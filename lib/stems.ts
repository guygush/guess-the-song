export interface StemSong {
  trackId: number;
  song: string;
  performer: string;
  year: number;
  language: 'hebrew' | 'foreign';
  stems: { bass: string; drums: string; other: string; vocals: string };
}

const DECADE_STARTS: Record<string, number> = {
  '60s': 1960, '70s': 1970, '80s': 1980, '90s': 1990,
  '2000s': 2000, '2010s': 2010, '2020s': 2020,
};

let cache: StemSong[] | null = null;

export async function loadStemManifest(): Promise<StemSong[]> {
  if (cache) return cache;
  const res = await fetch('/data/stems-manifest.json');
  cache = (await res.json()) as StemSong[];
  return cache;
}

export function pickStemSong(
  songs: StemSong[],
  language: 'hebrew' | 'foreign' | 'both',
  decades: string[],
  exclude?: Set<number>,
): StemSong | null {
  let pool = songs;

  if (language !== 'both') pool = pool.filter(s => s.language === language);

  if (decades.length > 0) {
    pool = pool.filter(s =>
      decades.some(d => {
        const start = DECADE_STARTS[d];
        return start !== undefined && s.year >= start && s.year < start + 10;
      })
    );
  }

  if (exclude?.size) pool = pool.filter(s => !exclude.has(s.trackId));

  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
