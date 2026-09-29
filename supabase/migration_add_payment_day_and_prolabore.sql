-- ==========================================================
-- MIGRAÇÃO: DIA DE PAGAMENTO E TABELA DE PRÓ-LABORE DE FUNDADORES
-- Luh Recepções ERP
-- Execute este script no SQL Editor do Supabase se desejar
-- suporte a colunas nativas no banco de dados.
-- ==========================================================

-- 1. Coluna de dia fixo de pagamento (1 a 31) em employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS payment_day INTEGER;

-- 2. Tabela dedicada de Pró-Labore para sócios/fundadores
CREATE TABLE IF NOT EXISTS public.employee_prolabore (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  competencia     TEXT NOT NULL,                                  -- Ex: "2026-09"
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,            -- Valor da retirada
  description     TEXT,                                           -- Observação
  payment_status  TEXT CHECK (payment_status IN ('pending', 'paid')) DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prolabore_employee ON public.employee_prolabore(employee_id);
CREATE INDEX IF NOT EXISTS idx_prolabore_status   ON public.employee_prolabore(payment_status);
CREATE INDEX IF NOT EXISTS idx_prolabore_comp     ON public.employee_prolabore(competencia);

ALTER TABLE public.employee_prolabore ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prolabore_select" ON public.employee_prolabore;
CREATE POLICY "prolabore_select" ON public.employee_prolabore
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "prolabore_write" ON public.employee_prolabore;
CREATE POLICY "prolabore_write" ON public.employee_prolabore
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro', 'estoque'));
