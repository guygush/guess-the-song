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
          <div className="text-5xl">🏆</div>
          <div className="candy-card rounded-3xl p-6 w-full text-center" style={{ boxShadow: '0 4px 0 #c4a882' }}>
            <p className="text-xs text-brown-light font-bold tracking-widest uppercase mb-2">ניקוד סופי</p>
            <p className="text-5xl font-black text-brown" dir="ltr"
              style={{ textShadow: '0 2px 0 #c4a882' }}>{room.total_score}</p>
            <p className="text-brown-light text-sm mt-2">מתוך {totalTurns} תורים</p>
          </div>
          {room.end_reason && (
            <p className="text-brown-light text-sm text-center">{room.end_reason}</p>
          )}
        </div>
        <div className="px-5 pt-3 pb-safe flex-shrink-0">
          <button
            onClick={onBackToHub}
            className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow"
            style={{ color: '#5c3511' }}
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
        <div className="candy-card rounded-3xl p-5 text-center flex-shrink-0"
          style={guess.is_correct
            ? { background: 'rgba(255,219,44,0.12)', borderColor: '#b8860b', boxShadow: '0 4px 0 #c4a882' }
            : { background: 'rgba(192,57,43,0.06)', borderColor: 'rgba(192,57,43,0.3)', boxShadow: '0 4px 0 rgba(192,57,43,0.2)' }
          }
        >
          <p className="text-3xl mb-2">{guess.is_correct ? '✓' : '✗'}</p>
          <p className="text-xs text-brown-light font-bold tracking-widest uppercase mb-2">המילה הייתה</p>
          <p className="text-2xl font-black text-brown">{room.current_word}</p>
          <p className="text-brown-light text-sm mt-2">
            הניחוש: <span className="font-bold text-brown">{guess.guess}</span>
          </p>
        </div>

        {/* Score card */}
        <div className="candy-card rounded-3xl p-4 text-center flex-shrink-0" style={{ boxShadow: '0 4px 0 #c4a882' }}>
          <p className="text-xs text-brown-light font-bold tracking-widest uppercase mb-1">ניקוד</p>
          <p className="text-4xl font-black text-brown" dir="ltr"
            style={{ textShadow: '0 2px 0 #c4a882' }}>{room.total_score}</p>
          <p className="text-brown-light text-xs mt-1">מתוך {totalTurns} תורים</p>
        </div>
      </div>

      <div className="px-5 pt-3 pb-safe flex-shrink-0 flex flex-col gap-3">
        {isOrganizer ? (
          <>
            <button
              onClick={handleNext}
              disabled={busy}
              className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
              style={{ color: '#5c3511' }}
            >
              {loading === 'next'
                ? <div className="w-7 h-7 candy-spinner" />
                : 'תור הבא'}
            </button>
            <button
              onClick={handleEnd}
              disabled={busy}
              className="w-full py-4 rounded-[2.5rem] font-bold text-lg candy-btn-secondary disabled:opacity-50 flex items-center justify-center"
            >
              {loading === 'end'
                ? <div className="w-6 h-6 candy-spinner" />
                : 'סיים משחק'}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 candy-spinner-yellow" />
            <p className="text-brown text-sm">ממתין לתור הבא...</p>
          </div>
        )}
      </div>
    </div>
  );
}
