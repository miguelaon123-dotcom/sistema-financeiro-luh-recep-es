-- ==============================================================================
-- MIGRAÇÃO: Suporte a Sinal / Entrada personalizado para Eventos
-- Execute este script no SQL Editor do Supabase para atualizar a tabela events
-- ==============================================================================

-- 1. Adicionar colunas de sinal na tabela events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'paid')),
ADD COLUMN IF NOT EXISTS deposit_paid_date DATE;

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_events_deposit_status ON public.events(deposit_status);

-- 3. Notificar o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
