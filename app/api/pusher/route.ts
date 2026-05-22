import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';

export async function POST(req: Request) {
  const { channel, event, payload, socketId } = await req.json();
  await pusherServer.trigger(channel, event, payload ?? {}, socketId ? { socket_id: socketId } : undefined);
  return NextResponse.json({ ok: true });
}
