'use client';

import { useState } from 'react';
import SearchScreen from '@/components/SearchScreen';
import LoadingScreen from '@/components/LoadingScreen';
import PlayScreen from '@/components/PlayScreen';
import { findVideoId } from '@/lib/youtube';
import { loadChartSongs, pickRandomSong, chartSongToSong, type TestConfig } from '@/lib/charts';
import type { Song } from '@/lib/itunes';

type Screen =
  | { name: 'search' }
  | { name: 'loading'; song: Song; hideMetadata?: boolean; testConfig?: TestConfig }
  | { name: 'play'; song: Song; videoId: string; hideMetadata?: boolean; testConfig?: TestConfig };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ name: 'search' });

  async function handleSelect(song: Song, knownVideoId?: string, hideMetadata?: boolean, testConfig?: TestConfig) {
    setScreen({ name: 'loading', song, hideMetadata, testConfig });
    try {
      const videoId = knownVideoId ?? await findVideoId(song.trackName, song.artistName);
      if (!videoId) throw new Error('No YouTube result found');
      setScreen({ name: 'play', song, videoId, hideMetadata, testConfig });
    } catch (err) {
      console.error(err);
      setScreen({ name: 'search' });
    }
  }

  async function handleTestNext(config: TestConfig) {
    try {
      const songs = await loadChartSongs();
      const picked = pickRandomSong(songs, config.language, config.decades, config.topOnly);
      if (!picked) { setScreen({ name: 'search' }); return; }
      const song = chartSongToSong(picked);
      setScreen({ name: 'loading', song, hideMetadata: true, testConfig: config });
      const videoId = await findVideoId(picked.song, picked.performer);
      if (!videoId) { setScreen({ name: 'search' }); return; }
      setScreen({ name: 'play', song, videoId, hideMetadata: true, testConfig: config });
    } catch {
      setScreen({ name: 'search' });
    }
  }

  if (screen.name === 'loading') {
    return <LoadingScreen songName={screen.song.trackName} artist={screen.song.artistName} hideMetadata={screen.hideMetadata} />;
  }

  if (screen.name === 'play') {
    return (
      <PlayScreen
        song={screen.song}
        videoId={screen.videoId}
        hideMetadata={screen.hideMetadata}
        onNextSong={screen.testConfig ? () => handleTestNext(screen.testConfig!) : () => setScreen({ name: 'search' })}
      />
    );
  }

  return <SearchScreen onSelect={handleSelect} />;
}
