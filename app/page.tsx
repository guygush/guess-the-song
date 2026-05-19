'use client';

import { useState } from 'react';
import SearchScreen from '@/components/SearchScreen';
import LoadingScreen from '@/components/LoadingScreen';
import PlayScreen from '@/components/PlayScreen';
import { findVideoId } from '@/lib/youtube';
import type { Song } from '@/lib/itunes';

type Screen =
  | { name: 'search' }
  | { name: 'loading'; song: Song }
  | { name: 'play'; song: Song; videoId: string };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ name: 'search' });

  async function handleSelect(song: Song) {
    setScreen({ name: 'loading', song });
    try {
      const videoId = await findVideoId(song.trackName, song.artistName);
      if (!videoId) throw new Error('No YouTube result found');
      setScreen({ name: 'play', song, videoId });
    } catch (err) {
      console.error(err);
      setScreen({ name: 'search' });
    }
  }

  if (screen.name === 'loading') {
    return <LoadingScreen songName={screen.song.trackName} artist={screen.song.artistName} />;
  }

  if (screen.name === 'play') {
    return (
      <PlayScreen
        song={screen.song}
        videoId={screen.videoId}
        onNextSong={() => setScreen({ name: 'search' })}
      />
    );
  }

  return <SearchScreen onSelect={handleSelect} />;
}
