'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { invalidateCache } from '@/lib/data-cache'

export interface RentalItemInput {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface RentalPayload {
  id?: string
  clientId: string
  startDate: string
  returnDate: string
  deliveryType: 'pickup' | 'delivery'
  deliveryAddress?: string
  deliveryFee: number
  securityDeposit: number
  paymentStatus: 'pending' | 'paid' | 'partial'
  status: 'budget' | 'confirmed' | 'dispatched' | 'returned' | 'canceled'
  notes?: string
  items: RentalItemInput[]
}

export async function createRental(data: RentalPayload) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient() as any

  if (!data.clientId || !data.startDate || !data.returnDate || !data.items || data.items.length === 0) {
    return { error: 'Preencha o cliente, datas e selecione ao menos um produto.' }
  }

  // 1. Validar estoque se o status for 'confirmed' ou 'dispatched'
  if (data.status === 'dispatched' || data.status === 'confirmed') {
    for (const item of data.items) {
      const { data: prod } = await supabase
        .from('products')
        .select('name, current_stock')
        .eq('id', item.productId)
        .single()

      if (prod && prod.current_stock < item.quantity) {
        return {
          error: `Estoque insuficiente para "${prod.name}"! Saldo atual: ${prod.current_stock}, solicitado: ${item.quantity}.`,
        }
      }
    }
  }

