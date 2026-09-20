import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { ClientesClient } from './ClientesClient'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>
}) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || ''
  const role = headersList.get('x-user-role') || 'leitura'
  const params = await searchParams

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('name', { ascending: true })

  return (
    <ClientesClient
      contacts={contacts || []}
      initialOpenModal={params.action === 'novo-cliente'}
    />
  )
}
