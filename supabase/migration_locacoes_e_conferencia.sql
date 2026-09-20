-- ==========================================================
-- MIGRAÇÃO: MÓDULO DE LOCAÇÕES E CONEXÃO DE ESTOQUE COM FESTAS
-- Luh Recepções ERP
-- Execute este script no SQL Editor do Supabase para criar
-- as tabelas dedicadas de Locações e Itens de Eventos/Locações.
-- ==========================================================

-- 1. TABELA DE LOCAÇÕES (Aluguel de materiais e itens avulsos)
CREATE TABLE IF NOT EXISTS public.rentals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_code         TEXT UNIQUE NOT NULL,                       -- Ex: LOC-2026-001
  client_id           UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  start_date          TIMESTAMPTZ NOT NULL,                      -- Data/hora de retirada ou entrega
  return_date         TIMESTAMPTZ NOT NULL,                      -- Data/hora prevista de devolução
  actual_return_date  TIMESTAMPTZ,                               -- Data/hora real em que foi devolvido
  status              TEXT CHECK (status IN ('budget', 'confirmed', 'dispatched', 'returned', 'canceled')) DEFAULT 'budget',
  delivery_type       TEXT CHECK (delivery_type IN ('pickup', 'delivery')) DEFAULT 'pickup',
  delivery_address    TEXT,
  delivery_fee        DECIMAL(12,2) DEFAULT 0.00,
  security_deposit    DECIMAL(12,2) DEFAULT 0.00,                -- Caução / garantia
  items_total         DECIMAL(12,2) DEFAULT 0.00,                -- Soma dos itens locados
  total_amount        DECIMAL(12,2) DEFAULT 0.00,                -- Total (itens + frete)
  penalty_amount      DECIMAL(12,2) DEFAULT 0.00,                -- Cobrança de avarias/quebras
  payment_status      TEXT CHECK (payment_status IN ('pending', 'paid', 'partial', 'refunded')) DEFAULT 'pending',
  notes               TEXT,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentals_client_id   ON public.rentals(client_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status      ON public.rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_start_date  ON public.rentals(start_date);
CREATE INDEX IF NOT EXISTS idx_rentals_return_date ON public.rentals(return_date);

-- 2. TABELA DE ITENS DA LOCAÇÃO
CREATE TABLE IF NOT EXISTS public.rental_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id           UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity            INT NOT NULL CHECK (quantity > 0),
  unit_price          DECIMAL(12,2) NOT NULL DEFAULT 0.00,       -- Preço unitário da diária/locação
  subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  returned_qty        INT DEFAULT 0,                             -- Quantidade devolvida perfeita (retorna ao estoque)
  broken_qty          INT DEFAULT 0,                             -- Quantidade quebrada/danificada (baixa como perda)
  lost_qty            INT DEFAULT 0,                             -- Quantidade faltante/extraviada (baixa como perda)
  penalty_fee         DECIMAL(12,2) DEFAULT 0.00,                -- Valor de ressarcimento cobrado por avaria/perda
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_items_rental  ON public.rental_items(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_product ON public.rental_items(product_id);

-- 3. TABELA DE ITENS ALOCADOS EM FESTAS / EVENTOS
CREATE TABLE IF NOT EXISTS public.event_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity            INT NOT NULL CHECK (quantity > 0),
  returned_qty        INT DEFAULT 0,                             -- Quantidade devolvida perfeita (retorna ao estoque)
  broken_qty          INT DEFAULT 0,                             -- Quantidade quebrada/danificada (baixa como perda)
  lost_qty            INT DEFAULT 0,                             -- Quantidade faltante/extraviada (baixa como perda)
  penalty_fee         DECIMAL(12,2) DEFAULT 0.00,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_items_event   ON public.event_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_items_product ON public.event_items(product_id);

-- 4. ADICIONAR COLUNA rental_id EM product_movements SE NÃO EXISTIR
ALTER TABLE public.product_movements ADD COLUMN IF NOT EXISTS rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pm_rental ON public.product_movements(rental_id);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.rentals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rentals_select" ON public.rentals;
CREATE POLICY "rentals_select" ON public.rentals
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "rentals_write" ON public.rentals;
CREATE POLICY "rentals_write" ON public.rentals
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro', 'estoque'));

DROP POLICY IF EXISTS "rental_items_select" ON public.rental_items;
CREATE POLICY "rental_items_select" ON public.rental_items
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "rental_items_write" ON public.rental_items;
CREATE POLICY "rental_items_write" ON public.rental_items
  FOR ALL USING (current_user_role() IN ('admin', 'estoque', 'financeiro'));

DROP POLICY IF EXISTS "event_items_select" ON public.event_items;
CREATE POLICY "event_items_select" ON public.event_items
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "event_items_write" ON public.event_items;
CREATE POLICY "event_items_write" ON public.event_items
  FOR ALL USING (current_user_role() IN ('admin', 'estoque', 'financeiro'));
