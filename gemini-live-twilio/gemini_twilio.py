# gemini_twilio.py

from google import genai
from quart import websocket
import json
import base64
import audioop

class GeminiTwilio:
    def __init__(self):
        self.client = genai.Client()
        self.model_id = "gemini-2.0-flash-exp"
        self.config = {"response_modalities": ["AUDIO"]}
        self.stream_sid = None


    async def twilio_audio_stream(self):
        while True:
            message = await websocket.receive()
            data = json.loads(message)
            if data['event'] == 'start':
                self.stream_sid = data['start']['streamSid']
                print(f"Stream started - {self.stream_sid}")
            elif data['event'] == 'media': # Process incoming audio data: encoded in base64 and decoded to PCM
                audio_data = data['media']['payload'] 
                decoded_audio = base64.b64decode(audio_data) 
                pcm_audio = audioop.ulaw2lin(decoded_audio, 2) 
                yield pcm_audio
            elif data['event'] == 'stop':
                print("Stream stopped")


    def convert_audio_to_mulaw(self, audio_data: bytes) -> str:
        '''
        Converts audio bytes to mulaw and returns a base64 string
        Args:
            audio_data: (bytes) - the raw pcm audio data
        '''
        data, _ = audioop.ratecv(audio_data, 2, 1, 24000, 8000, None) # Convert from 24000 sample rate to 8000
        mulaw_audio = audioop.lin2ulaw(data, 2) # Convert to mulaw
        encoded_audio = base64.b64encode(mulaw_audio).decode('utf-8') # Convert to base64 encoded string
        return encoded_audio 


    async def gemini_websocket(self):
        '''
        Establishes a session (genai.types.AsyncSession) and starts a stream to process incoming audio and handle responses from Gemini
        '''
        print("New websocket connection established")
        async with self.client.aio.live.connect(model=self.model_id, config=self.config) as session:
            try:
                async for response in session.start_stream(stream=self.twilio_audio_stream(), mime_type='audio/pcm'):
                    if data := response.data:
                        message = {
                            "event": "media",
                            "streamSid": self.stream_sid,
                            "media": {
                                "payload": self.convert_audio_to_mulaw(data)
                            }
                        }
                        print(message)
                        await websocket.send(json.dumps(message))
            except Exception as e:
                print(f'Unexpected error in gemini_websocket: {e}')
            finally:
                print('Closing session')
                await websocket.close(code=200)
                await session.close()