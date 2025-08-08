import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

function getCurrentTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { session_id, role, audio_path, time ,content} = body;

    const filePath = path.join(process.cwd(), 'public/data/audioChatHistory', `${session_id}.json`);
    let chatData;

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      chatData = JSON.parse(fileContent);
    } catch (err) {
      chatData = {
        title: "chat_" + session_id,
        session_id: session_id,
        messages: [],
      };
    }

    const newMessage = {
      role,
      audio_path,
      content,
      time: time || getCurrentTimestamp(),
    };

    chatData.messages.push(newMessage);
    await fs.writeFile(filePath, JSON.stringify(chatData, null, 2));

    return NextResponse.json({ success: true, message: 'Chat history updated successfully.' });
  } catch (error) {
    console.error('Error updating chat history:', error);
    return NextResponse.json({ success: false, error: 'Failed to update chat history.' }, { status: 500 });
  }
}
