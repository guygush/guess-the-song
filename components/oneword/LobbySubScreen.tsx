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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-4">

        {/* Room code card */}
        <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-5 text-center flex-shrink-0">
          <p className="text-xs text-white/40 font-semibold tracking-widest uppercase mb-2">קוד חדר</p>
          <p className="text-4xl font-black tracking-widest text-[#FFDA57]" dir="ltr">{roomId}</p>
          <p className="text-white/30 text-xs mt-2">שתף עם החברים</p>
        </div>

        {/* Players list */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/40 font-semibold tracking-widest uppercase">משתתפים ({activePlayers.length})</p>
          {activePlayers.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-[#FFDA57] flex-shrink-0" />
              <span className="font-semibold text-sm flex-1">{p.name}</span>
              {p.is_organizer && <span className="text-xs text-white/30">מנהל</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pt-3 pb-safe flex-shrink-0">
        {isOrganizer ? (
          <>
            {error && <p className="text-center text-[#FF4757] text-sm mb-3">{error}</p>}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-lg active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center"
            >
              {loading
                ? <div className="w-6 h-6 border-[2.5px] border-[#0C0C0C]/20 border-t-[#0C0C0C] rounded-full animate-spin" />
                : 'התחל משחק'}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className="w-4 h-4 border-2 border-[#FFDA57]/20 border-t-[#FFDA57] rounded-full animate-spin" />
            <p className="text-white/50 text-sm">ממתין למנהל...</p>
          </div>
        )}
      </div>
    </div>
  );
}
