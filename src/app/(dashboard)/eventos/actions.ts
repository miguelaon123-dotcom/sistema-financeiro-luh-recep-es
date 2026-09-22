'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { invalidateCache } from '@/lib/data-cache'

interface SyncFinancialParams {
  title: string
  client_id?: string | null
  event_date: string
  budget: number
  deposit_amount: number
  deposit_status: 'pending' | 'paid'
  deposit_paid_date?: string | null
  status: string
  userId?: string | null
}

async function syncEventFinancialTransactions(
  supabase: any,
  eventId: string,
  params: SyncFinancialParams
) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const {
      title,
      client_id,
      event_date,
      budget,
      deposit_amount,
      deposit_status,
      deposit_paid_date,
      status,
      userId,
    } = params

    // 1. Buscar transações de receita já associadas ao evento
    const { data: existingTxs } = await supabase
      .from('financial_transactions')
      .select('id, description, amount, status, paid_date')
      .eq('event_id', eventId)
      .eq('type', 'income')

    const txs: any[] = existingTxs || []

    // Caso A: O evento possui um Sinal definido (> 0)
    if (deposit_amount > 0) {
      const remainingAmount = Math.max(0, budget - deposit_amount)

      // Identificar transação de Sinal existente ou reutilizar
      let sinalTx = txs.find((t) => t.description?.toLowerCase().includes('sinal'))
      let remainingTx = txs.find((t) => !t.description?.toLowerCase().includes('sinal'))

      if (!sinalTx && txs.length === 1 && remainingAmount === 0) {
        sinalTx = txs[0]
      } else if (!sinalTx && txs.length === 1) {
        remainingTx = txs[0]
      }

      // 1.1 Gerenciar Transação de Sinal
      const isSinalPaid = deposit_status === 'paid' || status === 'completed'
      const sinalPaidDate = isSinalPaid ? (deposit_paid_date || today) : null
      const sinalTxStatus = status === 'canceled' ? 'canceled' : (isSinalPaid ? 'paid' : 'pending')

      if (sinalTx) {
        await supabase
          .from('financial_transactions')
          .update({
            amount: deposit_amount,
            description: `Sinal - Evento: ${title}`,
            due_date: event_date,
            contact_id: client_id || null,
            status: sinalTxStatus,
            paid_date: sinalPaidDate,
          })
          .eq('id', sinalTx.id)
      } else {
        const sinalPayload: any = {
          event_id: eventId,
          contact_id: client_id || null,
          type: 'income',
          amount: deposit_amount,
          description: `Sinal - Evento: ${title}`,
          due_date: event_date,
          status: sinalTxStatus,
          paid_date: sinalPaidDate,
          created_by: userId || null,
        }
        let res = await supabase.from('financial_transactions').insert(sinalPayload)
        if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('created_by'))) {
          delete sinalPayload.created_by
          await supabase.from('financial_transactions').insert(sinalPayload)
        }
      }

      // 1.2 Gerenciar Transação do Saldo Restante
      if (remainingAmount > 0) {
        const isRemainingPaid = status === 'completed' || remainingTx?.status === 'paid'
        const remainingPaidDate = isRemainingPaid ? (remainingTx?.paid_date || today) : null
        const remainingTxStatus = status === 'canceled' ? 'canceled' : (isRemainingPaid ? 'paid' : 'pending')

        if (remainingTx && remainingTx.id !== sinalTx?.id) {
          await supabase
            .from('financial_transactions')
            .update({
              amount: remainingAmount,
              description: `Saldo Restante - Evento: ${title}`,
              due_date: event_date,
              contact_id: client_id || null,
              status: remainingTxStatus,
              paid_date: remainingPaidDate,
            })
            .eq('id', remainingTx.id)
        } else {
          const remPayload: any = {
            event_id: eventId,
            contact_id: client_id || null,
            type: 'income',
            amount: remainingAmount,
            description: `Saldo Restante - Evento: ${title}`,
            due_date: event_date,
            status: remainingTxStatus,
            paid_date: remainingPaidDate,
            created_by: userId || null,
          }
          let res = await supabase.from('financial_transactions').insert(remPayload)
          if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('created_by'))) {
            delete remPayload.created_by
            await supabase.from('financial_transactions').insert(remPayload)
          }
        }
      } else if (remainingTx && remainingTx.id !== sinalTx?.id) {
        await supabase.from('financial_transactions').delete().eq('id', remainingTx.id)
      }
    } else if (budget > 0) {
      // Caso B: Não há sinal (sinal = 0), mas há orçamento total
      let mainTx = txs[0]
      const isMainPaid = status === 'completed' || mainTx?.status === 'paid'
      const mainPaidDate = isMainPaid ? (mainTx?.paid_date || today) : null
      const mainTxStatus = status === 'canceled' ? 'canceled' : (isMainPaid ? 'paid' : 'pending')

      if (mainTx) {
        await supabase
          .from('financial_transactions')
          .update({
            amount: budget,
            description: `Contrato Evento: ${title}`,
            due_date: event_date,
            contact_id: client_id || null,
            status: mainTxStatus,
            paid_date: mainPaidDate,
          })
          .eq('id', mainTx.id)

        if (txs.length > 1) {
          const excessIds = txs.slice(1).map((t) => t.id)
          await supabase.from('financial_transactions').delete().in('id', excessIds)
        }
      } else {
        const txPayload: any = {
          event_id: eventId,
          contact_id: client_id || null,
          type: 'income',
          amount: budget,
          description: `Contrato Evento: ${title}`,
          due_date: event_date,
          status: mainTxStatus,
          paid_date: mainPaidDate,
          created_by: userId || null,
        }
        let res = await supabase.from('financial_transactions').insert(txPayload)
        if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('created_by'))) {
          delete txPayload.created_by
          await supabase.from('financial_transactions').insert(txPayload)
        }
      }
    } else {
      // Caso C: Orçamento zerado -> remove receitas
      if (txs.length > 0) {
        const ids = txs.map((t) => t.id)
        await supabase.from('financial_transactions').delete().in('id', ids)
      }
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar transações do evento:', err)
  }
}

