'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { invalidateCache } from '@/lib/data-cache'

export async function createTransaction(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

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

  const insertPayload: Record<string, any> = {
    description,
    type,
    amount,
    due_date,
    status,
    contact_id: contact_id || null,
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
    console.error('Erro ao criar transação:', error)
    return { error: error.message }
  }

  invalidateCache(['financeiro', 'dashboard', 'fornecedores'])
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateTransactionStatus(
  id: string,
  newStatus: 'paid' | 'pending' | 'late' | 'canceled'
) {
  const supabase = createAdminClient()

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

  invalidateCache(['financeiro', 'dashboard', 'fornecedores'])
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.from('financial_transactions').delete().eq('id', id)

  if (error) {
    console.error('Erro ao deletar transação:', error)
    return { error: error.message }
  }

  invalidateCache(['financeiro', 'dashboard', 'fornecedores'])
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateTransaction(formData: FormData) {
  const supabase = createAdminClient()

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

  invalidateCache(['financeiro', 'dashboard', 'fornecedores'])
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function adjustCashBalance(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient()

  const targetBalance = Number(formData.get('target_balance'))
  const customNotes = (formData.get('notes') as string)?.trim()
  const today = new Date().toISOString().split('T')[0]

  if (isNaN(targetBalance)) {
    return { error: 'Informe um valor de saldo válido.' }
  }

  // 1. Obter saldo em caixa real atual das transações pagas
  const { data: txs, error: fetchErr } = await supabase
    .from('financial_transactions')
    .select('amount, type, status')
    .eq('status', 'paid')

  if (fetchErr) {
    return { error: fetchErr.message }
  }

  const currentCash = (txs || []).reduce((acc: number, t: any) => {
    return t.type === 'income' ? acc + Number(t.amount || 0) : acc - Number(t.amount || 0)
  }, 0)

  const diff = Number((targetBalance - currentCash).toFixed(2))

  if (diff === 0) {
    return { success: true, message: 'O saldo já está exatamente no valor informado.' }
  }

  const type = diff > 0 ? 'income' : 'expense'
  const amount = Math.abs(diff)
  const defaultDesc =
    diff > 0
      ? 'Saldo Inicial / Abertura de Conta Bancária'
      : 'Ajuste de Saldo Bancário / Gastos anteriores'
  const description =
    customNotes ||
    `${defaultDesc} (Conciliação para R$ ${targetBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`

  const payload: any = {
    type,
    amount,
    status: 'paid',
    due_date: today,
    paid_date: today,
    description,
    created_by: userId || null,
  }

  let { error } = await supabase.from('financial_transactions').insert(payload)
  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('created_by') ||
      error.details?.includes('created_by'))
  ) {
    delete payload.created_by
    const retry = await supabase.from('financial_transactions').insert(payload)
    error = retry.error
  }

  if (error) {
    console.error('Erro ao ajustar saldo bancário:', error)
    return { error: error.message }
  }

  invalidateCache(['financeiro', 'dashboard', 'caixinhas'])
  revalidatePath('/financeiro')
  revalidatePath('/')
  revalidatePath('/caixinhas')

  return { success: true }
}

