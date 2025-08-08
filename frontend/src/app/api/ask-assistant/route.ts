// src/app/api/ask-assistant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Message } from "@/types/message";

export async function POST(req: NextRequest) {
  try {
    const { session_id, user_answer } = await req.json();

    if (!session_id || !user_answer) {
      return NextResponse.json(
        { error: "Missing session_id or user_answer" },
        { status: 400 }
      );
    }

    // Call backend API
    const apiResponse = await fetch("http://localhost:8000/handle-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, user_answer }),
    });

    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get response from backend API" },
        { status: 500 }
      );
    }

    const { question, answer } = await apiResponse.json();

    const userMessage: Message = {
      role: "user",
      content: user_answer,
    };

    const assistantMessage: Message = {
      role: "assistant",
      content: question ,
    };

    return NextResponse.json(assistantMessage);
  } catch (error) {
    console.error("Error handling assistant reply:", error);
    return NextResponse.json(
      { error: "Failed to handle assistant reply" },
      { status: 500 }
    );
  }
}
