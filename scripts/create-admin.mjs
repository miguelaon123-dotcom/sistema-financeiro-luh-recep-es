/**
 * Script de seed para criar o primeiro usuário admin.
 * Execute: node scripts/create-admin.mjs
 */
import bcrypt from 'bcryptjs'

const email = 'admin@luhrecepcoes.com.br' // ← Altere para seu e-mail
const senha = 'Admin@2025!'               // ← Altere para sua senha desejada
const nome  = 'Administrador'             // ← Altere para seu nome

const hash = await bcrypt.hash(senha, 12)

console.log('\n✅ Hash gerado com sucesso!\n')
console.log('Execute o SQL abaixo no Editor do Supabase:\n')
console.log(`INSERT INTO public.users (name, email, password_hash, role)
VALUES (
  '${nome}',
  '${email}',
  '${hash}',
  'admin'
)
ON CONFLICT (email) DO NOTHING;`)
console.log('\n')
