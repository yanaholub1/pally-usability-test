import { createClient } from '@supabase/supabase-js'

/** Publishable key: safe in the browser. Row-level security lets visitors only add rows, never read them. */
export const SUPABASE_URL = 'https://gbkmjfjltpamaftoispn.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_n2Hw6lybfQiOucxCEkuysg_d1Q5atQB'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
