'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchSongs, PAGE_SIZE, type Song } from '@/lib/itunes';
import { loadChartSongs, pickRandomSong, chartSongToSong, type TestConfig } from '@/lib/charts';
import { findVideoId } from '@/lib/youtube';
import Header from '@/components/Header';

interface Props {
  onSelect: (song: Song, videoId?: string, hideMetadata?: boolean, testConfig?: TestConfig, groupPlayers?: string[]) => void;
  onBackToHub: () => void;
}

const PREVIEW_SECONDS = 10;
const DECADES = ['60s', '70s', '80s', '90s', '2000s', '2010s', '2020s'];
const LANGUAGES: { id: 'hebrew' | 'foreign' | 'both'; label: string }[] = [
  { id: 'both', label: 'גם וגם' },
  { id: 'hebrew', label: 'עברית' },
  { id: 'foreign', label: 'אנגלית' },
];

export default function SearchScreen({ onSelect, onBackToHub }: Props) {
  const [mode, setMode] = useState<'search' | 'test'>('search');

  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<Song[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const [selectedLanguage, setSelectedLanguage] = useState<'hebrew' | 'foreign' | 'both'>('both');
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [topOnly, setTopOnly] = useState(true);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [randomError, setRandomError] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [playerInputs, setPlayerInputs] = useState<string[]>(Array(6).fill(''));
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupError, setGroupError] = useState(false);

  const allSongsRef = useRef<Song[]>([]);
  const visibleCountRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      allSongsRef.current = [];
      visibleCountRef.current = 0;
      setVisible([]);
      setHasMore(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingInitial(true);
      allSongsRef.current = [];
      visibleCountRef.current = 0;
      setVisible([]);
      setHasMore(false);
      try {
        const songs = await searchSongs(query);
        allSongsRef.current = songs;
        const first = songs.slice(0, PAGE_SIZE);
        visibleCountRef.current = first.length;
        setVisible(first);
        setHasMore(songs.length > PAGE_SIZE);
      } catch {
        setVisible([]);
      } finally {
        setLoadingInitial(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const showMore = useCallback(() => {
    const all = allSongsRef.current;
    const current = visibleCountRef.current;
    if (current >= all.length) return;
    const next = Math.min(current + PAGE_SIZE, all.length);
    visibleCountRef.current = next;
    setVisible(all.slice(0, next));
    setHasMore(next < all.length);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) showMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showMore]);

  const stopPreview = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    setPlayingId(null);
  };

  const handlePreview = (song: Song) => {
    if (playingId === song.trackId) { stopPreview(); return; }
    stopPreview();
    const audio = new Audio(song.previewUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
    setPlayingId(song.trackId);
    audio.onended = stopPreview;
    stopTimerRef.current = setTimeout(stopPreview, PREVIEW_SECONDS * 1000);
  };

  const getTestConfig = (): TestConfig => ({ language: selectedLanguage, decades: selectedDecades, topOnly });

  const handleTestYourself = async () => {
    setLoadingRandom(true);
    setRandomError(false);
    try {
      const songs = await loadChartSongs();
      const picked = pickRandomSong(songs, selectedLanguage, selectedDecades, topOnly);
      if (!picked) { setRandomError(true); return; }
      const song = chartSongToSong(picked);
      const videoId = await findVideoId(picked.song, picked.performer);
      if (!videoId) { setRandomError(true); return; }
      stopPreview();
      onSelect(song, videoId, true, getTestConfig());
    } catch {
      setRandomError(true);
    } finally {
      setLoadingRandom(false);
    }
  };

  const handleStartGroupGame = async () => {
    const players = playerInputs.map(s => s.trim()).filter(Boolean);
    if (players.length < 2) return;
    setLoadingGroup(true);
    setGroupError(false);
    try {
      const songs = await loadChartSongs();
      const picked = pickRandomSong(songs, selectedLanguage, selectedDecades, topOnly);
      if (!picked) { setGroupError(true); return; }
      const song = chartSongToSong(picked);
      const videoId = await findVideoId(picked.song, picked.performer);
      if (!videoId) { setGroupError(true); return; }
      stopPreview();
      onSelect(song, videoId, true, getTestConfig(), players);
    } catch {
      setGroupError(true);
    } finally {
      setLoadingGroup(false);
    }
  };

  const updatePlayerInput = (index: number, value: string) =>
    setPlayerInputs(prev => prev.map((v, i) => i === index ? value : v));

  const filledPlayers = playerInputs.filter(s => s.trim());
  const anyLoading = loadingRandom || loadingGroup;

  const pill = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
      active
        ? 'bg-[#FFDA57] text-[#0C0C0C] border-[#FFDA57]'
        : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white/80'
    }`;

  return (
    <div className="flex flex-col h-dvh bg-[#0C0C0C] text-white">
      <Header title="זהה את השיר" onBack={onBackToHub} />

      {/* Mode toggle */}
      <div className="px-4 pt-1 pb-3 flex-shrink-0">
        <div className="flex bg-[#141414] border border-white/[0.07] rounded-xl p-1">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'search'
                ? 'bg-[#FFDA57] text-[#0C0C0C]'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            חפש שיר
          </button>
          <button
            onClick={() => setMode('test')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'test'
                ? 'bg-[#FFDA57] text-[#0C0C0C]'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            בחן את עצמך
          </button>
        </div>
      </div>

      {/* Search input */}
      {mode === 'search' && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש שיר / זמר / להקה..."
              className="w-full bg-[#141414] border border-white/[0.08] rounded-xl px-4 py-3 text-base outline-none focus:border-[#FFDA57]/40 focus:ring-1 focus:ring-[#FFDA57]/20 placeholder-white/25 transition-colors"
              autoFocus
            />
            {loadingInitial && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#FFDA57]/30 border-t-[#FFDA57] rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search results */}
      {mode === 'search' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 min-h-0">
          {visible.map((song) => (
            <div key={song.trackId} className="flex items-center gap-2 bg-[#141414] border border-white/[0.06] rounded-xl p-3">
              <button
                onClick={() => { stopPreview(); onSelect(song); }}
                className="flex-1 flex items-center gap-3 text-right min-w-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={song.artworkUrl100} alt="" className="w-12 h-12 rounded-lg flex-shrink-0 object-cover" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{song.trackName}</p>
                  <p className="text-white/45 text-xs truncate mt-0.5">{song.artistName}</p>
                </div>
              </button>

              <button
                onClick={() => handlePreview(song)}
                className={`relative w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm transition-colors ${
                  playingId === song.trackId
                    ? 'bg-[#FFDA57]/20 text-[#FFDA57]'
                    : 'bg-white/[0.06] text-white/60 hover:bg-white/10'
                }`}
              >
                {playingId === song.trackId && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
                    <circle
                      cx="20" cy="20" r="18"
                      fill="none"
                      stroke="#FFDA57"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="113.1"
                      strokeDashoffset="113.1"
                      transform="rotate(-90 20 20)"
                      style={{ animation: `progress-ring ${PREVIEW_SECONDS}s linear forwards` }}
                    />
                  </svg>
                )}
                <span className="text-xs">{playingId === song.trackId ? '■' : '▶'}</span>
              </button>
            </div>
          ))}

          <div ref={sentinelRef} className="min-h-[40px] flex justify-center items-center">
            {hasMore && (
              <div className="w-5 h-5 border-2 border-[#FFDA57]/30 border-t-[#FFDA57] rounded-full animate-spin" />
            )}
          </div>

          {!loadingInitial && query.trim() && visible.length === 0 && (
            <p className="text-center text-white/35 text-sm mt-8">לא נמצאו תוצאות</p>
          )}
        </div>
      )}

      {/* Test yourself */}
      {mode === 'test' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">

          <div className="mb-5">
            <p className="text-xs text-white/40 mb-2.5 font-semibold tracking-widest uppercase">שפה</p>
            <div className="flex gap-2">
              {LANGUAGES.map(({ id, label }) => (
                <button key={id} onClick={() => { setSelectedLanguage(id); setRandomError(false); }} className={pill(selectedLanguage === id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs text-white/40 mb-2.5 font-semibold tracking-widest uppercase">עשור</p>
            <div className="flex flex-wrap gap-2">
              {DECADES.map((d) => (
                <button key={d} onClick={() => { setSelectedDecades(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); setRandomError(false); }} className={pill(selectedDecades.includes(d))}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs text-white/40 mb-2.5 font-semibold tracking-widest uppercase">מיקום</p>
            <div className="flex gap-2">
              <button onClick={() => { setTopOnly(true); setRandomError(false); }} className={pill(topOnly)}>טופ 5</button>
              <button onClick={() => { setTopOnly(false); setRandomError(false); }} className={pill(!topOnly)}>כל המיקומים</button>
            </div>
          </div>

          {randomError && (
            <p className="text-center text-[#FF4757] text-sm mb-4">לא נמצאו שירים, נסה קריטריונים אחרים</p>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleTestYourself}
              disabled={anyLoading}
              className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-base transition-opacity disabled:opacity-50 flex items-center justify-center"
            >
              {loadingRandom
                ? <div className="w-5 h-5 border-2 border-[#0C0C0C]/30 border-t-[#0C0C0C] rounded-full animate-spin" />
                : 'משחק אישי'}
            </button>

            <button
              onClick={() => { setShowGroupModal(true); setGroupError(false); }}
              disabled={anyLoading}
              className="w-full py-4 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white font-bold text-base transition-colors hover:bg-white/10 disabled:opacity-50 flex items-center justify-center"
            >
              משחק קבוצתי
            </button>
          </div>
        </div>
      )}

      {/* Group modal */}
      {showGroupModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
          onClick={() => { if (!loadingGroup) setShowGroupModal(false); }}
        >
          <div
            className="bg-[#141414] border border-white/[0.08] rounded-t-3xl w-full max-w-md p-5 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">שחקנים</h2>
              <button
                onClick={() => { if (!loadingGroup) setShowGroupModal(false); }}
                className="text-white/40 hover:text-white transition-colors w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {playerInputs.map((name, i) => (
                <input
                  key={i}
                  value={name}
                  onChange={e => updatePlayerInput(i, e.target.value)}
                  placeholder={`שחקן ${i + 1}`}
                  disabled={loadingGroup}
                  className="bg-[#1e1e1e] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FFDA57]/30 placeholder-white/25 disabled:opacity-50"
                />
              ))}
            </div>

            {groupError && (
              <p className="text-center text-[#FF4757] text-sm mb-3">לא נמצאו שירים, נסה קריטריונים אחרים</p>
            )}

            <button
              onClick={handleStartGroupGame}
              disabled={filledPlayers.length < 2 || loadingGroup}
              className="w-full py-3.5 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-base transition-opacity disabled:opacity-50 flex items-center justify-center"
            >
              {loadingGroup
                ? <div className="w-5 h-5 border-2 border-[#0C0C0C]/30 border-t-[#0C0C0C] rounded-full animate-spin" />
                : 'התחל'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
