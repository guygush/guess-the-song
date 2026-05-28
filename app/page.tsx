'use client';

import { useState, useEffect, useRef } from 'react';
import GameHubScreen from '@/components/GameHubScreen';
import SearchScreen from '@/components/SearchScreen';
import LoadingScreen from '@/components/LoadingScreen';
import PlayScreen from '@/components/PlayScreen';
import SummaryScreen from '@/components/SummaryScreen';
import OneWordScreen from '@/components/OneWordScreen';
import StemSetupScreen from '@/components/StemSetupScreen';
import StemPlayScreen from '@/components/StemPlayScreen';
import { findVideoId } from '@/lib/youtube';
import { loadChartSongs, pickRandomSong, chartSongToSong, type TestConfig } from '@/lib/charts';
import { loadStemManifest, pickStemSong, type StemSong } from '@/lib/stems';
import type { Song } from '@/lib/itunes';

type Screen =
  | { name: 'hub' }
  | { name: 'search' }
  | { name: 'loading'; song: Song; hideMetadata?: boolean; testConfig?: TestConfig; groupPlayers?: string[]; scores?: Record<string, number>; playedSongs?: Set<string> }
  | { name: 'play'; song: Song; videoId: string; hideMetadata?: boolean; testConfig?: TestConfig; groupPlayers?: string[]; scores: Record<string, number>; playedSongs?: Set<string> }
  | { name: 'summary'; players: { name: string; score: number }[] }
  | { name: 'one-word' }
  | { name: 'stems-setup' }
  | { name: 'stems-play'; song: StemSong; groupPlayers?: string[]; scores: Record<string, number>; playedSongs: Set<number>; language: 'hebrew' | 'foreign' | 'both'; decades: string[] };

function addPoint(scores: Record<string, number>, winner: string | undefined): Record<string, number> {
  if (!winner) return scores;
  return { ...scores, [winner]: (scores[winner] ?? 0) + 1 };
}

