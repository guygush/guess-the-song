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

async function cleanupOldRooms(): Promise<void> {
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const [{ data: oldRooms }] = await Promise.all([
    supabase.from('ow_rooms').select('id').or(`status.eq.ended,created_at.lt.${cutoff}`),
  ]);
  const ids = oldRooms?.map(r => r.id) ?? [];
  if (!ids.length) return;
  await Promise.all([
    supabase.from('ow_guesses').delete().in('room_id', ids),
    supabase.from('ow_hints').delete().in('room_id', ids),
    supabase.from('ow_players').delete().in('room_id', ids),
  ]);
  await supabase.from('ow_rooms').delete().in('id', ids);
}

export async function createRoom(playerId: string, playerName: string): Promise<Room> {
  await cleanupOldRooms().catch(() => {}); // best-effort; never block room creation
  let id = '';
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

export async function sendHint(roomId: string, turnNumber: number, playerId: string, word: string): Promise<Hint> {
  const { data, error } = await supabase.from('ow_hints')
    .insert({ room_id: roomId, turn_number: turnNumber, player_id: playerId, word })
    .select()
    .single();
  if (error) throw error;
  return data as Hint;
}

export async function sendGuess(room: Room, guessText: string): Promise<{ guess: Guess; updatedRoom: Room }> {
  const isCorrect = guessText.trim() === room.current_word.trim();
  const { data, error } = await supabase.from('ow_guesses')
    .insert({ room_id: room.id, turn_number: room.current_turn, guess: guessText.trim(), is_correct: isCorrect })
    .select()
    .single();
  if (error) throw error;
  const updatedRoom: Room = { ...room, total_score: isCorrect ? room.total_score + 1 : room.total_score };
  if (isCorrect) {
    await supabase.from('ow_rooms').update({ total_score: updatedRoom.total_score }).eq('id', room.id);
  }
  return { guess: data as Guess, updatedRoom };
}

export async function nextTurn(room: Room, activePlayers: Player[]): Promise<Room> {
  const activeIds = activePlayers.filter(p => p.is_active).map(p => p.id);
  const len = room.guesser_order.length;
  let nextTurnNumber = room.current_turn + 1;
  for (let i = 0; i < len; i++) {
    if (activeIds.includes(room.guesser_order[nextTurnNumber % len])) break;
    nextTurnNumber++;
  }
  const newWord = pickWord();
  await supabase.from('ow_rooms').update({ current_turn: nextTurnNumber, current_word: newWord }).eq('id', room.id);
  return { ...room, current_turn: nextTurnNumber, current_word: newWord };
}

export async function endGame(roomId: string): Promise<void> {
  await Promise.all([
    supabase.from('ow_guesses').delete().eq('room_id', roomId),
    supabase.from('ow_hints').delete().eq('room_id', roomId),
    supabase.from('ow_players').delete().eq('room_id', roomId),
  ]);
  await supabase.from('ow_rooms').delete().eq('id', roomId);
}

export async function markInactive(playerId: string, roomId: string): Promise<void> {
  await supabase.from('ow_players').update({ is_active: false }).eq('id', playerId).eq('room_id', roomId);
}
