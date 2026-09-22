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

  // 4. Lançar no Financeiro como despesa paga de diária
  if (assignmentData) {
    try {
      const empName = assignmentData.employees?.name || 'Colaborador'
      const eventTitle = assignmentData.events?.title || 'Festa'
      const txPayload: any = {
        event_id: assignmentData.event_id,
        type: 'expense',
        amount: Number(assignmentData.daily_rate) || 0,
        description: `Pagamento Diária: ${empName} (${assignmentData.role}) - Festa: ${eventTitle}`,
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

  try {
    await supabase
      .from('event_staff')
      .update({ payment_status: 'pending', paid_at: null })
      .eq('id', assignmentId)
  } catch {}

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
