const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? '';

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
