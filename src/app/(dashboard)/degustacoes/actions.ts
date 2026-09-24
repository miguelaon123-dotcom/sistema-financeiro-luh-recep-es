'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { invalidateCache } from '@/lib/data-cache'

export interface TastingItem {
  id: string
  title: string
  date: string
  amount: number
  people_count: number
  status: 'scheduled' | 'completed' | 'canceled'
  payment_status: 'pending' | 'paid'
  paid_date?: string | null
  created_at?: string
  updated_at?: string
}

const CACHE_KEYS = ['degustacoes_data', 'eventos_data', 'financeiro_data', 'dashboard_data']

function revalidateAll() {
  invalidateCache(CACHE_KEYS)
  revalidatePath('/degustacoes')
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
}

/**
 * Sincroniza a transação de receita no Financeiro para subir ou descer o saldo da conta
 */
async function syncFinancialTransaction(
  supabase: any,
  tastingId: string,
  title: string,
  amount: number,
  date: string,
  paymentStatus: 'pending' | 'paid',
  paidDate?: string | null,
  userId?: string | null
) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const tag = `[${tastingId}]`

    // Buscar se já existe transação financeira desta degustação
    const { data: existingTxs } = await supabase
      .from('financial_transactions')
      .select('id, amount, status')
      .ilike('description', `%${tag}%`)

    const existingTx = existingTxs && existingTxs.length > 0 ? existingTxs[0] : null

    if (amount > 0) {
      const isPaid = paymentStatus === 'paid'
      const finalPaidDate = isPaid ? (paidDate || today) : null

      if (existingTx) {
        await supabase
          .from('financial_transactions')
          .update({
            amount,
            description: `Degustação: ${title} ${tag}`,
            due_date: date,
            status: isPaid ? 'paid' : 'pending',
            paid_date: finalPaidDate,
          })
          .eq('id', existingTx.id)
      } else {
        const payload: any = {
          type: 'income',
          amount,
          description: `Degustação: ${title} ${tag}`,
          due_date: date,
          status: isPaid ? 'paid' : 'pending',
          paid_date: finalPaidDate,
          created_by: userId || null,
        }
        const res = await supabase.from('financial_transactions').insert(payload)
        if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('created_by'))) {
          delete payload.created_by
          await supabase.from('financial_transactions').insert(payload)
        }
      }
    } else if (existingTx) {
      // Se o valor virou 0, remove a transação
      await supabase.from('financial_transactions').delete().eq('id', existingTx.id)
    }
  } catch (err) {
    console.error('Erro ao sincronizar financeiro da degustação:', err)
  }
}

export async function createTasting(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient() as any

  const title = (formData.get('title') as string)?.trim()
  const date = formData.get('date') as string
  const amountStr = formData.get('amount') as string
  const peopleCountStr = formData.get('people_count') as string
  const status = (formData.get('status') as string) || 'scheduled'
  const paymentStatus = ((formData.get('payment_status') as string) || 'pending') as 'pending' | 'paid'

  if (!title || !date) {
    return { error: 'Nome e Data são obrigatórios.' }
  }

  const amount = parseFloat(amountStr ? amountStr.replace(/\./g, '').replace(',', '.') : '0') || 0
  const people_count = parseInt(peopleCountStr, 10) || 1
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const paid_date = paymentStatus === 'paid' ? today : null

  // 1. Tenta inserir na tabela nativa tastings
  const { error: insertErr } = await supabase.from('tastings').insert({
    id,
    title,
    date,
    amount,
    people_count,
    status,
    payment_status: paymentStatus,
    paid_date,
    created_by: userId,
    created_at: now,
    updated_at: now,
  })

  // 2. Se a tabela não tiver essas colunas ou não existir ainda (fallback para audit_logs)
  if (insertErr) {
    if (insertErr.code === 'PGRST205' || insertErr.message?.includes('payment_status')) {
      // Tenta inserir apenas com as colunas base se a coluna de payment_status não existir
      await supabase.from('tastings').insert({
        id,
        title,
        date,
        amount,
        people_count,
        status,
        created_by: userId,
        created_at: now,
        updated_at: now,
      })

      // Grava no audit_logs para redundância
      await supabase.from('audit_logs').insert({
        record_id: id,
        action: 'tasting_create',
        new_data: {
          id,
          title,
          date,
          amount,
          people_count,
          status,
          payment_status: paymentStatus,
          paid_date,
          created_at: now,
          updated_at: now,
        },
      })
    } else {
      console.error('Erro ao cadastrar degustação:', insertErr)
      return { error: insertErr.message }
    }
  }

  // 3. Sincronizar receita com o financeiro (sobe o saldo se for pago!)
  await syncFinancialTransaction(supabase, id, title, amount, date, paymentStatus, paid_date, userId)

  revalidateAll()
  return { success: true }
}

