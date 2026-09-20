'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export interface Caixinha {
  id: string
  name: string
  current_balance: number
  target_balance: number
  category: string
  color: string
  icon: string
  notes?: string
  created_at?: string
  updated_at?: string
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

const DEFAULT_CAIXINHAS: Caixinha[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Reserva de Emergência',
    current_balance: 3500,
    target_balance: 10000,
    category: 'emergencia',
    color: '#1d1d1f', // Grafite clássico
    icon: 'shield',
    notes: 'Reserva para imprevistos operacionais em recepções',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Reposição de Louças & Taças',
    current_balance: 1200,
    target_balance: 3000,
    category: 'equipamentos',
    color: '#0071e3', // Azul Apple
    icon: 'wrench',
    notes: 'Fundo para compra e substituição de itens de acervo que quebram',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Capital de Giro',
    current_balance: 4500,
    target_balance: 8000,
    category: 'giro',
    color: '#1a7f37', // Verde
    icon: 'wallet',
    notes: 'Fluxo para compras de insumos antes do recebimento final dos eventos',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Distribuição de Lucros',
    current_balance: 2000,
    target_balance: 5000,
    category: 'meta',
    color: '#d4af37', // Dourado
    icon: 'target',
    notes: 'Meta semestral de bonificação da equipe e sócios',
  },
]

export async function getCaixinhas(): Promise<Caixinha[]> {
  const supabase = createAdminClient()
  try {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('record_id, new_data, created_at')
      .eq('action', 'caixinha')
      .eq('table_name', 'financial_caixinhas')
      .order('created_at', { ascending: true })

    const map: Record<string, Caixinha> = {}

    if (logs && logs.length > 0) {
      for (const log of logs) {
        if (log.new_data && typeof log.new_data === 'object') {
          const item = log.new_data as any
          const caixinhaId = item.id || log.record_id
          if (!caixinhaId) continue

          if (item.deleted) {
            delete map[caixinhaId]
          } else {
            map[caixinhaId] = {
              id: caixinhaId,
              name: item.name,
              current_balance: Number(item.current_balance || 0),
              target_balance: Number(item.target_balance || 0),
              category: item.category || 'geral',
              color: item.color === '#820ad1' ? '#1d1d1f' : (item.color || '#1d1d1f'),
              icon: item.icon || 'wallet',
              notes: item.notes || '',
              created_at: item.created_at || log.created_at,
              updated_at: item.updated_at || log.created_at,
            }
          }
        }
      }
    }

    return Object.values(map)
  } catch (error) {
    console.error('Erro ao buscar caixinhas:', error)
    return []
  }
}

export async function createCaixinha(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const name = (formData.get('name') as string)?.trim()
  const initial_balance = Number(formData.get('current_balance') || 0)
  const target_balance = Number(formData.get('target_balance') || 0)
  const category = (formData.get('category') as string) || 'geral'
  const color = (formData.get('color') as string) || '#1d1d1f'
  const icon = (formData.get('icon') as string) || 'wallet'
  const notes = (formData.get('notes') as string)?.trim() || ''

  if (!name) {
    return { error: 'O nome da caixinha é obrigatório.' }
  }

  if (initial_balance < 0) {
    return { error: 'O saldo inicial não pode ser negativo.' }
  }

  // Gera UUID padrão compatível com o tipo UUID do PostgreSQL no Supabase
  const id = crypto.randomUUID()
  const caixinha: Caixinha = {
    id,
    name,
    current_balance: initial_balance,
    target_balance,
    category,
    color,
    icon,
    notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_logs').insert({
    action: 'caixinha',
    table_name: 'financial_caixinhas',
    record_id: id,
    user_id: userId,
    new_data: caixinha,
  })

  if (error) {
    return { error: 'Erro ao salvar caixinha: ' + error.message }
  }

  revalidatePath('/')
  revalidatePath('/financeiro')
  return { success: true, caixinha }
}

