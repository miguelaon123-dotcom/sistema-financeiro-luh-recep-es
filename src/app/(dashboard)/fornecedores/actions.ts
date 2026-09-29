'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { invalidateCache } from '@/lib/data-cache'

export async function createSupplier(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const pix = (formData.get('pix') as string)?.trim() || (formData.get('document') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name) {
    return { error: 'O nome do fornecedor é obrigatório.' }
  }

  // Prepara dados de inserção
  const insertData: Record<string, any> = {
    name,
    type: 'supplier',
    phone,
    document: pix, // Guarda a chave PIX ou documento
    notes: notes || (pix ? `Chave PIX: ${pix}` : null),
    created_by: userId || null,
  }

  let { data, error } = await supabase
    .from('contacts')
    .insert(insertData)
    .select('*')
    .single()

  if (
    error &&
    (error.message?.includes('created_by') ||
      error.details?.includes('created_by') ||
      error.code === 'PGRST204')
  ) {
    delete insertData.created_by
    const retry = await supabase.from('contacts').insert(insertData).select('*').single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Erro ao cadastrar fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'fornecedores_data', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true, supplier: data }
}

export async function updateSupplier(formData: FormData) {
  const supabase = createAdminClient()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const pix = (formData.get('pix') as string)?.trim() || (formData.get('document') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!id || !name) {
    return { error: 'Fornecedor inválido ou nome não informado.' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .update({
      name,
      phone,
      document: pix,
      notes: notes || (pix ? `Chave PIX: ${pix}` : null),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Erro ao atualizar fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'fornecedores_data', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true, supplier: data }
}

export async function deleteSupplier(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.from('contacts').delete().eq('id', id)

  if (error) {
    console.error('Erro ao excluir fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function createSupplierExpense(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const supplier_id = formData.get('supplier_id') as string
  const description = (formData.get('description') as string)?.trim()
  const amount = Number(formData.get('amount'))
  const due_date = (formData.get('due_date') as string) || new Date().toISOString().split('T')[0]
  const status = (formData.get('status') as string) || 'pending'
  const event_id = (formData.get('event_id') as string) || null
  const items_json = formData.get('items_json') as string

  if (!supplier_id || !description || !amount || amount <= 0) {
    return { error: 'Preencha o fornecedor, descrição e um valor válido.' }
  }

  const insertPayload: Record<string, any> = {
    type: 'expense',
    contact_id: supplier_id,
    description: description,
    amount: amount,
    due_date: due_date,
    status: status,
    event_id: event_id || null,
    paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
    created_by: userId || null,
  }

  let res = await supabase.from('financial_transactions').insert(insertPayload).select('id').single()
  let error = res.error
  let data = res.data

  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('created_by') ||
      error.details?.includes('created_by'))
  ) {
    delete insertPayload.created_by
    const retry = await supabase.from('financial_transactions').insert(insertPayload).select('id').single()
    error = retry.error
    data = retry.data
  }

  if (error) {
    console.error('Erro ao lançar conta do fornecedor:', error)
    return { error: error.message }
  }

  if (items_json) {
    try {
      await supabase.from('audit_logs').insert({
        action: 'boleto_itens',
        table_name: 'financial_transactions',
        record_id: data?.id || null,
        user_id: userId,
        new_data: { items: JSON.parse(items_json), supplier_id, amount },
      })
    } catch (e) {
      // Non-blocking log
    }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function paySupplierExpense(id: string) {
  const supabase = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('financial_transactions')
    .update({
      status: 'paid',
      paid_date: today,
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao liquidar conta de fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateSupplierExpense(formData: FormData) {
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  const supplier_id = formData.get('supplier_id') as string
  const description = (formData.get('description') as string)?.trim()
  const amount = Number(formData.get('amount'))
  const due_date = (formData.get('due_date') as string) || new Date().toISOString().split('T')[0]
  const status = (formData.get('status') as string) || 'pending'
  const event_id = (formData.get('event_id') as string) || null
  const items_json = formData.get('items_json') as string

  if (!id || !supplier_id || !description || !amount || amount <= 0) {
    return { error: 'Preencha o fornecedor, descrição e um valor válido.' }
  }

  const updatePayload: Record<string, any> = {
    contact_id: supplier_id,
    description: description,
    amount: amount,
    due_date: due_date,
    status: status,
    event_id: event_id || null,
    paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
  }

  const { error } = await supabase
    .from('financial_transactions')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar conta do fornecedor:', error)
    return { error: error.message }
  }

  if (items_json) {
    try {
      const headersList = await headers()
      const userId = headersList.get('x-user-id') || null
      await supabase.from('audit_logs').insert({
        action: 'boleto_itens_update',
        table_name: 'financial_transactions',
        record_id: id,
        user_id: userId,
        new_data: { items: JSON.parse(items_json), supplier_id, amount },
      })
    } catch (e) {
      // Non-blocking log
    }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function deleteSupplierExpense(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.from('financial_transactions').delete().eq('id', id)

  if (error) {
    console.error('Erro ao excluir conta de fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}
