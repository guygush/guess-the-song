'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { markInactive, endGame } from '@/lib/oneword-rooms';
import type { Room, Player, Hint, Guess } from '@/lib/oneword-rooms';
import Header from '@/components/Header';
import JoinSubScreen from '@/components/oneword/JoinSubScreen';
import LobbySubScreen from '@/components/oneword/LobbySubScreen';
import GameSubScreen from '@/components/oneword/GameSubScreen';
import TurnSummarySubScreen from '@/components/oneword/TurnSummarySubScreen';

type SubScreen = 'join' | 'lobby' | 'game' | 'summary';

interface Props {
  onBackToHub: () => void;
}

export default function OneWordScreen({ onBackToHub }: Props) {
  const playerIdRef = useRef<string>(uuidv4());
  const playerId = playerIdRef.current;

  const [subScreen, setSubScreen] = useState<SubScreen>('join');
  const [roomId, setRoomId] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hints, setHints] = useState<Hint[]>([]);
  const [currentGuess, setCurrentGuess] = useState<Guess | null>(null);
  const [totalTurns, setTotalTurns] = useState(0);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const isOrganizerRef = useRef(isOrganizer);
  isOrganizerRef.current = isOrganizer;

  // Mark player inactive on unload
  useEffect(() => {
    if (!roomId) return;
    const handleUnload = () => {
      const id = roomIdRef.current;
      markInactive(playerId, id);
      if (isOrganizerRef.current) endGame(id, 'מנהל המשחק עזב');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, playerId]);

  // Subscribe to room, players, hints, guesses once we have a roomId
  useEffect(() => {
    if (!roomId) return;

    // Load initial state
    async function load() {
      const [{ data: roomData }, { data: playersData }] = await Promise.all([
        supabase.from('ow_rooms').select('*').eq('id', roomId).single(),
        supabase.from('ow_players').select('*').eq('room_id', roomId),
      ]);
      if (roomData) setRoom(roomData as Room);
      if (playersData) setPlayers(playersData as Player[]);
    }
    load();

    const channel = supabase
      .channel(`room:${roomId}`)
      // Room changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ow_rooms', filter: `id=eq.${roomId}` }, payload => {
        const r = payload.new as Room;
        setRoom(r);
        if (r.status === 'playing') {
          setHints([]);
          setCurrentGuess(null);
          setSubScreen('game');
        }
        if (r.status === 'ended') setSubScreen('summary');
      })
      // Player changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ow_players', filter: `room_id=eq.${roomId}` }, async () => {
        const { data } = await supabase.from('ow_players').select('*').eq('room_id', roomId);
        if (data) setPlayers(data as Player[]);
      })
      // Hints
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ow_hints', filter: `room_id=eq.${roomId}` }, payload => {
        setHints(prev => [...prev, payload.new as Hint]);
      })
      // Guesses
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ow_guesses', filter: `room_id=eq.${roomId}` }, payload => {
        const g = payload.new as Guess;
        setCurrentGuess(g);
        setTotalTurns(t => t + 1);
        setSubScreen('summary');
      })
      // Presence for dropout detection
      .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
        const leftIds = (leftPresences as unknown as Array<{ player_id: string }>).map(p => p.player_id);
        for (const id of leftIds) {
          await markInactive(id, roomId);
          if (id === room?.organizer_id) {
            await endGame(roomId, 'מנהל המשחק עזב');
            return;
          }
        }
        const { data } = await supabase.from('ow_players').select('*').eq('room_id', roomId).eq('is_active', true);
        if (data && data.length < 3 && room?.status === 'playing') {
          await endGame(roomId, 'המשחק הסתיים כי נשארו פחות מ-3 שחקנים');
        }
      })
      .subscribe();

    // Track own presence
    channel.track({ player_id: playerId });

    return () => { supabase.removeChannel(channel); };
  }, [roomId, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load hints/guess when re-entering game or summary after reconnect
  useEffect(() => {
    if (!roomId || !room) return;
    async function loadTurnData() {
      const [{ data: hintData }, { data: guessData }, { data: allGuesses }] = await Promise.all([
        supabase.from('ow_hints').select('*').eq('room_id', roomId).eq('turn_number', room!.current_turn),
        supabase.from('ow_guesses').select('*').eq('room_id', roomId).eq('turn_number', room!.current_turn).maybeSingle(),
        supabase.from('ow_guesses').select('id').eq('room_id', roomId),
      ]);
      if (hintData) setHints(hintData as Hint[]);
      if (guessData) setCurrentGuess(guessData as Guess);
      if (allGuesses) setTotalTurns(allGuesses.length);
    }
    loadTurnData();
  }, [roomId, room?.current_turn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoined = useCallback((rid: string, organizer: boolean) => {
    setRoomId(rid);
    setIsOrganizer(organizer);
    setSubScreen('lobby');
  }, []);

  const handleBack = useCallback(() => {
    if (subScreen === 'join') {
      onBackToHub();
    } else if (subScreen === 'lobby') {
      markInactive(playerId, roomId);
      setRoomId('');
      setSubScreen('join');
    }
    // no back from game/summary — use End Game button
  }, [subScreen, onBackToHub, playerId, roomId]);

  const showBack = subScreen === 'join' || subScreen === 'lobby';

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <Header title="במילה אחת" onBack={showBack ? handleBack : undefined} />

      {subScreen === 'join' && (
        <JoinSubScreen playerId={playerId} onJoined={handleJoined} />
      )}

      {subScreen === 'lobby' && (
        <LobbySubScreen
          roomId={roomId}
          isOrganizer={isOrganizer}
          players={players}
          onStart={() => setSubScreen('game')}
        />
      )}

      {subScreen === 'game' && room && (
        <GameSubScreen
          room={room}
          myPlayerId={playerId}
          players={players}
          hints={hints}
        />
      )}

      {subScreen === 'summary' && room && currentGuess && (
        <TurnSummarySubScreen
          room={room}
          isOrganizer={isOrganizer}
          players={players}
          guess={currentGuess}
          totalTurns={totalTurns}
          onNextTurn={() => setSubScreen('game')}
          onEndGame={() => setSubScreen('summary')}
          onBackToHub={onBackToHub}
        />
      )}
    </div>
  );
}
