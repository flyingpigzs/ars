import os
import json
import uuid
import time
import logging
from typing import List, Dict, Any, Union, Tuple, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
import openai
from typing import Dict, List, Tuple
from fastapi.middleware.cors import CORSMiddleware
import time
from pathlib import Path
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:3001"],

    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

load_dotenv()
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY environment variable must be set")

QUESTION_TREE_PATH = "../excel/json/VATSAOIREET.json"
CHAT_HISTORY_DIR = "./data/chatHistory"

try:
    with open("./prompts.json", "r", encoding="utf-8") as f:
        prompts = json.load(f)
except FileNotFoundError:
    logger.error("prompts.json file not found")
    raise
except json.JSONDecodeError as e:
    logger.error(f"Invalid JSON in prompts.json: {e}")
    raise

class ChatHistory(BaseModel):
    session_id: str
    stack: List[str]
    chatHistory: List[Dict[str, Any]]
    current_question_id: Union[str, None] = None
    temp_next_q_id: Union[str, None] = None
    temp_inferred_answer: Union[str, None] = None
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

question_tree = {}
try:
    with open(QUESTION_TREE_PATH, "r", encoding="utf-8") as f:
        file_contents = json.load(f)
        for q in file_contents:
            question = Question(**q)
            question_tree[question.questionId] = question
except FileNotFoundError:
    logger.error(f"Question tree file not found at {QUESTION_TREE_PATH}")
    raise
except json.JSONDecodeError as e:
    logger.error(f"Invalid JSON in question tree file: {e}")
    raise

def build_question_map(question_tree: Dict[str, Question]) -> Dict[str, Question]:
    question_map = {}
    def build_helper(question_id: str, question: Question) -> None:
        if question_id not in question_map:
            question_map[question_id] = question
        for answer in question.answers or []:
            for sub_question in answer["question"] or []:
                sub_q_id = sub_question["questionId"]
                if sub_q_id not in question_map:
                    sub_q_obj = Question(**sub_question)
                    question_map[sub_q_id] = sub_q_obj
                build_helper(sub_q_id, sub_q_obj)
    for q_id, q in question_tree.items():
        build_helper(q_id, q)
    return question_map

question_map = build_question_map(question_tree)

def load_chat_history(session_id: str) -> Union[ChatHistory, None]:
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

def infer_answer(chat_history: ChatHistory, next_question: Question) -> Union[str, None]:
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
    
def process_answer(question: Question, user_answer: str) -> Tuple[str, List[Dict]]:
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
    chat_history = ChatHistory(session_id=session_id, stack=list(question_tree.keys())[::-1], chatHistory=[])
    if chat_history.stack:
        chat_history.current_question_id = chat_history.stack.pop()
        question_text = f"Hei! Olen Arska. Autan sinua oireiden kartoittamisessa. \n {question_tree[chat_history.current_question_id].questionText['FI']}"
        status = "ongoing"
    else:
        question_text = "No questions available"
        status = "complete"
    save_chat_history(chat_history)
    logger.info(f"New chat session started: {session_id}")
    return InstanceResponse(session_id=session_id, question=question_text, answer="", status=status)

def create_new_chat(session_id: str) -> InstanceResponse:
    chat_history = ChatHistory(session_id=session_id, stack=list(question_tree.keys())[::-1], chatHistory=[])
    if chat_history.stack:
        chat_history.current_question_id = chat_history.stack.pop()
        question_text = f"{question_tree[chat_history.current_question_id].questionText['FI']}"
        status = "ongoing"
    else:
        question_text = "No questions available"
        status = "complete"
    save_chat_history(chat_history)
    logger.info(f"New chat session started: {session_id}, question_text: {question_text}")
    return InstanceResponse(session_id=session_id, question=question_text, answer="", status=status)

@app.get("/get-conversation-history/{session_id}", response_model=ChatHistory)
async def get_conversation_history(session_id: str) -> ChatHistory:
    chat_history = load_chat_history(session_id)
    if not chat_history:
        raise HTTPException(status_code=404, detail="Session not found")
    return chat_history

@app.get("/get-json-tree/{name}")
def get_json_tree(name: str):
    file_path = Path(f"../excel/json2/{name}.json")
    if not file_path.exists():
        return JSONResponse(content={"error": "File not found"}, status_code=404)
    with file_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@app.get("/get-json-tree-names", response_model=List[str])
def get_json_tree_names():
    json_folder = Path(__file__).parent / "../excel/json2"
    if not json_folder.exists():
        return []
    return [f.stem for f in json_folder.glob("*.json")]

