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
  const { events, products, eventMovements, employees, staffAssignments } = await getCachedData(
    'eventos_data',
    async () => {
      const [eventsRes, prodsRes, movementsRes, employeesRes, staffRes] = await Promise.all([
        supabase
          .from('events')
          .select(`
            id, title, event_date, location, budget, deposit_amount, deposit_status, deposit_paid_date, status,
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
      ])

      return {
        events: (eventsRes.data as any[]) || [],
        products: (prodsRes.data as any[]) || [],
        eventMovements: (movementsRes.data as any[]) || [],
        employees: (employeesRes.data as any[]) || [],
        staffAssignments: (staffRes.data as any[]) || [],
      }
    }
  )

  return (
    <EventosClient
      events={events}
      contacts={[]}
      products={products}
      eventMovements={eventMovements}
      employees={employees}
      staffAssignments={staffAssignments}
      initialOpenModal={params.action === 'novo-evento'}
    />
  )
}
