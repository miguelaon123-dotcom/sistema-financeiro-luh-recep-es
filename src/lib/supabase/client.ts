import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente com a anon key — acessa dados conforme RLS
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
