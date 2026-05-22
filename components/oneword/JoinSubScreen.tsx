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
    if (!trimmedName) return;
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
    if (!trimmedName || !roomCode.trim()) return;
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
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col justify-center px-6 pb-safe gap-6">
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-2">השם שלך</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="הכנס שם..."
          disabled={busy}
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 disabled:opacity-50"
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={!trimmedName || busy}
        className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading === 'create'
          ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : 'צור חדר'}
      </button>

      <div className="flex items-center gap-3 text-gray-600">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-sm">או</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      <div className="flex gap-2">
        <input
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          placeholder="קוד חדר"
          maxLength={4}
          disabled={busy}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-lg text-center tracking-widest font-bold outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 disabled:opacity-50"
        />
        <button
          onClick={handleJoin}
          disabled={!trimmedName || !roomCode.trim() || busy}
          className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading === 'join'
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'הצטרף'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center text-sm">{error}</p>}
    </div>
  );
}
