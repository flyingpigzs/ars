import os
import json
import uuid
import time
from typing import List, Dict, Any, Union, Tuple, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
import openai
from pathlib import Path
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

load_dotenv()
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY environment variable must be set")

CHAT_HISTORY_DIR = "./data/chatHistory"
JSON_TREES_DIR = "../excel/json"

try:
    with open("./prompts.json", "r", encoding="utf-8") as f:
        prompts = json.load(f)
except FileNotFoundError:
    logger.error("prompts.json file not found")
    raise
except json.JSONDecodeError as e:
    logger.error(f"Invalid JSON in prompts.json: {e}")
    raise

# 定义初始问题
INITIAL_QUESTION = {
    "questionId": "initial_question",
    "questionText": {"FI": "Hei! Olen Anna. Autan sinua oireiden kartoittamisessa. Kuvaile, missä sinulla on oireita tai mikä vaivaa?"},
    "type": "open_text",
    "answers": []
}

class ChatHistory(BaseModel):
    session_id: str
    stack: List[str] = []
    chatHistory: List[Dict[str, Any]] = []
    current_question_id: Optional[str] = None
    selected_tree: Optional[str] = None  # 记录选择的问题树文件名
    temp_next_q_id: Optional[str] = None
    temp_inferred_answer: Optional[str] = None
    retry_counts: Dict[str, int] = {}

class InstanceResponse(BaseModel):
    session_id: str
    question: str
    answer: str
    status: str

class InstanceRequest(BaseModel):
    session_id: str
    user_answer: str

class Question(BaseModel):
    questionId: str
    questionText: Dict[str, str]
    category: Dict[str, Any]
    type: str
    answers: List

Question.model_rebuild()

# 全局问题映射，动态更新
question_map = {}

def load_question_tree(tree_filename: str) -> Dict[str, Question]:
    file_path = os.path.join(JSON_TREES_DIR, tree_filename)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            file_contents = json.load(f)
            question_tree = {}
            for q in file_contents:
                question = Question(**q)
                question_tree[question.questionId] = question
            return question_tree
    except FileNotFoundError:
        logger.error(f"Question tree file not found at {file_path}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in question tree file {file_path}: {e}")
        raise

def build_question_map(question_tree: Dict[str, Question]) -> Dict[str, Question]:
    question_map = {}
    def build_helper(question_id: str, question: Question) -> None:
        if question_id not in question_map:
            question_map[question_id] = question
        for answer in question.answers or []:
            for sub_question in answer.get("question", []):
                sub_q_id = sub_question["questionId"]
                if sub_q_id not in question_map:
                    sub_q_obj = Question(**sub_question)
                    question_map[sub_q_id] = sub_q_obj
                build_helper(sub_q_id, sub_q_obj)
    for q_id, q in question_tree.items():
        build_helper(q_id, q)
    return question_map

question_map = build_question_map(load_question_tree("VATSAOIREET.json"))

def load_chat_history(session_id: str) -> Optional[ChatHistory]:
    filename = os.path.join(CHAT_HISTORY_DIR, f"{session_id}.json")
    try:
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as file:
                data = json.load(file)
                return ChatHistory(**data)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode chat history for session {session_id}: {e}")
    return None

def save_chat_history(chat_history: ChatHistory) -> None:
    filename = os.path.join(CHAT_HISTORY_DIR, f"{chat_history.session_id}.json")
    os.makedirs(CHAT_HISTORY_DIR, exist_ok=True)
    try:
        with open(filename, "w", encoding="utf-8") as file:
            json.dump(chat_history.model_dump(), file, indent=4)
    except IOError as e:
        logger.error(f"Failed to save chat history for session {chat_history.session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save chat history")

def select_question_tree(user_answer: str, available_trees: List[str]) -> Tuple[Optional[str], str]:
    prompt = prompts["select_tree"]
    system_message = prompt["system"]
    user_message = prompt["user"].format(
        user_answer=user_answer,
        tree_names=", ".join(available_trees)
    )
    try:
        response = openai.chat.completions.create(
            model="gpt-4.1-2025-04-14",  # 使用实际可用模型
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "select_tree_response",
                    "schema": prompt["response_schema"],
                    "strict": True
                }
            },
            temperature=0.0,
            max_tokens=200
        )
        result = json.loads(response.choices[0].message.content)
        logger.info(f"Selected tree: {result['selected_tree']}, Explanation: {result['explanation']}")
        return result["selected_tree"], result["explanation"]
    except Exception as e:
        logger.error(f"Error selecting question tree: {e}")
        return None, f"Error selecting tree: {e}"

