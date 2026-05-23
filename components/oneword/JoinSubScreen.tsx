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

      {/* Name input */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-white/40 font-semibold tracking-widest uppercase">השם שלך</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="הכנס שם..."
          disabled={busy}
          className="w-full bg-[#141414] border border-white/[0.08] rounded-xl px-4 py-3 text-base text-white outline-none focus:border-[#FFDA57]/50 placeholder-white/20 disabled:opacity-50 transition-colors"
        />
      </div>

      {/* Join divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-xs text-white/30">הצטרף לחדר קיים</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
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
          className="flex-1 min-w-0 bg-[#141414] border border-white/[0.08] rounded-xl px-4 py-3 text-base text-center tracking-widest font-bold text-white outline-none focus:border-[#FFDA57]/50 placeholder-white/20 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleJoin}
          disabled={busy}
          className="shrink-0 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/80 font-bold transition-colors disabled:opacity-50 flex items-center justify-center active:bg-white/[0.10]"
        >
          {loading === 'join'
            ? <div className="w-5 h-5 border-[2.5px] border-white/20 border-t-white rounded-full animate-spin" />
            : 'הצטרף'}
        </button>
      </div>

      {/* Or divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-xs text-white/30">או</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Create */}
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-lg active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center"
      >
        {loading === 'create'
          ? <div className="w-6 h-6 border-[2.5px] border-[#0C0C0C]/20 border-t-[#0C0C0C] rounded-full animate-spin" />
          : 'צור חדר'}
      </button>

      {error && <p className="text-[#FF4757] text-center text-sm">{error}</p>}
    </div>
  );
}
