export interface Song {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
}

export const PAGE_SIZE = 20;
const FETCH_LIMIT = 100;

export async function searchSongs(query: string): Promise<Song[]> {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
    `&media=music&entity=song&limit=${FETCH_LIMIT}`;
  const res = await fetch(url);
  const data = await res.json();
  return ((data.results ?? []) as Song[]).filter((s) => s.previewUrl);
}
