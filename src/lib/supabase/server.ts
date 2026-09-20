import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com Service Role Key — bypassa RLS.
 * Usar APENAS em operações de servidor confiáveis (login, seed).
 * NUNCA expor ao cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  )
}

/**
 * Cliente autenticado que injeta o user_id e role do usuário logado
 * em cada transação via SET LOCAL, ativando as RLS policies customizadas.
 */
export async function createAuthenticatedClient(userId: string, role: string) {
  const client = createAdminClient()

  // Injeta o contexto do usuário para que as RLS policies funcionem
  // Isso substitui o auth.uid() do Supabase Auth
  await client.rpc('set_user_context', { p_user_id: userId, p_role: role })

  return client
}
