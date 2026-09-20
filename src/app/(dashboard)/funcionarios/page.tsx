import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { FuncionariosClient } from './FuncionariosClient'

export default async function FuncionariosPage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || ''
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  let employees: any[] = []
  let tableCreated = true

  // 1. Tentar buscar da tabela employees
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      employees = data
    } else if (error?.code === 'PGRST205') {
      tableCreated = false
    }
  } catch {
    tableCreated = false
  }

  // Fallback para audit_logs se a tabela ainda não existir
  if (!tableCreated) {
    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .like('action', 'employee_%')
        .order('created_at', { ascending: true })

      if (logs && logs.length > 0) {
        const empMap = new Map<string, any>()
        const deletedIds = new Set<string>()

        for (const log of logs) {
          if (log.action === 'employee_deleted') {
            deletedIds.add(log.record_id)
            empMap.delete(log.record_id)
            continue
          }

          if (deletedIds.has(log.record_id)) continue

          if (log.action === 'employee_created' && log.new_data) {
            empMap.set(log.record_id, {
              id: log.record_id,
              ...log.new_data,
              created_at: log.created_at,
            })
          } else if (log.action === 'employee_updated' && empMap.has(log.record_id)) {
            const cur = empMap.get(log.record_id)
            empMap.set(log.record_id, { ...cur, ...log.new_data })
          } else if (log.action === 'employee_toggle_active' && empMap.has(log.record_id)) {
            const cur = empMap.get(log.record_id)
            cur.active = log.new_data.active
          }
        }

        employees = Array.from(empMap.values())
      }
    } catch (e) {
      console.error('Erro ao reconstruir funcionários do audit_logs:', e)
    }
  }

  // 2. Buscar escalas para contar eventos e pagamentos de cada colaborador
  let staffAssignments: any[] = []
  try {
    const { data: staffData } = await supabase
      .from('event_staff')
      .select('id, event_id, employee_id, role, daily_rate, status, payment_status, paid_at, events(id, title, event_date)')
    if (staffData) staffAssignments = staffData
  } catch {}

  // Se não veio do banco, busca em audit_logs
  if (staffAssignments.length === 0) {
    try {
      const { data: scaleLogs } = await supabase
        .from('audit_logs')
        .select('new_data')
        .eq('action', 'event_staff_assigned')
      if (scaleLogs) {
        for (const log of scaleLogs) {
          if (log.new_data?.staff) {
            for (const s of log.new_data.staff) {
              staffAssignments.push({
                id: s.id || crypto.randomUUID(),
                event_id: log.new_data.eventId,
                employee_id: s.employeeId || s.employee_id,
                role: s.role,
                daily_rate: s.dailyRate || s.daily_rate || 0,
                status: 'confirmed',
                payment_status: s.payment_status || 'pending',
                paid_at: s.paid_at || null,
                events: {
                  id: log.new_data.eventId,
                  title: log.new_data.eventTitle || 'Festa',
                  event_date: log.new_data.eventDate || '',
                },
              })
            }
          }
        }
      }
    } catch {}
  }

  // 3. Buscar categorias/funções de colaboradores (employee_roles)
  const DEFAULT_ROLES = [
    { id: 'role-1', name: 'Garçom', default_daily_rate: 150 },
    { id: 'role-2', name: 'Cozinheiro(a)', default_daily_rate: 200 },
    { id: 'role-3', name: 'Auxiliar de Cozinha', default_daily_rate: 140 },
    { id: 'role-4', name: 'Auxiliar de Bar', default_daily_rate: 150 },
    { id: 'role-5', name: 'Recepcionista', default_daily_rate: 140 },
    { id: 'role-6', name: 'Segurança', default_daily_rate: 160 },
    { id: 'role-7', name: 'Limpeza & Apoio', default_daily_rate: 130 },
    { id: 'role-8', name: 'Coordenador(a) de Salão', default_daily_rate: 220 },
  ]

  let roles = [...DEFAULT_ROLES]
  try {
    const { data: dbRoles } = await supabase
      .from('employee_roles')
      .select('*')
      .order('name', { ascending: true })
    if (dbRoles && dbRoles.length > 0) {
      roles = dbRoles
    }
  } catch {}

  // Fallback audit_logs para employee_roles
  try {
    const { data: roleLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .like('action', 'employee_role_%')
      .order('created_at', { ascending: true })
    if (roleLogs && roleLogs.length > 0) {
      const rMap = new Map<string, any>()
      for (const r of roles) rMap.set(r.id || r.name, r)
      for (const log of roleLogs) {
        if (log.action === 'employee_role_deleted') {
          rMap.delete(log.record_id)
        } else if (log.action === 'employee_role_created' && log.new_data) {
          rMap.set(log.record_id, { id: log.record_id, ...log.new_data })
        } else if (log.action === 'employee_role_updated' && rMap.has(log.record_id)) {
          rMap.set(log.record_id, { ...rMap.get(log.record_id), ...log.new_data })
        }
      }
      roles = Array.from(rMap.values())
    }
  } catch {}

  // Filtrar e garantir remoção de Cerimonialista, DJ e Barman, assegurando Auxiliar de Bar
  roles = roles.filter(
    (r) =>
      r.name !== 'Cerimonialista' &&
      !r.name.includes('DJ') &&
      !r.name.toLowerCase().includes('sonorização') &&
      r.name !== 'Bartender / Barman' &&
      r.name !== 'Barman'
  )
  if (!roles.some((r) => r.name.toLowerCase() === 'auxiliar de bar')) {
    roles.splice(3, 0, { id: 'role-4', name: 'Auxiliar de Bar', default_daily_rate: 150 })
  }

  return (
    <FuncionariosClient
      employees={employees}
      staffAssignments={staffAssignments}
      roles={roles}
      tableCreatedInDb={tableCreated}
    />
  )
}
