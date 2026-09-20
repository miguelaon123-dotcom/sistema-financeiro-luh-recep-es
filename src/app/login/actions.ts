'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, destroySession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const rememberMe = formData.get('rememberMe') === 'on'

  // Validações básicas de entrada
  if (!email || !password) {
    redirect('/login?error=campos_obrigatorios')
  }

  const supabase = createAdminClient()

  // 1. Buscar o usuário na tabela customizada
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, password_hash, role, active')
    .eq('email', email)
    .single()

  // Mensagem genérica — nunca revelar se email existe ou não (enumeração)
  if (error || !user) {
    redirect('/login?error=credenciais_invalidas')
  }

  // 2. Verificar se conta está ativa
  if (!user.active) {
    redirect('/login?error=conta_inativa')
  }

  // 3. Verificar senha com bcrypt (tempo constante — seguro contra timing attacks)
  const passwordOk = await verifyPassword(password, user.password_hash)
  if (!passwordOk) {
    redirect('/login?error=credenciais_invalidas')
  }

  // 4. Criar sessão JWT segura
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }, rememberMe)

  // 5. Atualizar last_login (sem bloquear o fluxo)
  supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {})

  redirect('/')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
