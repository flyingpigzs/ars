'use client';

import { useState } from 'react';

export default function TranscribeTestPage() {
  const [transcribedText, setTranscribedText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUploadAndTranscribe = async () => {
    setLoading(true);
  
    try {
      const transcribeRes = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: 'data/audioFile/400d28b0-1dd9-4165-a162-bd39c83b47e8_assistant_2.mp3',
        }),
      });
  
      const data = await transcribeRes.json();
      setTranscribedText(data.text || '未识别任何内容');
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscribedText('出现错误');
    }
  
    setLoading(false);
  };
  

  return (
    <div style={{ padding: '2rem' }}>
      <h1>🎤 测试语音转文字</h1>
      <button
        onClick={handleUploadAndTranscribe}
      >
        {loading ? '转写中...' : '上传并转写'}
      </button>

      <div style={{ marginTop: '2rem' }}>
        <h2>📝 识别结果：</h2>
        <p>{transcribedText}</p>
      </div>
    </div>
  );
}
