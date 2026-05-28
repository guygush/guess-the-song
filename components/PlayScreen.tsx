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

const INCREMENTS = [0.25, 0.5, 1];
const DEFAULT_DURATION = 300;
const PLAYER_COLORS = ['#5EB3F8', '#FF6B9D', '#3ECF8E', '#B69AF0', '#FF8C42', '#FFDA57'];
const CANDY_CLASSES = ['btn-candy-blue', 'btn-candy-green', 'btn-candy-red', 'btn-candy-yellow', 'btn-candy-purple', 'btn-candy-orange'];
const CANDY_TEXT_COLORS = ['#1a5c8b', '#3d6010', '#8b2222', '#5c3511', '#5c1a8b', '#7a3000'];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function fmtDur(sec: number) {
  if (sec === 0.25) return '¼s';
  if (sec === 0.5) return '½s';
  if (Number.isInteger(sec)) return `${sec}s`;
  return `${sec}s`;
}

export default function PlayScreen({ song, videoId, onNextSong, onFinish, onBack, hideMetadata, groupPlayers, scores }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snippetStartMsRef = useRef(0);
  const snippetDurMsRef = useRef(500);
  const scrubbingRef = useRef(false);
  const revealedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
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
          revealedRef.current ? value : new MediaMetadata({ title: 'צפוף', artist: '', artwork: [] })
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

  // Progress ring tracking
  useEffect(() => {
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
    if (!playing) { setProgress(0); return; }
    progressIntervalRef.current = setInterval(() => {
      if (revealed) {
        const t = playerRef.current?.getCurrentTime() ?? 0;
        const d = playerRef.current?.getDuration() ?? duration;
        setProgress(d > 0 ? t / d : 0);
      } else {
        setProgress(Math.min((Date.now() - snippetStartMsRef.current) / snippetDurMsRef.current, 1));
      }
    }, 50);
    return () => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; } };
  }, [playing, revealed, duration]);

  const clearStop = () => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
  };

  const playSnippet = useCallback((offset: number, dur: number) => {
    const p = playerRef.current;
    if (!p) return;
    clearStop();
    snippetStartMsRef.current = Date.now();
    snippetDurMsRef.current = dur * 1000;
    setProgress(0);
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

  const handleSelectWinner = (player: string | null) => {
    handleStop();
    setSelectedWinner(player);
    setShowScores(true);
  };

  const scoreBase = scores ?? {};
  const displayScores = groupPlayers
    ? [...groupPlayers]
        .map(name => ({ name, score: (scoreBase[name] ?? 0) + (name === selectedWinner ? 1 : 0) }))
        .sort((a, b) => b.score - a.score)
    : [];
  const scoreMax = displayScores[0]?.score || 1;

  // ── Shared header ────────────────────────────────────────────────
  const Header = ({ title }: { title?: string }) => (
    <header className="play-header flex-shrink-0">
      <div className="relative flex items-center justify-center px-4 py-3">
        {/* Back — always on visual left */}
        <button
          onClick={onBack}
          className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: '#f4e6d4', border: '2px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="#8b5e34" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Title centered */}
        <span className="text-sm font-bold text-brown truncate">
          {title ?? 'צפוף'}
        </span>
      </div>
      <div className="play-wavy opacity-50" />
    </header>
  );

  return (
    <div className="flex flex-col h-dvh play-page overflow-hidden">

      {/* Hidden YouTube player */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        <div ref={containerRef} />
      </div>

      {/* ── SCORE SCREEN ── */}
      {showScores && groupPlayers && (
        <>
          <Header />
          <div className="flex-1 flex flex-col min-h-0 px-5 pt-4 pb-safe overflow-y-auto">

            {/* Scores */}
            <div className="flex-1 flex flex-col gap-2.5 mb-5">
              {displayScores.map(({ name, score }, i) => {
                const color = PLAYER_COLORS[groupPlayers.indexOf(name) % PLAYER_COLORS.length];
                const isWinner = name === selectedWinner;
                return (
                  <div
                    key={name}
                    className="flex items-center gap-3 px-4 py-3 rounded-3xl"
                    style={{
                      background: isWinner ? 'rgba(255,219,44,0.2)' : '#fff',
                      border: `2.5px solid ${isWinner ? '#ffbf00' : '#dcc9ad'}`,
                      boxShadow: isWinner ? '0 3px 8px rgba(230,168,0,0.4)' : '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)',
                    }}
                  >
                    <span className="text-xs font-bold w-5 text-center text-brown-light" dir="ltr">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: color }}>
                      {name.charAt(0)}
                    </div>
                    <span className="flex-1 text-sm font-bold text-brown">{name}</span>
                    {isWinner && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#ffdb2c', color: '#5c3511', border: '1.5px solid #b8860b' }}>+1</span>
                    )}
                    <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: '#e9dcc5' }} dir="ltr">
                      <div className="h-full rounded-full" style={{ width: `${(score / scoreMax) * 100}%`, background: isWinner ? '#ffbf00' : '#c4a882' }} />
                    </div>
                    <span className="font-bold text-base w-6 text-right text-brown" dir="ltr">{score}</span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowScores(false); onNextSong(selectedWinner ?? undefined); }}
                className="w-full py-4 rounded-[2.5rem] font-bold text-xl glossy-btn btn-candy-yellow active:opacity-80 transition-opacity"
                style={{ color: '#5c3511' }}
              >
                השיר הבא ←
              </button>
              {onFinish && (
                <button
                  onClick={() => { setShowScores(false); onFinish?.(selectedWinner ?? undefined); }}
                  className="w-full py-3 rounded-[2.5rem] font-bold text-base"
                  style={{ background: '#f0e6d0', border: '2.5px solid #dcc9ad', color: '#8b5e34', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
                >
                  סיים משחק
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── MAIN PLAY SCREEN ── */}
      {!showScores && (
        <>
          <Header />

          {/* Song info strip — shown when metadata visible */}
          {(!hideMetadata || revealed) && (
            revealed ? (
              <div className="flex flex-col items-center mx-4 mt-3 px-3 py-2.5 rounded-2xl flex-shrink-0 text-center"
                style={{ background: '#fff', border: '2px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
              >
                <p className="font-bold text-sm text-brown">{song.trackName}</p>
                <p className="text-xs text-brown-light mt-0.5">{song.artistName}{song.year ? ` (${song.year})` : ''}</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 mx-4 mt-3 px-3 py-2.5 rounded-2xl flex-shrink-0"
                style={{ background: '#fff', border: '2px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
              >
                {song.artworkUrl100 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={song.artworkUrl100} alt="" className="w-10 h-10 rounded-xl flex-shrink-0 object-cover" style={{ border: '2px solid #dcc9ad' }} />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate text-brown">{song.trackName}</p>
                  <p className="text-xs truncate text-brown-light">{song.artistName}</p>
                </div>
              </div>
            )
          )}

          {/* ── PRE-REVEAL ── */}
          {!revealed && (
            <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-2 min-h-0 overflow-hidden">

              {/* Play button (centered) + duration bubble (to its right) */}
              <div className="relative flex items-center justify-center mb-8 flex-shrink-0" style={{ height: 92 }}>
                {/* Play button with progress ring */}
                <div className="relative w-[88px] h-[88px]">
                  <button
                    onClick={handlePlay}
                    disabled={!ready}
                    className="w-full h-full rounded-full flex items-center justify-center glossy-btn btn-candy-yellow"
                    style={{ opacity: ready ? 1 : 0.6 }}
                  >
                    {!ready ? (
                      <div className="w-5 h-5 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(92,53,17,0.2)', borderTopColor: '#5c3511' }} />
                    ) : playing ? (
                      <div className="w-5 h-5 rounded-sm" style={{ background: '#5c3511' }} />
                    ) : (
                      <div className="w-0 h-0 ml-1" style={{ borderTop: '14px solid transparent', borderBottom: '14px solid transparent', borderLeft: '24px solid #5c3511' }} />
                    )}
                  </button>
                  <svg className="absolute inset-0 pointer-events-none" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
                    <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(92,53,17,0.5)" strokeWidth="4"
                      strokeDasharray={251.33} strokeDashoffset={251.33 * (1 - progress)} strokeLinecap="round" />
                  </svg>
                </div>

                {/* Duration bubble — adjacent to the right of the button */}
                <div className="absolute" style={{ left: 'calc(50% + 56px)' }}>
                  <div className="relative flex items-center justify-center px-3 py-1.5 rounded-2xl"
                    style={{ background: '#fff', border: '2px solid #dcc9ad', boxShadow: '0 3px 6px rgba(0,0,0,0.1)', minWidth: 52 }}
                  >
                    {/* Left-pointing arrow */}
                    <div className="absolute" style={{ left: -9, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '9px solid #dcc9ad' }} />
                    <div className="absolute" style={{ left: -6, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: '7px solid #fff' }} />
                    <span className="font-bold text-base" style={{ color: '#b8860b' }} dir="ltr">{fmtDur(revealDuration)}</span>
                  </div>
                </div>
              </div>

              {/* Increment buttons */}
              <div className="flex gap-3 w-full mb-7 flex-shrink-0" dir="ltr">
                {INCREMENTS.map((n, idx) => {
                  const label = n === 0.25 ? '+¼s' : n === 0.5 ? '+½s' : '+1s';
                  const cls = n === 1 ? 'btn-candy-red' : n === 0.5 ? 'btn-candy-green' : 'btn-candy-blue';
                  const textColor = n === 1 ? '#8b2222' : n === 0.5 ? '#3d6010' : '#1a5c8b';
                  return (
                    <button
                      key={n}
                      onClick={() => handleReveal(n)}
                      disabled={!ready || revealDuration + n > 30}
                      className={`flex-1 py-4 rounded-[2rem] font-bold text-2xl glossy-btn ${cls}`}
                      style={{ color: textColor }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Start offset */}
              <div className="w-full flex flex-col items-center gap-3 flex-shrink-0">
                <label className="font-bold text-lg text-brown">התחל מ (שניות)</label>
                <div className="flex items-center gap-3 w-full justify-center" dir="ltr">
                  {/* − */}
                  <button
                    onClick={() => handleStartCommit(startOffset - 1)}
                    disabled={!ready || startOffset <= 0}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-3xl font-bold circle-ctrl text-brown"
                  >
                    −
                  </button>
                  {/* Value */}
                  <div className="flex-1 max-w-[160px] h-14 flex items-center justify-center rounded-3xl text-2xl font-bold text-brown value-box">
                    {startOffset}
                  </div>
                  {/* + */}
                  <button
                    onClick={() => handleStartCommit(startOffset + 1)}
                    disabled={!ready || startOffset >= Math.floor(duration)}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-3xl font-bold circle-ctrl text-brown"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleReset}
                  disabled={!ready || revealDuration === 0.5}
                  className="text-xs text-brown-light disabled:opacity-0 transition-opacity"
                >
                  ↺ אפס ל-0.5 שניות
                </button>
              </div>
            </div>
          )}

          {/* ── POST-REVEAL ── */}
          {revealed && (
            <div className="flex-1 flex flex-col px-5 pt-4 pb-2 min-h-0 overflow-hidden">

              {/* Play + scrubber */}
              <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <button
                    onClick={handlePlay}
                    disabled={!ready}
                    className="w-full h-full rounded-full flex items-center justify-center glossy-btn btn-candy-yellow"
                    style={{ opacity: ready ? 1 : 0.5 }}
                  >
                    {playing
                      ? <div className="w-4 h-4 rounded-sm" style={{ background: '#5c3511' }} />
                      : <div className="w-0 h-0 ml-1" style={{ borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '18px solid #5c3511' }} />
                    }
                  </button>
                  <svg className="absolute inset-0 pointer-events-none" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                    <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(92,53,17,0.5)" strokeWidth="3"
                      strokeDasharray={131.95} strokeDashoffset={131.95 * (1 - progress)} strokeLinecap="round" />
                  </svg>
                </div>
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
                    className="w-full accent-[#ffbf00] disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-brown-light mt-0.5">
                    <span>{fmt(startOffset)}</span>
                    <span>{fmt(Math.floor(duration))}</span>
                  </div>
                </div>
              </div>

              {/* YouTube + back to guessing — below timeline */}
              <div className="flex items-center justify-between mb-4 flex-shrink-0 px-1">
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-brown-light"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube
                </a>
                <button
                  onClick={() => { handleStop(); setRevealed(false); revealedRef.current = false; }}
                  className="text-sm text-brown-light"
                >
                  → חזור לניחוש
                </button>
              </div>

              {/* Group: winner selection */}
              {groupPlayers && (
                <div className="flex-1 flex flex-col min-h-0">
                  <p className="text-center font-bold text-sm mb-4 text-brown">מי זיהה ראשון?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {groupPlayers.map((player, i) => {
                      const cls = CANDY_CLASSES[i % CANDY_CLASSES.length];
                      const textColor = CANDY_TEXT_COLORS[i % CANDY_TEXT_COLORS.length];
                      return (
                        <button
                          key={player}
                          onClick={() => handleSelectWinner(player)}
                          className={`py-4 rounded-[2rem] font-bold text-xl glossy-btn ${cls}`}
                          style={{ color: textColor }}
                        >
                          {player}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleSelectWinner(null)}
                      className="col-span-2 py-4 rounded-[2rem] font-bold text-base glossy-btn candy-btn-secondary"
                    >
                      אף אחד לא זיהה
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom bar */}
          <div className="px-5 pb-safe pt-2 flex flex-col gap-3 flex-shrink-0">
            {!revealed && (
              <button
                onClick={handleRevealSong}
                disabled={!ready}
                className="w-full py-5 rounded-[2.5rem] font-bold text-3xl glossy-btn btn-candy-yellow disabled:opacity-50"
                style={{ color: '#5c3511', textShadow: '-1px -1px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(92,53,17,0.3)' }}
              >
                חשוף את השיר
              </button>
            )}
            {revealed && !groupPlayers && (
              <>
                <button
                  onClick={() => { handleStop(); onNextSong(undefined); }}
                  className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow"
                  style={{ color: '#5c3511' }}
                >
                  השיר הבא ←
                </button>
                {onFinish && (
                  <button
                    onClick={() => { handleStop(); onFinish?.(undefined); }}
                    className="w-full py-4 rounded-[2.5rem] font-bold text-base text-brown"
                    style={{ background: '#f0e6d0', border: '2.5px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
                  >
                    סיים
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
