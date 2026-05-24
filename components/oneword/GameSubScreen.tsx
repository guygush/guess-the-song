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
    <div className={`relative overflow-hidden rounded-2xl px-3 py-2.5 text-center min-w-[72px] candy-card transition-all ${
      rejected ? '' : ''
    }`}
      style={rejected
        ? { background: 'rgba(192,57,43,0.06)', borderColor: 'rgba(192,57,43,0.3)', boxShadow: '0 3px 0 rgba(192,57,43,0.2)' }
        : { boxShadow: '0 3px 0 #c4a882' }
      }
    >
      <p className={`font-bold text-sm text-brown ${rejected ? 'opacity-30' : ''}`}>{hint.word}</p>
      {senderName && <p className="text-xs text-brown-light mt-0.5">{senderName}</p>}
      {rejected && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100%" y2="100%" stroke="#c0392b" strokeWidth="1.5" opacity="0.4" />
          </svg>
        </div>
      )}
      {showRejectButton && (
        <button
          onClick={onToggleReject}
          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors"
          style={rejected
            ? { background: 'rgba(192,57,43,0.3)', color: '#c0392b' }
            : { background: '#f4e6d4', border: '1px solid #dcc9ad', color: '#8b5e34' }
          }
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
  const [hintError, setHintError] = useState('');
  const [guessError, setGuessError] = useState('');

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
    if (submitting) return;
    if (!hintInput.trim()) { setHintError('נא להזין רמז'); return; }
    setSubmitting(true);
    setHintError('');
    try {
      const hint = await sendHint(room.id, room.current_turn, myPlayerId, hintInput.trim());
      onBroadcast('hint_sent', { hint });
      setHintInput('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendGuess() {
    if (submitting) return;
    if (!guessInput.trim()) { setGuessError('נא להזין ניחוש'); return; }
    setSubmitting(true);
    setGuessError('');
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
        <div className="w-10 h-10 candy-spinner-yellow" />
      </div>
    );
  }

  // ── Guesser view ──
  if (amGuesser) {
    const visibleHints = hints.filter(h => !rejectedHintIds.includes(h.id));
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-4">

          <div className="candy-card rounded-3xl p-5 text-center flex-shrink-0"
            style={{ boxShadow: '0 4px 0 #c4a882' }}
          >
            <p className="text-xs text-brown-light font-bold tracking-widest uppercase mb-2">התור שלך לנחש</p>
            <div className="text-4xl font-black text-brown" style={{ opacity: 0.2 }}>?</div>
          </div>

          {!effectiveHintsApproved ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
              <div className="w-10 h-10 candy-spinner-yellow" />
              {!allHintsSent ? (
                <>
                  <p className="text-brown text-sm font-semibold">מחכה לרמזים...</p>
                  <p className="text-brown-light text-xs">{hints.length} מתוך {activeHinters.length} רמזים התקבלו</p>
                </>
              ) : (
                <p className="text-brown text-sm font-semibold">ממתין לאישור המנהל...</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-brown-light font-bold tracking-widest uppercase">הרמזים שלך</p>
              <div className="flex flex-wrap gap-2">
                {visibleHints.map(h => (
                  <span key={h.id} className="px-4 py-2 rounded-2xl font-bold text-base glossy-btn btn-candy-yellow" style={{ color: '#5c3511' }}>
                    {h.word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {effectiveHintsApproved && (
          <div className="px-5 pt-3 pb-safe flex-shrink-0">
            {guessError && <p className="candy-error mb-2">{guessError}</p>}
            <div className="flex gap-2">
              <input
                value={guessInput}
                onChange={e => { setGuessInput(e.target.value); setGuessError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSendGuess()}
                placeholder="הניחוש שלך..."
                disabled={submitting}
                className="candy-input flex-1 min-w-0"
                style={{ borderRadius: '0.875rem' }}
              />
              <button
                onClick={handleSendGuess}
                disabled={submitting}
                className="shrink-0 px-5 rounded-2xl font-bold glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
                style={{ color: '#5c3511' }}
              >
                {submitting ? <div className="w-5 h-5 candy-spinner" /> : 'שלח'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Hinter view ──
  const showHints = !!myHint;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-4">

        {/* Word card */}
        <div className="candy-card rounded-3xl p-5 text-center flex-shrink-0"
          style={{ background: 'rgba(255,219,44,0.1)', borderColor: '#b8860b', boxShadow: '0 4px 0 #c4a882' }}
        >
          <p className="text-xs text-brown-light font-bold tracking-widest uppercase mb-2">המילה לתאר</p>
          <p className="text-3xl font-black text-brown">{room.current_word}</p>
          <p className="text-brown-light text-xs mt-2">{guesser?.name} מנסה לנחש</p>
        </div>

        {/* Hint input */}
        {!myHint && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {hintError && <p className="candy-error">{hintError}</p>}
            <div className="flex gap-2">
              <input
                value={hintInput}
                onChange={e => { setHintInput(e.target.value); setHintError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSendHint()}
                placeholder="רמז במילה אחת..."
                disabled={submitting}
                className="candy-input flex-1 min-w-0"
                style={{ borderRadius: '0.875rem' }}
              />
              <button
                onClick={handleSendHint}
                disabled={submitting}
                className="shrink-0 px-5 rounded-2xl font-bold glossy-btn btn-candy-yellow disabled:opacity-50 flex items-center justify-center"
                style={{ color: '#5c3511' }}
              >
                {submitting ? <div className="w-5 h-5 candy-spinner" /> : 'שלח'}
              </button>
            </div>
          </div>
        )}

        {/* Hints grid */}
        {showHints && hints.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-brown-light font-bold tracking-widest uppercase">
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

        {!showHints && hints.length > 0 && (
          <p className="text-center text-brown-light text-sm flex-shrink-0">
            {hints.length} מתוך {activeHinters.length} רמזים נשלחו
          </p>
        )}

        {showHints && allHintsSent && !hintsApproved && !effectiveIsOrganizer && (
          <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0">
            <div className="w-5 h-5 candy-spinner-yellow" />
            <p className="text-brown text-sm">ממתין לאישור המנהל...</p>
          </div>
        )}
        {showHints && hintsApproved && (
          <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0">
            <div className="w-5 h-5 candy-spinner-yellow" />
            <p className="text-brown text-sm">ממתין לניחוש של {guesser?.name}...</p>
          </div>
        )}
      </div>

      {effectiveIsOrganizer && allHintsSent && !hintsApproved && (
        <div className="px-5 pt-3 pb-safe flex-shrink-0">
          <button
            onClick={() => onBroadcast('hints_approved', {})}
            className="w-full py-5 rounded-[2.5rem] font-bold text-xl glossy-btn btn-candy-yellow"
            style={{ color: '#5c3511' }}
          >
            אשר רמזים ושלח לניחוש
          </button>
        </div>
      )}
    </div>
  );
}
