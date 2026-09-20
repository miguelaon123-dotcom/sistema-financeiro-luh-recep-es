'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function createTransaction(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const description = (formData.get('description') as string)?.trim()
  const type = (formData.get('type') as 'income' | 'expense') || 'income'
  const amount = Number(formData.get('amount'))
  const due_date = formData.get('due_date') as string
  const status = (formData.get('status') as string) || 'pending'
  const contact_id = (formData.get('contact_id') as string) || null
  const event_id = (formData.get('event_id') as string) || null

  if (!description || !amount || !due_date) {
    return { error: 'Preencha a descrição, valor e data de vencimento.' }
  }

  const { error } = await supabase.from('financial_transactions').insert({
    description,
    type,
    amount,
    due_date,
    status,
    contact_id: contact_id || null,
    event_id: event_id || null,
    paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
    created_by: userId || null,
  })

  if (error) {
    console.error('Erro ao criar transação:', error)
    return { error: error.message }
  }

  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateTransactionStatus(
  id: string,
  newStatus: 'paid' | 'pending' | 'late' | 'canceled'
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const updateData: any = { status: newStatus }
  if (newStatus === 'paid') {
    updateData.paid_date = new Date().toISOString().split('T')[0]
  } else {
    updateData.paid_date = null
  }

  const { error } = await supabase
    .from('financial_transactions')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar status:', error)
    return { error: error.message }
  }

  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const { error } = await supabase.from('financial_transactions').delete().eq('id', id)

  if (error) {
    console.error('Erro ao deletar transação:', error)
    return { error: error.message }
  }

  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateTransaction(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const id = formData.get('id') as string
  const description = (formData.get('description') as string)?.trim()
  const type = (formData.get('type') as 'income' | 'expense') || 'income'
  const amount = Number(formData.get('amount'))
  const due_date = formData.get('due_date') as string
  const status = (formData.get('status') as string) || 'pending'
  const contact_id = (formData.get('contact_id') as string) || null
  const event_id = (formData.get('event_id') as string) || null

  if (!id || !description || !amount || !due_date) {
    return { error: 'Preencha a descrição, valor e data de vencimento.' }
  }

  const updateData: any = {
    description,
    type,
    amount,
    due_date,
    status,
    contact_id: contact_id || null,
    event_id: event_id || null,
  }

  if (status === 'paid') {
    updateData.paid_date = new Date().toISOString().split('T')[0]
  } else {
    updateData.paid_date = null
  }

  const { error } = await supabase
    .from('financial_transactions')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar transação:', error)
    return { error: error.message }
  }

  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}
