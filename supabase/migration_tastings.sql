-- ==============================================================================
-- MIGRAÇÃO: Módulo de Degustações
-- Luh Recepções ERP
-- Execute este script no SQL Editor do Supabase se desejar criar a tabela nativa
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tastings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  date          DATE NOT NULL,
  amount        DECIMAL(12,2) DEFAULT 0.00,
  people_count  INTEGER DEFAULT 1,
  status        TEXT CHECK (status IN ('scheduled', 'completed', 'canceled')) DEFAULT 'scheduled',
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_tastings_date ON public.tastings(date);
CREATE INDEX IF NOT EXISTS idx_tastings_status ON public.tastings(status);

-- Habilitar RLS
ALTER TABLE public.tastings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on tastings" ON public.tastings
  FOR ALL USING (true) WITH CHECK (true);

-- Notificar PostgREST
NOTIFY pgrst, 'reload schema';
