'use client';

import { useState } from 'react';
import { startGame } from '@/lib/oneword-rooms';
import type { Player } from '@/lib/oneword-rooms';

const PLAYER_COLORS = ['#5EB3F8', '#FF6B9D', '#3ECF8E', '#B69AF0', '#FF8C42', '#FFDA57'];

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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-4">

        {/* Room code card */}
        <div className="candy-card rounded-3xl p-5 text-center flex-shrink-0"
          style={{ background: 'rgba(255,219,44,0.12)', borderColor: '#b8860b', boxShadow: '0 4px 0 #c4a882' }}
        >
          <p className="text-xs text-brown-light font-bold tracking-widest uppercase mb-2">קוד חדר</p>
          <p className="text-4xl font-black tracking-widest text-brown" dir="ltr"
            style={{ textShadow: '0 2px 0 #c4a882' }}>{roomId}</p>
          <p className="text-brown-light text-xs mt-2">שתף עם החברים</p>
        </div>

        {/* Players list */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-brown-light font-bold tracking-widest uppercase">משתתפים ({activePlayers.length})</p>
          {activePlayers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 candy-card rounded-2xl px-4 py-3" style={{ boxShadow: '0 3px 0 #c4a882' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>
                {p.name.charAt(0)}
              </div>
              <span className="font-semibold text-sm flex-1 text-brown">{p.name}</span>
              {p.is_organizer && (
                <span className="text-xs text-brown-light px-2 py-0.5 rounded-full" style={{ background: '#f4e6d4', border: '1px solid #dcc9ad' }}>מנהל</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pt-3 pb-safe flex-shrink-0">
        {isOrganizer ? (
          <>
            {error && <p className="candy-error mb-3">{error}</p>}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
              style={{ color: '#5c3511' }}
            >
              {loading
                ? <div className="w-7 h-7 candy-spinner" />
                : 'התחל משחק'}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 candy-spinner-yellow" />
            <p className="text-brown-light text-sm">ממתין למנהל...</p>
          </div>
        )}
      </div>
    </div>
  );
}
