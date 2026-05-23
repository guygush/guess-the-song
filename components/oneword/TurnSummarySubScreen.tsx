'use client';

import { useState } from 'react';
import { nextTurn, endGame } from '@/lib/oneword-rooms';
import type { Room, Player, Guess } from '@/lib/oneword-rooms';

interface Props {
  room: Room;
  isOrganizer: boolean;
  players: Player[];
  guess: Guess;
  totalTurns: number;
  onNextTurn: () => void;
  onEndGame: () => void;
  onBackToHub: () => void;
  onBroadcast: (event: string, payload: Record<string, unknown>) => void;
}

export default function TurnSummarySubScreen({ room, isOrganizer, players, guess, totalTurns, onNextTurn, onEndGame, onBackToHub, onBroadcast }: Props) {
  const [loading, setLoading] = useState<'next' | 'end' | null>(null);

  async function handleNext() {
    setLoading('next');
    try {
      const updatedRoom = await nextTurn(room, players);
      onBroadcast('next_turn', { room: updatedRoom });
      onNextTurn();
    } finally {
      setLoading(null);
    }
  }

  async function handleEnd() {
    setLoading('end');
    try {
      await endGame(room.id);
      onBroadcast('game_ended', { room: { ...room, status: 'ended' } });
      onEndGame();
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  if (room.status === 'ended') {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
          <div className="text-4xl">🏆</div>
          <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-6 w-full text-center">
            <p className="text-xs text-white/40 font-semibold tracking-widest uppercase mb-2">ניקוד סופי</p>
            <p className="text-5xl font-black text-[#FFDA57]" dir="ltr">{room.total_score}</p>
            <p className="text-white/30 text-sm mt-2">מתוך {totalTurns} תורים</p>
          </div>
          {room.end_reason && (
            <p className="text-white/40 text-sm text-center">{room.end_reason}</p>
          )}
        </div>
        <div className="px-5 pt-3 pb-safe flex-shrink-0">
          <button
            onClick={onBackToHub}
            className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-lg active:opacity-80 transition-opacity"
          >
            בחזרה למסך הראשי
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col px-5 pt-4 gap-4 min-h-0 overflow-y-auto">

        {/* Result card */}
        <div className={`rounded-2xl p-5 text-center border flex-shrink-0 ${
          guess.is_correct
            ? 'bg-[#FFDA57]/10 border-[#FFDA57]/25'
            : 'bg-[#FF4757]/10 border-[#FF4757]/20'
        }`}>
          <p className="text-3xl mb-2">{guess.is_correct ? '✓' : '✗'}</p>
          <p className="text-xs text-white/40 font-semibold tracking-widest uppercase mb-2">המילה הייתה</p>
          <p className={`text-2xl font-black ${guess.is_correct ? 'text-[#FFDA57]' : 'text-white'}`}>{room.current_word}</p>
          <p className="text-white/40 text-sm mt-2">הניחוש: <span className="text-white font-bold">{guess.guess}</span></p>
        </div>

        {/* Score card */}
        <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-4 text-center flex-shrink-0">
          <p className="text-xs text-white/40 font-semibold tracking-widest uppercase mb-1">ניקוד</p>
          <p className="text-4xl font-black text-[#FFDA57]" dir="ltr">{room.total_score}</p>
          <p className="text-white/30 text-xs mt-1">מתוך {totalTurns} תורים</p>
        </div>
      </div>

      <div className="px-5 pt-3 pb-safe flex-shrink-0 flex flex-col gap-3">
        {isOrganizer ? (
          <>
            <button
              onClick={handleNext}
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-lg active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center"
            >
              {loading === 'next'
                ? <div className="w-6 h-6 border-[2.5px] border-[#0C0C0C]/20 border-t-[#0C0C0C] rounded-full animate-spin" />
                : 'תור הבא'}
            </button>
            <button
              onClick={handleEnd}
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white/70 font-semibold transition-colors disabled:opacity-50 active:bg-white/[0.10] flex items-center justify-center"
            >
              {loading === 'end'
                ? <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                : 'סיים משחק'}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className="w-4 h-4 border-2 border-[#FFDA57]/20 border-t-[#FFDA57] rounded-full animate-spin" />
            <p className="text-white/50 text-sm">ממתין לתור הבא...</p>
          </div>
        )}
      </div>
    </div>
  );
}