  const rentalCode = `LOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const itemsTotal = data.items.reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0)
  const totalAmount = itemsTotal + (Number(data.deliveryFee) || 0)

  // 2. Se a tabela rentals existir, insere nela
  let rentalId = data.id || crypto.randomUUID()
  let tableExists = true

  const { error: insertErr } = await supabase.from('rentals').insert({
    id: rentalId,
    rental_code: rentalCode,
    client_id: data.clientId,
    start_date: data.startDate,
    return_date: data.returnDate,
    delivery_type: data.deliveryType,
    delivery_address: data.deliveryAddress || null,
    delivery_fee: data.deliveryFee || 0,
    security_deposit: data.securityDeposit || 0,
    items_total: itemsTotal,
    total_amount: totalAmount,
    status: data.status,
    payment_status: data.paymentStatus,
    notes: data.notes || null,
    created_by: userId,
  })

  if (insertErr) {
    if (insertErr.code === 'PGRST205') {
      tableExists = false
    } else {
      console.error('Erro ao inserir locação:', insertErr)
      return { error: insertErr.message }
    }
  }

  // 3. Se a tabela rental_items existir, grava os itens
  if (tableExists) {
    for (const item of data.items) {
      await supabase.from('rental_items').insert({
        rental_id: rentalId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        returned_qty: 0,
        broken_qty: 0,
        lost_qty: 0,
      })
    }
  }

  // 4. Se o status já for 'dispatched' (entregue ao cliente), desconta do estoque imediatamente
  if (data.status === 'dispatched') {
    for (const item of data.items) {
      const { data: prod } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item.productId)
        .single()

      if (prod) {
        const currentStock = Number(prod.current_stock || 0)
        const newStock = Math.max(0, currentStock - item.quantity)

        await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', item.productId)

        await supabase.from('product_movements').insert({
          product_id: item.productId,
          user_id: userId,
          type: 'out',
          quantity: item.quantity,
          reason: `Saída para Locação ${rentalCode}`,
        })
      }
    }
  }

  // 5. Integração com o Financeiro (Gera receita da locação no Financeiro)
  if (totalAmount > 0) {
    try {
      const txPayload: any = {
        type: 'income',
        amount: totalAmount,
        contact_id: data.clientId || null,
        due_date: data.startDate.split('T')[0] || new Date().toISOString().split('T')[0],
        paid_date: data.paymentStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
        status: data.paymentStatus === 'paid' ? 'paid' : 'pending',
        description: `Receita de Locação ${rentalCode} (${data.items.length} itens)`,
        created_by: userId || null,
      }
      let txRes = await supabase.from('financial_transactions').insert(txPayload)
      if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
        delete txPayload.created_by
        await supabase.from('financial_transactions').insert(txPayload)
      }
    } catch (e) {
      console.error('Erro ao integrar receita da locação no financeiro:', e)
    }
  }

  // 6. Salva log no audit_logs para garantia total de redundância e fallback
  try {
    await supabase.from('audit_logs').insert({
      action: 'rental_created',
      table_name: 'rentals',
      record_id: rentalId,
      user_id: userId,
      new_data: {
        ...data,
        id: rentalId,
        rentalCode,
        itemsTotal,
        totalAmount,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (e) {
    console.error('Erro ao gravar log de locação:', e)
  }

  invalidateCache(['locacoes', 'estoque', 'financeiro', 'dashboard'])
  revalidatePath('/locacoes')
  revalidatePath('/estoque')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true, rentalId, rentalCode }
}

export async function updateRentalStatus(
  rentalId: string,
  newStatus: 'budget' | 'confirmed' | 'dispatched' | 'returned' | 'canceled'
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient() as any

  // Se estiver despachando (entregando ao cliente), desconta o estoque dos itens
  if (newStatus === 'dispatched') {
    let items: any[] = []
    const { data: dbItems } = await supabase
      .from('rental_items')
      .select('product_id, quantity')
      .eq('rental_id', rentalId)

    if (dbItems && dbItems.length > 0) {
      items = dbItems
    } else {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('new_data')
        .eq('record_id', rentalId)
        .eq('action', 'rental_created')
        .single()
      if (logs?.new_data?.items) {
        items = logs.new_data.items
      }
    }

    for (const item of items) {
      const pid = item.product_id || item.productId
      const qty = item.quantity
      if (!pid || !qty) continue

      const { data: prod } = await supabase
        .from('products')
        .select('current_stock, name')
        .eq('id', pid)
        .single()

      if (prod) {
        const newStock = Math.max(0, Number(prod.current_stock) - qty)
        await supabase.from('products').update({ current_stock: newStock }).eq('id', pid)

        await supabase.from('product_movements').insert({
          product_id: pid,
          user_id: userId,
          type: 'out',
          quantity: qty,
          reason: `Saída para Locação ${rentalId}`,
        })
      }
    }
  }

  // Atualiza status na tabela rentals se existir
  try {
    await supabase.from('rentals').update({ status: newStatus }).eq('id', rentalId)
  } catch {}

  // Grava auditoria
  try {
    await supabase.from('audit_logs').insert({
      action: 'rental_status_updated',
      table_name: 'rentals',
      record_id: rentalId,
      user_id: userId,
      new_data: { status: newStatus, updatedAt: new Date().toISOString() },
    })
  } catch {}

  invalidateCache(['locacoes', 'estoque', 'financeiro', 'dashboard'])
  revalidatePath('/locacoes')
  revalidatePath('/estoque')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function updateRentalPaymentStatus(
  rentalId: string,
  newPaymentStatus: 'paid' | 'pending'
) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient() as any

  // 1. Atualizar na tabela rentals
  try {
    await supabase
      .from('rentals')
      .update({ payment_status: newPaymentStatus })
      .eq('id', rentalId)
  } catch {}

  // 2. Buscar dados da locação para atualizar ou criar a transação financeira
  try {
    const { data: rent } = await supabase
      .from('rentals')
      .select('rental_code, client_id, total_amount, start_date')
      .eq('id', rentalId)
      .single()

    const code = rent?.rental_code || rentalId

    const { data: existingTxs } = await supabase
      .from('financial_transactions')
      .select('id')
      .like('description', `%${code}%`)
      .limit(1)

    if (existingTxs && existingTxs.length > 0) {
      await supabase
        .from('financial_transactions')
        .update({
          status: newPaymentStatus,
          paid_date: newPaymentStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', existingTxs[0].id)
    } else if (rent) {
      const txPayload: any = {
        type: 'income',
        amount: rent.total_amount,
        contact_id: rent.client_id,
        due_date: rent.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        paid_date: newPaymentStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
        status: newPaymentStatus,
        description: `Receita de Locação ${code}`,
        created_by: userId || null,
      }
      let txRes = await supabase.from('financial_transactions').insert(txPayload)
      if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
        delete txPayload.created_by
        await supabase.from('financial_transactions').insert(txPayload)
      }
    }
  } catch (e) {
    console.error('Erro ao sincronizar pagamento no financeiro:', e)
  }

  invalidateCache(['locacoes', 'financeiro', 'dashboard'])
  revalidatePath('/locacoes')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export interface RentalInspectionItem {
  productId: string
  productName: string
  totalRented: number
  returnedQty: number
  brokenQty: number
  lostQty: number
  penaltyFee: number
  notes?: string
}

export async function returnRentalWithInspection(
  rentalId: string,
  rentalCode: string,
  items: RentalInspectionItem[],
  chargeOption: 'none' | 'deposit_deduct' | 'financial_charge'
): Promise<{ success?: boolean; error?: string }> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient() as any

  let totalPenalties = 0

  for (const item of items) {
    const returned = Number(item.returnedQty) || 0
    const broken = Number(item.brokenQty) || 0
    const lost = Number(item.lostQty) || 0
    totalPenalties += Number(item.penaltyFee) || 0

    if (returned > 0) {
      const { data: prod } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item.productId)
        .single()

      if (prod) {
        const newStock = Number(prod.current_stock) + returned
        await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', item.productId)

        await supabase.from('product_movements').insert({
          product_id: item.productId,
          user_id: userId,
          type: 'return',
          quantity: returned,
          reason: `Devolução íntegra da Locação ${rentalCode} (${returned} un.)`,
        })
      }
    }

    if (broken > 0) {
      await supabase.from('product_movements').insert({
        product_id: item.productId,
        user_id: userId,
        type: 'loss',
        quantity: broken,
        reason: `Avaria/Quebra na Locação ${rentalCode} (${broken} un.) ${
          item.notes ? `- Obs: ${item.notes}` : ''
        }`,
      })
    }

    if (lost > 0) {
      await supabase.from('product_movements').insert({
        product_id: item.productId,
        user_id: userId,
        type: 'loss',
        quantity: lost,
        reason: `Extravio/Perda na Locação ${rentalCode} (${lost} un. não retornaram) ${
          item.notes ? `- Obs: ${item.notes}` : ''
        }`,
      })
    }

    try {
      await supabase
        .from('rental_items')
        .update({
          returned_qty: returned,
          broken_qty: broken,
          lost_qty: lost,
          penalty_fee: item.penaltyFee,
          notes: item.notes || null,
        })
        .eq('rental_id', rentalId)
        .eq('product_id', item.productId)
    } catch {}
  }

  try {
    await supabase
      .from('rentals')
      .update({
        status: 'returned',
        actual_return_date: new Date().toISOString(),
        penalty_amount: totalPenalties,
      })
      .eq('id', rentalId)
  } catch {}

  if (chargeOption === 'financial_charge' && totalPenalties > 0) {
    try {
      let clientId: string | null = null
      const { data: rentData } = await supabase
        .from('rentals')
        .select('client_id')
        .eq('id', rentalId)
        .single()
      clientId = rentData?.client_id || null

      const txPayload: any = {
        type: 'income',
        amount: totalPenalties,
        due_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        contact_id: clientId,
        description: `Cobrança de Avarias/Quebras - Locação ${rentalCode}`,
        created_by: userId || null,
      }
      let txRes = await supabase.from('financial_transactions').insert(txPayload)
      if (txRes.error && (txRes.error.code === 'PGRST204' || txRes.error.message?.includes('created_by'))) {
        delete txPayload.created_by
        await supabase.from('financial_transactions').insert(txPayload)
      }
    } catch (e) {
      console.error('Erro ao gerar lançamento financeiro de avaria:', e)
    }
  }

  try {
    await supabase.from('audit_logs').insert({
      action: 'rental_returned_inspection',
      table_name: 'rentals',
      record_id: rentalId,
      user_id: userId,
      new_data: {
        rentalCode,
        items,
        totalPenalties,
        chargeOption,
        completedAt: new Date().toISOString(),
      },
    })
  } catch {}

  invalidateCache(['locacoes', 'estoque', 'financeiro', 'dashboard'])
  revalidatePath('/locacoes')
  revalidatePath('/estoque')
  revalidatePath('/financeiro')
  revalidatePath('/')
  return { success: true }
}

export async function quickCreateClient(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient() as any

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null

  if (!name) {
    return { error: 'O nome do cliente é obrigatório.' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name,
      type: 'client',
      phone,
      document,
      email,
      address,
      created_by: userId,
    })
    .select('id, name, phone, document, address')
    .single()

  if (error) {
    return { error: error.message }
  }

  invalidateCache(['locacoes', 'dashboard'])
  revalidatePath('/clientes')
  revalidatePath('/locacoes')
  return { success: true, client: data }
}

export async function deleteRental(rentalId: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null

  const supabase = createAdminClient() as any

  try {
    const { data: rent } = await supabase.from('rentals').select('code').eq('id', rentalId).maybeSingle()
    if (rent?.code) {
      await supabase.from('financial_transactions').delete().ilike('description', `%${rent.code}%`)
    }
  } catch {}

  try {
    await supabase.from('rental_items').delete().eq('rental_id', rentalId)
  } catch {}

  try {
    await supabase.from('rentals').delete().eq('id', rentalId)
  } catch {}

  try {
    await supabase.from('audit_logs').insert({
      action: 'rental_deleted',
      table_name: 'rentals',
      record_id: rentalId,
      user_id: userId,
    })
  } catch {}

  invalidateCache(['locacoes', 'financeiro', 'dashboard'])
  revalidatePath('/locacoes')
  revalidatePath('/')
  return { success: true }
}
