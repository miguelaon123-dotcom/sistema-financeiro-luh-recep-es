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
  const email = (formData.get('email') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name) {
    return { error: 'O nome ou razão social do fornecedor é obrigatório.' }
  }

  const insertData: Record<string, any> = {
    name,
    type: 'supplier',
    phone,
    email,
    document,
    address,
    notes,
    created_by: userId || null,
  }

  let { error } = await supabase.from('contacts').insert(insertData)

  if (
    error &&
    (error.message?.includes('created_by') ||
      error.details?.includes('created_by') ||
      error.code === 'PGRST204')
  ) {
    delete insertData.created_by
    const retry = await supabase.from('contacts').insert(insertData)
    error = retry.error
  }

  if (error) {
    console.error('Erro ao cadastrar fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateSupplier(formData: FormData) {
  const supabase = createAdminClient()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!id || !name) {
    return { error: 'Fornecedor inválido ou nome não informado.' }
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      name,
      phone,
      email,
      document,
      address,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar fornecedor:', error)
    return { error: error.message }
  }

  invalidateCache(['fornecedores', 'financeiro', 'dashboard'])
  revalidatePath('/fornecedores')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
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

  let { error } = await supabase.from('financial_transactions').insert(insertPayload)

  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('created_by') ||
      error.details?.includes('created_by'))
  ) {
    delete insertPayload.created_by
    const retry = await supabase.from('financial_transactions').insert(insertPayload)
    error = retry.error
  }

  if (error) {
    console.error('Erro ao lançar conta do fornecedor:', error)
    return { error: error.message }
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
