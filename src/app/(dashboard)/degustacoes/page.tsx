import { createAdminClient } from '@/lib/supabase/server'
import { getCachedData } from '@/lib/data-cache'
import { DegustacoesClient } from './DegustacoesClient'
import { TastingItem } from './actions'

export default async function DegustacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>
}) {
  const params = await searchParams
  const supabase = createAdminClient()

  const { tastings, tableCreated } = await getCachedData(
    'degustacoes_data',
    async () => {
      const { data, error } = await supabase
        .from('tastings')
        .select('*')
        .order('date', { ascending: true })

      const isTableCreated = !error || error.code !== 'PGRST205'
      return {
        tastings: (data as TastingItem[]) || [],
        tableCreated: isTableCreated,
      }
    }
  )

  let finalTastings = [...tastings]

  // Fallback transparente se a tabela ainda não existir no Supabase
  if (!tableCreated) {
    try {
      const { data: logs } = await (supabase as any)
        .from('audit_logs')
        .select('record_id, action, new_data, created_at')
        .like('action', 'tasting_%')
        .order('created_at', { ascending: true })

      if (logs && (logs as any[]).length > 0) {
        const tastingsMap = new Map<string, any>()
        for (const log of logs as any[]) {
          if (log.action === 'tasting_deleted') {
            tastingsMap.delete(log.record_id)
          } else {
            const existing = tastingsMap.get(log.record_id) || {}
            tastingsMap.set(log.record_id, {
              ...existing,
              ...(log.new_data || {}),
              id: log.record_id,
            })
          }
        }
        finalTastings = Array.from(tastingsMap.values())
        finalTastings.sort((a, b) => (a.date > b.date ? 1 : -1))
      }
    } catch (e) {
      console.error('Erro no fallback de degustações:', e)
    }
  }

  return (
    <DegustacoesClient
      tastings={finalTastings}
      initialOpenModal={params.action === 'nova-degustacao'}
    />
  )
}
