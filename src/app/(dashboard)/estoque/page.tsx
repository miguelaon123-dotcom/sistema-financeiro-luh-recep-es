import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { EstoqueClient } from './EstoqueClient'

export default async function EstoquePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || ''
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  // Buscar redundâncias de descrições em audit_logs caso a coluna products.description ainda não exista no banco
  let descriptionsMap: Record<string, string> = {}
  try {
    const { data: descLogs } = await supabase
      .from('audit_logs')
      .select('record_id, new_data, created_at')
      .eq('action', 'product_description')
      .order('created_at', { ascending: true })

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
  } catch (e) {
    console.error('Erro ao buscar descrições secundárias:', e)
  }

  const hydratedProducts = (products || []).map((p) => ({
    ...p,
    description: p.description || descriptionsMap[p.id] || null,
  }))

  // Buscar movimentações recentes (inclui saídas e retornos de festas e locações)
  const { data: movements } = await supabase
    .from('product_movements')
    .select('id, product_id, event_id, quantity, type, reason, created_at, products(id, name, sku)')
    .order('created_at', { ascending: false })
    .limit(60)

  return <EstoqueClient products={hydratedProducts} movements={(movements as any) || []} />
}
