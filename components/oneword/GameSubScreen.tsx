'use client';

import { useState } from 'react';
import { sendHint, sendGuess } from '@/lib/oneword-rooms';
import type { Room, Player, Hint } from '@/lib/oneword-rooms';

interface Props {
  room: Room;
  myPlayerId: string;
  players: Player[];
  hints: Hint[];
  onBroadcast: (event: string) => void;
}

export default function GameSubScreen({ room, myPlayerId, players, hints, onBroadcast }: Props) {
  const [hintInput, setHintInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activePlayers = players.filter(p => p.is_active);
  const guesserId = room.guesser_order[room.current_turn % room.guesser_order.length];
  const amGuesser = myPlayerId === guesserId;
  const guesser = players.find(p => p.id === guesserId);

  const activeHinters = activePlayers.filter(p => p.id !== guesserId);
  const myHint = hints.find(h => h.player_id === myPlayerId);
  const allHintsSent = activeHinters.every(p => hints.some(h => h.player_id === p.id));

  async function handleSendHint() {
    if (!hintInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await sendHint(room.id, room.current_turn, myPlayerId, hintInput.trim());
      onBroadcast('hint_sent');
      setHintInput('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendGuess() {
    if (!guessInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await sendGuess(room, guessInput.trim());
      onBroadcast('guess_made');
      setGuessInput('');
    } finally {
      setSubmitting(false);
    }
  }

  // Room data not yet populated — wait for fresh fetch
  if (!room.guesser_order.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (amGuesser) {
    return (
      <div className="flex-1 flex flex-col px-6 pt-6 gap-6">
        <div className="bg-gray-900 rounded-2xl p-5 text-center">
          <p className="text-gray-400 text-sm mb-1">התור שלך לנחש</p>
          <p className="text-2xl font-bold text-indigo-400">?</p>
        </div>

        {!allHintsSent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">מחכה לרמזים...</p>
            <p className="text-gray-600 text-sm">
              {hints.length} מתוך {activeHinters.length} רמזים התקבלו
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <p className="text-gray-400 text-sm">הרמזים שקיבלת:</p>
            <div className="flex flex-wrap gap-2">
              {hints.map(h => (
                <span key={h.id} className="bg-indigo-900 text-indigo-200 px-4 py-2 rounded-xl font-semibold text-lg">
                  {h.word}
                </span>
              ))}
            </div>
            <div className="mt-auto flex gap-2">
              <input
                value={guessInput}
                onChange={e => setGuessInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendGuess()}
                placeholder="הניחוש שלך..."
                disabled={submitting}
                className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendGuess}
                disabled={!guessInput.trim() || submitting}
                className="px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors disabled:opacity-40"
              >
                {submitting ? '...' : 'שלח'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Hinter view
  return (
    <div className="flex-1 flex flex-col px-6 pt-6 gap-6">
      <div className="bg-gray-900 rounded-2xl p-5 text-center">
        <p className="text-gray-400 text-sm mb-1">המילה לתאר</p>
        <p className="text-3xl font-bold">{room.current_word}</p>
        <p className="text-gray-500 text-xs mt-2">{guesser?.name} מנסה לנחש</p>
      </div>

      {!myHint ? (
        <div className="flex gap-2">
          <input
            value={hintInput}
            onChange={e => setHintInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendHint()}
            placeholder="רמז במילה אחת..."
            disabled={submitting}
            className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendHint}
            disabled={!hintInput.trim() || submitting}
            className="px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-colors disabled:opacity-40"
          >
            {submitting ? '...' : 'שלח'}
          </button>
        </div>
      ) : null}

      {hints.length > 0 && (
        <div>
          <p className="text-gray-400 text-sm mb-2">
            רמזים שנשלחו ({hints.length}/{activeHinters.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {hints.map(h => {
              const sender = players.find(p => p.id === h.player_id);
              return (
                <div key={h.id} className="bg-gray-800 rounded-xl px-4 py-2 text-center">
                  <p className="font-semibold">{h.word}</p>
                  <p className="text-xs text-gray-500">{sender?.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {myHint && !allHintsSent && (
        <p className="text-center text-gray-400 text-sm">ממתין לשאר הרמזים...</p>
      )}
    </div>
  );
}
