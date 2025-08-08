// app/api/get-timestamp/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const timestamp = `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
  return NextResponse.json({ timestamp });
}
