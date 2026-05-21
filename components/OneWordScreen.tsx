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

  const [lastBc, setLastBc] = useState<string | null>(null);
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [channelStatus, setChannelStatus] = useState<string>('');

  // Keep refs so async callbacks always see current values without stale closures
  const roomIdRef = useRef(roomId);
  const roomRef = useRef(room);
  const isOrganizerRef = useRef(isOrganizer);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  roomIdRef.current = roomId;
  roomRef.current = room;
  isOrganizerRef.current = isOrganizer;

  // Mark player inactive on unload
  useEffect(() => {
    if (!roomId) return;
    const handleUnload = () => {
      markInactive(playerId, roomIdRef.current);
      if (isOrganizerRef.current) endGame(roomIdRef.current, 'מנהל המשחק עזב');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, playerId]);

  // Subscribe to all realtime changes once we have a roomId
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

    // No colon in channel name (Phoenix treats "topic:subtopic" as special)
    // No self:true — sender applies own state directly via handleBroadcast
    const channel = supabase.channel('ow-' + roomId)

      .on('broadcast', { event: 'player_joined' }, async () => {
        const { data } = await supabase.from('ow_players').select('*').eq('room_id', roomIdRef.current);
        if (data) setPlayers(data as Player[]);
        setLastBc('player_joined');
      })

      .on('broadcast', { event: 'game_started' }, (msg) => {
        const r = (msg.payload as { room?: Room }).room;
        if (r) {
          setRoom(r);
          setHints([]);
          setCurrentGuess(null);
          setSubScreen('game');
          setLastBc('game_started');
        }
      })

      .on('broadcast', { event: 'hint_sent' }, (msg) => {
        const h = (msg.payload as { hint?: Hint }).hint;
        if (!h) return;
        setHints(prev => prev.some(x => x.id === h.id) ? prev : [...prev, h]);
        setLastBc('hint_sent');
      })

      .on('broadcast', { event: 'guess_made' }, (msg) => {
        const { guess, room: updatedRoom } = msg.payload as { guess?: Guess; room?: Room };
        if (!guess) return;
        setCurrentGuess(guess);
        setTotalTurns(t => t + 1);
        if (updatedRoom) setRoom(updatedRoom);
        setSubScreen('summary');
        setLastBc('guess_made');
      })

      .on('broadcast', { event: 'next_turn' }, (msg) => {
        const r = (msg.payload as { room?: Room }).room;
        if (r) {
          setRoom(r);
          setHints([]);
          setCurrentGuess(null);
          setSubScreen('game');
          setLastBc('next_turn');
        }
      })

      .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
        const leftIds = (leftPresences as unknown as Array<{ player_id: string }>).map(p => p.player_id);
        const rid = roomIdRef.current;
        const currentRoom = roomRef.current;
        for (const id of leftIds) {
          await markInactive(id, rid);
          if (id === currentRoom?.organizer_id) {
            await endGame(rid, 'מנהל המשחק עזב');
            return;
          }
        }
        const { data } = await supabase.from('ow_players').select('*').eq('room_id', rid).eq('is_active', true);
        if (data && data.length < 3 && currentRoom?.status === 'playing') {
          await endGame(rid, 'המשחק הסתיים כי נשארו פחות מ-3 שחקנים');
        }
      })

      .subscribe((status, err) => {
        setChannelStatus(err ? `${status}:${err.message}` : status);
        if (status === 'SUBSCRIBED') {
          channel.track({ player_id: playerId });
          channel.send({ type: 'broadcast', event: 'player_joined', payload: {} });
        }
      });

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply broadcast payload locally (for the sender, since self-echo is off)
  // and send to other clients via the channel.
  const handleBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    if (event === 'hint_sent') {
      const h = (payload as { hint?: Hint }).hint;
      if (h) setHints(prev => prev.some(x => x.id === h.id) ? prev : [...prev, h]);
    } else if (event === 'guess_made') {
      const { guess, room: updatedRoom } = payload as { guess?: Guess; room?: Room };
      if (guess) {
        setCurrentGuess(guess);
        setTotalTurns(t => t + 1);
        if (updatedRoom) setRoom(updatedRoom);
        setSubScreen('summary');
      }
    } else if (event === 'next_turn') {
      const r = (payload as { room?: Room }).room;
      if (r) { setRoom(r); setHints([]); setCurrentGuess(null); }
    }
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling — refresh players + room status every 1s while in lobby
  useEffect(() => {
    if (subScreen !== 'lobby' || !roomId) return;
    const interval = setInterval(async () => {
      const [{ data: playersData }, { data: roomData }] = await Promise.all([
        supabase.from('ow_players').select('*').eq('room_id', roomId),
        supabase.from('ow_rooms').select('*').eq('id', roomId).single(),
      ]);
      if (playersData) setPlayers(playersData as Player[]);
      if (roomData) {
        setRoom(roomData as Room);
        if ((roomData as Room).status === 'playing') {
          setHints([]);
          setCurrentGuess(null);
          setSubScreen('game');
        }
      }
      setLastPoll('lobby');
    }, 1000);
    return () => clearInterval(interval);
  }, [subScreen, roomId]);

  // Polling — check for next turn or game end every 1s while in summary
  useEffect(() => {
    if (subScreen !== 'summary' || !roomId) return;
    const capturedTurn = roomRef.current?.current_turn;
    const interval = setInterval(async () => {
      const { data: roomData } = await supabase.from('ow_rooms').select('*').eq('id', roomId).single();
      if (!roomData) return;
      const r = roomData as Room;
      setRoom(r);
      if (r.current_turn !== capturedTurn) {
        setHints([]);
        setCurrentGuess(null);
        setSubScreen('game');
      }
      setLastPoll('summary');
    }, 1000);
    return () => clearInterval(interval);
  }, [subScreen, roomId]);

  // Polling — refresh hints and check for guess every 500ms while in game
  useEffect(() => {
    if (subScreen !== 'game' || !roomId || !room?.guesser_order?.length) return;
    const turnNumber = room.current_turn;
    const interval = setInterval(async () => {
      const [{ data: hintData }, { data: guessData }] = await Promise.all([
        supabase.from('ow_hints').select('*').eq('room_id', roomId).eq('turn_number', turnNumber),
        supabase.from('ow_guesses').select('*').eq('room_id', roomId).eq('turn_number', turnNumber).maybeSingle(),
      ]);
      if (hintData) setHints(hintData as Hint[]);
      if (guessData) {
        setCurrentGuess(guessData as Guess);
        const [{ data: all }, { data: freshRoom }] = await Promise.all([
          supabase.from('ow_guesses').select('id').eq('room_id', roomId),
          supabase.from('ow_rooms').select('*').eq('id', roomId).single(),
        ]);
        if (all) setTotalTurns(all.length);
        if (freshRoom) setRoom(freshRoom as Room);
        setSubScreen('summary');
      }
      setLastPoll('game');
    }, 500);
    return () => clearInterval(interval);
  }, [subScreen, roomId, room?.current_turn, room?.guesser_order?.length]);

  // When entering the game screen, always fetch fresh room data (guesser_order, current_word)
  useEffect(() => {
    if (subScreen !== 'game' || !roomId) return;
    supabase.from('ow_rooms').select('*').eq('id', roomId).single()
      .then(({ data }) => { if (data) setRoom(data as Room); });
  }, [subScreen, roomId]);

  // Load turn-specific data when current_turn advances (e.g. after next turn)
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
      setPlayers([]);
      setRoom(null);
      setSubScreen('join');
    }
  }, [subScreen, onBackToHub, playerId, roomId]);

  const showBack = subScreen === 'join' || subScreen === 'lobby';

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <Header title="במילה אחת" onBack={showBack ? handleBack : undefined} />

      {roomId && (
        <div className="flex gap-2 justify-center py-1 flex-wrap">
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${channelStatus === 'SUBSCRIBED' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
            ws:{channelStatus || '…'}
          </span>
          {lastBc && <span className="text-xs font-mono bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full">bc:{lastBc}</span>}
          {lastPoll && <span className="text-xs font-mono bg-amber-900 text-amber-200 px-2 py-0.5 rounded-full">poll:{lastPoll}</span>}
        </div>
      )}

      {subScreen === 'join' && (
        <JoinSubScreen playerId={playerId} onJoined={handleJoined} />
      )}

      {subScreen === 'lobby' && (
        <LobbySubScreen
          roomId={roomId}
          isOrganizer={isOrganizer}
          players={players}
          onStart={async () => {
            const { data } = await supabase.from('ow_rooms').select('*').eq('id', roomId).single();
            if (data) {
              setRoom(data as Room);
              channelRef.current?.send({ type: 'broadcast', event: 'game_started', payload: { room: data } });
              setSubScreen('game');
            }
          }}
        />
      )}

      {subScreen === 'game' && room && (
        <GameSubScreen
          room={room}
          myPlayerId={playerId}
          players={players}
          hints={hints}
          onBroadcast={handleBroadcast}
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
          onBroadcast={handleBroadcast}
        />
      )}
    </div>
  );
}
