'use client';

import { useState } from 'react';
import { createRoom, joinRoom } from '@/lib/oneword-rooms';

interface Props {
  playerId: string;
  onJoined: (roomId: string, isOrganizer: boolean) => void;
}

export default function JoinSubScreen({ playerId, onJoined }: Props) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  const trimmedName = name.trim();

  async function handleCreate() {
    if (!trimmedName) { setError('נא להזין שם'); return; }
    setLoading('create');
    setError('');
    try {
      const room = await createRoom(playerId, trimmedName);
      onJoined(room.id, true);
    } catch {
      setError('שגיאה ביצירת חדר, נסה שוב');
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (!trimmedName) { setError('נא להזין שם'); return; }
    if (!roomCode.trim()) { setError('נא להזין קוד חדר'); return; }
    setLoading('join');
    setError('');
    try {
      await joinRoom(roomCode.trim().toUpperCase(), playerId, trimmedName);
      onJoined(roomCode.trim().toUpperCase(), false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בהצטרפות לחדר');
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="flex-1 flex flex-col justify-center px-5 pb-safe gap-5 min-h-0 overflow-hidden">

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-brown-light font-bold tracking-widest uppercase">השם שלך</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="הכנס שם..."
          disabled={busy}
          className="candy-input"
          style={{ borderRadius: '0.875rem' }}
        />
      </div>

      {/* Join divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: '#dcc9ad', opacity: 0.5 }} />
        <span className="text-xs text-brown-light">הצטרף לחדר קיים</span>
        <div className="flex-1 h-px" style={{ background: '#dcc9ad', opacity: 0.5 }} />
      </div>

      {/* Join row */}
      <div className="flex gap-2">
        <input
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          placeholder="קוד חדר"
          maxLength={4}
          dir="ltr"
          disabled={busy}
          className="candy-input flex-1 min-w-0 text-center tracking-widest font-bold"
          style={{ borderRadius: '0.875rem' }}
        />
        <button
          onClick={handleJoin}
          disabled={busy}
          className="shrink-0 px-5 py-3 rounded-2xl font-bold candy-btn-secondary disabled:opacity-50 flex items-center justify-center"
        >
          {loading === 'join'
            ? <div className="w-5 h-5 candy-spinner" />
            : 'הצטרף'}
        </button>
      </div>

      {/* Or divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: '#dcc9ad', opacity: 0.5 }} />
        <span className="text-xs text-brown-light">או</span>
        <div className="flex-1 h-px" style={{ background: '#dcc9ad', opacity: 0.5 }} />
      </div>

      {/* Create */}
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
        style={{ color: '#5c3511' }}
      >
        {loading === 'create'
          ? <div className="w-7 h-7 candy-spinner" />
          : 'צור חדר'}
      </button>

      {error && <p className="candy-error">{error}</p>}
    </div>
  );
}
