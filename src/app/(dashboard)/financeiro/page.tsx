import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { FinanceiroClient } from './FinanceiroClient'
import { getCaixinhas } from '../caixinhas/actions'

import { getCachedData } from '@/lib/data-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; tab?: string }>
}) {
  const params = await searchParams
  const supabase = createAdminClient()

  // Fetch transactions, contacts, events e caixinhas com cache em memória
  const { txData, contacts, events, caixinhas } = await getCachedData(
    'financeiro_data',
    async () => {
      const [txRes, contactsRes, eventsRes, cx] = await Promise.all([
        supabase
          .from('financial_transactions')
          .select(`
            id, amount, type, status, description, due_date, paid_date,
            events(id, title, event_date), contacts(id, name)
          `)
          .order('due_date', { ascending: false }),
        supabase.from('contacts').select('id, name').order('name', { ascending: true }),
        supabase.from('events').select('id, title').order('event_date', { ascending: true }),
        getCaixinhas(),
      ])
      return {
        txData: txRes.data || [],
        contacts: contactsRes.data || [],
        events: eventsRes.data || [],
        caixinhas: cx || [],
      }
    }
  )

  return (
    <FinanceiroClient
      transactions={(txData as any) || []}
      contacts={contacts}
      events={events}
      initialAction={params.action}
      initialTab={params.tab}
      caixinhas={caixinhas}
    />
  )
}