def infer_answer(chat_history: ChatHistory, next_question: Question) -> Tuple[Optional[str], Optional[str]]:
    options = [answer["answerText"] for answer in next_question.answers]
    options_str = "\n".join([f"- {answer['answerId']}: {text}" for text, answer in zip(options, next_question.answers)])

    infer_prompt = prompts["infer_answer"]
    system_message = infer_prompt["system"]
    user_message = infer_prompt["user"].format(
        next_question_text=next_question.questionText["FI"],
        options=options_str
    )
    response_schema = infer_prompt["response_schema"]
    history = chat_history.chatHistory
    message_history = []
    for entry in history:
        message_history.append({
            "role": "assistant",
            "content": f"{entry['question_text']}"
        })
        message_history.append({
            "role": "user",
            "content": f"{entry['user_answer']}"
        })
        
    logger.info(f"Message history for session {chat_history.session_id}: {message_history}")
    try:
        response = openai.chat.completions.create(
            model="gpt-4.1-2025-04-14",
            messages=[
                {"role": "system", "content": system_message},
                *message_history,
                {"role": "user", "content": user_message},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "infer_answer_response",
                    "schema": response_schema,
                    "strict": True
                }
            },
            temperature=0.0,
            max_tokens=500
        )
        result = json.loads(response.choices[0].message.content)
        logger.info(f"Inferred answer: {result}")
        return (result["inferred_answer_text"], result["inferred_answer_id"]) if result["answer_found"] else (None, None)
    except Exception as e:
        logger.error(f"Error in infer_answer for session {chat_history.session_id}: {e}")
        return None, None

def get_summary(conversation_history: List[Dict[str, Any]]) -> str:
    summary_prompt = prompts["get_summary"]
    system_message = summary_prompt["system"]
    user_message = summary_prompt["user"].format(
        conversation_history="\n".join([f"{entry['question_text']}: {entry['user_answer']}" for entry in conversation_history])
    )
    try:
        response = openai.chat.completions.create(
            model="gpt-4.1-2025-04-14",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.0,
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error summarizing conversation: {e}")
        return "Error summarizing conversation"

def process_valinta_answer(question: Question, user_answer: str) -> Tuple[str, List[Dict], Optional[str]]:
    valid_answers = {answer["answerId"]: answer for answer in question.answers}
    descriptions = [answer["answerText"]["FI"] for answer in question.answers]
    options_str = ", ".join([f"{desc}: {aid}" for desc, aid in zip(descriptions, valid_answers.keys())])

    map_prompt = prompts["map_answer"]
    system_message = map_prompt["system"]
    user_message = map_prompt["user"].format(
        question_text=question.questionText["FI"],
        user_answer=user_answer,
        options=options_str
    )
    response_schema = map_prompt["response_schema"]

    try:
        response = openai.chat.completions.create(
            model="gpt-4.1-2025-04-14",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "map_answer_response",
                    "schema": response_schema,
                    "strict": True
                }
            },
            temperature=0.0,
            max_tokens=150
        )
        result = json.loads(response.choices[0].message.content)
        answer_id = result["answer_id"]

        if not answer_id or answer_id not in valid_answers:
            return "", [], None

        answer = valid_answers[answer_id]
        formatted_text = answer["answerText"]["FI"].replace("__", user_answer)
        return formatted_text, answer.get("question", []), answer_id

    except Exception as e:
        logger.error(f"Error processing valinta answer: {e}")
        return "", [], None

def process_ligert_answer(question: Question, user_answer: str) -> Tuple[str, List[Dict], Optional[str]]:
    valid_answers = {
        str(i): {"answerId": str(i), "answerText": {"FI": desc}}
        for i, desc in {
            "1": "Erittäin lievä kipu",
            "2": "Hyvin lievä kipu",
            "3": "Lievä kipu",
            "4": "Epämiellyttävä kipu",
            "5": "Kohtalainen kipu",
            "6": "Häiritsevä kipu",
            "7": "Kova kipu",
            "8": "Erittäin kova kipu",
            "9": "Sietämätön kipu",
            "10": "Erittäin sietämätön kipu",
            "-1": "käyttäjä ei vastannut selkeästi / yhden kirjaimen vastaus",
        }.items()
    }
    options_str = ", ".join([f"{v['answerText']['FI']}: {k}" for k, v in valid_answers.items()])

    map_prompt = prompts["map_answer"]
    system_message = map_prompt["system"]
    user_message = map_prompt["user"].format(
        question_text=question.questionText["FI"],
        user_answer=user_answer,
        options=options_str
    )
    response_schema = map_prompt["response_schema"]

    try:
        response = openai.chat.completions.create(
            model="gpt-4.1-2025-04-14",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "map_answer_response",
                    "schema": response_schema,
                    "strict": True
                }
            },
            temperature=0.0,
            max_tokens=150
        )
        result = json.loads(response.choices[0].message.content)
        answer_id = result["answer_id"]

        if not answer_id or answer_id not in valid_answers:
            logger.warning(f"Invalid answer_id: {answer_id} for ligert question {question.questionId}")
            return "", [], None

        answer = valid_answers[answer_id]
        formatted_text = answer["answerText"]["FI"].replace("__", user_answer)
        return formatted_text, answer.get("question", []), answer_id

    except Exception as e:
        logger.error(f"Error processing ligert answer: {e}")
        return "", [], None

