'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchSongs, PAGE_SIZE, type Song } from '@/lib/itunes';

interface Props {
  onSelect: (song: Song) => void;
}

export default function SearchScreen({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<Song[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const allSongsRef = useRef<Song[]>([]);
  const visibleCountRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <div className="p-4 pt-8">
        <h1 className="text-2xl font-bold text-center mb-6">נחש את השיר</h1>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש שיר..."
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            autoFocus
          />
          {loadingInitial && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {visible.map((song) => (
          <button
            key={song.trackId}
            onClick={() => onSelect(song)}
            className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl p-3 text-right transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={song.artworkUrl100}
              alt=""
              className="w-14 h-14 rounded-lg flex-shrink-0 object-cover"
            />
            <div className="min-w-0">
              <p className="font-semibold truncate">{song.trackName}</p>
              <p className="text-gray-200 text-sm truncate">{song.artistName}</p>
            </div>
          </button>
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
    </div>
  );
}
