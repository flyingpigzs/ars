# app.py file 

from quart import Quart, websocket
from gemini_twilio import GeminiTwilio

app = Quart(__name__)

@app.websocket('/gemini')
async def talk_to_gemini():
    await GeminiTwilio().gemini_websocket() 

if __name__ == "__main__":
    app.run(host='localhost', port=8080)