function addPoints(scores: Record<string, number>, winner: string | undefined, points: number): Record<string, number> {
  if (!winner) return scores;
  return { ...scores, [winner]: (scores[winner] ?? 0) + points };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ name: 'hub' });
  const screenRef = useRef(screen);
  const suppressPushRef = useRef(false);
  const hasHistoryEntryRef = useRef(false);
  const ignoreNextPopStateRef = useRef(false);

  screenRef.current = screen;

  // Keep exactly one history entry while away from hub.
  // Push once on first departure, replaceState on subsequent transitions,
  // and consume the entry via history.back() when returning to hub programmatically.
  useEffect(() => {
    if (screen.name === 'hub') {
      if (hasHistoryEntryRef.current) {
        ignoreNextPopStateRef.current = true;
        window.history.back();
        hasHistoryEntryRef.current = false;
      }
      return;
    }
    const suppress = suppressPushRef.current;
    suppressPushRef.current = false;
    if (suppress) return;
    if (hasHistoryEntryRef.current) {
      window.history.replaceState(null, '');
    } else {
      window.history.pushState(null, '');
      hasHistoryEntryRef.current = true;
    }
  }, [screen]);

  // Handle Android / browser hardware back button.
  useEffect(() => {
    const onPopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }
      hasHistoryEntryRef.current = false;
      suppressPushRef.current = true;
      const s = screenRef.current;
      if (s.name === 'search' || s.name === 'one-word' || s.name === 'summary' || s.name === 'stems-setup') {
        setScreen({ name: 'hub' });
      } else if (s.name === 'play' || s.name === 'loading') {
        setScreen({ name: 'search' });
      } else if (s.name === 'stems-play') {
        setScreen({ name: 'stems-setup' });
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
    const playedSongs = testConfig ? new Set([`${song.trackName}|${song.artistName}`]) : undefined;
    setScreen({ name: 'loading', song, hideMetadata, testConfig, groupPlayers, scores, playedSongs });
    try {
      const videoId = knownVideoId ?? await findVideoId(song.trackName, song.artistName);
      if (!videoId) throw new Error('No YouTube result found');
      setScreen({ name: 'play', song, videoId, hideMetadata, testConfig, groupPlayers, scores, playedSongs });
    } catch (err) {
      console.error(err);
      setScreen({ name: 'search' });
    }
  }

  async function handleTestNext(
    config: TestConfig,
    groupPlayers?: string[],
    scores?: Record<string, number>,
    playedSongs?: Set<string>,
  ) {
    try {
      const songs = await loadChartSongs();
      const picked = pickRandomSong(songs, config.language, config.decades, config.topN, playedSongs);
      if (!picked) { setScreen({ name: 'search' }); return; }
      const song = chartSongToSong(picked);
      const newPlayed = new Set([...(playedSongs ?? []), `${picked.song}|${picked.performer}`]);
      setScreen({ name: 'loading', song, hideMetadata: true, testConfig: config, groupPlayers, scores, playedSongs: newPlayed });
      const videoId = await findVideoId(picked.song, picked.performer);
      if (!videoId) { setScreen({ name: 'search' }); return; }
      setScreen({ name: 'play', song, videoId, hideMetadata: true, testConfig: config, groupPlayers, scores: scores ?? {}, playedSongs: newPlayed });
    } catch {
      setScreen({ name: 'search' });
    }
  }

  if (screen.name === 'hub') {
    return (
      <GameHubScreen
        onSelectGame={(game) => {
          if (game === 'one-word') setScreen({ name: 'one-word' });
          else if (game === 'stems') setScreen({ name: 'stems-setup' });
          else setScreen({ name: 'search' });
        }}
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
      handleTestNext(testConfig, groupPlayers, addPoint(scores, winner), screen.playedSongs);
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
        scores={scores}
        onNextSong={onNextSong}
        onFinish={onFinish}
        onBack={() => setScreen({ name: 'search' })}
      />
    );
  }

  if (screen.name === 'stems-setup') {
    return (
      <StemSetupScreen
        onStart={(song, language, decades, players) => {
          setScreen({ name: 'stems-play', song, groupPlayers: players, scores: {}, playedSongs: new Set([song.trackId]), language, decades });
        }}
        onBackToHub={() => setScreen({ name: 'hub' })}
      />
    );
  }

  if (screen.name === 'stems-play') {
    const { groupPlayers, scores, playedSongs, language, decades } = screen;

    const onNextSong = async (winner?: string, points?: number) => {
      const newScores = winner && points ? addPoints(scores, winner, points) : scores;
      const songs = await loadStemManifest();
      const next = pickStemSong(songs, language, decades, playedSongs);
      if (!next) {
        if (groupPlayers) {
          setScreen({ name: 'summary', players: groupPlayers.map(name => ({ name, score: newScores[name] ?? 0 })) });
        } else {
          setScreen({ name: 'stems-setup' });
        }
        return;
      }
      setScreen({ name: 'stems-play', song: next, groupPlayers, scores: newScores, playedSongs: new Set([...playedSongs, next.trackId]), language, decades });
    };

    const onFinish = (winner?: string, points?: number) => {
      if (groupPlayers) {
        const newScores = winner && points ? addPoints(scores, winner, points) : scores;
        setScreen({ name: 'summary', players: groupPlayers.map(name => ({ name, score: newScores[name] ?? 0 })) });
      } else {
        setScreen({ name: 'stems-setup' });
      }
    };

    return (
      <StemPlayScreen
        key={screen.song.trackId}
        song={screen.song}
        groupPlayers={groupPlayers}
        scores={scores}
        onNextSong={onNextSong}
        onFinish={onFinish}
        onBack={() => setScreen({ name: 'stems-setup' })}
      />
    );
  }

  return <SearchScreen onSelect={handleSelect} onBackToHub={() => setScreen({ name: 'hub' })} />;
}
