'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadYouTubeApi } from '@/lib/youtube';
import type { Song } from '@/lib/itunes';

interface Props {
  song: Song;
  videoId: string;
  onNextSong: () => void;
  onFinish?: () => void;
  hideMetadata?: boolean;
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
  return `${n} שניות`;
}

export default function PlayScreen({ song, videoId, onNextSong, onFinish, hideMetadata }: Props) {
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

  const handleNextSong = () => {
    handleStop();
    onNextSong();
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

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white overflow-hidden">
      {/* Hidden YouTube player */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        <div ref={containerRef} />
      </div>

      {/* Song info — hidden before reveal in test-yourself mode */}
      {(!hideMetadata || revealed) && (
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {song.artworkUrl100 && <img src={song.artworkUrl100} alt="" className="w-12 h-12 rounded-xl flex-shrink-0 object-cover" />}
          <div className="min-w-0">
            <p className="font-bold truncate">{song.trackName}</p>
            <p className="text-gray-200 text-sm truncate">{song.artistName}</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center gap-3 px-4">

        {/* מצב ניחוש */}
        {!revealed && (
          <>
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-400">{fmtReveal(revealDuration)}</p>
              <p className="text-gray-300 text-xs">משך חשיפה</p>
            </div>

            <div className="flex justify-center mb-4">
              <button
                onClick={handlePlay}
                disabled={!ready}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  playing
                    ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                    : 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700'
                }`}
              >
                {playing && (
                  <svg key={snippetKey} className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
                    <circle
                      cx="20" cy="20" r="18"
                      fill="none"
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="113.1"
                      strokeDashoffset="113.1"
                      transform="rotate(-90 20 20)"
                      style={{ animation: `progress-ring ${revealDuration}s linear forwards` }}
                    />
                  </svg>
                )}
                {!ready ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : playing ? '■' : '▶'}
              </button>
            </div>

            <div>
              <p className="text-center text-gray-200 text-sm mb-2">חשוף עוד</p>

              <div className="w-fit mx-auto">
                <div className="flex gap-2 mb-8">
                  {INCREMENTS.map((n) => {
                    const label = n === 0.25 ? '+¼' : n === 0.5 ? '+½' : '+1';
                    return (
                      <button
                        key={n}
                        dir="ltr"
                        onClick={() => handleReveal(n)}
                        disabled={!ready || revealDuration + n > 30}
                        className="px-5 py-3 rounded-xl font-semibold text-lg transition-colors bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* התחל מ */}
                <div>
                  <p className="text-sm text-gray-200 mb-1">התחל מ (שניות)</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartCommit(startOffset + 1)}
                      disabled={!ready || startOffset >= Math.floor(duration)}
                      className="w-11 h-11 rounded-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={Math.floor(duration)}
                      value={startOffset}
                      disabled={!ready}
                      onChange={(e) => handleStartInput(e.target.value)}
                      onBlur={(e) => handleStartCommit(parseInt(e.target.value, 10) || 0)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartCommit(startOffset)}
                      className="w-0 flex-1 bg-gray-800 rounded-xl px-4 py-2 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => handleStartCommit(startOffset - 1)}
                      disabled={!ready || startOffset <= 0}
                      className="w-11 h-11 rounded-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                disabled={!ready || revealDuration === 0.5}
                className="mt-2 w-full py-1.5 rounded-xl text-sm text-gray-200 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ↺ אפס ל-0.5 שניות
              </button>
            </div>
          </>
        )}

        {/* מצב חשיפה */}
        {revealed && (
          <>
            <div className="flex justify-center mb-4">
              <button
                onClick={handlePlay}
                disabled={!ready}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  playing
                    ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                    : 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700'
                }`}
              >
                {!ready ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : playing ? '■' : '▶'}
              </button>
            </div>

            <div className="mb-8">
              <div dir="ltr">
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
                  className="w-full accent-indigo-500 disabled:opacity-40"
                />
                <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                  <span>0:00</span><span>{fmt(Math.floor(duration))}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => { handleStop(); setRevealed(false); }}
                className="flex items-center gap-1 text-gray-200 hover:text-white transition-colors text-sm"
              >
                → חזור לניחוש
              </button>
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                פתח ביוטיוב
              </a>
            </div>
          </>
        )}
      </div>

      {/* כפתורי תחתית */}
      <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
        {!revealed && (
          <button
            onClick={handleRevealSong}
            disabled={!ready}
            className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 font-semibold text-lg transition-colors disabled:opacity-40"
          >
            חשוף את השיר
          </button>
        )}
        {revealed && (
          <>
            <button
              onClick={handleNextSong}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-lg transition-colors"
            >
              שיר הבא
            </button>
            {onFinish && (
              <button
                onClick={() => { handleStop(); onFinish(); }}
                className="w-full py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 font-semibold text-lg transition-colors mt-1"
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
