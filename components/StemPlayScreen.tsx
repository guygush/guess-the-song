'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { StemSong } from '@/lib/stems';
import Header from '@/components/Header';

interface Props {
  song: StemSong;
  groupPlayers?: string[];
  scores?: Record<string, number>;
  onNextSong: (winner?: string, points?: number) => void;
  onFinish?: (winner?: string, points?: number) => void;
  onBack: () => void;
}

const CANDY_CLASSES = ['btn-candy-blue', 'btn-candy-green', 'btn-candy-red', 'btn-candy-yellow', 'btn-candy-purple', 'btn-candy-orange'];
const CANDY_TEXT_COLORS = ['#1a5c8b', '#3d6010', '#8b2222', '#5c3511', '#5c1a8b', '#7a3000'];
const PLAYER_COLORS = ['#5EB3F8', '#FF6B9D', '#3ECF8E', '#B69AF0', '#FF8C42', '#FFDA57'];

const STAGE_LABELS = ['תופים + בס', 'תופים + בס + כלים', 'תופים + בס + כלים + שירה'];
const STAGE_POINTS = [3, 2, 1];

export default function StemPlayScreen({ song, groupPlayers, scores, onNextSong, onFinish, onBack }: Props) {
  // Audio refs (mutable, don't need re-renders)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainsRef = useRef<Record<string, GainNode>>({});
  const buffersRef = useRef<Record<string, AudioBuffer | null>>({ drums: null, bass: null, other: null, vocals: null });
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playOffsetRef = useRef(0);
  const playStartAcTimeRef = useRef(0);
  const endHandledRef = useRef(false);
  const playingRef = useRef(false);
  const stageRef = useRef(1);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [eagerReady, setEagerReady] = useState(false);
  const [otherReady, setOtherReady] = useState(false);
  const [vocalsReady, setVocalsReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  const getCurrentOffset = useCallback(() => {
    if (!playingRef.current || !audioCtxRef.current) return playOffsetRef.current;
    return playOffsetRef.current + (audioCtxRef.current.currentTime - playStartAcTimeRef.current);
  }, []);

  const stopSources = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    activeSourcesRef.current = [];
  }, []);

  const startStem = useCallback((name: string, offset: number) => {
    const ctx = audioCtxRef.current;
    const buf = buffersRef.current[name];
    const gain = gainsRef.current[name];
    if (!ctx || !buf || !gain) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(0, Math.min(offset, buf.duration - 0.01));
    src.onended = () => {
      // If this source is no longer in the active list, it was manually stopped — ignore.
      if (!activeSourcesRef.current.includes(src)) return;
      if (!endHandledRef.current && playingRef.current) {
        endHandledRef.current = true;
        playOffsetRef.current = 0;
        setPlaying(false);
      }
    };
    activeSourcesRef.current.push(src);
  }, []);

  // Setup: create AudioContext, load stems
  useEffect(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const gains: Record<string, GainNode> = {};
    for (const name of ['drums', 'bass', 'other', 'vocals']) {
      gains[name] = ctx.createGain();
      gains[name].connect(ctx.destination);
    }
    gains.other.gain.value = 0;
    gains.vocals.gain.value = 0;
    gainsRef.current = gains;

    const loadStem = async (name: string, url: string) => {
      const resp = await fetch(url);
      const ab = await resp.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      buffersRef.current[name] = buf;
      return buf;
    };

    // Eager: drums + bass — auto-plays when ready
    Promise.all([
      loadStem('drums', song.stems.drums),
      loadStem('bass', song.stems.bass),
    ]).then(() => setEagerReady(true));

    // Lazy: other + vocals — load in background
    loadStem('other', song.stems.other).then(() => setOtherReady(true));
    loadStem('vocals', song.stems.vocals).then(() => setVocalsReady(true));

    return () => {
      stopSources();
      ctx.close();
    };
  }, [song, stopSources]);

  // Auto-play as soon as drums+bass are ready
  useEffect(() => {
    if (!eagerReady) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    ctx.resume().then(() => {
      stopSources();
      endHandledRef.current = false;
      playStartAcTimeRef.current = ctx.currentTime;
      for (const name of ['drums', 'bass', 'other', 'vocals']) {
        startStem(name, 0);
      }
      setPlaying(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eagerReady]);

  // Progress ring tracking
  useEffect(() => {
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
    if (!playing) { setProgress(0); return; }
    const dur = buffersRef.current.drums?.duration || 15;
    progressIntervalRef.current = setInterval(() => {
      setProgress(Math.min(getCurrentOffset() / dur, 1));
    }, 50);
    return () => { if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; } };
  }, [playing, getCurrentOffset]);

  // Auto-play when song is revealed
  useEffect(() => {
    if (!revealed) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    ctx.resume().then(() => {
      stopSources();
      endHandledRef.current = false;
      playOffsetRef.current = 0;
      playStartAcTimeRef.current = ctx.currentTime;
      for (const name of ['drums', 'bass', 'other', 'vocals']) startStem(name, 0);
      setPlaying(true);
    });
  }, [revealed, stopSources, startStem]);

  // When a lazy stem loads while playing, start its source at current position
  useEffect(() => {
    if (otherReady && playingRef.current) {
      startStem('other', getCurrentOffset());
    }
  }, [otherReady, getCurrentOffset, startStem]);

  useEffect(() => {
    if (vocalsReady && playingRef.current) {
      startStem('vocals', getCurrentOffset());
    }
  }, [vocalsReady, getCurrentOffset, startStem]);

  const handlePlay = useCallback(async () => {
    const ctx = audioCtxRef.current;
    if (!ctx || !eagerReady) return;
    if (ctx.state === 'suspended') await ctx.resume();

    if (playingRef.current) {
      playOffsetRef.current = getCurrentOffset();
      stopSources();
      setPlaying(false);
    } else {
      const offset = playOffsetRef.current;
      stopSources();
      endHandledRef.current = false;
      playStartAcTimeRef.current = ctx.currentTime;
      for (const name of ['drums', 'bass', 'other', 'vocals']) {
        startStem(name, offset);
      }
      setPlaying(true);
    }
  }, [eagerReady, getCurrentOffset, stopSources, startStem]);

  const handleReveal = useCallback(() => {
    if (stage >= 3) return;
    const next = stage + 1;
    setStage(next);
    stageRef.current = next;
    const stemName = next === 2 ? 'other' : 'vocals';
    if (gainsRef.current[stemName]) {
      gainsRef.current[stemName].gain.value = 1;
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    ctx.resume().then(() => {
      stopSources();
      endHandledRef.current = false;
      playOffsetRef.current = 0;
      playStartAcTimeRef.current = ctx.currentTime;
      for (const name of ['drums', 'bass', 'other', 'vocals']) {
        startStem(name, 0);
      }
      setPlaying(true);
    });
  }, [stage, stopSources, startStem]);

  const handleContinue = useCallback(() => {
    for (const name of ['other', 'vocals']) {
      if (gainsRef.current[name]) gainsRef.current[name].gain.value = 1;
    }
    stopSources();
    setPlaying(false);
    playOffsetRef.current = 0;
    setRevealed(true);
  }, [stopSources]);

  const handleSelectWinner = (player: string | null) => {
    setSelectedWinner(player);
    setShowScores(true);
  };

  const points = STAGE_POINTS[stage - 1];
  const scoreBase = scores ?? {};
  const displayScores = groupPlayers
    ? [...groupPlayers]
        .map(name => ({ name, score: (scoreBase[name] ?? 0) + (name === selectedWinner ? points : 0) }))
        .sort((a, b) => b.score - a.score)
    : [];
  const scoreMax = displayScores[0]?.score || 1;

  // Loading screen
  if (!eagerReady) {
    return (
      <div className="flex flex-col h-dvh play-page">
        <Header title="איך שיר נולד?" onBack={onBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 candy-spinner-yellow" />
        </div>
      </div>
    );
  }

  // Score screen
  if (showScores && groupPlayers) {
    return (
      <div className="flex flex-col h-dvh play-page overflow-hidden">
        <Header title="איך שיר נולד?" onBack={onBack} />
        <div className="flex-1 flex flex-col min-h-0 px-5 pt-4 pb-safe overflow-y-auto">
          <div className="flex-1 flex flex-col gap-2.5 mb-5">
            {displayScores.map(({ name, score }, i) => {
              const color = PLAYER_COLORS[groupPlayers.indexOf(name) % PLAYER_COLORS.length];
              const isWinner = name === selectedWinner;
              return (
                <div key={name} className="flex items-center gap-3 px-4 py-3 rounded-3xl"
                  style={{
                    background: isWinner ? 'rgba(255,219,44,0.2)' : '#fff',
                    border: `2.5px solid ${isWinner ? '#ffbf00' : '#dcc9ad'}`,
                    boxShadow: isWinner ? '0 3px 8px rgba(230,168,0,0.4)' : '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)',
                  }}>
                  <span className="text-xs font-bold w-5 text-center text-brown-light" dir="ltr">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: color }}>
                    {name.charAt(0)}
                  </div>
                  <span className="flex-1 text-sm font-bold text-brown">{name}</span>
                  {isWinner && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#ffdb2c', color: '#5c3511', border: '1.5px solid #b8860b' }}>+{points}</span>
                  )}
                  <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: '#e9dcc5' }} dir="ltr">
                    <div className="h-full rounded-full" style={{ width: `${(score / scoreMax) * 100}%`, background: isWinner ? '#ffbf00' : '#c4a882' }} />
                  </div>
                  <span className="font-bold text-base w-6 text-right text-brown" dir="ltr">{score}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setShowScores(false); onNextSong(selectedWinner ?? undefined, selectedWinner ? points : undefined); }}
              className="w-full py-4 rounded-[2.5rem] font-bold text-xl glossy-btn btn-candy-yellow active:opacity-80 transition-opacity"
              style={{ color: '#5c3511' }}
            >
              השיר הבא ←
            </button>
            {onFinish && (
              <button
                onClick={() => { setShowScores(false); onFinish?.(selectedWinner ?? undefined, selectedWinner ? points : undefined); }}
                className="w-full py-3 rounded-[2.5rem] font-bold text-base"
                style={{ background: '#f0e6d0', border: '2.5px solid #dcc9ad', color: '#8b5e34', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
              >
                סיים משחק
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh play-page overflow-hidden">
      <Header title="איך שיר נולד?" onBack={onBack} />

      {/* Song info strip — revealed only */}
      {revealed && (
        <div className="flex flex-col items-center mx-4 mt-3 px-3 py-2.5 rounded-2xl flex-shrink-0 text-center"
          style={{ background: '#fff', border: '2px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}>
          <p className="font-bold text-sm text-brown">{song.song}</p>
          <p className="text-xs text-brown-light mt-0.5">{song.performer} ({song.year})</p>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-2 min-h-0 overflow-hidden">
        {!revealed ? (
          <>
            {/* Play button with progress ring */}
            <div className="flex items-center justify-center mb-8 flex-shrink-0">
              <div className="relative w-[88px] h-[88px]">
                <button
                  onClick={handlePlay}
                  className="w-full h-full rounded-full flex items-center justify-center glossy-btn btn-candy-yellow"
                >
                  {playing
                    ? <div className="w-5 h-5 rounded-sm" style={{ background: '#5c3511' }} />
                    : <div className="w-0 h-0 ml-1" style={{ borderTop: '14px solid transparent', borderBottom: '14px solid transparent', borderLeft: '24px solid #5c3511' }} />
                  }
                </button>
                <svg className="absolute inset-0 pointer-events-none" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
                  <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(92,53,17,0.5)" strokeWidth="4"
                    strokeDasharray={251.33} strokeDashoffset={251.33 * (1 - progress)} strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Stage label */}
            <div className="mb-6 flex-shrink-0">
              <div className="px-5 py-2 rounded-2xl text-center"
                style={{ background: '#fff', border: '2px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3)' }}>
                <p className="font-bold text-sm text-brown">{STAGE_LABELS[stage - 1]}</p>
              </div>
            </div>

            {/* Reveal more */}
            <div className="w-full flex-shrink-0">
              <button
                onClick={handleReveal}
                disabled={stage >= 3 || (stage === 1 && !otherReady) || (stage === 2 && !vocalsReady)}
                className="w-full py-4 rounded-[2rem] font-bold text-xl glossy-btn btn-candy-green disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ color: '#3d6010' }}
              >
                {(stage === 1 && !otherReady) || (stage === 2 && !vocalsReady)
                  ? <><div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(61,96,16,0.2)', borderTopColor: '#3d6010' }} />טוען...</>
                  : stage >= 3 ? 'תופים+בס+כלים+שירה' : 'חשוף עוד'}
              </button>
            </div>
          </>
        ) : (
          /* Revealed: play button + optional winner selection */
          <div className="w-full flex-1 flex flex-col items-center min-h-0">
            {/* Play button with progress ring */}
            <div className="flex items-center justify-center mb-6 flex-shrink-0">
              <div className="relative w-[88px] h-[88px]">
                <button
                  onClick={handlePlay}
                  className="w-full h-full rounded-full flex items-center justify-center glossy-btn btn-candy-yellow"
                >
                  {playing
                    ? <div className="w-5 h-5 rounded-sm" style={{ background: '#5c3511' }} />
                    : <div className="w-0 h-0 ml-1" style={{ borderTop: '14px solid transparent', borderBottom: '14px solid transparent', borderLeft: '24px solid #5c3511' }} />
                  }
                </button>
                <svg className="absolute inset-0 pointer-events-none" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
                  <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(92,53,17,0.5)" strokeWidth="4"
                    strokeDasharray={251.33} strokeDashoffset={251.33 * (1 - progress)} strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Winner selection (group only) */}
            {groupPlayers && (
              <div className="w-full flex-1 flex flex-col min-h-0">
                <p className="text-center font-bold text-sm mb-4 text-brown">מי זיהה ראשון?</p>
                <div className="grid grid-cols-2 gap-3">
                  {groupPlayers.map((player, i) => {
                    const cls = CANDY_CLASSES[i % CANDY_CLASSES.length];
                    const textColor = CANDY_TEXT_COLORS[i % CANDY_TEXT_COLORS.length];
                    return (
                      <button key={player} onClick={() => handleSelectWinner(player)}
                        className={`py-4 rounded-[2rem] font-bold text-xl glossy-btn ${cls}`}
                        style={{ color: textColor }}>
                        {player}
                      </button>
                    );
                  })}
                  <button onClick={() => handleSelectWinner(null)}
                    className="col-span-2 py-4 rounded-[2rem] font-bold text-base glossy-btn candy-btn-secondary">
                    אף אחד לא זיהה
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-5 pb-safe pt-2 flex flex-col gap-3 flex-shrink-0">
        {!revealed && (
          <button
            onClick={handleContinue}
            className="w-full py-5 rounded-[2.5rem] font-bold text-3xl glossy-btn btn-candy-yellow"
            style={{ color: '#5c3511', textShadow: '-1px -1px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(92,53,17,0.3)' }}
          >
            המשך...
          </button>
        )}
        {revealed && !groupPlayers && (
          <>
            <button
              onClick={() => onNextSong(undefined)}
              className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow"
              style={{ color: '#5c3511' }}
            >
              השיר הבא ←
            </button>
            {onFinish && (
              <button
                onClick={() => onFinish?.(undefined)}
                className="w-full py-4 rounded-[2.5rem] font-bold text-base text-brown"
                style={{ background: '#f0e6d0', border: '2.5px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
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
