'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function createContact(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const name = (formData.get('name') as string)?.trim()
  const type = (formData.get('type') as string) || 'client'
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name) {
    return { error: 'O nome é obrigatório' }
  }

  const insertData: Record<string, any> = {
    name,
    type,
    email,
    phone,
    document,
    address,
    notes,
  }

  if (userId) {
    insertData.created_by = userId
  }

  let { error } = await supabase.from('contacts').insert(insertData)

  if (
    error &&
    (error.message?.includes('created_by') ||
      error.details?.includes('created_by') ||
      error.code === 'PGRST204')
  ) {
    delete insertData.created_by
    const retry = await supabase.from('contacts').insert(insertData)
    error = retry.error
  }

  if (error) {
    console.error('Erro ao cadastrar contato:', error)
    return { error: error.message }
  }

  revalidatePath('/clientes')
  return { success: true }
}

export async function deleteContact(id: string) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) {
    console.error('Erro ao deletar contato:', error)
    return { error: error.message }
  }

  revalidatePath('/clientes')
  return { success: true }
}

export async function updateContact(formData: FormData) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') || null
  const role = headersList.get('x-user-role') || 'leitura'

  const supabase = createAdminClient()
  if (userId) {
    await supabase.rpc('set_user_context', { p_user_id: userId, p_role: role })
  }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const type = (formData.get('type') as string) || 'client'
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const document = (formData.get('document') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!id || !name) {
    return { error: 'O nome é obrigatório.' }
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      name,
      type,
      email,
      phone,
      document,
      address,
      notes,
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar contato:', error)
    return { error: error.message }
  }

  revalidatePath('/clientes')
  return { success: true }
}
