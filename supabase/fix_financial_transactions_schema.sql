-- ==============================================================================
-- CORREÇÃO: Adicionar created_by e updated_at na tabela financial_transactions
-- Execute este script no SQL Editor do Supabase se desejar persistir essas colunas.
-- ==============================================================================

-- 1. Garante que a coluna created_by existe na tabela financial_transactions
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Garante que a coluna updated_at existe na tabela financial_transactions
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Notifica o PostgREST (Supabase) para recarregar imediatamente o schema cache
NOTIFY pgrst, 'reload schema';
