'use client';

import { useState, useEffect, useRef } from 'react';
import GameHubScreen from '@/components/GameHubScreen';
import SearchScreen from '@/components/SearchScreen';
import LoadingScreen from '@/components/LoadingScreen';
import PlayScreen from '@/components/PlayScreen';
import SummaryScreen from '@/components/SummaryScreen';
import OneWordScreen from '@/components/OneWordScreen';
import { findVideoId } from '@/lib/youtube';
import { loadChartSongs, pickRandomSong, chartSongToSong, type TestConfig } from '@/lib/charts';
import type { Song } from '@/lib/itunes';

type Screen =
  | { name: 'hub' }
  | { name: 'search' }
  | { name: 'loading'; song: Song; hideMetadata?: boolean; testConfig?: TestConfig; groupPlayers?: string[]; scores?: Record<string, number> }
  | { name: 'play'; song: Song; videoId: string; hideMetadata?: boolean; testConfig?: TestConfig; groupPlayers?: string[]; scores: Record<string, number> }
  | { name: 'summary'; players: { name: string; score: number }[] }
  | { name: 'one-word' };

function addPoint(scores: Record<string, number>, winner: string | undefined): Record<string, number> {
  if (!winner) return scores;
  return { ...scores, [winner]: (scores[winner] ?? 0) + 1 };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ name: 'hub' });
  const screenRef = useRef(screen);
  const suppressPushRef = useRef(false);

  screenRef.current = screen;

  // Push a history entry for every forward navigation so Android back can pop it.
  useEffect(() => {
    const suppress = suppressPushRef.current;
    suppressPushRef.current = false;
    if (screen.name === 'hub' || suppress) return;
    window.history.pushState(null, '');
  }, [screen]);

  // Handle Android / browser hardware back button.
  useEffect(() => {
    const onPopState = () => {
      suppressPushRef.current = true;
      const s = screenRef.current;
      if (s.name === 'search' || s.name === 'one-word' || s.name === 'summary') {
        setScreen({ name: 'hub' });
      } else if (s.name === 'play' || s.name === 'loading') {
        setScreen({ name: 'search' });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  async function handleSelect(
    song: Song,
    knownVideoId?: string,
    hideMetadata?: boolean,
    testConfig?: TestConfig,
    groupPlayers?: string[],
  ) {
    const scores: Record<string, number> = {};
    setScreen({ name: 'loading', song, hideMetadata, testConfig, groupPlayers, scores });
    try {
      const videoId = knownVideoId ?? await findVideoId(song.trackName, song.artistName);
      if (!videoId) throw new Error('No YouTube result found');
      setScreen({ name: 'play', song, videoId, hideMetadata, testConfig, groupPlayers, scores });
    } catch (err) {
      console.error(err);
      setScreen({ name: 'search' });
    }
  }

  async function handleTestNext(
    config: TestConfig,
    groupPlayers?: string[],
    scores?: Record<string, number>,
  ) {
    try {
      const songs = await loadChartSongs();
      const picked = pickRandomSong(songs, config.language, config.decades, config.topOnly);
      if (!picked) { setScreen({ name: 'search' }); return; }
      const song = chartSongToSong(picked);
      setScreen({ name: 'loading', song, hideMetadata: true, testConfig: config, groupPlayers, scores });
      const videoId = await findVideoId(picked.song, picked.performer);
      if (!videoId) { setScreen({ name: 'search' }); return; }
      setScreen({ name: 'play', song, videoId, hideMetadata: true, testConfig: config, groupPlayers, scores: scores ?? {} });
    } catch {
      setScreen({ name: 'search' });
    }
  }

  if (screen.name === 'hub') {
    return (
      <GameHubScreen
        onSelectGame={(game) => setScreen(game === 'one-word' ? { name: 'one-word' } : { name: 'search' })}
      />
    );
  }

  if (screen.name === 'one-word') {
    return <OneWordScreen onBackToHub={() => setScreen({ name: 'hub' })} />;
  }

  if (screen.name === 'loading') {
    return <LoadingScreen songName={screen.song.trackName} artist={screen.song.artistName} hideMetadata={screen.hideMetadata} />;
  }

  if (screen.name === 'summary') {
    return <SummaryScreen players={screen.players} onDone={() => setScreen({ name: 'hub' })} />;
  }

  if (screen.name === 'play') {
    const { testConfig, groupPlayers, scores } = screen;

    const onNextSong = (winner?: string) => {
      if (!testConfig) { setScreen({ name: 'search' }); return; }
      handleTestNext(testConfig, groupPlayers, addPoint(scores, winner));
    };

    const onFinish = testConfig ? (winner?: string) => {
      const newScores = addPoint(scores, winner);
      if (groupPlayers) {
        setScreen({
          name: 'summary',
          players: groupPlayers.map(name => ({ name, score: newScores[name] ?? 0 })),
        });
      } else {
        setScreen({ name: 'search' });
      }
    } : undefined;

    return (
      <PlayScreen
        song={screen.song}
        videoId={screen.videoId}
        hideMetadata={screen.hideMetadata}
        groupPlayers={groupPlayers}
        onNextSong={onNextSong}
        onFinish={onFinish}
        onBack={() => setScreen({ name: 'search' })}
      />
    );
  }

  return <SearchScreen onSelect={handleSelect} onBackToHub={() => setScreen({ name: 'hub' })} />;
}
