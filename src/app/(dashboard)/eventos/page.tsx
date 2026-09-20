import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { EventosClient } from './EventosClient'

export default async function EventosPage({
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

  // Fetch events, contacts, products and event movements
  const [eventsRes, contactsRes, productsRes, movementsRes] = await Promise.all([
    supabase
      .from('events')
      .select(`
        id, title, event_date, location, budget, status,
        contacts(id, name),
        financial_transactions(id, type, amount, status, due_date, paid_date, description)
      `)
      .order('event_date', { ascending: true }),
    supabase.from('contacts').select('id, name').order('name', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, sku, category, current_stock, rental_price, cost_price, image_url')
      .order('name', { ascending: true }),
    supabase
      .from('product_movements')
      .select('id, product_id, event_id, quantity, type, reason, created_at, products(id, name, sku)')
      .not('event_id', 'is', null)
      .order('created_at', { ascending: true }),
  ])

  // Buscar colaboradores (employees)
  let employees: any[] = []
  try {
    const { data: empData, error: empErr } = await supabase
      .from('employees')
      .select('id, name, role, phone, default_daily_rate, active')
      .eq('active', true)
      .order('name', { ascending: true })
    if (!empErr && empData) {
      employees = empData
    }
  } catch {}

  if (employees.length === 0) {
    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .like('action', 'employee_%')
        .order('created_at', { ascending: true })
      if (logs) {
        const empMap = new Map<string, any>()
        for (const log of logs) {
          if (log.action === 'employee_deleted') empMap.delete(log.record_id)
          else if (log.action === 'employee_created' && log.new_data) {
            empMap.set(log.record_id, { id: log.record_id, ...log.new_data })
          } else if (log.action === 'employee_updated' && empMap.has(log.record_id)) {
            empMap.set(log.record_id, { ...empMap.get(log.record_id), ...log.new_data })
          }
        }
        employees = Array.from(empMap.values()).filter((e) => e.active !== false)
      }
    } catch {}
  }

  // Buscar escalas existentes (event_staff)
  let staffAssignments: any[] = []
  try {
    const { data: staffData } = await supabase
      .from('event_staff')
      .select('id, event_id, employee_id, role, daily_rate, status')
    if (staffData) staffAssignments = staffData
  } catch {}

  if (staffAssignments.length === 0) {
    try {
      const { data: scaleLogs } = await supabase
        .from('audit_logs')
        .select('record_id, new_data')
        .eq('action', 'event_staff_assigned')
      if (scaleLogs) {
        for (const log of scaleLogs) {
          if (log.new_data?.staff) {
            for (const s of log.new_data.staff) {
              staffAssignments.push({
                id: crypto.randomUUID(),
                event_id: log.record_id,
                employee_id: s.employeeId || s.employee_id,
                role: s.role,
                daily_rate: s.dailyRate || s.daily_rate || 0,
                status: 'confirmed',
              })
            }
          }
        }
      }
    } catch {}
  }

  return (
    <EventosClient
      events={(eventsRes.data as any) || []}
      contacts={contactsRes.data || []}
      products={(productsRes.data as any) || []}
      eventMovements={(movementsRes.data as any) || []}
      employees={employees}
      staffAssignments={staffAssignments}
      initialOpenModal={params.action === 'novo-evento'}
    />
  )
}
