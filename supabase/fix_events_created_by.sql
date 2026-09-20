-- ==============================================================================
-- CORREÇÃO: Adicionar coluna created_by na tabela events e recarregar schema cache
-- Execute este script no SQL Editor do Supabase para garantir a compatibilidade
-- ==============================================================================

-- 1. Garante que a coluna created_by existe na tabela events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Garante que a coluna created_by existe na tabela contacts também se necessário
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Notifica o PostgREST (Supabase) para recarregar imediatamente o schema cache
NOTIFY pgrst, 'reload schema';
