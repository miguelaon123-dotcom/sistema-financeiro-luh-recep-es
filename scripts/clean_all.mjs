import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Faltam variáveis de ambiente SUPABASE!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

async function cleanAll() {
  console.log('--- INICIANDO LIMPEZA COMPLETA DO SISTEMA ---')

  const tablesToClean = [
    'event_staff',
    'rental_items',
    'event_items',
    'rentals',
    'financial_transactions',
    'product_movements',
    'events',
    'products',
    'employees',
    'contacts',
    'audit_logs',
  ]

  for (const table of tablesToClean) {
    try {
      // Exclui todos os registros onde id não é nulo
      const { data, error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id')

      if (error) {
        console.warn(`[${table}] Aviso ao limpar via neq id:`, error.message)
        const { error: err2 } = await supabase.from(table).delete().gte('created_at', '1970-01-01')
        if (err2) {
          console.warn(`[${table}] Fallback também falhou ou tabela ainda não existe:`, err2.message)
        } else {
          console.log(`✓ [${table}] limpo com sucesso via fallback.`)
        }
      } else {
        console.log(`✓ [${table}] limpo com sucesso (${data?.length ?? 0} registros removidos).`)
      }
    } catch (e) {
      console.warn(`[${table}] Exceção:`, e.message)
    }
  }

  // Limpar usuários de teste mantendo admin
  try {
    const { data: usersData, error: userErr } = await supabase
      .from('users')
      .delete()
      .neq('role', 'admin')
      .select('email')

    if (!userErr) {
      console.log(`✓ [users] Usuários de teste não-administradores limpos (${usersData?.length ?? 0} removidos).`)
    } else {
      console.warn('[users] Aviso:', userErr.message)
    }
  } catch (e) {
    console.warn('[users] Exceção:', e.message)
  }

  console.log('--- LIMPEZA FINALIZADA COM SUCESSO ---')
}

cleanAll()