export async function createEvent(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const title = (formData.get('title') as string)?.trim()
  const client_id = (formData.get('client_id') as string) || null
  const event_date = formData.get('event_date') as string
  const location = (formData.get('location') as string)?.trim() || null
  const budget = Number(formData.get('budget')) || 0
  const deposit_amount = Math.max(0, Number(formData.get('deposit_amount')) || 0)
  const deposit_status = (formData.get('deposit_status') as 'pending' | 'paid') || 'pending'
  const status = (formData.get('status') as string) || 'budget'
  const today = new Date().toISOString().split('T')[0]
  const deposit_paid_date = deposit_status === 'paid' ? today : null

  if (!title || !event_date) {
    return { error: 'O título e a data do evento são obrigatórios.' }
  }

  const insertData: Record<string, any> = {
    title,
    client_id: client_id || null,
    event_date,
    location,
    budget,
    deposit_amount,
    deposit_status,
    deposit_paid_date,
    status,
  }

  if (userId) {
    insertData.created_by = userId
  }

  let { data: insertedEvent, error } = await supabase
    .from('events')
    .insert(insertData)
    .select('id')
    .maybeSingle()

  // Fallback se colunas novas ou created_by ainda não estiverem no schema cache
  if (error && (error.code === 'PGRST204' || error.message?.includes('deposit_') || error.message?.includes('created_by'))) {
    delete insertData.created_by
    delete insertData.deposit_amount
    delete insertData.deposit_status
    delete insertData.deposit_paid_date

    const retry = await supabase
      .from('events')
      .insert(insertData)
      .select('id')
      .maybeSingle()
    error = retry.error
    insertedEvent = retry.data
  }

  if (error) {
    console.error('Erro ao cadastrar evento:', error)
    return { error: error.message }
  }

  const newEventId = insertedEvent?.id

  // 💰 Conexão Automática com o Financeiro e Dashboard
  if (newEventId && (budget > 0 || deposit_amount > 0)) {
    await syncEventFinancialTransactions(supabase, newEventId, {
      title,
      client_id,
      event_date,
      budget,
      deposit_amount,
      deposit_status,
      deposit_paid_date,
      status,
      userId,
    })
  }

  invalidateCache(['eventos', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateEventStatus(
  id: string,
  newStatus: 'budget' | 'approved' | 'completed' | 'canceled'
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('events')
    .update({ status: newStatus })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  // Sincroniza o status no financeiro
  try {
    const today = new Date().toISOString().split('T')[0]
    if (newStatus === 'completed') {
      await supabase
        .from('financial_transactions')
        .update({
          status: 'paid',
          paid_date: today,
        })
        .eq('event_id', id)
        .eq('type', 'income')

      try {
        await supabase
          .from('events')
          .update({
            deposit_status: 'paid',
            deposit_paid_date: today,
          })
          .eq('id', id)
      } catch {}
    } else if (newStatus === 'canceled') {
      await supabase
        .from('financial_transactions')
        .update({ status: 'canceled' })
        .eq('event_id', id)
    }
  } catch (err) {
    console.warn('Aviso ao atualizar status no financeiro:', err)
  }

  invalidateCache(['eventos', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const supabase = createAdminClient()

  // Exclui transações financeiras associadas ao evento
  try {
    await supabase.from('financial_transactions').delete().eq('event_id', id)
  } catch (err) {
    console.warn('Aviso ao remover transações do evento:', err)
  }

  const { error } = await supabase.from('events').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  invalidateCache(['eventos', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateEvent(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const id = formData.get('id') as string
  const title = (formData.get('title') as string)?.trim()
  const client_id = (formData.get('client_id') as string) || null
  const event_date = formData.get('event_date') as string
  const location = (formData.get('location') as string)?.trim() || null
  const budget = Number(formData.get('budget')) || 0
  const deposit_amount = Math.max(0, Number(formData.get('deposit_amount')) || 0)
  const deposit_status = (formData.get('deposit_status') as 'pending' | 'paid') || 'pending'
  const status = (formData.get('status') as string) || 'budget'
  const today = new Date().toISOString().split('T')[0]
  const deposit_paid_date = deposit_status === 'paid' ? today : null

  if (!id || !title || !event_date) {
    return { error: 'O título e a data do evento são obrigatórios.' }
  }

  const updateData: Record<string, any> = {
    title,
    client_id: client_id || null,
    event_date,
    location,
    budget,
    deposit_amount,
    deposit_status,
    deposit_paid_date,
    status,
  }

  let { error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', id)

  if (error && (error.code === 'PGRST204' || error.message?.includes('deposit_'))) {
    delete updateData.deposit_amount
    delete updateData.deposit_status
    delete updateData.deposit_paid_date
    const retry = await supabase.from('events').update(updateData).eq('id', id)
    error = retry.error
  }

  if (error) {
    console.error('Erro ao atualizar evento:', error)
    return { error: error.message }
  }

  // Sincronizar transações no Financeiro
  await syncEventFinancialTransactions(supabase, id, {
    title,
    client_id,
    event_date,
    budget,
    deposit_amount,
    deposit_status,
    deposit_paid_date,
    status,
    userId,
  })

  invalidateCache(['eventos', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export interface EventStockItemInput {
  productId: string
  quantity: number
}

export async function allocateStockToEvent(
  eventId: string,
  items: EventStockItemInput[]
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  if (!eventId || !items || items.length === 0) {
    return { error: 'Selecione ao menos um produto para alocar ao evento.' }
  }

  // 1. Obter dados do evento
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (eventErr || !event) {
    return { error: 'Evento não encontrado.' }
  }

  // 2. Validar estoque de cada produto
  for (const item of items) {
    if (item.quantity <= 0) continue

    const { data: prod, error: prodErr } = await supabase
      .from('products')
      .select('id, name, current_stock')
      .eq('id', item.productId)
      .single()

  if (prodErr || !prod) {
    return { error: `Produto não encontrado (ID: ${item.productId})` }
  }

  if (prod.current_stock < item.quantity) {
    return {
      error: `Estoque insuficiente para "${prod.name}"! Saldo disponível: ${prod.current_stock}, solicitado: ${item.quantity}.`,
    }
  }
}

  // 3. Executar saídas no estoque
  for (const item of items) {
    if (item.quantity <= 0) continue

    const { data: prod } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.productId)
      .single()

    const currentStock = Number(prod?.current_stock || 0)
    const newStock = Math.max(0, currentStock - item.quantity)

    // Atualizar saldo do produto
    await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', item.productId)

    // Registrar movimentação de saída vinculada ao evento
    await supabase.from('product_movements').insert({
      product_id: item.productId,
      event_id: eventId,
      user_id: userId || null,
      type: 'out',
      quantity: item.quantity,
      reason: `Saída para Festa/Evento: ${event.title}`,
    })

    // Tentar gravar na tabela event_items
    try {
      await supabase.from('event_items').insert({
        event_id: eventId,
        product_id: item.productId,
        quantity: item.quantity,
        returned_qty: 0,
        broken_qty: 0,
        lost_qty: 0,
      })
    } catch {
      // Ignora se tabela event_items ainda não existir
    }
  }

  // Redundância em audit_logs
  try {
    await supabase.from('audit_logs').insert({
      action: 'event_allocated_items',
      table_name: 'events',
      record_id: eventId,
      user_id: userId || null,
      new_data: { items, allocated_at: new Date().toISOString() },
    })
  } catch (e) {
    console.error('Erro ao registrar alocação em audit_logs:', e)
  }

  invalidateCache(['eventos', 'estoque', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/estoque')
  revalidatePath('/')
  return { success: true }
}

export interface ReturnItemChecklist {
  productId: string
  productName: string
  totalAllocated: number
  returnedQty: number // Intactos (retornam ao estoque)
  brokenQty: number   // Quebrados (baixa definitiva)
  lostQty: number     // Faltantes/Extraviados (baixa definitiva)
  penaltyFee?: number // Valor de ressarcimento cobrado
  notes?: string
}

export async function returnEventWithInspection(
  eventId: string,
  items: ReturnItemChecklist[]
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (eventErr || !event) {
    return { error: 'Evento não encontrado.' }
  }

  for (const item of items) {
    const returned = Number(item.returnedQty) || 0
    const broken = Number(item.brokenQty) || 0
    const lost = Number(item.lostQty) || 0

    // 1. Devolver os intactos ao estoque
    if (returned > 0) {
      const { data: prod } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item.productId)
        .single()

      const currentStock = Number(prod?.current_stock || 0)
      await supabase
        .from('products')
        .update({ current_stock: currentStock + returned })
        .eq('id', item.productId)

      await supabase.from('product_movements').insert({
        product_id: item.productId,
        event_id: eventId,
        user_id: userId || null,
        type: 'return',
        quantity: returned,
        reason: `Retorno íntegro pós-festa: ${event.title} (${returned} un.)`,
      })
    }

    // 2. Registrar quebras/avarias (não voltam ao estoque, registra baixa definitiva como perda)
    if (broken > 0) {
      await supabase.from('product_movements').insert({
        product_id: item.productId,
        event_id: eventId,
        user_id: userId || null,
        type: 'loss',
        quantity: broken,
        reason: `Avaria/Quebra na festa: ${event.title} (${broken} un.) ${
          item.notes ? `- Motivo: ${item.notes}` : ''
        }`,
      })
    }

    // 3. Registrar faltas/extravios (não voltam ao estoque, registra baixa definitiva)
    if (lost > 0) {
      await supabase.from('product_movements').insert({
        product_id: item.productId,
        event_id: eventId,
        user_id: userId || null,
        type: 'loss',
        quantity: lost,
        reason: `Extravio/Perda na festa: ${event.title} (${lost} un. não retornaram) ${
          item.notes ? `- Motivo: ${item.notes}` : ''
        }`,
      })
    }

    // Tentar atualizar tabela event_items se existir
    try {
      await supabase
        .from('event_items')
        .update({
          returned_qty: returned,
          broken_qty: broken,
          lost_qty: lost,
          penalty_fee: Number(item.penaltyFee || 0),
          notes: item.notes || null,
        })
        .eq('event_id', eventId)
        .eq('product_id', item.productId)
    } catch {
      // Ignora se não existir
    }
  }

  // Concluir status do evento para 'completed'
  await supabase
    .from('events')
    .update({ status: 'completed' })
    .eq('id', eventId)

  // Auditoria do checklist de devolução
  try {
    await supabase.from('audit_logs').insert({
      action: 'event_return_inspection',
      table_name: 'events',
      record_id: eventId,
      user_id: userId || null,
      new_data: {
        items,
        completed_at: new Date().toISOString(),
      },
    })
  } catch (e) {
    console.error('Erro ao gravar log da conferência:', e)
  }

  invalidateCache(['eventos', 'estoque', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/estoque')
  revalidatePath('/')
  return { success: true }
}

export interface EventStaffInput {
  employeeId: string
  employeeName?: string
  role: string
  dailyRate: number
}

export async function assignStaffToEvent(
  eventId: string,
  staffList: EventStaffInput[]
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  // 1. Obter data do evento atual
  const { data: currentEvent } = await supabase
    .from('events')
    .select('id, title, event_date')
    .eq('id', eventId)
    .single()

  if (!currentEvent) {
    return { error: 'Evento não encontrado.' }
  }

  // 2. Verificar outros eventos ativos que ocorrem na mesma data
  const { data: sameDayEvents } = await supabase
    .from('events')
    .select('id, title, event_date')
    .eq('event_date', currentEvent.event_date)
    .neq('id', eventId)
    .neq('status', 'canceled')

  const otherEventIds = (sameDayEvents || []).map((e: any) => e.id)
  let doubleShiftEmployees: string[] = []
  if (otherEventIds.length > 0) {
    try {
      const { data: conflicts } = await supabase
        .from('event_staff')
        .select('employee_id, event_id, events(title)')
        .in('event_id', otherEventIds)

      if (conflicts && conflicts.length > 0) {
        for (const input of staffList) {
          const found = conflicts.find((c: any) => c.employee_id === input.employeeId)
          if (found) {
            const empName = input.employeeName || 'Colaborador'
            const conflictEventTitle = (found as any).events?.title || 'Outra festa na mesma data'
            doubleShiftEmployees.push(`${empName} (também em "${conflictEventTitle}")`)
          }
        }
      }
    } catch {}
  }

  // 4. Se passou pela validação de conflitos, salva a escala na tabela
  try {
    await supabase.from('event_staff').delete().eq('event_id', eventId)
    for (const s of staffList) {
      await supabase.from('event_staff').insert({
        event_id: eventId,
        employee_id: s.employeeId,
        role: s.role,
        daily_rate: s.dailyRate,
        status: 'confirmed',
      })
    }
  } catch {}

  // 5. Salva log de escala em audit_logs para fallback imediato
  try {
    await supabase.from('audit_logs').insert({
      action: 'event_staff_assigned',
      table_name: 'event_staff',
      record_id: eventId,
      user_id: userId,
      new_data: {
        eventId,
        eventTitle: currentEvent.title,
        eventDate: currentEvent.event_date,
        staff: staffList,
        doubleShiftEmployees: doubleShiftEmployees.length > 0 ? doubleShiftEmployees : null,
        assignedAt: new Date().toISOString(),
      },
    })
  } catch {}

  // 6. 💰 Conexão com o Financeiro (Despesa da Equipe):
  // Lança ou atualiza as diárias da equipe na tabela financial_transactions
  try {
    const totalStaffCost = staffList.reduce((acc, s) => acc + (Number(s.dailyRate) || 0), 0)
    const { data: existingStaffTx } = await supabase
      .from('financial_transactions')
      .select('id')
      .eq('event_id', eventId)
      .eq('type', 'expense')
      .ilike('description', 'Diárias da Equipe%')
      .maybeSingle()

    if (totalStaffCost > 0) {
      const desc = `Diárias da Equipe (${staffList.length} pessoas) - Festa: ${currentEvent.title}`
      if (existingStaffTx) {
        await supabase
          .from('financial_transactions')
          .update({
            amount: totalStaffCost,
            description: desc,
            due_date: currentEvent.event_date,
          })
          .eq('id', existingStaffTx.id)
      } else {
        const txPayload: any = {
          event_id: eventId,
          type: 'expense',
          amount: totalStaffCost,
          description: desc,
          due_date: currentEvent.event_date,
          status: 'pending',
          created_by: userId || null,
        }
        let txRes = await supabase.from('financial_transactions').insert(txPayload)
        if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
          delete txPayload.created_by
          await supabase.from('financial_transactions').insert(txPayload)
        }
      }
    } else if (existingStaffTx) {
      await supabase.from('financial_transactions').delete().eq('id', existingStaffTx.id)
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar diárias no financeiro:', err)
  }

  invalidateCache(['eventos', 'funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function removeStaffFromEvent(eventId: string, employeeId: string) {
  const supabase = createAdminClient()

  try {
    await supabase
      .from('event_staff')
      .delete()
      .eq('event_id', eventId)
      .eq('employee_id', employeeId)
  } catch {}

  invalidateCache(['eventos', 'funcionarios', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateEventDepositStatus(
  eventId: string,
  newDepositStatus: 'pending' | 'paid'
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('id, title, budget, deposit_amount, deposit_status, client_id, event_date, status')
    .eq('id', eventId)
    .single()

  if (fetchErr || !event) {
    return { error: 'Evento não encontrado.' }
  }

  const deposit_amount = Number(event.deposit_amount) || 0
  const deposit_paid_date = newDepositStatus === 'paid' ? today : null

  // 1. Atualizar tabela events
  let updateData: Record<string, any> = {
    deposit_status: newDepositStatus,
    deposit_paid_date: deposit_paid_date,
  }

  let { error: updateEvtErr } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)

  if (updateEvtErr && (updateEvtErr.code === 'PGRST204' || updateEvtErr.message?.includes('deposit_'))) {
    console.warn('Aviso: colunas de sinal ainda não sincronizadas no banco events:', updateEvtErr.message)
  }

  // 2. Sincronizar transações no financeiro (faz o sinal subir no Dashboard imediatamente ao marcar como Pago!)
  await syncEventFinancialTransactions(supabase, eventId, {
    title: event.title,
    client_id: event.client_id,
    event_date: event.event_date,
    budget: Number(event.budget) || 0,
    deposit_amount: deposit_amount,
    deposit_status: newDepositStatus,
    deposit_paid_date: deposit_paid_date,
    status: event.status,
    userId,
  })

  invalidateCache(['eventos', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function receiveEventContractPayment(eventId: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, title, budget, deposit_amount, deposit_status, client_id, event_date, status')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Evento não encontrado' }

  const today = new Date().toISOString().split('T')[0]

  // Marca todas as transações de receita deste evento como pagas
  await supabase
    .from('financial_transactions')
    .update({
      status: 'paid',
      paid_date: today,
    })
    .eq('event_id', eventId)
    .eq('type', 'income')

  // Se o sinal ou contrato do evento estavam pendentes, atualiza o evento
  try {
    await supabase
      .from('events')
      .update({
        deposit_status: 'paid',
        deposit_paid_date: today,
      })
      .eq('id', eventId)
  } catch (err) {
    console.warn('Aviso ao atualizar deposit_status no evento:', err)
  }

  invalidateCache(['eventos', 'financeiro', 'dashboard'])
  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}