def process_answer(question: Question, user_answer: str) -> Tuple[str, List[Dict], Optional[str]]:
    processors = {
        "valinta": process_valinta_answer,
        "ligert": process_ligert_answer,
    }
    processor = processors.get(question.type)
    print(f"Processing question type: {question.type} with user answer: {user_answer}")
    if not processor:
        raise ValueError(f"Unsupported question type: {question.type}")
    return processor(question, user_answer)

@app.get("/new-chat", response_model=InstanceResponse)
async def new_chat() -> InstanceResponse:
    session_id = str(uuid.uuid4())
    chat_history = ChatHistory(
        session_id=session_id,
        stack=[],
        chatHistory=[],
        current_question_id="initial_question",
        selected_tree=None
    )
    question_text = INITIAL_QUESTION["questionText"]["FI"]
    status = "ongoing"
    save_chat_history(chat_history)
    logger.info(f"New chat session started: {session_id}")
    return InstanceResponse(
        session_id=session_id,
        question=question_text,
        answer="",
        status=status
    )

def create_new_chat(session_id: str) -> InstanceResponse:
    chat_history = ChatHistory(
        session_id=session_id,
        stack=[],
        chatHistory=[],
        current_question_id="initial_question",
        selected_tree=None
    )
    question_text = INITIAL_QUESTION["questionText"]["FI"]
    status = "ongoing"
    save_chat_history(chat_history)
    logger.info(f"New chat session started: {session_id}, question_text: {question_text}")
    return InstanceResponse(
        session_id=session_id,
        question=question_text,
        answer="",
        status=status
    )

@app.get("/get-conversation-history/{session_id}", response_model=ChatHistory)
async def get_conversation_history(session_id: str) -> ChatHistory:
    chat_history = load_chat_history(session_id)
    if not chat_history:
        raise HTTPException(status_code=404, detail="Session not found")
    return chat_history

@app.get("/get-json-tree/{name}")
def get_json_tree(name: str):
    file_path = Path(os.path.join(JSON_TREES_DIR, f"{name}.json"))
    if not file_path.exists():
        return JSONResponse(content={"error": "File not found"}, status_code=404)
    with file_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@app.get("/get-json-tree-names", response_model=List[str])
def get_json_tree_names():
    json_folder = Path(JSON_TREES_DIR)
    if not json_folder.exists():
        return []
    return [f.stem for f in json_folder.glob("*.json")]

