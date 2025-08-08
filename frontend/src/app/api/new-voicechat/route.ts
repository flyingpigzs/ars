// src/app/api/new-voicechat/route.ts
// when creating a new voice chat, the user will be redirected to the chat page with the new chat ID, and the chat history will be saved in a JSON file in the [public/data/chatHistory] folder

import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(req: NextRequest) {
  try {
    const apiResponse = await fetch('http://localhost:8000/new-chat')
    if (!apiResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch from API' }, { status: 500 })
    }

    const { session_id, question } = await apiResponse.json()

    if (!session_id || !question) {
      return NextResponse.json({ error: 'Invalid API response' }, { status: 500 })
    }

    const assistantQuestion = {
      role: 'assistant',
      content: question,
    }

    const newChat = {
      title: "",
      session_id,
      messages: [assistantQuestion],
    }

    const filePath = join(process.cwd(), 'public/data/audioChatHistory', `${session_id}.json`)
    await writeFile(filePath, JSON.stringify(newChat, null, 2))

    return NextResponse.json({ id: session_id })
  } catch (error) {
    console.error('Error creating new chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
