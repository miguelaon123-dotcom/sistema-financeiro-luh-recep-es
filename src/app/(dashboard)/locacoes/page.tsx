import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { LocacoesClient } from './LocacoesClient'

import { getCachedData } from '@/lib/data-cache'

export default async function LocacoesPage() {
  const supabase = createAdminClient()

  // 1. Buscar Clientes, Produtos e Locações com cache ultra-rápido em memória
  const { contacts, products, rentals: initialRentals, tableCreated } = await getCachedData(
    'locacoes_data',
    async () => {
      const [contactsRes, productsRes, rentalsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, name, document, phone, email, address')
          .order('name', { ascending: true }),
        supabase
          .from('products')
          .select('id, name, sku, category, current_stock, min_stock, cost_price, rental_price, image_url')
          .order('name', { ascending: true }),
        supabase
          .from('rentals')
          .select(`
            id, rental_code, client_id, start_date, return_date, actual_return_date,
            status, delivery_type, delivery_address, delivery_fee, security_deposit,
            items_total, total_amount, penalty_amount, payment_status, notes, created_at,
            contacts(id, name, phone, document, address),
            rental_items(
              id, product_id, quantity, unit_price, subtotal, returned_qty, broken_qty, lost_qty, penalty_fee, notes,
              products(id, name, sku, image_url, cost_price, rental_price)
            )
          `)
          .order('created_at', { ascending: false }),
      ])

      const isTableCreated = !rentalsRes.error || rentalsRes.error.code !== 'PGRST205'
      return {
        contacts: contactsRes.data || [],
        products: productsRes.data || [],
        rentals: rentalsRes.data || [],
        tableCreated: isTableCreated,
      }
    }
  )

  let rentals: any[] = initialRentals || []

  // Fallback para audit_logs se a tabela ainda não existir no Supabase
  if (!tableCreated) {
    try {
      const { data: logs } = await (supabase as any)
        .from('audit_logs')
        .select('*')
        .like('action', 'rental_%')
        .order('created_at', { ascending: true })

      if (logs && (logs as any[]).length > 0) {
        const rentalsMap = new Map<string, any>()
        const deletedIds = new Set<string>()

        for (const log of (logs as any[])) {
          if (log.action === 'rental_deleted') {
            deletedIds.add(log.record_id)
            rentalsMap.delete(log.record_id)
            continue
          }

          if (deletedIds.has(log.record_id)) continue

          if (log.action === 'rental_created' && log.new_data) {
            const data = log.new_data
            const client = (contacts as any[]).find((c: any) => c.id === data.clientId) || null
            const hydratedItems = (data.items || []).map((it: any) => {
              const prod = (products as any[]).find((p: any) => p.id === it.productId)
              return {
                id: crypto.randomUUID(),
                product_id: it.productId,
                quantity: it.quantity,
                unit_price: it.unitPrice,
                subtotal: it.subtotal,
                returned_qty: 0,
                broken_qty: 0,
                lost_qty: 0,
                products: prod || null,
              }
            })

            rentalsMap.set(data.id || log.record_id, {
              id: data.id || log.record_id,
              rental_code: data.rentalCode || 'LOC-001',
              client_id: data.clientId,
              start_date: data.startDate,
              return_date: data.returnDate,
              status: data.status || 'budget',
              delivery_type: data.deliveryType || 'pickup',
              delivery_address: data.deliveryAddress,
              delivery_fee: data.deliveryFee || 0,
              security_deposit: data.securityDeposit || 0,
              items_total: data.itemsTotal || 0,
              total_amount: data.totalAmount || 0,
              payment_status: data.paymentStatus || 'pending',
              notes: data.notes,
              created_at: log.created_at,
              contacts: client,
              rental_items: hydratedItems,
            })
          } else if (log.action === 'rental_status_updated' && rentalsMap.has(log.record_id)) {
            const cur = rentalsMap.get(log.record_id)
            cur.status = log.new_data.status
          } else if (log.action === 'rental_returned_inspection' && rentalsMap.has(log.record_id)) {
            const cur = rentalsMap.get(log.record_id)
            cur.status = 'returned'
            cur.penalty_amount = log.new_data.totalPenalties || 0
          }
        }

        rentals = Array.from(rentalsMap.values()).reverse()
      }
    } catch (e) {
      console.error('Erro ao reconstruir locações do audit_logs:', e)
    }
  }

  return (
    <LocacoesClient
      rentals={rentals}
      contacts={contacts}
      products={products}
      tableCreatedInDb={tableCreated}
    />
  )
}
