'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { getPusher, publish } from '@/lib/pusher-client';
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
  const [rejectedHintIds, setRejectedHintIds] = useState<string[]>([]);
  const [hintsApproved, setHintsApproved] = useState(false);

  const roomIdRef = useRef(roomId);
  const isOrganizerRef = useRef(isOrganizer);
  const channelNameRef = useRef<string>('');
  roomIdRef.current = roomId;
  isOrganizerRef.current = isOrganizer;

  useEffect(() => {
    if (!roomId) return;
    const handleUnload = () => {
      markInactive(playerId, roomIdRef.current);
      if (isOrganizerRef.current) endGame(roomIdRef.current, 'מנהל המשחק עזב');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, playerId]);

  useEffect(() => {
    if (!roomId) return;

    async function load() {
      const [{ data: roomData }, { data: playersData }] = await Promise.all([
        supabase.from('ow_rooms').select('*').eq('id', roomId).single(),
        supabase.from('ow_players').select('*').eq('room_id', roomId),
      ]);
      if (roomData) setRoom(roomData as Room);
      if (playersData) setPlayers(playersData as Player[]);
    }
    load();

    const channelName = 'ow-' + roomId;
    channelNameRef.current = channelName;
    const pusher = getPusher();
    const channel = pusher.subscribe(channelName);

    channel.bind('player_joined', async () => {
      const { data } = await supabase.from('ow_players').select('*').eq('room_id', roomIdRef.current);
      if (data) setPlayers(data as Player[]);
    });

    channel.bind('game_started', (msg: { room?: Room }) => {
      if (msg.room) {
        setRoom(msg.room);
        setHints([]);
        setCurrentGuess(null);
        setSubScreen('game');
      }
    });

    channel.bind('hint_sent', (msg: { hint?: Hint }) => {
      const h = msg.hint;
      if (!h) return;
      setHints(prev => prev.some(x => x.id === h.id) ? prev : [...prev, h]);
    });

    channel.bind('guess_made', (msg: { guess?: Guess; room?: Room }) => {
      if (!msg.guess) return;
      setCurrentGuess(msg.guess);
      setTotalTurns(t => t + 1);
      if (msg.room) setRoom(msg.room);
      setSubScreen('summary');
    });

    channel.bind('next_turn', (msg: { room?: Room }) => {
      if (msg.room) {
        setRoom(msg.room);
        setHints([]);
        setCurrentGuess(null);
        setRejectedHintIds([]);
        setHintsApproved(false);
        setSubScreen('game');
      }
    });

    channel.bind('hint_rejected', (msg: { hintId?: string; rejected?: boolean }) => {
      const { hintId: id, rejected } = msg;
      if (!id) return;
      setRejectedHintIds(prev => rejected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id));
    });

    channel.bind('hints_approved', () => {
      setHintsApproved(true);
    });

    publish(channelName, 'player_joined', {});

    return () => {
      getPusher().unsubscribe(channelName);
      channelNameRef.current = '';
    };
  }, [roomId, playerId]);

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
      if (r) { setRoom(r); setHints([]); setCurrentGuess(null); setRejectedHintIds([]); setHintsApproved(false); }
    } else if (event === 'hint_rejected') {
      const { hintId, rejected } = payload as { hintId?: string; rejected?: boolean };
      if (hintId !== undefined) setRejectedHintIds(prev => rejected ? (prev.includes(hintId) ? prev : [...prev, hintId]) : prev.filter(x => x !== hintId));
    } else if (event === 'hints_approved') {
      setHintsApproved(true);
    }
    if (channelNameRef.current) {
      publish(channelNameRef.current, event, payload);
    }
  }, []);

  useEffect(() => {
    if (subScreen !== 'game' || !roomId) return;
    supabase.from('ow_rooms').select('*').eq('id', roomId).single()
      .then(({ data }) => { if (data) setRoom(data as Room); });
  }, [subScreen, roomId]);

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
              await publish(channelNameRef.current, 'game_started', { room: data });
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
          isOrganizer={isOrganizer}
          rejectedHintIds={rejectedHintIds}
          hintsApproved={hintsApproved}
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