@app.post("/handle-answer", response_model=InstanceResponse)
async def handle_answer(request: InstanceRequest) -> InstanceResponse:
    chat_history = load_chat_history(request.session_id)
    if not chat_history:
        return create_new_chat(request.session_id)

    if not hasattr(chat_history, 'retry_counts'):
        chat_history.retry_counts = {}

    user_answer = request.user_answer.strip()
    
    # 处理初始问题
    if chat_history.current_question_id == "initial_question":
        available_trees = get_json_tree_names()
        if not available_trees:
            raise HTTPException(status_code=500, detail="No question trees available")
        
        selected_tree, explanation = select_question_tree(user_answer, available_trees)
        selected_tree = "VATSAOIREET"
        logger.info(f"Selected tree: {selected_tree}, Explanation: {explanation}")
        if not selected_tree or selected_tree not in available_trees:
            raise HTTPException(status_code=500, detail="Failed to select a valid question tree")
        
        question_tree = load_question_tree(f"{selected_tree}.json")
        #question_map.update(build_question_map(question_tree))
        
        chat_history.selected_tree = selected_tree
        chat_history.stack = list(question_tree.keys())[::-1]
        chat_history.chatHistory.append({
            "question_id": "initial_question",
            "question_text": INITIAL_QUESTION["questionText"]["FI"],
            "user_answer": user_answer,
            "chosen_answer": f"Selected tree: {selected_tree}",
            "answer_id": None,
            "timestamp": str(time.time()),
            "inferred": False,
            "re_ask": False,
            "skipped": False
        })
        
        if chat_history.stack:
            chat_history.current_question_id = chat_history.stack.pop()
            question_text = question_map[chat_history.current_question_id].questionText["FI"]
            status = "ongoing"
        else:
            chat_history.current_question_id = None
            question_text = "No questions available in selected tree"
            status = "complete"
        
        save_chat_history(chat_history)
        return InstanceResponse(
            session_id=request.session_id,
            question=question_text,
            answer="",
            status=status
        )
    
    # 处理后续问题
    if not chat_history.current_question_id:
        return InstanceResponse(
            session_id=request.session_id,
            question="Conversation complete",
            answer="",
            status="complete"
        )
    
    current_qid = chat_history.current_question_id
    current_question = question_map[current_qid]
    
    if current_question.type == "ligert":
        formatted_text, sub_qs, answer_id = process_ligert_answer(current_question, user_answer)
        if answer_id == "-1":
            retries = chat_history.retry_counts.get(current_qid, 0)
            if retries < 99:
                chat_history.retry_counts[current_qid] = retries + 1
                chat_history.chatHistory.append({
                    "question_id": current_qid,
                    "question_text": current_question.questionText["FI"],
                    "user_answer": None,
                    "chosen_answer": None,
                    "answer_id": None,
                    "timestamp": str(time.time()),
                    "inferred": False,
                    "re_ask": True,
                    "skipped": False
                })
                save_chat_history(chat_history)
                return InstanceResponse(
                    session_id=request.session_id,
                    question=current_question.questionText["FI"],
                    answer="",
                    status="ongoing"
                )
        chat_history.chatHistory.append({
            "question_id": current_qid,
            "question_text": current_question.questionText["FI"],
            "user_answer": f"User said: {user_answer}, we determined that to mean ligert scale number {answer_id}",
            "chosen_answer": formatted_text,
            "answer_id": answer_id,
            "timestamp": str(time.time()),
            "inferred": False,
            "re_ask": False,
            "skipped": False
        })
        chat_history.retry_counts.pop(current_qid, None)
        chat_history.stack.extend(q["questionId"] for q in sub_qs[::-1])
    
    # 2b) Other types: use mapping + retry
    else:
        formatted_text, sub_qs, answer_id = process_valinta_answer(current_question, user_answer)
        logger.info(f"Processed answer for question {current_qid}: {formatted_text}, sub questions: {sub_qs}, answer_id: {answer_id}")
        if answer_id is None:
            retries = chat_history.retry_counts.get(current_qid, 0)
            if retries < 99:
                chat_history.retry_counts[current_qid] = retries + 1
                chat_history.chatHistory.append({
                    "question_id": current_qid,
                    "question_text": current_question.questionText["FI"],
                    "user_answer": None,
                    "chosen_answer": None,
                    "answer_id": None,
                    "timestamp": str(time.time()),
                    "inferred": False,
                    "re_ask": True,
                    "skipped": False
                })
                save_chat_history(chat_history)
                return InstanceResponse(
                    session_id=request.session_id,
                    question=current_question.questionText["FI"],
                    answer="",
                    status="ongoing"
                )
            else:
                chat_history.retry_counts.pop(current_qid, None)
                chat_history.chatHistory.append({
                    "question_id": current_qid,
                    "question_text": current_question.questionText["FI"],
                    "user_answer": None,
                    "chosen_answer": None,
                    "answer_id": None,
                    "timestamp": str(time.time()),
                    "inferred": False,
                    "re_ask": False,
                    "skipped": True
                })
        else:
            chat_history.chatHistory.append({
                "question_id": current_qid,
                "question_text": current_question.questionText["FI"],
                "user_answer": user_answer,
                "chosen_answer": formatted_text,
                "answer_id": answer_id,
                "timestamp": str(time.time()),
                "inferred": False,
                "re_ask": False,
                "skipped": False
            })
            chat_history.stack.extend(q["questionId"] for q in sub_qs[::-1])
    
    if chat_history.stack:
        next_qid = chat_history.stack.pop()
        chat_history.current_question_id = next_qid
        question_text = question_map[next_qid].questionText["FI"]
        status = "ongoing"
    else:
        chat_history.current_question_id = None
        question_text = get_summary(chat_history.chatHistory)
        chat_history.chatHistory.append({
            "question_id": "summary",
            "question_text": question_text,
            "user_answer": "",
            "chosen_answer": "",
            "answer_id": None,
            "timestamp": str(time.time()),
            "inferred": False,
            "re_ask": False,
            "skipped": False
        })
        status = "complete"
    
    save_chat_history(chat_history)
    return InstanceResponse(
        session_id=request.session_id,
        question=question_text,
        answer=formatted_text if 'formatted_text' in locals() else "",
        status=status
    )

if __name__ == "__main__":
    uvicorn.run("endpoint_new:app", host="0.0.0.0", port=8000, reload=True)