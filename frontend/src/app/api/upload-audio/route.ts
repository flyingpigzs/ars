import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('audio') as File;
  const sessionId = formData.get('session_id')?.toString() || 'unknown';
  const messageCount = formData.get('message_count')?.toString() || '0';

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const extension = file.name.split('.').pop() || 'mp3';
  const fileName = `${sessionId}_user_${messageCount}.${extension}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const audioDir = path.join(process.cwd(), 'public', 'data', 'audioFile');
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true });
  }

  const filePath = path.join(audioDir, fileName);
  await writeFile(filePath, buffer);

  return NextResponse.json({ success: true, path: `/data/audioFile/${fileName}` });
}
