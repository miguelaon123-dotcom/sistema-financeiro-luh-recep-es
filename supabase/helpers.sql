-- ================================================
-- SCRIPT DE SUPORTE - Funções e RPC para o Next.js
-- Execute DEPOIS do schema.sql principal
-- ================================================

-- Função RPC chamada pelo servidor Next.js antes de cada query
-- para ativar as RLS policies com o usuário correto
CREATE OR REPLACE FUNCTION public.set_user_context(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Seta variáveis de sessão que as RLS policies leem
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, true);
  PERFORM set_config('app.current_user_role', p_role, true);
END;
$$;

-- ================================================
-- COMO CRIAR SEU PRIMEIRO USUÁRIO ADMIN
-- ================================================
-- 1. Gere o hash bcrypt da sua senha favorita via terminal:
--    node -e "const b=require('bcryptjs');b.hash('SuaSenhaAqui@123',12).then(console.log)"
--
-- 2. Substitua o hash abaixo e rode no SQL Editor do Supabase:

-- EXEMPLO (troque o hash!):
-- INSERT INTO public.users (name, email, password_hash, role)
-- VALUES (
--   'Luh - Administradora',
--   'luh@luhrecepcoes.com.br',
--   '$2b$12$SEU_HASH_BCRYPT_AQUI',
--   'admin'
-- );
