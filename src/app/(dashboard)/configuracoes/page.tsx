import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { ConfiguracoesClient } from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || ''
  const role = headersList.get('x-user-role') || 'leitura'
  const name = headersList.get('x-user-name') || 'Usuário'
  const email = headersList.get('x-user-email') || ''

  const supabase = createAdminClient()

  // Se for admin, busca todos os usuários
  let users: any[] = []
  if (role === 'admin') {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, active, last_login, created_at')
      .order('created_at', { ascending: true })
    users = data || []
  }

  return (
    <ConfiguracoesClient
      currentUser={{ id: userId, name, email, role }}
      users={users}
    />
  )
}
