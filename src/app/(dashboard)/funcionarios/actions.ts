'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { invalidateCache } from '@/lib/data-cache'

export async function createEmployee(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const name = (formData.get('name') as string)?.trim()
  const employeeRole = (formData.get('role') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const pix_key = (formData.get('pix_key') as string)?.trim() || null
  const default_daily_rate = Number(formData.get('default_daily_rate')) || 0
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name || !employeeRole) {
    return { error: 'O nome e a função do colaborador são obrigatórios.' }
  }

  const employeeId = crypto.randomUUID()
  let tableExists = true

  const { error } = await supabase.from('employees').insert({
    id: employeeId,
    name,
    role: employeeRole,
    phone,
    document,
    pix_key,
    default_daily_rate,
    active: true,
    notes,
    created_by: userId,
  })

  if (error) {
    if (error.code === 'PGRST205') {
      tableExists = false
    } else {
      console.error('Erro ao cadastrar funcionário:', error)
      return { error: error.message }
    }
  }

  // Backup em audit_logs para fallback imediato
  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_created',
      table_name: 'employees',
      record_id: employeeId,
      user_id: userId,
      new_data: {
        id: employeeId,
        name,
        role: employeeRole,
        phone,
        document,
        pix_key,
        default_daily_rate,
        active: true,
        notes,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (e) {
    console.error('Erro ao gravar log do funcionário:', e)
  }

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true, id: employeeId }
}

export async function updateEmployee(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const employeeRole = (formData.get('role') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const pix_key = (formData.get('pix_key') as string)?.trim() || null
  const default_daily_rate = Number(formData.get('default_daily_rate')) || 0
  const active = formData.get('active') === 'true'
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!id || !name || !employeeRole) {
    return { error: 'O ID, nome e função são obrigatórios.' }
  }

  try {
    await supabase
      .from('employees')
      .update({
        name,
        role: employeeRole,
        phone,
        document,
        pix_key,
        default_daily_rate,
        active,
        notes,
      })
      .eq('id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_updated',
      table_name: 'employees',
      record_id: id,
      user_id: userId,
      new_data: {
        name,
        role: employeeRole,
        phone,
        document,
        pix_key,
        default_daily_rate,
        active,
        notes,
        updatedAt: new Date().toISOString(),
      },
    })
  } catch {}

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true }
}

export async function toggleEmployeeActive(id: string, newActiveState: boolean) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  try {
    await supabase.from('employees').update({ active: newActiveState }).eq('id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_toggle_active',
      table_name: 'employees',
      record_id: id,
      user_id: userId,
      new_data: { active: newActiveState, updatedAt: new Date().toISOString() },
    })
  } catch {}

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  try {
    await supabase.from('employees').delete().eq('id', id)
  } catch {}

  try {
    await supabase.from('event_staff').delete().eq('employee_id', id)
  } catch {}

  try {
    await supabase.from('employee_prolabore').delete().eq('employee_id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_deleted',
      table_name: 'employees',
      record_id: id,
      user_id: userId,
    })
  } catch {}

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true }
}

export async function createEmployeeRole(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const name = (formData.get('name') as string)?.trim()
  const default_daily_rate = Number(formData.get('default_daily_rate')) || 150
  const description = (formData.get('description') as string)?.trim() || null

  if (!name) {
    return { error: 'O nome da função/categoria é obrigatório.' }
  }

  const roleId = crypto.randomUUID()
  let tableExists = true

  const { error } = await supabase.from('employee_roles').insert({
    id: roleId,
    name,
    default_daily_rate,
    description,
  })

  if (error) {
    if (error.code === 'PGRST205') {
      tableExists = false
    } else {
      return { error: error.message }
    }
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_role_created',
      table_name: 'employee_roles',
      record_id: roleId,
      user_id: userId,
      new_data: {
        id: roleId,
        name,
        default_daily_rate,
        description,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (e) {
    console.error('Erro ao gravar log da função:', e)
  }

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true, id: roleId }
}

export async function updateEmployeeRole(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const default_daily_rate = Number(formData.get('default_daily_rate')) || 150
  const description = (formData.get('description') as string)?.trim() || null

  if (!id || !name) {
    return { error: 'O ID e o nome da função são obrigatórios.' }
  }

  try {
    await supabase
      .from('employee_roles')
      .update({
        name,
        default_daily_rate,
        description,
      })
      .eq('id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_role_updated',
      table_name: 'employee_roles',
      record_id: id,
      user_id: userId,
      new_data: {
        name,
        default_daily_rate,
        description,
        updatedAt: new Date().toISOString(),
      },
    })
  } catch {}

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true }
}

