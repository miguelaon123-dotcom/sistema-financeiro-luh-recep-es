'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function createStockMovement(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const product_id = formData.get('product_id') as string
  const type = formData.get('type') as 'in' | 'out' | 'loss' | 'adjustment' | 'return'
  const quantity = Number(formData.get('quantity'))
  const reason = (formData.get('reason') as string)?.trim() || null

  if (!product_id || !type || isNaN(quantity) || quantity <= 0) {
    return { error: 'Selecione o produto, tipo e informe uma quantidade válida.' }
  }

  // 1. Obter estoque atual do produto
  const { data: product, error: fetchErr } = await supabase
    .from('products')
    .select('current_stock, name')
    .eq('id', product_id)
    .single()

  if (fetchErr || !product) {
    return { error: 'Produto não encontrado.' }
  }

  let newStock = Number(product.current_stock)
  if (type === 'in' || type === 'return') {
    newStock += quantity
  } else if (type === 'out' || type === 'loss') {
    if (newStock < quantity) {
      return { error: `Estoque insuficiente! Saldo atual de "${product.name}" é ${newStock} un.` }
    }
    newStock -= quantity
  } else if (type === 'adjustment') {
    newStock = quantity
  }

  // 2. Gravar movimentação
  const { error: movErr } = await supabase.from('product_movements').insert({
    product_id,
    type,
    quantity,
    reason,
    user_id: userId || null,
  })

  if (movErr) {
    return { error: movErr.message }
  }

  // 3. Atualizar estoque do produto
  const { error: updateErr } = await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', product_id)

  if (updateErr) {
    return { error: updateErr.message }
  }

  revalidatePath('/estoque')
  revalidatePath('/')
  return { success: true }
}

export async function deleteProduct(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const { error } = await supabase.from('products').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/estoque')
  revalidatePath('/')
  return { success: true }
}

export async function updateProduct(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const sku = (formData.get('sku') as string)?.trim()
  const category = formData.get('category') as string
  const current_stock = Number(formData.get('current_stock'))
  const min_stock = Number(formData.get('min_stock'))
  const cost_price = Number(formData.get('cost_price'))
  const rental_price = Number(formData.get('rental_price'))
  let image_url = (formData.get('image_url') as string)?.trim() || null
  const imageFile = formData.get('image_file') as File | null
  const description = (formData.get('description') as string)?.trim() || null

  if (!id || !name || !sku) {
    return { error: 'O nome e o código SKU são obrigatórios.' }
  }

  // Processar Upload de Foto para o Supabase Storage se fornecido
  if (imageFile && imageFile.size > 0 && typeof imageFile.arrayBuffer === 'function') {
    try {
      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = imageFile.name.split('.').pop() || 'jpg'
      const cleanFileName = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('products')
        .upload(cleanFileName, buffer, {
          contentType: imageFile.type || 'image/jpeg',
          upsert: true,
        })

      if (!uploadError && uploadData?.path) {
        const { data: pubData } = supabase.storage.from('products').getPublicUrl(uploadData.path)
        image_url = pubData.publicUrl
      } else if (uploadError) {
        console.error('Erro no upload da imagem:', uploadError)
      }
    } catch (e) {
      console.error('Erro ao processar arquivo de imagem:', e)
    }
  }

  const updatePayload: Record<string, any> = {
    name,
    sku,
    category,
    current_stock,
    min_stock,
    cost_price,
    rental_price,
    image_url,
    description,
  }

  let { error } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', id)

  // Se o banco ainda não possuir a coluna description no cache do Supabase, tenta sem ela
  if (error && error.code === 'PGRST204' && error.message?.includes('description')) {
    delete updatePayload.description
    const retry = await supabase.from('products').update(updatePayload).eq('id', id)
    error = retry.error
  }

  if (error) {
    console.error('Erro ao atualizar produto:', error)
    return { error: error.message }
  }

  // Grava redundância da descrição em audit_logs para garantir persistência imediata
  if (description !== null) {
    try {
      await supabase.from('audit_logs').insert({
        action: 'product_description',
        table_name: 'products',
        record_id: id,
        user_id: userId,
        new_data: { description },
      })
    } catch (e) {
      console.error('Erro ao registrar descrição no audit_logs:', e)
    }
  }

  revalidatePath('/estoque')
  revalidatePath('/')
  return { success: true }
}