export async function updateCaixinha(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const target_balance = Number(formData.get('target_balance') || 0)
  const category = (formData.get('category') as string) || 'geral'
  const color = (formData.get('color') as string) || '#1d1d1f'
  const icon = (formData.get('icon') as string) || 'wallet'
  const notes = (formData.get('notes') as string)?.trim() || ''

  if (!id || !name) {
    return { error: 'Dados inválidos para edição.' }
  }

  const caixinhas = await getCaixinhas()
  const existing = caixinhas.find((c) => c.id === id)
  if (!existing) {
    return { error: 'Caixinha não encontrada.' }
  }

  const updated: Caixinha = {
    ...existing,
    name,
    target_balance,
    category,
    color,
    icon,
    notes,
    updated_at: new Date().toISOString(),
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_logs').insert({
    action: 'caixinha',
    table_name: 'financial_caixinhas',
    record_id: isValidUuid(id) ? id : null,
    user_id: userId,
    new_data: updated,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/financeiro')
  return { success: true }
}

// 1. EDITAR SALDO DIRETAMENTE
export async function editCaixinhaBalance(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const id = formData.get('id') as string
  const newBalance = Number(formData.get('new_balance'))

  if (!id || isNaN(newBalance)) {
    return { error: 'Informe um valor de saldo válido.' }
  }

  if (newBalance < 0) {
    return { error: 'O saldo não pode ser negativo.' }
  }

  const caixinhas = await getCaixinhas()
  const existing = caixinhas.find((c) => c.id === id)
  if (!existing) {
    return { error: 'Caixinha não encontrada.' }
  }

  const updated: Caixinha = {
    ...existing,
    current_balance: newBalance,
    updated_at: new Date().toISOString(),
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_logs').insert({
    action: 'caixinha',
    table_name: 'financial_caixinhas',
    record_id: isValidUuid(id) ? id : null,
    user_id: userId,
    new_data: updated,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/financeiro')
  return { success: true }
}

// 2. GUARDAR / DEPOSITAR DINHEIRO NA CAIXINHA
export async function depositToCaixinha(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const id = formData.get('id') as string
  const amount = Number(formData.get('amount'))

  if (!id || isNaN(amount) || amount <= 0) {
    return { error: 'Informe um valor positivo para guardar.' }
  }

  const caixinhas = await getCaixinhas()
  const existing = caixinhas.find((c) => c.id === id)
  if (!existing) {
    return { error: 'Caixinha não encontrada.' }
  }

  const updated: Caixinha = {
    ...existing,
    current_balance: existing.current_balance + amount,
    updated_at: new Date().toISOString(),
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_logs').insert({
    action: 'caixinha',
    table_name: 'financial_caixinhas',
    record_id: isValidUuid(id) ? id : null,
    user_id: userId,
    new_data: updated,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/financeiro')
  return { success: true }
}

// 3. RESGATAR / RETIRAR DINHEIRO DA CAIXINHA (COM REGRA: NÃO PODER TIRAR O QUE NÃO TEM)
export async function withdrawFromCaixinha(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const id = formData.get('id') as string
  const amount = Number(formData.get('amount'))

  if (!id || isNaN(amount) || amount <= 0) {
    return { error: 'Informe um valor válido para resgate.' }
  }

  const caixinhas = await getCaixinhas()
  const existing = caixinhas.find((c) => c.id === id)
  if (!existing) {
    return { error: 'Caixinha não encontrada.' }
  }

  // REGRA DE OURO: NÃO PODER TIRAR SALDO QUE NÃO TENHA
  if (amount > existing.current_balance) {
    return {
      error: `Saldo insuficiente! Você só pode retirar até R$ ${existing.current_balance.toLocaleString(
        'pt-BR',
        { minimumFractionDigits: 2 }
      )} desta caixinha.`,
    }
  }

  const updated: Caixinha = {
    ...existing,
    current_balance: existing.current_balance - amount,
    updated_at: new Date().toISOString(),
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_logs').insert({
    action: 'caixinha',
    table_name: 'financial_caixinhas',
    record_id: isValidUuid(id) ? id : null,
    user_id: userId,
    new_data: updated,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/financeiro')
  return { success: true }
}

// 4. APAGAR CAIXINHA
export async function deleteCaixinha(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  if (!id) {
    return { error: 'ID da caixinha inválido.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_logs').insert({
    action: 'caixinha',
    table_name: 'financial_caixinhas',
    record_id: isValidUuid(id) ? id : null,
    user_id: userId,
    new_data: { deleted: true, deleted_at: new Date().toISOString() },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/financeiro')
  return { success: true }
}
