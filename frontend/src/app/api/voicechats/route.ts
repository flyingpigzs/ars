// When displaying conversations on the sidebar, traverse the folder [public/data/chatHistory] to find all chats
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET() {
  const dirPath = path.join(process.cwd(), 'public/data/audioChatHistory');
  try {
    const files = await fs.readdir(dirPath);
    const chats = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
        const json = JSON.parse(content);
        const id = file.replace('.json', '');
        chats.push({ id, title: json.title || `Chat ${id}` });
      }
    }

    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load chat files' }, { status: 500 });
  }
}
