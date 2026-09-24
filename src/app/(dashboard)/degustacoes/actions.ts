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
  created_at?: string
  updated_at?: string
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

  if (!title || !date) {
    return { error: 'Nome e Data são obrigatórios.' }
  }

  const amount = parseFloat(amountStr ? amountStr.replace(/\./g, '').replace(',', '.') : '0') || 0
  const people_count = parseInt(peopleCountStr, 10) || 1
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  // 1. Tenta inserir na tabela nativa tastings
  const { error: insertErr } = await supabase.from('tastings').insert({
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

  // 2. Se a tabela não existir ainda no Supabase (PGRST205), faz fallback transparente para audit_logs
  if (insertErr) {
    if (insertErr.code === 'PGRST205') {
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
          created_at: now,
          updated_at: now,
        },
      })
    } else {
      console.error('Erro ao cadastrar degustação:', insertErr)
      return { error: insertErr.message }
    }
  }

  invalidateCache(['degustacoes_data', 'eventos_data'])
  revalidatePath('/degustacoes')
  revalidatePath('/eventos')
  return { success: true }
}

export async function updateTasting(formData: FormData) {
  const supabase = createAdminClient() as any

  const id = formData.get('id') as string
  const title = (formData.get('title') as string)?.trim()
  const date = formData.get('date') as string
  const amountStr = formData.get('amount') as string
  const peopleCountStr = formData.get('people_count') as string
  const status = (formData.get('status') as string) || 'scheduled'

  if (!id || !title || !date) {
    return { error: 'ID, Nome e Data são obrigatórios.' }
  }

  const amount = parseFloat(amountStr ? amountStr.replace(/\./g, '').replace(',', '.') : '0') || 0
  const people_count = parseInt(peopleCountStr, 10) || 1
  const now = new Date().toISOString()

  const { error: updateErr } = await supabase
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

  if (updateErr) {
    if (updateErr.code === 'PGRST205') {
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
          updated_at: now,
        },
      })
    } else {
      console.error('Erro ao atualizar degustação:', updateErr)
      return { error: updateErr.message }
    }
  }

  invalidateCache(['degustacoes_data', 'eventos_data'])
  revalidatePath('/degustacoes')
  revalidatePath('/eventos')
  return { success: true }
}

export async function updateTastingStatus(id: string, newStatus: 'scheduled' | 'completed' | 'canceled') {
  const supabase = createAdminClient() as any
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('tastings')
    .update({ status: newStatus, updated_at: now })
    .eq('id', id)

  if (error) {
    if (error.code === 'PGRST205') {
      await supabase.from('audit_logs').insert({
        record_id: id,
        action: 'tasting_status',
        new_data: { status: newStatus, updated_at: now },
      })
    } else {
      console.error('Erro ao atualizar status da degustação:', error)
      return { error: error.message }
    }
  }

  invalidateCache(['degustacoes_data', 'eventos_data'])
  revalidatePath('/degustacoes')
  revalidatePath('/eventos')
  return { success: true }
}

export async function deleteTasting(id: string) {
  const supabase = createAdminClient() as any

  const { error } = await supabase.from('tastings').delete().eq('id', id)

  if (error) {
    if (error.code === 'PGRST205') {
      await supabase.from('audit_logs').insert({
        record_id: id,
        action: 'tasting_deleted',
        new_data: { deleted: true },
      })
    } else {
      console.error('Erro ao excluir degustação:', error)
      return { error: error.message }
    }
  }

  invalidateCache(['degustacoes_data', 'eventos_data'])
  revalidatePath('/degustacoes')
  revalidatePath('/eventos')
  return { success: true }
}
