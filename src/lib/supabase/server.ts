import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com Service Role Key com pool persistente (singleton)
 * e keep-alive para máxima velocidade de resposta.
 */
const globalForSupabase = global as unknown as {
  supabaseAdminClient?: any
}

export function createAdminClient(): any {
  if (!globalForSupabase.supabaseAdminClient) {
    globalForSupabase.supabaseAdminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: { 'x-application-name': 'luh-recepcoes-erp' },
        },
      }
    )
  }
  return globalForSupabase.supabaseAdminClient
}

export async function createAuthenticatedClient(userId: string, role: string) {
  const client = createAdminClient()
  return client
}
