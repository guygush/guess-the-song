'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchSongs, PAGE_SIZE, type Song } from '@/lib/itunes';
import { loadChartSongs, pickRandomSong, chartSongToSong, type TestConfig } from '@/lib/charts';
import { findVideoId } from '@/lib/youtube';

interface Props {
  onSelect: (song: Song, videoId?: string, hideMetadata?: boolean, testConfig?: TestConfig) => void;
}

const PREVIEW_SECONDS = 10;

const DECADES = ['60s', '70s', '80s', '90s', '2000s', '2010s', '2020s'];

const LANGUAGES: { id: 'hebrew' | 'foreign' | 'both'; label: string }[] = [
  { id: 'both', label: 'גם וגם' },
  { id: 'hebrew', label: 'עברית' },
  { id: 'foreign', label: 'אנגלית' },
];

export default function SearchScreen({ onSelect }: Props) {
  const [mode, setMode] = useState<'search' | 'test'>('search');

  // Search mode
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<Song[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  // Test yourself mode
  const [selectedLanguage, setSelectedLanguage] = useState<'hebrew' | 'foreign' | 'both'>('both');
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [topOnly, setTopOnly] = useState(true);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [randomError, setRandomError] = useState(false);

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
      onSelect(song, videoId, true, { language: selectedLanguage, decades: selectedDecades, topOnly });
    } catch {
      setRandomError(true);
    } finally {
      setLoadingRandom(false);
    }
  };

  const pill = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
    }`;

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <div className="p-4 pt-8">
        <h1 className="text-2xl font-bold text-center mb-6">נחש את השיר</h1>

        {/* Mode toggle */}
        <div className="flex bg-gray-800 rounded-xl p-1 mb-4">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'search' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            חפש שיר
          </button>
          <button
            onClick={() => setMode('test')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'test' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            בחן את עצמך
          </button>
        </div>

        {mode === 'search' && (
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש שיר/זמר/להקה..."
              className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
              autoFocus
            />
            {loadingInitial && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search results */}
      {mode === 'search' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {visible.map((song) => (
            <div key={song.trackId} className="flex items-center gap-2 bg-gray-800 rounded-xl p-3">
              <button
                onClick={() => { stopPreview(); onSelect(song); }}
                className="flex-1 flex items-center gap-3 text-right min-w-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={song.artworkUrl100} alt="" className="w-14 h-14 rounded-lg flex-shrink-0 object-cover" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{song.trackName}</p>
                  <p className="text-gray-200 text-sm truncate">{song.artistName}</p>
                </div>
              </button>

              <button
                onClick={() => handlePreview(song)}
                className={`relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm transition-colors ${
                  playingId === song.trackId
                    ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                    : 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700'
                }`}
              >
                {playingId === song.trackId && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
                    <circle
                      cx="20" cy="20" r="18"
                      fill="none"
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="113.1"
                      strokeDashoffset="113.1"
                      transform="rotate(-90 20 20)"
                      style={{ animation: `progress-ring ${PREVIEW_SECONDS}s linear forwards` }}
                    />
                  </svg>
                )}
                {playingId === song.trackId ? '■' : '▶'}
              </button>
            </div>
          ))}

          <div ref={sentinelRef} className="min-h-[48px] flex justify-center items-center">
            {hasMore && (
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {!loadingInitial && query.trim() && visible.length === 0 && (
            <p className="text-center text-gray-300 mt-8">לא נמצאו תוצאות</p>
          )}
        </div>
      )}

      {/* Test yourself filters */}
      {mode === 'test' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">

          <div className="mb-5">
            <p className="text-sm text-gray-400 mb-2">שפה</p>
            <div className="flex gap-2">
              {LANGUAGES.map(({ id, label }) => (
                <button key={id} onClick={() => { setSelectedLanguage(id); setRandomError(false); }} className={pill(selectedLanguage === id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm text-gray-400 mb-2">עשור</p>
            <div className="flex flex-wrap gap-2">
              {DECADES.map((d) => (
                <button key={d} onClick={() => { setSelectedDecades(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); setRandomError(false); }} className={pill(selectedDecades.includes(d))}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-2">מיקום</p>
            <div className="flex gap-2">
              <button onClick={() => { setTopOnly(true); setRandomError(false); }} className={pill(topOnly)}>
                טופ 5
              </button>
              <button onClick={() => { setTopOnly(false); setRandomError(false); }} className={pill(!topOnly)}>
                כל המיקומים
              </button>
            </div>
          </div>

          {randomError && (
            <p className="text-center text-red-400 text-sm mb-4">לא נמצאו שירים, נסה קריטריונים אחרים</p>
          )}

          <button
            onClick={handleTestYourself}
            disabled={loadingRandom}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loadingRandom
              ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'בחר שיר בשבילי'}
          </button>
        </div>
      )}
    </div>
  );
}
