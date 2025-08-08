'use client';

import { useEffect, useState, useRef } from 'react';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';

type Props = {
  session_id: string;
};

interface Message {
  role: 'user' | 'assistant';
  audio_path: string;
  content: string;
  time?: string; // Optional, if you want to include timestamps
}

interface ChatData {
  title: string;
  session_id: string;
  messages: Message[];
}

export default function VoiceChatWindow({ session_id }: Props) {
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [audioFileToSend, setAudioFileToSend] = useState<File | null>(null);
  const [fileNameToDisplay, setFileNameToDisplay] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null); // To manage the microphone stream

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // If currently recording, stop it before setting the new file
      if (isRecording) {
        stopRecording(); // This will also set isRecording to false
      }
      setAudioFileToSend(file);
      setFileNameToDisplay(file.name);
    } else {
      // Only clear if not actively recording or about to record
      // If isRecording is true, it means a recording is in progress or just finished,
      // so we shouldn't clear its associated file/filename yet.
      if (!isRecording) {
        setAudioFileToSend(null);
        setFileNameToDisplay(null);
      }
    }
  };

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    // Ensure any previous stream or recorder is stopped
    cleanupStream();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];


    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Clear previous file selection when starting a new recording
      setAudioFileToSend(null);
      setFileNameToDisplay('Recording...');
      setIsRecording(true); // Set recording state immediately

      const options = { mimeType: 'audio/webm' }; // Default
      if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        options.mimeType = 'audio/mpeg';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        const fileExtension = options.mimeType.split('/')[1] || 'bin';
        const recordingFileName = `recording.${fileExtension}`;
        const recordedFile = new File([audioBlob], recordingFileName, {
          type: options.mimeType,
          lastModified: Date.now(),
        });

        setAudioFileToSend(recordedFile);
        setFileNameToDisplay(recordingFileName); // Update display name with the actual recording name
        // isRecording state is typically set to false by the function that called stop()

        audioChunksRef.current = []; // Clear chunks for next recording
        cleanupStream(); // Release microphone
      };

      mediaRecorderRef.current.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      setFileNameToDisplay(null); // Reset display name on error
      setIsRecording(false); // Ensure recording state is reset
      cleanupStream(); // Cleanup stream if error occurred
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger 'onstop' which handles stream cleanup
    } else {
      // If for some reason recording wasn't active but stream exists
      cleanupStream();
    }
    setIsRecording(false); // Set recording state to false
    // fileNameToDisplay will be updated in onstop if recording was successful
    // If stopRecording is called and there was no actual data (e.g. very short click),
    // onstop might still set a (possibly empty) file.
    // If onstop doesn't set fileNameToDisplay (e.g. error or no data), it might remain "Recording..."
    // So, consider resetting fileNameToDisplay here if no file is produced by onstop.
    // For now, assuming onstop will always try to set audioFileToSend and fileNameToDisplay.
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = async () => {
    if (!audioFileToSend || !chatData) {
      console.log("No audio file to send or chatData not loaded.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioFileToSend, audioFileToSend.name);
      formData.append('session_id', session_id);
      formData.append('message_count', chatData.messages.length.toString());
// 1. upload the audio file
      const fileInputElement = document.getElementById('upload-audio') as HTMLInputElement;
      if (fileInputElement) {
        fileInputElement.value = ''; // Reset file input
      }

      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
//2. upload successful, get the audio path and content        
        const data = await res.json(); // Expected: { path: string, content?: string }
        const audioPath = data.path;
//3. call the api to transcribe the audio to text
        const transcribeRes = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_path: audioPath }),
        });
        if (!transcribeRes.ok) {
          console.error('Transcription API call failed:', await transcribeRes.text());
          // Handle transcription error (e.g., show message in chat)
          return;
        }
        const { text } = await transcribeRes.json();
        const user_answer = text;
        console.log('Transcription result:', text);
        const tsRes = await fetch('/api/get-timestamp');
        const tsData = await tsRes.json();
        const timestamp = tsData.timestamp;
        console.log('->Timestamp:', timestamp);
        await fetch('/api/update-audiochat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id,
            role: 'user',
            audio_path: audioPath,
            content: user_answer,
            time: timestamp,
          }),
        });

        setAudioFileToSend(null);
        setFileNameToDisplay(null);

        const updated = await fetch(`/data/audioChatHistory/${session_id}.json`);
        if (updated.ok) {
          const updatedData = await updated.json();
          setChatData(updatedData);
        } else {
          console.error('Failed to fetch updated chat history after send');
        }
        // call the backend model to get the assistant response
        try {
          console.log('Calling assistant API with user answer:', user_answer,session_id);
          const assistantApiRes = await fetch(`/api/ask-assistant`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_answer, session_id }), // Send user's message content
          });

          if (!assistantApiRes.ok) {
            console.error('Assistant API call failed:', await assistantApiRes.text());
            // Handle assistant error (e.g., show message in chat)
            return;
          }
    
          const assistantReply: Message = await assistantApiRes.json(); // Assuming API returns a complete Message object

          // Get a new timestamp for the assistant's message
          const assistantTsRes = await fetch('/api/get-timestamp');
          const assistantTsData = await assistantTsRes.json();
          const assistantTimestamp = assistantTsData.timestamp;

          // Update backend with the assistant's reply
          // Assuming /api/update-audiochat appends a single message
          await fetch(`/api/update-audiochat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id, // Use 'session_id' consistently
              role: 'assistant',
              audio_path: assistantReply.audio_path, // If assistant can send audio
              content: assistantReply.content,
              time: assistantTimestamp,
            }),
          });

          // Option 2: Fetch the absolute latest chat history again (safest, but one more network request)
          const finalChatRes = await fetch(`/data/audioChatHistory/${session_id}.json`);
          if (finalChatRes.ok) {
            const finalChatData = await finalChatRes.json();
            setChatData(finalChatData);
          } else {
            console.error('Failed to fetch updated chat history after assistant reply');
          }  
        } catch (error) {
          console.error("Error sending/receiving message:", error);
        }
      } else {
        console.error('Failed to upload file', await res.text());
      }


    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const isSendEnabled = !!audioFileToSend;

  useEffect(() => {
    async function fetchChat() {
      try {
        const res = await fetch(`/data/audioChatHistory/${session_id}.json`);
        if (res.ok) {
          const data = await res.json();
          setChatData(data);
        } else {
          if (res.status === 404) {
            console.log(`Chat history for ${session_id} not found. Initializing.`);
            const initialChatData: ChatData = {
              title: `Chat with ${session_id}`,
              session_id: session_id,
              messages: [],
            };
            setChatData(initialChatData);
          } else {
            console.error('Failed to load chat history:', res.statusText);
          }
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
    }

    if (session_id) {
      fetchChat();
    }

    return () => {
      // Cleanup recorder and stream on component unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop(); // This will trigger onstop for data processing and stream cleanup
      }
      cleanupStream(); // Ensure any residual stream is closed
    };
  }, [session_id]);

  // Determine the text for the upload/file display area
  let currentFileDisplay = 'Choose file';
  if (isRecording) {
    currentFileDisplay = 'Recording...';
  } else if (fileNameToDisplay) {
    currentFileDisplay = fileNameToDisplay;
  }


  return (
    <div className="flex flex-col h-full p-4 max-w-3xl mx-auto">
      <div className="flex-[5] overflow-y-auto space-y-4 mb-4">
        {chatData ? (
          chatData.messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-xs p-3 rounded-lg ${
                    msg.role === 'user' ? 'bg-white text-right dark:bg-gray-700 dark:text-white ' : 'text-left bg-gray-100 dark:bg-gray-800 dark:text-white '
                  }`}
                >
                  {msg.content || (msg.role === 'assistant' ? 'Assistant response' : 'User audio')}
                </div>
                {msg.audio_path && (
                  <audio controls className="w-64">
                    <source
                        src={`${msg.audio_path}`}
                        type={
                            msg.audio_path.endsWith('.mp3') ? "audio/mpeg" :
                            msg.audio_path.endsWith('.webm') ? "audio/webm" :
                            msg.audio_path.endsWith('.mp4') ? "audio/mp4" :
                            msg.audio_path.endsWith('.ogg') ? "audio/ogg" :
                            "audio/wav" /* Fallback or default */
                        } />
                    Your browser does not support the audio element.
                  </audio>
                )}
              </div>
            </div>
          ))
        ) : (
          <div>
            <p>session: {session_id}</p>
            <p>Loading chat...</p>
          </div>
        )}
      </div>

      <div className="flex-[1] flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-4 sm:gap-8 w-full justify-center flex-wrap">
          <label htmlFor="upload-audio" className="cursor-pointer flex items-center gap-1 text-gray-700 hover:text-black">
            <UploadFileIcon />
            <span className="truncate max-w-[150px] sm:max-w-[200px]">{currentFileDisplay}</span>
          </label>
          <input
            id="upload-audio"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
            onClick={(event) => { (event.target as HTMLInputElement).value = '' }}
          />

          <button
            onClick={handleRecordToggle}
            className="flex items-center gap-1 text-gray-700 hover:text-black p-2 rounded-md hover:bg-gray-100"
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <MicIcon style={{ color: isRecording ? 'red' : 'inherit' }} />
            <span>{isRecording ? 'Stop' : 'Record'}</span>
          </button>

          <button
            onClick={handleSend}
            disabled={!isSendEnabled}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg ${
              isSendEnabled ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <SendIcon />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}