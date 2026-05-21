import type { Song } from '@/lib/itunes';

const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? '';

const HEBREW_GENRES: Record<string, string> = {
  'pop': 'פופ',
  'rock': 'רוק',
  'hip hop': 'היפ הופ',
  'r&b': 'R&B',
  'electronic': 'אלקטרוני',
  'country': 'קאנטרי',
  'jazz': "ג'אז",
};

const SKIP_TITLE = /\b(compilation|mix|medley|playlist|megamix|mashup|best of|top \d|greatest hits)\b/i;

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](official\s*(music\s*)?video|official\s*audio|lyrics?|audio|remastered|hd|4k|mv|visualizer)[\)\]]/gi, '')
    .trim();
}

function buildPopularQuery(genre?: string, decade?: string, language?: 'hebrew' | 'english'): string {
  if (language === 'hebrew') {
    const parts = ['שירים ישראלים'];
    if (decade) parts.push(decade);
    if (genre) parts.push(HEBREW_GENRES[genre] ?? genre);
    return parts.join(' ');
  }
  const parts: string[] = [];
  if (decade) parts.push(decade);
  if (genre) parts.push(genre);
  parts.push('hits music');
  return parts.join(' ');
}

export async function searchPopularSong(
  genre?: string,
  decade?: string,
  language?: 'hebrew' | 'english'
): Promise<{ song: Song; videoId: string } | null> {
  const q = encodeURIComponent(buildPopularQuery(genre, decade, language));
  const url =
    `https://www.googleapis.com/youtube/v3/search?q=${q}` +
    `&type=video&videoCategoryId=10&order=viewCount&part=snippet&maxResults=20&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } } }[] =
    (data.items ?? []).filter((item: { id: { videoId?: string }; snippet: { title: string } }) =>
      item.id?.videoId && !SKIP_TITLE.test(item.snippet.title)
    );
  if (!items.length) return null;

  const pool = items.slice(0, Math.min(10, items.length));
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const videoId = picked.id.videoId;
  const snippet = picked.snippet;

  const song: Song = {
    trackId: videoId.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0),
    trackName: cleanTitle(snippet.title),
    artistName: snippet.channelTitle,
    artworkUrl100: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
    previewUrl: '',
  };

  return { song, videoId };
}

export async function findVideoId(trackName: string, artistName: string): Promise<string | null> {
  const q = encodeURIComponent(`${trackName} ${artistName}`);
  const url = `https://www.googleapis.com/youtube/v3/search?q=${q}&type=video&part=id&maxResults=1&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.items?.[0]?.id?.videoId as string) ?? null;
}

// Module-level singleton so the API script is only injected once
let apiReadyPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (apiReadyPromise) return apiReadyPromise;
  apiReadyPromise = new Promise<void>((resolve) => {
    if (typeof window === 'undefined') return;
    if (window.YT?.Player) { resolve(); return; }
    (window as Window & { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiReadyPromise;
}
