import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { FinanceiroClient } from './FinanceiroClient'
import { getCaixinhas } from '../caixinhas/actions'

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; tab?: string }>
}) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || ''
  const role = headersList.get('x-user-role') || 'leitura'
  const params = await searchParams

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  // Fetch transactions, contacts, events e caixinhas
  const [txRes, contactsRes, eventsRes, caixinhas] = await Promise.all([
    supabase
      .from('financial_transactions')
      .select(`
        id, amount, type, status, description, due_date, paid_date,
        events(id, title), contacts(id, name)
      `)
      .order('due_date', { ascending: false }),
    supabase.from('contacts').select('id, name').order('name', { ascending: true }),
    supabase.from('events').select('id, title').order('event_date', { ascending: true }),
    getCaixinhas(),
  ])

  return (
    <FinanceiroClient
      transactions={(txRes.data as any) || []}
      contacts={contactsRes.data || []}
      events={eventsRes.data || []}
      initialAction={params.action}
      initialTab={params.tab}
      caixinhas={caixinhas || []}
    />
  )
}
