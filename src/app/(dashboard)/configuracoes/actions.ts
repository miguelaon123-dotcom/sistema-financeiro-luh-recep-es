'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const headersList = await headers()
  const callerRole = headersList.get('x-user-role') || 'leitura'

  if (callerRole !== 'admin') {
    return { error: 'Apenas administradores podem criar novos usuários.' }
  }

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const role = (formData.get('role') as string) || 'leitura'

  if (!name || !email || !password) {
    return { error: 'Todos os campos são obrigatórios.' }
  }

  if (password.length < 6) {
    return { error: 'A senha deve ter pelo menos 6 caracteres.' }
  }

  const supabase = createAdminClient()
  const password_hash = await hashPassword(password)

  const { error } = await supabase.from('users').insert({
    name,
    email,
    password_hash,
    role,
    active: true,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Este e-mail já está cadastrado no sistema.' }
    }
    return { error: error.message }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}

export async function toggleUserStatus(id: string, currentActive: boolean) {
  const headersList = await headers()
  const callerRole = headersList.get('x-user-role') || 'leitura'
  const callerId = headersList.get('x-user-id') || ''

  if (callerRole !== 'admin') {
    return { error: 'Apenas administradores podem alterar o status de usuários.' }
  }

  if (callerId === id) {
    return { error: 'Você não pode desativar o seu próprio usuário.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('users')
    .update({ active: !currentActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}

export async function deleteUser(id: string) {
  const headersList = await headers()
  const callerRole = headersList.get('x-user-role') || 'leitura'
  const callerId = headersList.get('x-user-id') || ''

  if (callerRole !== 'admin') {
    return { error: 'Apenas administradores podem excluir usuários.' }
  }

  if (callerId === id) {
    return { error: 'Você não pode excluir o seu próprio usuário.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('users').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}
