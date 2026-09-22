import { createAdminClient } from '@/lib/supabase/server'
import { EstoqueClient } from './EstoqueClient'

import { getCachedData } from '@/lib/data-cache'

export default async function EstoquePage() {
  const supabase = createAdminClient()

  // Fetch products, descLogs e movements com cache em memória
  const { products, descLogs, movements } = await getCachedData(
    'estoque_data',
    async () => {
      const [prodsRes, logsRes, movsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('audit_logs')
          .select('record_id, new_data, created_at')
          .eq('action', 'product_description')
          .order('created_at', { ascending: true }),
        supabase
          .from('product_movements')
          .select('id, product_id, event_id, quantity, type, reason, created_at, products(id, name, sku)')
          .order('created_at', { ascending: false })
          .limit(60),
      ])
      return {
        products: prodsRes.data || [],
        descLogs: logsRes.data || [],
        movements: movsRes.data || [],
      }
    }
  )

  const descriptionsMap: Record<string, string> = {}
  if (descLogs && descLogs.length > 0) {
    for (const log of descLogs) {
      if (
        log.record_id &&
        log.new_data &&
        typeof log.new_data === 'object' &&
        'description' in log.new_data
      ) {
        descriptionsMap[log.record_id] = (log.new_data as { description: string }).description
      }
    }
  }

  const hydratedProducts = (products || []).map((p: any) => ({
    ...p,
    description: p.description || descriptionsMap[p.id] || null,
  }))

  return <EstoqueClient products={hydratedProducts} movements={(movements as any) || []} />
}
