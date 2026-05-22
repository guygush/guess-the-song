import PusherJs from 'pusher-js';

let instance: PusherJs | null = null;

export function getPusher(): PusherJs {
  if (!instance) {
    instance = new PusherJs(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return instance;
}

export async function publish(channel: string, event: string, payload: unknown): Promise<void> {
  const socketId = getPusher().connection.socket_id;
  await fetch('/api/pusher', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel, event, payload, socketId }),
  });
}
