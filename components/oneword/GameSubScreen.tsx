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

interface HintCardProps {
  hint: Hint;
  senderName?: string;
  rejected: boolean;
  showRejectButton: boolean;
  onToggleReject: () => void;
}

function HintCard({ hint, senderName, rejected, showRejectButton, onToggleReject }: HintCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl px-4 py-2 text-center min-w-[80px] transition-colors ${rejected ? 'bg-red-950' : 'bg-gray-800'}`}>
      <p className={`font-semibold ${rejected ? 'text-gray-500' : ''}`}>{hint.word}</p>
      {senderName && <p className="text-xs text-gray-500">{senderName}</p>}
      {rejected && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgb(239 68 68)" strokeWidth="2" />
          </svg>
        </div>
      )}
      {showRejectButton && (
        <button
          onClick={onToggleReject}
          className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${rejected ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-gray-600 hover:bg-red-700 text-gray-300 hover:text-white'}`}
        >
          ✕
        </button>
      )}
    </div>
  );
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

  const organizerIsGuesser = guesserId === room.organizer_id;
  const alternateModerator = organizerIsGuesser
    ? room.guesser_order.find(id => id !== room.organizer_id && activePlayers.some(p => p.id === id)) ?? null
    : null;
  const isAlternateModerator = myPlayerId === alternateModerator;
  const effectiveIsOrganizer = isOrganizer || isAlternateModerator;

  const effectiveHintsApproved = (isOrganizer && amGuesser && !alternateModerator) ? allHintsSent : hintsApproved;

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

  function handleToggleReject(hint: Hint) {
    const rejected = !rejectedHintIds.includes(hint.id);
    onBroadcast('hint_rejected', { hintId: hint.id, rejected });
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
      <div className="flex-1 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-6 flex flex-col gap-6">
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
            <>
              <p className="text-gray-400 text-sm">הרמזים שקיבלת:</p>
              <div className="flex flex-wrap gap-2">
                {visibleHints.map(h => (
                  <span key={h.id} className="bg-indigo-900 text-indigo-200 px-4 py-2 rounded-xl font-semibold text-lg">
                    {h.word}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {effectiveHintsApproved && (
          <div className="px-6 pt-3 pb-safe">
            <div className="flex gap-2">
              <input
                value={guessInput}
                onChange={e => setGuessInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendGuess()}
                placeholder="הניחוש שלך..."
                disabled={submitting}
                className="flex-1 min-w-0 bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendGuess}
                disabled={!guessInput.trim() || submitting}
                className="shrink-0 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors disabled:opacity-40"
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
  const showHints = !!myHint;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 flex flex-col gap-6">
        <div className="bg-gray-900 rounded-2xl p-5 text-center">
          <p className="text-gray-400 text-sm mb-1">המילה לתאר</p>
          <p className="text-3xl font-bold">{room.current_word}</p>
          <p className="text-gray-500 text-xs mt-2">{guesser?.name} מנסה לנחש</p>
        </div>

        {/* Hint input — shown until submitted */}
        {!myHint && (
          <div className="flex gap-2">
            <input
              value={hintInput}
              onChange={e => setHintInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendHint()}
              placeholder="רמז במילה אחת..."
              disabled={submitting}
              className="flex-1 min-w-0 bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendHint}
              disabled={!hintInput.trim() || submitting}
              className="shrink-0 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-colors disabled:opacity-40"
            >
              {submitting ? '...' : 'שלח'}
            </button>
          </div>
        )}

        {/* Hints grid */}
        {showHints && hints.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-gray-400 text-sm">
              רמזים שהתקבלו ({hints.length}/{activeHinters.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {hints.map(h => {
                const sender = players.find(p => p.id === h.player_id);
                return (
                  <HintCard
                    key={h.id}
                    hint={h}
                    senderName={sender?.name}
                    rejected={rejectedHintIds.includes(h.id)}
                    showRejectButton={effectiveIsOrganizer}
                    onToggleReject={() => handleToggleReject(h)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Count for hinters before submitting */}
        {!showHints && hints.length > 0 && (
          <p className="text-center text-gray-400 text-sm">
            {hints.length} מתוך {activeHinters.length} רמזים נשלחו
          </p>
        )}

        {/* Status lines */}
        {showHints && allHintsSent && !hintsApproved && !effectiveIsOrganizer && (
          <p className="text-center text-gray-400 text-sm">ממתין לאישור המנהל...</p>
        )}
        {showHints && hintsApproved && (
          <p className="text-center text-emerald-400 text-sm">רמזים אושרו ✓</p>
        )}
      </div>

      {/* Approve button — pinned at bottom for effective organizer */}
      {effectiveIsOrganizer && allHintsSent && !hintsApproved && (
        <div className="px-6 pt-3 pb-safe">
          <button
            onClick={() => onBroadcast('hints_approved', {})}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-lg transition-colors"
          >
            אשר רמזים ושלח לניחוש
          </button>
        </div>
      )}
    </div>
  );
}
