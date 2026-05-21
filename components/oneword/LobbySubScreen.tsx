'use client';

import { useState } from 'react';
import { startGame } from '@/lib/oneword-rooms';
import type { Player } from '@/lib/oneword-rooms';

interface Props {
  roomId: string;
  isOrganizer: boolean;
  players: Player[];
  onStart: () => void;
}

export default function LobbySubScreen({ roomId, isOrganizer, players, onStart }: Props) {
  const activePlayers = players.filter(p => p.is_active);
  const canStart = isOrganizer && activePlayers.length >= 3;
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await startGame(roomId);
      onStart();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-6 gap-6">
      <div className="bg-gray-900 rounded-2xl p-5 text-center">
        <p className="text-gray-400 text-sm mb-1">קוד חדר</p>
        <p className="text-4xl font-bold tracking-widest text-indigo-400">{roomId}</p>
        <p className="text-gray-500 text-xs mt-2">שתף עם החברים</p>
      </div>

      <div>
        <p className="text-sm text-gray-400 mb-3">משתתפים ({activePlayers.length})</p>
        <div className="flex flex-col gap-2">
          {activePlayers.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-semibold">{p.name}</span>
              {p.is_organizer && <span className="text-xs text-gray-400 mr-auto">מנהל המשחק</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pb-4">
        {isOrganizer ? (
          <>
            {activePlayers.length < 3 && (
              <p className="text-center text-gray-400 text-sm mb-3">
                ממתין לעוד {3 - activePlayers.length} שחקנים לפחות...
              </p>
            )}
            <button
              onClick={handleStart}
              disabled={!canStart || loading}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading
                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'התחל משחק'}
            </button>
          </>
        ) : (
          <p className="text-center text-gray-400">ממתין למנהל המשחק להתחיל...</p>
        )}
      </div>
    </div>
  );
}
