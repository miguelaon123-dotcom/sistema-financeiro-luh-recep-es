'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { invalidateCache } from '@/lib/data-cache'

export async function createProduct(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || ''

  const supabase = createAdminClient()

  const name = formData.get('name') as string
  const sku = formData.get('sku') as string
  const category = formData.get('category') as string
  const current_stock = Number(formData.get('current_stock'))
  const min_stock = Number(formData.get('min_stock'))
  const cost_price = Number(formData.get('cost_price'))
  const rental_price = Number(formData.get('rental_price'))
  let image_url = (formData.get('image_url') as string)?.trim() || null
  const imageFile = formData.get('image_file') as File | null
  const description = (formData.get('description') as string)?.trim() || null

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

  const insertPayload: Record<string, any> = {
    name,
    sku,
    category,
    current_stock,
    min_stock,
    cost_price,
    rental_price,
    image_url: image_url || null,
    description: description || null,
    created_by: userId || null,
  }

  let { data: newProd, error } = await supabase
    .from('products')
    .insert(insertPayload)
    .select('id')
    .single()

  // Se o banco ainda não possuir description ou created_by no cache do Supabase, tenta sem eles
  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('description') ||
      error.message?.includes('created_by'))
  ) {
    if (error.message?.includes('description')) delete insertPayload.description
    if (error.message?.includes('created_by')) delete insertPayload.created_by
    const retry = await supabase
      .from('products')
      .insert(insertPayload)
      .select('id')
      .single()
    error = retry.error
    newProd = retry.data
  }

  if (error) {
    console.error('Error creating product:', error)
    redirect('/estoque/novo?error=true')
  }

  // Grava redundância da descrição em audit_logs para garantir exibição imediata caso a coluna no banco ainda não exista
  if (description && newProd?.id) {
    try {
      await supabase.from('audit_logs').insert({
        action: 'product_description',
        table_name: 'products',
        record_id: newProd.id,
        user_id: userId || null,
        new_data: { description },
      })
    } catch (e) {
      console.error('Erro ao registrar descrição no audit_logs:', e)
    }
  }

  invalidateCache(['estoque', 'dashboard'])
  revalidatePath('/estoque')
  redirect('/estoque')
}
