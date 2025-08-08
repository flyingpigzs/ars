import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { audio_path } = body;

    if (!audio_path) {
      return NextResponse.json({ success: false, error: 'audio_path is required' }, { status: 400 });
    }

    const cleanedPath = audio_path.replace(/^\/+/, '');
    const fullAudioPath = path.join(process.cwd(), 'public', cleanedPath);

    const fileStream = fs.createReadStream(fullAudioPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'json',
    });

    return NextResponse.json({ success: true, text: transcription.text });
  } catch (error) {
    console.error('Error in transcribe-audio:', error);
    return NextResponse.json({ success: false, error: 'Failed to transcribe audio.' }, { status: 500 });
  }
}