export async function deleteEmployeeRole(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  try {
    await supabase.from('employee_roles').delete().eq('id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_role_deleted',
      table_name: 'employee_roles',
      record_id: id,
      user_id: userId,
    })
  } catch {}

  invalidateCache(['funcionarios', 'eventos', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  return { success: true }
}

export async function payStaffDailyRate(
  assignmentId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const now = new Date().toISOString()

  // 1. Tentar buscar dados da escala (event_staff)
  let assignmentData: any = null
  try {
    const { data } = await supabase
      .from('event_staff')
      .select('id, event_id, employee_id, role, daily_rate, events(id, title, event_date), employees(id, name, pix_key)')
      .eq('id', assignmentId)
      .maybeSingle()
    if (data) assignmentData = data
  } catch {}

  // 2. Atualizar payment_status na tabela event_staff
  try {
    await supabase
      .from('event_staff')
      .update({ payment_status: 'paid', paid_at: now })
      .eq('id', assignmentId)
  } catch {}

  // 3. Fallback / log em audit_logs
  try {
    await supabase.from('audit_logs').insert({
      action: 'event_staff_daily_paid',
      table_name: 'event_staff',
      record_id: assignmentId,
      user_id: userId,
      new_data: {
        assignmentId,
        payment_status: 'paid',
        paid_at: now,
        amount: assignmentData?.daily_rate,
      },
    })
  } catch {}

  // 4. Lançar no Financeiro como despesa paga de diária (evitando duplicações)
  if (assignmentData) {
    try {
      const empName = assignmentData.employees?.name || 'Colaborador'
      const eventTitle = assignmentData.events?.title || 'Festa'
      const desc = `Pagamento Diária: ${empName} (${assignmentData.role}) - Festa: ${eventTitle}`

      // Evita duplicar se já existir lançamento deste pagamento
      const { data: existingTx } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('event_id', assignmentData.event_id)
        .eq('description', desc)
        .maybeSingle()

      if (!existingTx) {
        const txPayload: any = {
          event_id: assignmentData.event_id,
          type: 'expense',
          amount: Number(assignmentData.daily_rate) || 0,
          description: desc,
          due_date: assignmentData.events?.event_date || now.split('T')[0],
          status: 'paid',
          paid_date: now.split('T')[0],
          created_by: userId || null,
        }
        let txRes = await supabase.from('financial_transactions').insert(txPayload)
        if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
          delete txPayload.created_by
          await supabase.from('financial_transactions').insert(txPayload)
        }
      }
    } catch (err) {
      console.warn('Aviso ao lançar pagamento no financeiro:', err)
    }
  }

  invalidateCache(['funcionarios', 'eventos', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function payAllEmployeeDailyRates(
  employeeId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const now = new Date().toISOString()

  // 1. Buscar todas as escalas pendentes do colaborador
  let pendingAssignments: any[] = []
  try {
    const { data } = await supabase
      .from('event_staff')
      .select('id, event_id, role, daily_rate, events(id, title, event_date)')
      .eq('employee_id', employeeId)
      .neq('payment_status', 'paid')
    if (data) pendingAssignments = data
  } catch {}

  // 2. Buscar colaborador
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, pix_key')
    .eq('id', employeeId)
    .maybeSingle()

  // 3. Atualizar todas para paid
  try {
    await supabase
      .from('event_staff')
      .update({ payment_status: 'paid', paid_at: now })
      .eq('employee_id', employeeId)
  } catch {}

  // 4. Log em audit_logs
  try {
    await supabase.from('audit_logs').insert({
      action: 'event_staff_all_paid',
      table_name: 'event_staff',
      record_id: employeeId,
      user_id: userId,
      new_data: {
        employeeId,
        paid_at: now,
        count: pendingAssignments.length,
      },
    })
  } catch {}

  // 5. Lançar transação consolidada de quitação de diárias no financeiro
  const totalAmount = pendingAssignments.reduce((acc, a) => acc + Number(a.daily_rate || 0), 0)
  if (totalAmount > 0 && employee) {
    try {
      const txPayload: any = {
        type: 'expense',
        amount: totalAmount,
        description: `Quitação de Diárias: ${employee.name} (${pendingAssignments.length} festas)`,
        due_date: now.split('T')[0],
        status: 'paid',
        paid_date: now.split('T')[0],
        created_by: userId || null,
      }
      let txRes = await supabase.from('financial_transactions').insert(txPayload)
      if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
        delete txPayload.created_by
        await supabase.from('financial_transactions').insert(txPayload)
      }
    } catch (err) {
      console.warn('Aviso ao lançar quitação no financeiro:', err)
    }
  }

  invalidateCache(['funcionarios', 'eventos', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function revertStaffDailyPayment(
  assignmentId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  // 1. Buscar dados da escala antes de estornar
  let assignmentData: any = null
  try {
    const { data } = await supabase
      .from('event_staff')
      .select('id, event_id, role, employees(name), events(title)')
      .eq('id', assignmentId)
      .maybeSingle()
    if (data) assignmentData = data
  } catch {}

  try {
    await supabase
      .from('event_staff')
      .update({ payment_status: 'pending', paid_at: null })
      .eq('id', assignmentId)
  } catch {}

  // 2. Remove o pagamento lançado no Financeiro para restaurar o saldo real
  if (assignmentData) {
    try {
      const empName = assignmentData.employees?.name || 'Colaborador'
      const eventTitle = assignmentData.events?.title || 'Festa'
      const desc = `Pagamento Diária: ${empName} (${assignmentData.role}) - Festa: ${eventTitle}`
      await supabase
        .from('financial_transactions')
        .delete()
        .eq('event_id', assignmentData.event_id)
        .eq('description', desc)
    } catch (err) {
      console.warn('Aviso ao remover transação no financeiro:', err)
    }
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'event_staff_daily_reverted',
      table_name: 'event_staff',
      record_id: assignmentId,
      user_id: userId,
      new_data: {
        assignmentId,
        payment_status: 'pending',
      },
    })
  } catch {}

  invalidateCache(['funcionarios', 'eventos', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

// ─────────────────────────────────────────────
// PRÓ-LABORE
// ─────────────────────────────────────────────

export async function createProlabore(
  formData: FormData
): Promise<{ success?: boolean; id?: string; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  const employee_id = (formData.get('employee_id') as string)?.trim()
  const competencia = (formData.get('competencia') as string)?.trim()
  const amount = Number(formData.get('amount')) || 0
  const description = (formData.get('description') as string)?.trim() || null

  if (!employee_id || !competencia || amount <= 0) {
    return { error: 'Colaborador, competência e valor são obrigatórios.' }
  }

  const id = crypto.randomUUID()

  const { error } = await supabase.from('employee_prolabore').insert({
    id,
    employee_id,
    competencia,
    amount,
    description,
    payment_status: 'pending',
    created_by: userId,
  })

  if (error) {
    console.error('Erro ao criar pró-labore:', error)
    return { error: error.message }
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'prolabore_created',
      table_name: 'employee_prolabore',
      record_id: id,
      user_id: userId,
      new_data: { id, employee_id, competencia, amount, description },
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  return { success: true, id }
}

export async function updateProlabore(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  const id = (formData.get('id') as string)?.trim()
  const competencia = (formData.get('competencia') as string)?.trim()
  const amount = Number(formData.get('amount')) || 0
  const description = (formData.get('description') as string)?.trim() || null

  if (!id || !competencia || amount <= 0) {
    return { error: 'ID, competência e valor são obrigatórios.' }
  }

  try {
    await supabase
      .from('employee_prolabore')
      .update({ competencia, amount, description })
      .eq('id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'prolabore_updated',
      table_name: 'employee_prolabore',
      record_id: id,
      user_id: userId,
      new_data: { competencia, amount, description },
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  return { success: true }
}

export async function deleteProlabore(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  // 1. Se estiver pago, remove o lançamento correspondente no financeiro
  try {
    const { data: record } = await supabase
      .from('employee_prolabore')
      .select('id, competencia, employees(name)')
      .eq('id', id)
      .maybeSingle()
    if (record) {
      const empName = record.employees?.name || 'Colaborador'
      const [year, month] = (record.competencia as string).split('-')
      const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      const monthLabel = monthNames[parseInt(month, 10) - 1] || month
      await supabase
        .from('financial_transactions')
        .delete()
        .ilike('description', `Pró-Labore: ${empName} — ${monthLabel}/${year}%`)
    }
  } catch {}

  try {
    await supabase.from('employee_prolabore').delete().eq('id', id)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'prolabore_deleted',
      table_name: 'employee_prolabore',
      record_id: id,
      user_id: userId,
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function payProlabore(
  prolaboreId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  // 1. Buscar dados do pró-labore + colaborador
  let record: any = null
  try {
    const { data } = await supabase
      .from('employee_prolabore')
      .select('id, employee_id, competencia, amount, description, employees(id, name, pix_key)')
      .eq('id', prolaboreId)
      .maybeSingle()
    if (data) record = data
  } catch {}

  // 2. Marcar como pago
  try {
    await supabase
      .from('employee_prolabore')
      .update({ payment_status: 'paid', paid_at: now })
      .eq('id', prolaboreId)
  } catch {}

  // 3. Log
  try {
    await supabase.from('audit_logs').insert({
      action: 'prolabore_paid',
      table_name: 'employee_prolabore',
      record_id: prolaboreId,
      user_id: userId,
      new_data: { prolaboreId, payment_status: 'paid', paid_at: now },
    })
  } catch {}

  // 4. Lançar no Financeiro como despesa
  if (record) {
    try {
      const empName = record.employees?.name || 'Colaborador'
      const [year, month] = (record.competencia as string).split('-')
      const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      const monthLabel = monthNames[parseInt(month, 10) - 1] || month
      const txPayload: any = {
        type: 'expense',
        amount: Number(record.amount) || 0,
        description: `Pró-Labore: ${empName} — ${monthLabel}/${year}${record.description ? ` (${record.description})` : ''}`,
        due_date: now.split('T')[0],
        status: 'paid',
        paid_date: now.split('T')[0],
        created_by: userId || null,
      }
      let txRes = await supabase.from('financial_transactions').insert(txPayload)
      if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
        delete txPayload.created_by
        await supabase.from('financial_transactions').insert(txPayload)
      }
    } catch (err) {
      console.warn('Aviso ao lançar pró-labore no financeiro:', err)
    }
  }

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function revertProlabore(
  prolaboreId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  // 1. Busca dados para estornar despesa no financeiro
  try {
    const { data: record } = await supabase
      .from('employee_prolabore')
      .select('id, competencia, employees(name)')
      .eq('id', prolaboreId)
      .maybeSingle()
    if (record) {
      const empName = record.employees?.name || 'Colaborador'
      const [year, month] = (record.competencia as string).split('-')
      const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      const monthLabel = monthNames[parseInt(month, 10) - 1] || month
      await supabase
        .from('financial_transactions')
        .delete()
        .ilike('description', `Pró-Labore: ${empName} — ${monthLabel}/${year}%`)
    }
  } catch {}

  try {
    await supabase
      .from('employee_prolabore')
      .update({ payment_status: 'pending', paid_at: null })
      .eq('id', prolaboreId)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'prolabore_reverted',
      table_name: 'employee_prolabore',
      record_id: prolaboreId,
      user_id: userId,
      new_data: { prolaboreId, payment_status: 'pending' },
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

// ─────────────────────────────────────────────
// DIAS TRABALHADOS E ACERTO DE DIÁRIAS (DIAS × DIÁRIA)
// ─────────────────────────────────────────────

export interface WorkEntryData {
  id: string
  employee_id: string
  employee_name: string
  role?: string
  days_worked: number
  daily_rate: number
  total_amount: number
  date: string
  description?: string | null
  payment_status: 'pending' | 'paid'
  paid_at?: string | null
  transaction_id?: string | null
  created_at: string
}

export async function createWorkEntry(
  formData: FormData
): Promise<{ success?: boolean; id?: string; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  const employee_id = (formData.get('employee_id') as string)?.trim()
  const days_worked = Number(formData.get('days_worked')) || 0
  const daily_rate = Number(formData.get('daily_rate')) || 0
  const date = (formData.get('date') as string)?.trim() || new Date().toISOString().split('T')[0]
  const description = (formData.get('description') as string)?.trim() || null
  const payment_status = (formData.get('payment_status') as 'pending' | 'paid') || 'pending'

  if (!employee_id) {
    return { error: 'Selecione o colaborador.' }
  }
  if (days_worked <= 0) {
    return { error: 'Informe a quantidade de dias trabalhados.' }
  }
  if (daily_rate <= 0) {
    return { error: 'Informe o valor da diária.' }
  }

  const total_amount = Number((days_worked * daily_rate).toFixed(2))

  // Buscar dados do colaborador
  let employeeName = 'Colaborador'
  let employeeRole = ''
  try {
    const { data: emp } = await supabase
      .from('employees')
      .select('id, name, role')
      .eq('id', employee_id)
      .maybeSingle()
    if (emp) {
      employeeName = emp.name
      employeeRole = emp.role || ''
    }
  } catch {}

  const entryId = crypto.randomUUID()
  const now = new Date().toISOString()
  let transactionId: string | null = null

  // Se já for cadastrado como Pago, lança despesa imediata no Financeiro (desconta no saldo em caixa)
  if (payment_status === 'paid') {
    try {
      const txDesc = `Pagamento Diárias: ${employeeName} (${days_worked} ${days_worked === 1 ? 'dia' : 'dias'} trab. × R$ ${daily_rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${description ? ` - ${description}` : ''}`
      const txPayload: any = {
        type: 'expense',
        amount: total_amount,
        description: txDesc,
        due_date: date,
        paid_date: date,
        status: 'paid',
        created_by: userId || null,
      }
      let txRes = await supabase.from('financial_transactions').insert(txPayload).select('id').maybeSingle()
      if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
        delete txPayload.created_by
        txRes = await supabase.from('financial_transactions').insert(txPayload).select('id').maybeSingle()
      }
      transactionId = txRes.data?.id || null
    } catch (err) {
      console.warn('Aviso ao lançar pagamento no financeiro:', err)
    }
  }

  // Gravar no log de auditoria
  const entryPayload: WorkEntryData = {
    id: entryId,
    employee_id,
    employee_name: employeeName,
    role: employeeRole,
    days_worked,
    daily_rate,
    total_amount,
    date,
    description,
    payment_status,
    paid_at: payment_status === 'paid' ? now : null,
    transaction_id: transactionId,
    created_at: now,
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_work_created',
      table_name: 'employee_work_entries',
      record_id: entryId,
      user_id: userId,
      new_data: entryPayload,
    })
  } catch (err) {
    console.error('Erro ao gravar log de trabalho:', err)
  }

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true, id: entryId }
}

export async function payWorkEntry(
  entryId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // Buscar log da diária
  const { data: log } = await supabase
    .from('audit_logs')
    .select('new_data')
    .eq('action', 'employee_work_created')
    .eq('record_id', entryId)
    .maybeSingle()

  if (!log || !log.new_data) {
    return { error: 'Lançamento de diária não encontrado.' }
  }

  const entry: WorkEntryData = log.new_data
  const totalAmount = Number(entry.total_amount) || 0

  // 1. Lançar despesa paga no Financeiro -> DESCONTA NO SALDO
  let txId: string | null = null
  try {
    const txDesc = `Pagamento Diárias: ${entry.employee_name} (${entry.days_worked} ${entry.days_worked === 1 ? 'dia' : 'dias'} trab. × R$ ${entry.daily_rate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${entry.description ? ` - ${entry.description}` : ''}`
    const txPayload: any = {
      type: 'expense',
      amount: totalAmount,
      description: txDesc,
      due_date: today,
      paid_date: today,
      status: 'paid',
      created_by: userId || null,
    }
    let txRes = await supabase.from('financial_transactions').insert(txPayload).select('id').maybeSingle()
    if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
      delete txPayload.created_by
      txRes = await supabase.from('financial_transactions').insert(txPayload).select('id').maybeSingle()
    }
    txId = txRes.data?.id || null
  } catch (err) {
    console.error('Erro ao lançar despesa no financeiro:', err)
  }

  // 2. Gravar status pago no audit_logs
  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_work_paid',
      table_name: 'employee_work_entries',
      record_id: entryId,
      user_id: userId,
      new_data: {
        id: entryId,
        payment_status: 'paid',
        paid_at: now,
        transaction_id: txId,
      },
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function payAllWorkEntriesForEmployee(
  employeeId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // Buscar todos os logs de trabalho
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .like('action', 'employee_work_%')
    .order('created_at', { ascending: true })

  const workMap = new Map<string, WorkEntryData>()
  if (logs) {
    for (const log of logs) {
      if (log.action === 'employee_work_deleted') {
        workMap.delete(log.record_id)
      } else if (log.action === 'employee_work_created' && log.new_data) {
        workMap.set(log.record_id, log.new_data)
      } else if (log.action === 'employee_work_paid' && workMap.has(log.record_id)) {
        const cur = workMap.get(log.record_id)!
        cur.payment_status = 'paid'
        cur.paid_at = log.new_data?.paid_at || now
      } else if (log.action === 'employee_work_reverted' && workMap.has(log.record_id)) {
        const cur = workMap.get(log.record_id)!
        cur.payment_status = 'pending'
        cur.paid_at = null
      }
    }
  }

  const pendingList = Array.from(workMap.values()).filter(
    (w) => w.employee_id === employeeId && w.payment_status !== 'paid'
  )

  if (pendingList.length === 0) {
    return { error: 'Não há diárias pendentes para este colaborador.' }
  }

  const totalAmount = pendingList.reduce((acc, w) => acc + Number(w.total_amount || 0), 0)
  const totalDays = pendingList.reduce((acc, w) => acc + Number(w.days_worked || 0), 0)
  const empName = pendingList[0].employee_name

  // Lançar despesa consolidada no Financeiro -> DESCONTA NO SALDO
  try {
    const txDesc = `Quitação de Diárias: ${empName} (${totalDays} ${totalDays === 1 ? 'dia' : 'dias'} trab. - ${pendingList.length} lançamentos)`
    const txPayload: any = {
      type: 'expense',
      amount: totalAmount,
      description: txDesc,
      due_date: today,
      paid_date: today,
      status: 'paid',
      created_by: userId || null,
    }
    let txRes = await supabase.from('financial_transactions').insert(txPayload).select('id').maybeSingle()
    if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
      delete txPayload.created_by
      await supabase.from('financial_transactions').insert(txPayload)
    }
  } catch (err) {
    console.warn('Aviso ao lançar quitação no financeiro:', err)
  }

  // Marcar todos os lançamentos como pagos
  for (const w of pendingList) {
    try {
      await supabase.from('audit_logs').insert({
        action: 'employee_work_paid',
        table_name: 'employee_work_entries',
        record_id: w.id,
        user_id: userId,
        new_data: {
          id: w.id,
          payment_status: 'paid',
          paid_at: now,
        },
      })
    } catch {}
  }

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function revertWorkEntryPayment(
  entryId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  // Buscar log original
  const { data: log } = await supabase
    .from('audit_logs')
    .select('new_data')
    .eq('action', 'employee_work_created')
    .eq('record_id', entryId)
    .maybeSingle()

  if (log?.new_data) {
    const entry: WorkEntryData = log.new_data
    try {
      const txDesc = `Pagamento Diárias: ${entry.employee_name} (${entry.days_worked} ${entry.days_worked === 1 ? 'dia' : 'dias'} trab.%`
      await supabase
        .from('financial_transactions')
        .delete()
        .ilike('description', txDesc)
    } catch {}
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_work_reverted',
      table_name: 'employee_work_entries',
      record_id: entryId,
      user_id: userId,
      new_data: {
        id: entryId,
        payment_status: 'pending',
        paid_at: null,
      },
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function deleteWorkEntry(
  entryId: string
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  // Buscar log original
  const { data: log } = await supabase
    .from('audit_logs')
    .select('new_data')
    .eq('action', 'employee_work_created')
    .eq('record_id', entryId)
    .maybeSingle()

  if (log?.new_data) {
    const entry: WorkEntryData = log.new_data
    if (entry.payment_status === 'paid') {
      try {
        const txDesc = `Pagamento Diárias: ${entry.employee_name} (${entry.days_worked} ${entry.days_worked === 1 ? 'dia' : 'dias'} trab.%`
        await supabase
          .from('financial_transactions')
          .delete()
          .ilike('description', txDesc)
      } catch {}
    }
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'employee_work_deleted',
      table_name: 'employee_work_entries',
      record_id: entryId,
      user_id: userId,
    })
  } catch {}

  invalidateCache(['funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}


