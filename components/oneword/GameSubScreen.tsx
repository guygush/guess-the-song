'use client';

import { useState } from 'react';
import { sendHint, sendGuess } from '@/lib/oneword-rooms';
import type { Room, Player, Hint } from '@/lib/oneword-rooms';

interface Props {
  room: Room;
  myPlayerId: string;
  players: Player[];
  hints: Hint[];
  isOrganizer: boolean;
  rejectedHintIds: string[];
  hintsApproved: boolean;
  onBroadcast: (event: string, payload: Record<string, unknown>) => void;
}

export default function GameSubScreen({ room, myPlayerId, players, hints, isOrganizer, rejectedHintIds, hintsApproved, onBroadcast }: Props) {
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

  // If organizer is the guesser, skip approval — auto-approve
  const effectiveHintsApproved = (isOrganizer && amGuesser) ? allHintsSent : hintsApproved;

  async function handleSendHint() {
    if (!hintInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const hint = await sendHint(room.id, room.current_turn, myPlayerId, hintInput.trim());
      onBroadcast('hint_sent', { hint });
      setHintInput('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendGuess() {
    if (!guessInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { guess, updatedRoom } = await sendGuess(room, guessInput.trim());
      onBroadcast('guess_made', { guess, room: updatedRoom });
      setGuessInput('');
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggleReject(hintId: string) {
    onBroadcast('hint_rejected', { hintId });
  }

  function handleApprove() {
    onBroadcast('hints_approved', {});
  }

  if (!room.guesser_order.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Guesser view ──────────────────────────────────────────────────────
  if (amGuesser) {
    const visibleHints = hints.filter(h => !rejectedHintIds.includes(h.id));

    return (
      <div className="flex-1 flex flex-col px-6 pt-6 gap-6">
        <div className="bg-gray-900 rounded-2xl p-5 text-center">
          <p className="text-gray-400 text-sm mb-1">התור שלך לנחש</p>
          <p className="text-2xl font-bold text-indigo-400">?</p>
        </div>

        {!effectiveHintsApproved ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            {!allHintsSent ? (
              <>
                <p className="text-gray-400">מחכה לרמזים...</p>
                <p className="text-gray-600 text-sm">{hints.length} מתוך {activeHinters.length} רמזים התקבלו</p>
              </>
            ) : (
              <p className="text-gray-400">ממתין לאישור המנהל...</p>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <p className="text-gray-400 text-sm">הרמזים שקיבלת:</p>
            <div className="flex flex-wrap gap-2">
              {visibleHints.map(h => (
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

  // ── Hinter view ───────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col px-6 pt-6 gap-6">
      <div className="bg-gray-900 rounded-2xl p-5 text-center">
        <p className="text-gray-400 text-sm mb-1">המילה לתאר</p>
        <p className="text-3xl font-bold">{room.current_word}</p>
        <p className="text-gray-500 text-xs mt-2">{guesser?.name} מנסה לנחש</p>
      </div>

      {/* Hint input — shown to all hinters until they submit */}
      {!myHint && (
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
      )}

      {/* Organizer sees all hints with rejection toggles */}
      {isOrganizer && hints.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-gray-400 text-sm">
            רמזים שהתקבלו ({hints.length}/{activeHinters.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {hints.map(h => {
              const sender = players.find(p => p.id === h.player_id);
              const rejected = rejectedHintIds.includes(h.id);
              return (
                <div
                  key={h.id}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 transition-colors ${rejected ? 'bg-red-950 opacity-60' : 'bg-gray-800'}`}
                >
                  <div className="text-center">
                    <p className={`font-semibold ${rejected ? 'line-through text-gray-500' : ''}`}>{h.word}</p>
                    <p className="text-xs text-gray-500">{sender?.name}</p>
                  </div>
                  <button
                    onClick={() => handleToggleReject(h.id)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${rejected ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-gray-600 hover:bg-red-700 text-gray-300 hover:text-white'}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          {allHintsSent && !hintsApproved && (
            <button
              onClick={handleApprove}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-lg transition-colors mt-2"
            >
              אשר רמזים ושלח לניחוש
            </button>
          )}
          {hintsApproved && (
            <p className="text-center text-emerald-400 text-sm">רמזים אושרו ✓</p>
          )}
        </div>
      )}

      {/* Non-organizer hinters: show count after submitting */}
      {!isOrganizer && myHint && (
        <p className="text-center text-gray-400 text-sm">
          {allHintsSent
            ? hintsApproved ? 'המנהל אישר את הרמזים' : 'ממתין לאישור המנהל...'
            : `${hints.length} מתוך ${activeHinters.length} רמזים נשלחו`}
        </p>
      )}

      {/* Non-organizer hinters: show count before submitting */}
      {!isOrganizer && !myHint && hints.length > 0 && (
        <p className="text-center text-gray-400 text-sm">
          {hints.length} מתוך {activeHinters.length} רמזים נשלחו
        </p>
      )}
    </div>
  );
}
