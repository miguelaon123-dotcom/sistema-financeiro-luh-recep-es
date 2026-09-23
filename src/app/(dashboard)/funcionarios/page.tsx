import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { FuncionariosClient } from './FuncionariosClient'

import { getCachedData } from '@/lib/data-cache'

export default async function FuncionariosPage() {
  const supabase = createAdminClient()

  // 1. Buscar Funcionários, Escalas, Cargos, Pró-Labores e Lançamentos de Diárias com cache em memória
  const {
    employees: initialEmployees,
    staffAssignments: initialStaff,
    roles: initialRoles,
    prolabores: initialProlabores,
    workEntries: initialWorkEntries,
    tableCreated: isTableCreated,
  } = await getCachedData(
    'funcionarios_data',
    async () => {
      const [empRes, staffRes, rolesRes, prolaboreRes, workLogsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('event_staff')
          .select('id, event_id, employee_id, role, daily_rate, status, payment_status, paid_at, events(id, title, event_date)'),
        supabase
          .from('employee_roles')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('employee_prolabore')
          .select('*')
          .order('competencia', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('*')
          .like('action', 'employee_work_%')
          .order('created_at', { ascending: true }),
      ])

      const workMap = new Map<string, any>()
      if (workLogsRes.data) {
        for (const log of workLogsRes.data) {
          if (log.action === 'employee_work_deleted') {
            workMap.delete(log.record_id)
          } else if (log.action === 'employee_work_created' && log.new_data) {
            workMap.set(log.record_id, log.new_data)
          } else if (log.action === 'employee_work_paid' && workMap.has(log.record_id)) {
            const cur = workMap.get(log.record_id)
            cur.payment_status = 'paid'
            cur.paid_at = log.new_data?.paid_at || log.created_at
          } else if (log.action === 'employee_work_reverted' && workMap.has(log.record_id)) {
            const cur = workMap.get(log.record_id)
            cur.payment_status = 'pending'
            cur.paid_at = null
          }
        }
      }

      return {
        employees: empRes.data || [],
        staffAssignments: staffRes.data || [],
        roles: rolesRes.data && rolesRes.data.length > 0 ? rolesRes.data : null,
        prolabores: prolaboreRes.data || [],
        workEntries: Array.from(workMap.values()),
        tableCreated: !empRes.error || empRes.error.code !== 'PGRST205',
      }
    }
  )


  let employees: any[] = initialEmployees
  let tableCreated = isTableCreated

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

  let staffAssignments: any[] = initialStaff || []

  // Se a tabela nativa não existir no banco, busca em audit_logs apenas para colaboradores existentes
  if (!tableCreated && staffAssignments.length === 0) {
    try {
      const { data: scaleLogs } = await supabase
        .from('audit_logs')
        .select('new_data')
        .eq('action', 'event_staff_assigned')
      if (scaleLogs) {
        const validEmployeeIds = new Set(employees.map((e: any) => e.id))
        for (const log of scaleLogs) {
          if (log.new_data?.staff) {
            for (const s of log.new_data.staff) {
              const empId = s.employeeId || s.employee_id
              if (!validEmployeeIds.has(empId)) continue // ignora escalas de colaboradores excluídos

              staffAssignments.push({
                id: s.id || crypto.randomUUID(),
                event_id: log.new_data.eventId,
                employee_id: empId,
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

  // 3. Buscar categorias/funções de colaboradores (employee_roles + fallback audit_logs)
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

  const customRolesMap = new Map<string, any>()
  DEFAULT_ROLES.forEach(r => customRolesMap.set(r.name.toLowerCase(), r))

  if (initialRoles && initialRoles.length > 0) {
    initialRoles.forEach((r: any) => customRolesMap.set(r.name.toLowerCase(), r))
  } else {
    try {
      const { data: roleLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .like('action', 'employee_role_%')
        .order('created_at', { ascending: true })

      if (roleLogs) {
        for (const log of roleLogs) {
          if (log.action === 'employee_role_deleted') {
            for (const [k, v] of customRolesMap.entries()) {
              if (v.id === log.record_id || v.name === log.record_id) {
                customRolesMap.delete(k)
              }
            }
          } else if (log.action === 'employee_role_created' && log.new_data) {
            const r = log.new_data
            customRolesMap.set(r.name.toLowerCase(), {
              id: r.id || log.record_id,
              name: r.name,
              default_daily_rate: Number(r.default_daily_rate) || 150,
              description: r.description || null,
            })
          } else if (log.action === 'employee_role_updated' && log.new_data) {
            const r = log.new_data
            for (const [k, v] of customRolesMap.entries()) {
              if (v.id === log.record_id) {
                customRolesMap.delete(k)
                break
              }
            }
            customRolesMap.set(r.name.toLowerCase(), {
              id: log.record_id,
              name: r.name,
              default_daily_rate: Number(r.default_daily_rate) || 150,
              description: r.description || null,
            })
          }
        }
      }
    } catch {}
  }

  let processedRoles = Array.from(customRolesMap.values()).filter(
    (r: any) =>
      r.name !== 'Cerimonialista' &&
      !r.name.includes('DJ') &&
      !r.name.toLowerCase().includes('sonorização') &&
      r.name !== 'Bartender / Barman' &&
      r.name !== 'Barman'
  )
  if (!processedRoles.some((r: any) => r.name.toLowerCase() === 'auxiliar de bar')) {
    processedRoles.splice(3, 0, { id: 'role-4', name: 'Auxiliar de Bar', default_daily_rate: 150 })
  }

  return (
    <FuncionariosClient
      employees={employees}
      staffAssignments={staffAssignments}
      roles={processedRoles}
      prolabores={initialProlabores}
      workEntries={initialWorkEntries || []}
      tableCreatedInDb={tableCreated}
    />
  )
}

