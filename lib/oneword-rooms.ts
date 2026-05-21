import { supabase } from './supabase';
import { pickWord } from './oneword-words';

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface Room {
  id: string;
  status: RoomStatus;
  organizer_id: string;
  guesser_order: string[];
  current_turn: number;
  total_score: number;
  current_word: string;
  end_reason?: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_organizer: boolean;
  is_active: boolean;
}

export interface Hint {
  id: string;
  room_id: string;
  turn_number: number;
  player_id: string;
  word: string;
}

export interface Guess {
  id: string;
  room_id: string;
  turn_number: number;
  guess: string;
  is_correct: boolean;
}

function randomCode(): string {
  return String(Math.floor(Math.random() * 90) + 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function createRoom(playerId: string, playerName: string): Promise<Room> {
  let id = '';
  // retry until we get a unique code
  for (let i = 0; i < 10; i++) {
    id = randomCode();
    const { data } = await supabase.from('ow_rooms').select('id').eq('id', id).maybeSingle();
    if (!data) break;
  }
  const { data, error } = await supabase
    .from('ow_rooms')
    .insert({ id, status: 'lobby', organizer_id: playerId, guesser_order: [], current_turn: 0, total_score: 0, current_word: '' })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('ow_players').insert({ id: playerId, room_id: id, name: playerName, is_organizer: true, is_active: true });
  return data as Room;
}

export async function joinRoom(roomId: string, playerId: string, playerName: string): Promise<Room> {
  const { data: room, error } = await supabase.from('ow_rooms').select('*').eq('id', roomId).single();
  if (error || !room) throw new Error('חדר לא נמצא');
  if (room.status !== 'lobby') throw new Error('המשחק כבר התחיל');

  await supabase.from('ow_players').insert({ id: playerId, room_id: roomId, name: playerName, is_organizer: false, is_active: true });
  return room as Room;
}

export async function startGame(roomId: string): Promise<void> {
  const { data: players } = await supabase.from('ow_players').select('id').eq('room_id', roomId).eq('is_active', true);
  if (!players || players.length < 3) throw new Error('צריך לפחות 3 שחקנים');

  const order = shuffle(players.map((p: { id: string }) => p.id));
  const word = pickWord();

  await supabase.from('ow_rooms').update({
    status: 'playing',
    guesser_order: order,
    current_turn: 0,
    current_word: word,
    total_score: 0,
  }).eq('id', roomId);
}

export async function sendHint(roomId: string, turnNumber: number, playerId: string, word: string): Promise<void> {
  await supabase.from('ow_hints').insert({ room_id: roomId, turn_number: turnNumber, player_id: playerId, word });
}

export async function sendGuess(room: Room, guessText: string): Promise<void> {
  const isCorrect = guessText.trim() === room.current_word.trim();
  await supabase.from('ow_guesses').insert({
    room_id: room.id,
    turn_number: room.current_turn,
    guess: guessText.trim(),
    is_correct: isCorrect,
  });
  if (isCorrect) {
    await supabase.from('ow_rooms').update({ total_score: room.total_score + 1 }).eq('id', room.id);
  }
}

export async function nextTurn(room: Room, activePlayers: Player[]): Promise<void> {
  const activeIds = activePlayers.filter(p => p.is_active).map(p => p.id);
  // advance guesser index cyclically, skipping inactive
  let nextIdx = (room.current_turn + 1) % room.guesser_order.length;
  for (let i = 0; i < room.guesser_order.length; i++) {
    if (activeIds.includes(room.guesser_order[nextIdx])) break;
    nextIdx = (nextIdx + 1) % room.guesser_order.length;
  }

  await supabase.from('ow_rooms').update({
    current_turn: nextIdx,
    current_word: pickWord(),
  }).eq('id', room.id);
}

export async function endGame(roomId: string, reason?: string): Promise<void> {
  await supabase.from('ow_rooms').update({ status: 'ended', end_reason: reason ?? null }).eq('id', roomId);
}

export async function markInactive(playerId: string, roomId: string): Promise<void> {
  await supabase.from('ow_players').update({ is_active: false }).eq('id', playerId).eq('room_id', roomId);
}
