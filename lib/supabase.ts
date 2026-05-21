import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use legacy JWT anon key — the sb_publishable_ format is not a JWT and
// breaks Supabase Realtime WebSocket authentication.
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);
