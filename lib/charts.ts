import type { Song } from '@/lib/itunes';

export interface ChartSong {
  song: string;
  performer: string;
  year: number;
  position: number;
  language: 'hebrew' | 'foreign';
}

export interface TestConfig {
  language: 'hebrew' | 'foreign' | 'both';
  decades: string[];
  topOnly: boolean;
}

const DECADE_STARTS: Record<string, number> = {
  '60s': 1960, '70s': 1970, '80s': 1980, '90s': 1990,
  '2000s': 2000, '2010s': 2010, '2020s': 2020,
};

let cache: ChartSong[] | null = null;

export async function loadChartSongs(): Promise<ChartSong[]> {
  if (cache) return cache;
  const res = await fetch('/data/israeli-charts.json');
  cache = (await res.json()) as ChartSong[];
  return cache;
}

export function pickRandomSong(
  songs: ChartSong[],
  language: 'hebrew' | 'foreign' | 'both',
  decades: string[],
  topOnly: boolean,
): ChartSong | null {
  let pool = songs;

  if (language !== 'both') {
    pool = pool.filter(s => s.language === language);
  }

  if (decades.length > 0) {
    pool = pool.filter(s =>
      decades.some(d => {
        const start = DECADE_STARTS[d];
        return start !== undefined && s.year >= start && s.year < start + 10;
      })
    );
  }

  if (topOnly) {
    pool = pool.filter(s => s.position <= 5);
  }

  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function chartSongToSong(cs: ChartSong): Song {
  const hash = Math.abs(
    (cs.song + cs.performer + cs.year).split('').reduce(
      (h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0
    )
  );
  return {
    trackId: hash,
    trackName: cs.song,
    artistName: cs.performer,
    artworkUrl100: '',
    previewUrl: '',
  };
}
