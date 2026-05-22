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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    if (activePlayers.length < 3) {
      setError(`צריך לפחות ${3 - activePlayers.length} שחקנים נוספים`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await startGame(roomId);
      onStart();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-6 flex flex-col gap-6">
        <div className="bg-gray-900 rounded-2xl p-5 text-center">
          <p className="text-gray-300 text-sm mb-1">קוד חדר</p>
          <p className="text-4xl font-bold tracking-widest text-indigo-400">{roomId}</p>
          <p className="text-gray-400 text-xs mt-2">שתף עם החברים</p>
        </div>

        <div>
          <p className="text-sm text-gray-300 mb-3">משתתפים ({activePlayers.length})</p>
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
      </div>

      <div className="px-6 pt-3 pb-safe">
        {isOrganizer ? (
          <>
            {error && <p className="text-center text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading
                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'התחל משחק'}
            </button>
          </>
        ) : (
          <p className="text-center text-gray-300">ממתין למנהל המשחק להתחיל...</p>
        )}
      </div>
    </div>
  );
}
