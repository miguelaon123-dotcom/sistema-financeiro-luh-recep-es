import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { FornecedoresClient } from './FornecedoresClient'
import { getCaixinhas } from '../caixinhas/actions'

import { getCachedData } from '@/lib/data-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; tab?: string }>
}) {
  const params = await searchParams
  const supabase = createAdminClient()

  // Buscar fornecedores, despesas, eventos e caixinhas com cache ultra-rápido em memória
  const { suppliers, transactions, events, caixinhas } = await getCachedData(
    'fornecedores_data',
    async () => {
      const [suppliersRes, txsRes, eventsRes, cx] = await Promise.all([
        supabase
          .from('contacts')
          .select('*')
          .eq('type', 'supplier')
          .order('name', { ascending: true }),
        supabase
          .from('financial_transactions')
          .select(`
            id, amount, type, status, description, due_date, paid_date, contact_id, event_id,
            contacts(id, name), events(id, title)
          `)
          .eq('type', 'expense')
          .order('due_date', { ascending: false }),
        supabase.from('events').select('id, title').order('event_date', { ascending: true }),
        getCaixinhas(),
      ])
      return {
        suppliers: suppliersRes.data || [],
        transactions: (txsRes.data as any) || [],
        events: eventsRes.data || [],
        caixinhas: cx || [],
      }
    }
  )

  return (
    <FornecedoresClient
      suppliers={suppliers}
      transactions={transactions}
      events={events}
      caixinhas={caixinhas}
      initialAction={params.action}
      initialTab={params.tab}
    />
  )
}
