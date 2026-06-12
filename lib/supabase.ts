import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let _client: ReturnType<typeof createBrowserClient> | null = null;

// Only call in browser context — createBrowserClient throws if env vars are empty.
export function getSupabase() {
  if (typeof window === 'undefined') return null as never;
  if (!_client) {
    _client = createBrowserClient(supabaseUrl, supabaseAnon);
  }
  return _client;
}
