# ARS

This repository is the production-ready version of ARS, migrated from a previous internal repository.

## Getting Started

### 1. Clone the Repository
```
git clone https://github.com/neuvo-ai/ars.git
cd ars
git checkout release/v1.0.0
```
### 2. Backend
```
cd backend 
pip install -r requirements.txt 
export OPENAI_API_KEY=sk-proj-....  
python3 endpoint.py 
python3 endpoint_new.py
```
1. endpoint: Starting from the first question in the problem tree, "Onko sinulla kipua vatsan alueella?"
2. endpoint_new: There is a greeting, based on the user's answer to ask questions
### 3. Frontend
```
cd frontend
mkdir -p public/data/audioChatHistory public/data/audioFile public/data/chatHistory
npm install 
npm run dev
```
### 4. Google Realtime 
```
cd google-realtime 
touch .env 
echo "REACT_APP_GEMINI_API_KEY='AI...'" > .env 
npm install 
npm run start
```