export async function updateTasting(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient() as any

  const id = formData.get('id') as string
  const title = (formData.get('title') as string)?.trim()
  const date = formData.get('date') as string
  const amountStr = formData.get('amount') as string
  const peopleCountStr = formData.get('people_count') as string
  const status = (formData.get('status') as string) || 'scheduled'
  const paymentStatus = ((formData.get('payment_status') as string) || 'pending') as 'pending' | 'paid'

  if (!id || !title || !date) {
    return { error: 'ID, Nome e Data são obrigatórios.' }
  }

  const amount = parseFloat(amountStr ? amountStr.replace(/\./g, '').replace(',', '.') : '0') || 0
  const people_count = parseInt(peopleCountStr, 10) || 1
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const paid_date = paymentStatus === 'paid' ? today : null

  const { error: updateErr } = await supabase
    .from('tastings')
    .update({
      title,
      date,
      amount,
      people_count,
      status,
      payment_status: paymentStatus,
      paid_date,
      updated_at: now,
    })
    .eq('id', id)

  if (updateErr) {
    // Fallback caso a tabela nativa não tenha a coluna ou retorne erro
    await supabase
      .from('tastings')
      .update({
        title,
        date,
        amount,
        people_count,
        status,
        updated_at: now,
      })
      .eq('id', id)

    await supabase.from('audit_logs').insert({
      record_id: id,
      action: 'tasting_update',
      new_data: {
        id,
        title,
        date,
        amount,
        people_count,
        status,
        payment_status: paymentStatus,
        paid_date,
        updated_at: now,
      },
    })
  }

  // Sincronizar receita no Financeiro
  await syncFinancialTransaction(supabase, id, title, amount, date, paymentStatus, paid_date, userId)

  revalidateAll()
  return { success: true }
}

/**
 * Alterna entre PAGO e PENDENTE e sobe/desce o saldo da conta imediatamente
 */
export async function toggleTastingPayment(
  id: string,
  currentPaymentStatus: 'pending' | 'paid'
): Promise<{ success: boolean; error?: string; newStatus?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const supabase = createAdminClient() as any
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  const newStatus = currentPaymentStatus === 'paid' ? 'pending' : 'paid'
  const newPaidDate = newStatus === 'paid' ? today : null

  // 1. Atualizar registro na tabela de degustações
  const { data: tastingData } = await supabase
    .from('tastings')
    .update({
      payment_status: newStatus,
      paid_date: newPaidDate,
      updated_at: now,
    })
    .eq('id', id)
    .select('title, amount, date')
    .maybeSingle()

  let tasting = tastingData

  // Se não retornou ou deu erro de schema, busca dados
  if (!tasting) {
    const { data: fallbackTasting } = await supabase
      .from('tastings')
      .select('title, amount, date')
      .eq('id', id)
      .maybeSingle()
    tasting = fallbackTasting
  }

  // Se ainda assim não encontrou (ex: audit_logs fallback)
  if (!tasting) {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('new_data')
      .eq('record_id', id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (logs && logs.length > 0 && logs[0].new_data) {
      tasting = logs[0].new_data
    }
  }

  // Grava no audit_logs para fallback
  await supabase.from('audit_logs').insert({
    record_id: id,
    action: 'tasting_payment_status',
    new_data: {
      payment_status: newStatus,
      paid_date: newPaidDate,
      updated_at: now,
    },
  })

  // 2. Sincroniza a transação no Financeiro (SUBIR O SALDO DA CONTA!)
  if (tasting) {
    await syncFinancialTransaction(
      supabase,
      id,
      tasting.title || 'Degustação',
      Number(tasting.amount || 0),
      tasting.date || today,
      newStatus,
      newPaidDate,
      userId
    )
  }

  revalidateAll()
  return { success: true, newStatus }
}

export async function updateTastingStatus(
  id: string,
  newStatus: 'scheduled' | 'completed' | 'canceled'
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient() as any
  const now = new Date().toISOString()

  await supabase
    .from('tastings')
    .update({ status: newStatus, updated_at: now })
    .eq('id', id)

  await supabase.from('audit_logs').insert({
    record_id: id,
    action: 'tasting_status',
    new_data: { status: newStatus, updated_at: now },
  })

  revalidateAll()
  return { success: true }
}

export async function deleteTasting(id: string) {
  const supabase = createAdminClient() as any

  // 1. Excluir degustação
  await supabase.from('tastings').delete().eq('id', id)

  // 2. Excluir transação financeira vinculada para descer o saldo
  const tag = `[${id}]`
  await supabase.from('financial_transactions').delete().ilike('description', `%${tag}%`)

  // 3. Fallback audit_logs
  await supabase.from('audit_logs').insert({
    record_id: id,
    action: 'tasting_deleted',
    new_data: { deleted: true },
  })

  revalidateAll()
  return { success: true }
}
