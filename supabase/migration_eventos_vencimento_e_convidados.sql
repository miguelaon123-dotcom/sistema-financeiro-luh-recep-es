-- ==============================================================================
-- MIGRAÇÃO: Suporte a Vencimento de Pagamento e Quantidade de Pessoas em Eventos
-- Luh Recepções ERP
-- Execute este script no SQL Editor do Supabase para atualizar a tabela events
-- ==============================================================================

-- 1. Adicionar colunas de vencimento do pagamento e quantidade de convidados/pessoas
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_events_guest_count ON public.events(guest_count);
CREATE INDEX IF NOT EXISTS idx_events_payment_due_date ON public.events(payment_due_date);

-- 3. Notificar o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
