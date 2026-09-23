import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { EventosClient } from './EventosClient'

import { getCachedData } from '@/lib/data-cache'

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>
}) {
  const params = await searchParams
  const supabase = createAdminClient()

  // Buscar todos os dados de eventos com cache ultra-rápido em memória
  const { events, products, eventMovements, employees, staffAssignments, contacts } = await getCachedData(
    'eventos_data',
    async () => {
      const [eventsRes, prodsRes, movementsRes, employeesRes, staffRes, contactsRes, eventLogsRes] = await Promise.all([
        supabase
          .from('events')
          .select(`
            id, title, event_date, location, budget, status,
            financial_transactions(id, type, amount, status, due_date, paid_date, description)
          `)
          .order('event_date', { ascending: true }),
        supabase
          .from('products')
          .select('id, name, sku, category, current_stock, rental_price, cost_price, image_url')
          .order('name', { ascending: true }),
        supabase
          .from('product_movements')
          .select('id, product_id, event_id, quantity, type, reason, created_at, products(id, name, sku)')
          .not('event_id', 'is', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('employees')
          .select('id, name, role, phone, default_daily_rate, active')
          .eq('active', true)
          .order('name', { ascending: true }),
        supabase
          .from('event_staff')
          .select('id, event_id, employee_id, role, daily_rate, status'),
        supabase
          .from('contacts')
          .select('id, name')
          .order('name', { ascending: true }),
        supabase
          .from('audit_logs')
          .select('record_id, action, new_data')
          .like('action', 'event_%')
          .order('created_at', { ascending: true }),
      ])

      const eventMetaMap = new Map<string, { guest_count?: number; payment_due_date?: string | null }>()
      if (eventLogsRes.data) {
        for (const log of eventLogsRes.data) {
          if (log.new_data) {
            const current = eventMetaMap.get(log.record_id) || {}
            if (log.new_data.guest_count !== undefined) {
              current.guest_count = Number(log.new_data.guest_count) || 0
            }
            if (log.new_data.payment_due_date !== undefined) {
              current.payment_due_date = log.new_data.payment_due_date || null
            }
            eventMetaMap.set(log.record_id, current)
          }
        }
      }

      const rawEvents = (eventsRes.data as any[]) || []
      const mappedEvents = rawEvents.map((ev: any) => {
        const sinalTx = ev.financial_transactions?.find((t: any) =>
          t.description?.toLowerCase().includes('sinal')
        )
        const remainingTx = ev.financial_transactions?.find((t: any) =>
          !t.description?.toLowerCase().includes('sinal') && t.type === 'income'
        )
        const meta = eventMetaMap.get(ev.id)
        return {
          ...ev,
          guest_count: Number(ev.guest_count ?? meta?.guest_count ?? 0),
          payment_due_date: ev.payment_due_date || meta?.payment_due_date || remainingTx?.due_date || null,
          deposit_amount: sinalTx ? Number(sinalTx.amount) : 0,
          deposit_status: sinalTx ? (sinalTx.status === 'paid' ? 'paid' : 'pending') : 'pending',
          deposit_paid_date: sinalTx?.paid_date || null,
        }
      })

      return {
        events: mappedEvents,
        products: (prodsRes.data as any[]) || [],
        eventMovements: (movementsRes.data as any[]) || [],
        employees: (employeesRes.data as any[]) || [],
        staffAssignments: (staffRes.data as any[]) || [],
        contacts: (contactsRes.data as any[]) || [],
      }
    }
  )

  return (
    <EventosClient
      events={events}
      contacts={contacts}
      products={products}
      eventMovements={eventMovements}
      employees={employees}
      staffAssignments={staffAssignments}
      initialOpenModal={params.action === 'novo-evento'}
    />
  )
}
