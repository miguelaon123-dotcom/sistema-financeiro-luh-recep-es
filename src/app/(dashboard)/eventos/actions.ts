'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function createEvent(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const title = (formData.get('title') as string)?.trim()
  const client_id = (formData.get('client_id') as string) || null
  const event_date = formData.get('event_date') as string
  const location = (formData.get('location') as string)?.trim() || null
  const budget = Number(formData.get('budget')) || 0
  const status = (formData.get('status') as string) || 'budget'

  if (!title || !event_date) {
    return { error: 'O título e a data do evento são obrigatórios.' }
  }

  const insertData: Record<string, any> = {
    title,
    client_id: client_id || null,
    event_date,
    location,
    budget,
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

  // Fallback: se a coluna created_by não existir na tabela events do Supabase ou estiver ausente no schema cache
  if (
    error &&
    (error.message?.includes('created_by') ||
      error.details?.includes('created_by') ||
      error.code === 'PGRST204')
  ) {
    delete insertData.created_by
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

  // 💰 Conexão Automática com o Financeiro:
  // Se o evento possuir valor orçado/contratado (> 0), gera a receita no financeiro
  if (newEventId && budget > 0) {
    try {
      await supabase.from('financial_transactions').insert({
        event_id: newEventId,
        contact_id: client_id || null,
        type: 'income',
        amount: budget,
        description: `Contrato Evento: ${title}`,
        due_date: event_date,
        status: status === 'completed' ? 'paid' : 'pending',
        paid_date: status === 'completed' ? new Date().toISOString().split('T')[0] : null,
        created_by: userId || null,
      })
    } catch (err) {
      console.warn('Aviso ao gerar receita financeira do evento:', err)
    }
  }

  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateEventStatus(
  id: string,
  newStatus: 'budget' | 'approved' | 'completed' | 'canceled'
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const { error } = await supabase
    .from('events')
    .update({ status: newStatus })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  // Sincroniza o status no financeiro
  try {
    if (newStatus === 'completed') {
      await supabase
        .from('financial_transactions')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('event_id', id)
        .eq('type', 'income')
    } else if (newStatus === 'canceled') {
      await supabase
        .from('financial_transactions')
        .update({ status: 'canceled' })
        .eq('event_id', id)
    }
  } catch (err) {
    console.warn('Aviso ao atualizar status no financeiro:', err)
  }

  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

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

  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateEvent(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const id = formData.get('id') as string
  const title = (formData.get('title') as string)?.trim()
  const client_id = (formData.get('client_id') as string) || null
  const event_date = formData.get('event_date') as string
  const location = (formData.get('location') as string)?.trim() || null
  const budget = Number(formData.get('budget')) || 0
  const status = (formData.get('status') as string) || 'budget'

  if (!id || !title || !event_date) {
    return { error: 'O título e a data do evento são obrigatórios.' }
  }

  const { error } = await supabase
    .from('events')
    .update({
      title,
      client_id: client_id || null,
      event_date,
      location,
      budget,
      status,
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar evento:', error)
    return { error: error.message }
  }

  // Sincronizar receita do contrato no Financeiro
  try {
    const { data: existingTx } = await supabase
      .from('financial_transactions')
      .select('id, status')
      .eq('event_id', id)
      .eq('type', 'income')
      .maybeSingle()

    if (existingTx) {
      await supabase
        .from('financial_transactions')
        .update({
          amount: budget,
          description: `Contrato Evento: ${title}`,
          due_date: event_date,
          contact_id: client_id || null,
          status: status === 'completed' ? 'paid' : status === 'canceled' ? 'canceled' : existingTx.status,
          paid_date: status === 'completed' ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', existingTx.id)
    } else if (budget > 0) {
      await supabase.from('financial_transactions').insert({
        event_id: id,
        contact_id: client_id || null,
        type: 'income',
        amount: budget,
        description: `Contrato Evento: ${title}`,
        due_date: event_date,
        status: status === 'completed' ? 'paid' : 'pending',
        paid_date: status === 'completed' ? new Date().toISOString().split('T')[0] : null,
        created_by: userId || null,
      })
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar transação no financeiro:', err)
  }

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
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

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
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

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
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

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

  const otherEventIds = (sameDayEvents || []).map((e) => e.id)
  let doubleShiftEmployees: string[] = []
  if (otherEventIds.length > 0) {
    try {
      const { data: conflicts } = await supabase
        .from('event_staff')
        .select('employee_id, event_id, events(title)')
        .in('event_id', otherEventIds)

      if (conflicts && conflicts.length > 0) {
        for (const input of staffList) {
          const found = conflicts.find((c) => c.employee_id === input.employeeId)
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
        await supabase.from('financial_transactions').insert({
          event_id: eventId,
          type: 'expense',
          amount: totalStaffCost,
          description: desc,
          due_date: currentEvent.event_date,
          status: 'pending',
          created_by: userId,
        })
      }
    } else if (existingStaffTx) {
      await supabase.from('financial_transactions').delete().eq('id', existingStaffTx.id)
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar diárias no financeiro:', err)
  }

  revalidatePath('/eventos')
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function removeStaffFromEvent(eventId: string, employeeId: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  try {
    await supabase
      .from('event_staff')
      .delete()
      .eq('event_id', eventId)
      .eq('employee_id', employeeId)
  } catch {}

  revalidatePath('/eventos')
  revalidatePath('/funcionarios')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function receiveEventContractPayment(eventId: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, budget, client_id, event_date')
    .eq('id', eventId)
    .single()

  if (!event) return { error: 'Evento não encontrado' }

  const today = new Date().toISOString().split('T')[0]

  // Buscar transação de receita existente
  const { data: existingTx } = await supabase
    .from('financial_transactions')
    .select('id')
    .eq('event_id', eventId)
    .eq('type', 'income')
    .maybeSingle()

  if (existingTx) {
    await supabase
      .from('financial_transactions')
      .update({
        status: 'paid',
        paid_date: today,
      })
      .eq('id', existingTx.id)
  } else {
    await supabase.from('financial_transactions').insert({
      event_id: eventId,
      contact_id: event.client_id,
      type: 'income',
      amount: Number(event.budget) || 0,
      description: `Contrato Evento: ${event.title}`,
      due_date: event.event_date,
      status: 'paid',
      paid_date: today,
      created_by: userId,
    })
  }

  revalidatePath('/eventos')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}
