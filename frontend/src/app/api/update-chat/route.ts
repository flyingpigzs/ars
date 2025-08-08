// this file is used to update the chat history
// when the user sends a new message, the chat history will be updated in the JSON file in the [public/data/chatHistory] folder
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { chatId, messages } = await req.json();
    const filePath = path.join(process.cwd(), 'public/data/chatHistory', `${chatId}.json`);

    let originalData: any = {};
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      originalData = JSON.parse(fileContent);
    }
    // Validate messages
    const updatedData = {
      ...originalData,
      messages,
    };

    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating chat:", error);
    return NextResponse.json({ error: "Failed to update chat" }, { status: 500 });
  }
}
