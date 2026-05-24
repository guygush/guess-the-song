'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadYouTubeApi } from '@/lib/youtube';
import type { Song } from '@/lib/itunes';

interface Props {
  song: Song;
  videoId: string;
  onNextSong: (winner?: string) => void;
  onFinish?: (winner?: string) => void;
  onBack: () => void;
  hideMetadata?: boolean;
  groupPlayers?: string[];
  scores?: Record<string, number>;
}

const INCREMENTS = [1, 0.5, 0.25];
const DEFAULT_DURATION = 300;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function fmtReveal(sec: number) {
  const n = Number.isInteger(sec) ? `${sec}` : sec.toFixed(2).replace(/\.?0+$/, '');
  return `${n}s`;
}

export default function PlayScreen({ song, videoId, onNextSong, onFinish, onBack, hideMetadata, groupPlayers, scores }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrubbingRef = useRef(false);
  const revealedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [snippetKey, setSnippetKey] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [revealDuration, setRevealDuration] = useState(0.5);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [revealed, setRevealed] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    if (!hideMetadata || !('mediaSession' in navigator)) return;
    const proto = MediaSession.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'metadata');
    Object.defineProperty(proto, 'metadata', {
      set(value: MediaMetadata | null) {
        descriptor?.set?.call(
          this,
          revealedRef.current ? value : new MediaMetadata({ title: 'נחש את השיר', artist: '', artwork: [] })
        );
      },
      get() { return descriptor?.get?.call(this); },
      configurable: true,
    });
    return () => { if (descriptor) Object.defineProperty(proto, 'metadata', descriptor); };
  }, [hideMetadata]);

  useEffect(() => {
    let player: YT.Player;
    loadYouTubeApi().then(() => {
      if (!containerRef.current) return;
      player = new window.YT.Player(containerRef.current, {
        videoId,
        width: '1',
        height: '1',
        playerVars: { autoplay: 0, controls: 0, rel: 0, fs: 0 },
        events: {
          onReady: () => {
            playerRef.current = player;
            const d = player.getDuration();
            if (d > 0) setDuration(d);
            setReady(true);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              const d = player.getDuration();
              if (d > 0) setDuration(d);
            }
            if (e.data === window.YT.PlayerState.ENDED) setPlaying(false);
          },
        },
      });
    });
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      try { player?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (revealed && playing) {
      pollRef.current = setInterval(() => {
        if (scrubbingRef.current) return;
        const t = playerRef.current?.getCurrentTime();
        if (t !== undefined) setStartOffset(Math.floor(t));
      }, 250);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [revealed, playing]);

  const clearStop = () => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
  };

  const playSnippet = useCallback((offset: number, dur: number) => {
    const p = playerRef.current;
    if (!p) return;
    clearStop();
    p.seekTo(offset, true);
    p.playVideo();
    setPlaying(true);
    setSnippetKey(k => k + 1);
    stopTimerRef.current = setTimeout(() => {
      p.pauseVideo();
      setPlaying(false);
    }, dur * 1000);
  }, []);

  const playFree = useCallback((offset: number) => {
    const p = playerRef.current;
    if (!p) return;
    clearStop();
    p.seekTo(offset, true);
    p.playVideo();
    setPlaying(true);
  }, []);

  const handleStop = () => {
    clearStop();
    playerRef.current?.pauseVideo();
    setPlaying(false);
  };

  const handlePlay = () => {
    if (playing) { handleStop(); return; }
    revealed ? playFree(startOffset) : playSnippet(startOffset, revealDuration);
  };

  const handleReveal = (inc: number) => {
    const next = Math.min(revealDuration + inc, 30);
    setRevealDuration(next);
    playSnippet(startOffset, next);
  };

  const handleReset = () => {
    setRevealDuration(0.5);
    playSnippet(startOffset, 0.5);
  };

  const handleRevealSong = () => {
    revealedRef.current = true;
    setRevealed(true);
    playFree(startOffset);
  };

  const handleStartCommit = (val: number) => {
    const clamped = Math.max(0, Math.min(Math.floor(duration), val));
    setStartOffset(clamped);
    if (revealed) playFree(clamped); else playSnippet(clamped, revealDuration);
  };

  const handleStartInput = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setStartOffset(Math.max(0, Math.min(Math.floor(duration), n)));
  };

  const handleSelectWinner = (player: string | null) => {
    handleStop();
    setSelectedWinner(player);
    setShowScores(true);
  };

  // ── Score screen ────────────────────────────────────────────────
  if (showScores && groupPlayers) {
    const base = scores ?? {};
    const displayScores = [...groupPlayers]
      .map(name => ({ name, score: (base[name] ?? 0) + (name === selectedWinner ? 1 : 0) }))
      .sort((a, b) => b.score - a.score);
    const max = displayScores[0]?.score || 1;

    return (
      <div className="flex flex-col h-dvh bg-[#0C0C0C] text-white overflow-hidden">
        {/* Top bar */}
        <div className="relative flex items-center justify-center h-13 flex-shrink-0 px-4">
          <button onClick={onBack} className="absolute left-3 w-9 h-9 flex items-center justify-center text-white/40 hover:text-[#FFDA57] transition-colors">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="text-sm font-bold text-white/70">ניקוד</span>
        </div>

        {/* Winner announcement */}
        <div className="text-center px-4 py-3 flex-shrink-0">
          {selectedWinner
            ? <p className="text-lg font-black text-[#FFDA57]">{selectedWinner} זיהה את השיר!</p>
            : <p className="text-lg font-black text-white/40">אף אחד לא זיהה</p>
          }
          <p className="text-white/35 text-xs mt-1 truncate">{song.trackName} — {song.artistName}</p>
        </div>

        {/* Scores */}
        <div className="flex-1 flex flex-col justify-center px-5 gap-2.5 min-h-0">
          {displayScores.map(({ name, score }, i) => (
            <div
              key={name}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                name === selectedWinner
                  ? 'bg-[#FFDA57]/10 border-[#FFDA57]/25'
                  : 'bg-[#141414] border-white/[0.06]'
              }`}
            >
              <span className={`font-bold flex-1 text-base ${name === selectedWinner ? 'text-[#FFDA57]' : 'text-white'}`}>{name}</span>
              <div className="w-14 h-1.5 bg-white/8 rounded-full overflow-hidden" dir="ltr">
                <div className="h-full rounded-full bg-[#FFDA57]" style={{ width: `${(score / max) * 100}%` }} />
              </div>
              <span className="font-black text-lg w-5 text-right text-white" dir="ltr">{score}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="px-5 pb-safe pt-3 flex flex-col gap-2.5 flex-shrink-0">
          <button
            onClick={() => { setShowScores(false); onNextSong(selectedWinner ?? undefined); }}
            className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-base active:opacity-80 transition-opacity"
          >
            שיר הבא
          </button>
          {onFinish && (
            <button
              onClick={() => { setShowScores(false); onFinish?.(selectedWinner ?? undefined); }}
              className="w-full py-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white font-bold text-base active:opacity-70 transition-opacity"
            >
              סיים משחק
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Main play screen ────────────────────────────────────────────
  return (
    <div className="flex flex-col h-dvh bg-[#0C0C0C] text-white overflow-hidden">

      {/* Hidden YouTube player */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        <div ref={containerRef} />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-center h-13 flex-shrink-0 px-4">
        <button onClick={onBack} className="absolute left-3 w-9 h-9 flex items-center justify-center text-white/40 hover:text-[#FFDA57] transition-colors">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-sm font-bold text-white/70">זהה את השיר</span>
        {!ready && (
          <div className="absolute right-4">
            <div className="w-4 h-4 border-2 border-[#FFDA57]/20 border-t-[#FFDA57] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Song info — visible after reveal */}
      {(!hideMetadata || revealed) && (
        <div className="flex items-center gap-3 mx-4 mb-1 bg-[#141414] border border-white/[0.07] rounded-xl px-3 py-2.5 flex-shrink-0">
          {song.artworkUrl100 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={song.artworkUrl100} alt="" className="w-10 h-10 rounded-lg flex-shrink-0 object-cover" />
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{song.trackName}</p>
            <p className="text-white/45 text-xs truncate">{song.artistName}</p>
          </div>
        </div>
      )}

      {/* ── PRE-REVEAL ── */}
      {!revealed && (
        <div className="flex-1 flex flex-col px-4 pb-1 min-h-0 overflow-hidden">

          {/* Hidden song card */}
          {hideMetadata && (
            <div className="bg-[#141414] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex gap-1 items-end h-6">
                {[55,100,40,80,60,90,45].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-sm bg-[#FFDA57]"
                    style={{
                      height: `${h}%`,
                      animation: `mba 0.7s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.08}s`,
                      transformOrigin: 'bottom',
                    }}
                  />
                ))}
              </div>
              <span className="text-white/10 font-bold tracking-[0.35em] text-sm">● ● ● ●</span>
            </div>
          )}

          {/* Duration + ring + play */}
          <div className="flex items-center justify-center gap-6 mb-4 flex-shrink-0">
            {/* Progress ring */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,218,87,0.1)" strokeWidth="5"/>
                <circle
                  key={snippetKey}
                  cx="40" cy="40" r="34"
                  fill="none" stroke="#FFDA57" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="213.6"
                  strokeDashoffset={playing ? undefined : '213.6'}
                  transform="rotate(-90 40 40)"
                  style={playing ? { animation: `progress-ring-large ${revealDuration}s linear forwards` } : {}}
                />
              </svg>
              <span className="text-base font-black text-[#FFDA57]" dir="ltr">{fmtReveal(revealDuration)}</span>
            </div>

            {/* Play button */}
            <button
              onClick={handlePlay}
              disabled={!ready}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-xl shadow-lg transition-all disabled:opacity-40 ${
                playing ? 'bg-[#FFDA57]/20 border-2 border-[#FFDA57]/40' : 'bg-[#FFDA57]'
              }`}
            >
              {!ready
                ? <div className="w-5 h-5 border-2 border-[#0C0C0C]/30 border-t-[#0C0C0C] rounded-full animate-spin" />
                : playing
                  ? <span className="text-[#FFDA57] text-xl font-bold">■</span>
                  : <svg width="20" height="22" viewBox="0 0 20 22" fill="#0C0C0C"><path d="M1.5 1.5l17 9.5-17 9.5z"/></svg>
              }
            </button>
          </div>

          {/* Expose more */}
          <div className="flex-shrink-0 mb-3">
            <p className="text-center text-white/35 text-xs mb-2.5 font-semibold tracking-widest uppercase">חשוף עוד</p>
            <div className="flex gap-2 justify-center">
              {INCREMENTS.map((n) => {
                const label = n === 0.25 ? '+¼s' : n === 0.5 ? '+½s' : '+1s';
                return (
                  <button
                    key={n}
                    dir="ltr"
                    onClick={() => handleReveal(n)}
                    disabled={!ready || revealDuration + n > 30}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors bg-[#141414] border border-white/[0.08] text-white/70 hover:border-[#FFDA57]/30 hover:text-[#FFDA57] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start offset */}
          <div className="flex-shrink-0">
            <p className="text-center text-white/35 text-xs mb-2.5 font-semibold tracking-widest uppercase">התחל מ (שניות)</p>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => handleStartCommit(startOffset + 1)}
                disabled={!ready || startOffset >= Math.floor(duration)}
                className="w-10 h-10 rounded-xl bg-[#141414] border border-white/[0.08] text-white/70 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-white/20 transition-colors"
              >‹</button>
              <input
                type="number"
                min={0}
                max={Math.floor(duration)}
                value={startOffset}
                disabled={!ready}
                onChange={(e) => handleStartInput(e.target.value)}
                onBlur={(e) => handleStartCommit(parseInt(e.target.value, 10) || 0)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartCommit(startOffset)}
                className="w-24 bg-[#141414] border border-white/[0.08] rounded-xl px-3 py-2 text-center text-xl font-black outline-none focus:border-[#FFDA57]/30 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => handleStartCommit(startOffset - 1)}
                disabled={!ready || startOffset <= 0}
                className="w-10 h-10 rounded-xl bg-[#141414] border border-white/[0.08] text-white/70 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-white/20 transition-colors"
              >›</button>
            </div>
            <button
              onClick={handleReset}
              disabled={!ready || revealDuration === 0.5}
              className="mt-2 w-full py-1.5 text-xs text-white/25 hover:text-white/50 disabled:opacity-0 transition-colors"
            >
              ↺ אפס ל-0.5 שניות
            </button>
          </div>
        </div>
      )}

      {/* ── POST-REVEAL ── */}
      {revealed && (
        <div className="flex-1 flex flex-col px-4 pb-1 min-h-0 overflow-hidden">

          {/* Play + scrubber */}
          <div className="flex items-center gap-3 mb-3 flex-shrink-0">
            <button
              onClick={handlePlay}
              disabled={!ready}
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 ${
                playing ? 'bg-[#FFDA57]/15 border border-[#FFDA57]/30' : 'bg-[#FFDA57]'
              }`}
            >
              {!ready
                ? <div className="w-4 h-4 border-2 border-[#0C0C0C]/30 border-t-[#0C0C0C] rounded-full animate-spin" />
                : playing
                  ? <span className="text-[#FFDA57] text-sm font-bold">■</span>
                  : <svg width="14" height="16" viewBox="0 0 14 16" fill="#0C0C0C"><path d="M1 1l12 7-12 7z"/></svg>
              }
            </button>
            <div className="flex-1" dir="ltr">
              <input
                type="range"
                min={0}
                max={Math.floor(duration)}
                step={1}
                value={startOffset}
                disabled={!ready}
                onMouseDown={() => { scrubbingRef.current = true; }}
                onTouchStart={() => { scrubbingRef.current = true; }}
                onChange={(e) => setStartOffset(Number(e.target.value))}
                onMouseUp={(e) => { scrubbingRef.current = false; handleStartCommit(Number((e.target as HTMLInputElement).value)); }}
                onTouchEnd={(e) => { scrubbingRef.current = false; handleStartCommit(Number((e.target as HTMLInputElement).value)); }}
                className="w-full accent-[#FFDA57] disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-white/25 mt-0.5">
                <span>{fmt(startOffset)}</span>
                <span>{fmt(Math.floor(duration))}</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <button
              onClick={() => { handleStop(); setRevealed(false); revealedRef.current = false; }}
              className="text-white/35 hover:text-white/60 text-xs transition-colors"
            >
              → חזור לניחוש
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-white/35 hover:text-red-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube
            </a>
          </div>

          {/* Group winner selection */}
          {groupPlayers && (
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-center text-white/40 text-xs font-semibold mb-3 tracking-widest uppercase">מי זיהה ראשון?</p>
              <div className="grid grid-cols-2 gap-2.5">
                {groupPlayers.map(player => (
                  <button
                    key={player}
                    onClick={() => handleSelectWinner(player)}
                    className="py-4 rounded-2xl font-black text-lg bg-[#141414] border border-white/[0.07] text-white hover:border-[#FFDA57]/30 hover:text-[#FFDA57] active:bg-[#FFDA57] active:text-[#0C0C0C] active:border-[#FFDA57] transition-colors"
                  >
                    {player}
                  </button>
                ))}
                <button
                  onClick={() => handleSelectWinner(null)}
                  className="col-span-2 py-3 rounded-2xl font-semibold text-sm bg-transparent border border-white/[0.06] text-white/30 hover:text-white/50 transition-colors"
                >
                  אף אחד לא זיהה
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="px-4 pb-safe pt-2 flex flex-col gap-2.5 flex-shrink-0">
        {!revealed && (
          <button
            onClick={handleRevealSong}
            disabled={!ready}
            className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-base active:opacity-80 transition-opacity disabled:opacity-40"
          >
            חשוף את השיר
          </button>
        )}
        {revealed && !groupPlayers && (
          <>
            <button
              onClick={() => { handleStop(); onNextSong(undefined); }}
              className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-base active:opacity-80 transition-opacity"
            >
              שיר הבא
            </button>
            {onFinish && (
              <button
                onClick={() => { handleStop(); onFinish?.(undefined); }}
                className="w-full py-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white font-bold text-base active:opacity-70"
              >
                סיים
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
