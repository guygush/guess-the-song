import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';

export async function POST(req: Request) {
  const { channel, event, payload } = await req.json();
  await pusherServer.trigger(channel, event, payload ?? {});
  return NextResponse.json({ ok: true });
}