@app.post("/get-schedule", response_model=InstanceResponse)
async def get_schedule(request: InstanceRequest) -> InstanceResponse:
    main_symptom = request.user_answer.strip()
    template_schedule = {
        "18.06.2025": {
                "Yleis Lääkäri": {
                    "free_slots": [
                        "09:00", "09:30", "10:00", "10:30", "11:00",
                        "11:30", "12:00", "12:30", "13:00", "13:30",
                        "14:00", "14:30", "15:00", "15:30"
                    ]},
                "Vatsa Lääkäri": {
                    "free_slots": [
                        "09:00", "09:30", "10:00", "10:30", "11:00",
                        "11:30", "12:00", "12:30", "13:00", "13:30",
                        "14:00", "14:30", "15:00", "15:30"
                    ]
                },
                "Kuume Lääkäri": {
                    "free_slots": [
                        "09:00", "09:30", "10:00", "10:30", "11:00",
                        "11:30", "12:00", "12:30", "13:00", "13:30",
                        "14:00", "14:30", "15:00", "15:30"
                    ]
                },
                "Gynekologi Lääkäri": {
                    "free_slots": [
                        "09:00", "09:30", "10:00", "10:30", "11:00",
                        "11:30", "12:00", "12:30", "13:00", "13:30",
                        "14:00", "14:30", "15:00", "15:30"
                    ]
            }
        },
        "All other dates": {
            "Yleis Lääkäri": {
                "free_slots": None
            },
            "Vatsa Lääkäri": {
                "free_slots": None
            },
            "Kuume Lääkäri": {
                "free_slots": None
            },
            "Gynekologi Lääkäri": {
                "free_slots": None
            }
        }
    }
    doctor_choices = {
        "Yleis Lääkäri": "Yleis Lääkäri",
        "Vatsa Lääkäri": "Vatsa Lääkäri",
        "Kuume Lääkäri": "Kuume Lääkäri",
        "Gynekologi Lääkäri": "Gynekologi Lääkäri"
    }
    openai_response = openai.chat.completions.create(
        model="gpt-4.1-2025-04-14",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that provides medical appointment scheduling."},
            {"role": "user", "content": f"Given the main symptom '{main_symptom}', suggest a doctor from the following choices: {', '.join(doctor_choices.keys())}. Only return the doctor's name as provided."}
        ],
        temperature=0.0,
        max_tokens=100,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "doctor_choice_response",
                "schema": {
                    "type": "object",
                    "properties": {
                        "doctor": {
                            "type": "string",
                            "enum": list(doctor_choices.keys())
                        }
                    },
                    "required": ["doctor"]
                },
                "strict": True
            }
        }
    )
    try:
        result = json.loads(openai_response.choices[0].message.content)
        doctor = result["doctor"]
        logger.info(f"Doctor chosen based on symptom '{main_symptom}': {doctor}")
        return InstanceResponse(
            session_id=request.session_id,
            question=f"Available schedule for {doctor}: {json.dumps(template_schedule, indent=2)}",
            answer="",
            status="ongoing"
        )
    except Exception as e:
        logger.error(f"Error processing doctor choice for symptom '{main_symptom}': {e}")
        raise HTTPException(status_code=500, detail="Failed to process doctor choice")
    
@app.post("/handle-answer", response_model=InstanceResponse)
async def handle_answer(request: InstanceRequest) -> InstanceResponse:
    chat_history = load_chat_history(request.session_id)
    if not chat_history:
        return create_new_chat(request.session_id)        
        
    # ensure retry map exists
    if not hasattr(chat_history, 'retry_counts'):
        chat_history.retry_counts = {}

    if not chat_history.current_question_id:
        return InstanceResponse(
            session_id=request.session_id,
            question="Conversation complete",
            answer="",
            status="complete"
        )
    current_qid = chat_history.current_question_id
    current_question = question_map[current_qid]
    user_ans = request.user_answer.strip()
    if current_question.type == "ligert":
        formatted_text, sub_qs, answer_id = process_ligert_answer(current_question, user_ans)
        if answer_id == "-1":
            # re ask user for ligert answer
            retries = chat_history.retry_counts.get(current_qid, 0)
            if retries < 99:
                #failure → re-ask and record re-ask
                chat_history.retry_counts[current_qid] = 1
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
            "user_answer": f"Users said: {user_ans}" + f",we determined that to mean ligert scale number{answer_id}",
            "chosen_answer": answer_id,
            "answer_id": answer_id,
            "timestamp": str(time.time()),
            "inferred": False
        })
        chat_history.retry_counts.pop(current_qid, None)
        chat_history.stack.extend(q["questionId"] for q in sub_qs[::-1])
    
    # 2b) Other types: use mapping + retry
    else:
        formatted_text, sub_qs, answer_id = process_valinta_answer(current_question, user_ans)
        logger.info(f"Processed answer for question {current_qid}: {formatted_text}, sub questions: {sub_qs}, answer_id: {answer_id}")
        if answer_id is None:
            retries = chat_history.retry_counts.get(current_qid, 0)
            if retries < 99:
                # first failure → re-ask and record re-ask
                chat_history.retry_counts[current_qid] = 1
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
                # second failure → skip and record skip
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
            # successful mapping
            chat_history.retry_counts.pop(current_qid, None)
            chat_history.chatHistory.append({
                "question_id": current_qid,
                "question_text": current_question.questionText["FI"],
                "user_answer": user_ans,
                "chosen_answer": formatted_text,
                "answer_id": answer_id,
                "timestamp": str(time.time()),
                "inferred": False
            })
            chat_history.stack.extend(q["questionId"] for q in sub_qs[::-1])
    # 3) Advance to next or summary
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
            "inferred": False
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
    uvicorn.run("endpoint:app", host="0.0.0.0", port=8000, reload=True)