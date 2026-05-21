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
  onBroadcast: (event: string) => void;
}

export default function TurnSummarySubScreen({ room, isOrganizer, players, guess, totalTurns, onNextTurn, onEndGame, onBackToHub, onBroadcast }: Props) {
  const [loading, setLoading] = useState<'next' | 'end' | null>(null);

  async function handleNext() {
    setLoading('next');
    try {
      await nextTurn(room, players);
      onBroadcast('next_turn');
      onNextTurn();
    } finally {
      setLoading(null);
    }
  }

  async function handleEnd() {
    setLoading('end');
    try {
      await endGame(room.id);
      onEndGame();
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  if (room.status === 'ended') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <p className="text-2xl font-bold text-center">המשחק נגמר!</p>
        <div className="bg-gray-900 rounded-2xl p-6 w-full text-center">
          <p className="text-gray-400 text-sm mb-1">ניקוד סופי</p>
          <p className="text-5xl font-bold text-indigo-400">{room.total_score}</p>
          <p className="text-gray-400 text-sm mt-1">מתוך {totalTurns} תורים</p>
        </div>
        {room.end_reason && (
          <p className="text-gray-400 text-sm text-center">{room.end_reason}</p>
        )}
        <button
          onClick={onBackToHub}
          className="w-full py-4 rounded-2xl bg-gray-700 hover:bg-gray-600 font-bold text-lg transition-colors"
        >
          בחזרה למסך הראשי
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-6 gap-5">
      <div className={`rounded-2xl p-5 text-center ${guess.is_correct ? 'bg-emerald-900/50' : 'bg-red-900/30'}`}>
        <p className="text-4xl mb-2">{guess.is_correct ? '✓' : '✗'}</p>
        <p className="text-gray-400 text-sm">המילה הייתה</p>
        <p className="text-2xl font-bold">{room.current_word}</p>
        <p className="text-gray-400 text-sm mt-2">הניחוש: <span className="text-white font-semibold">{guess.guess}</span></p>
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 text-center">
        <p className="text-gray-400 text-sm">ניקוד</p>
        <p className="text-4xl font-bold text-indigo-400">{room.total_score}</p>
        <p className="text-gray-500 text-sm">מתוך {totalTurns} תורים</p>
      </div>

      <div className="mt-auto pb-4 flex flex-col gap-3">
        {isOrganizer ? (
          <>
            <button
              onClick={handleNext}
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-bold text-lg transition-colors disabled:opacity-40 flex items-center justify-center"
            >
              {loading === 'next'
                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'תור הבא'}
            </button>
            <button
              onClick={handleEnd}
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 font-semibold transition-colors disabled:opacity-40 flex items-center justify-center"
            >
              {loading === 'end'
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'סיים משחק'}
            </button>
          </>
        ) : (
          <p className="text-center text-gray-400">ממתין לתור הבא...</p>
        )}
      </div>
    </div>
  );
}
