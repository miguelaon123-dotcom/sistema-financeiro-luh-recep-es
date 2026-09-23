-- ==========================================================
-- MIGRAÇÃO: MÓDULO DE FUNCIONÁRIOS, FUNÇÕES/CATEGORIAS E ESCALA DE FESTAS
-- Luh Recepções ERP
-- Execute este script no SQL Editor do Supabase para criar
-- as tabelas dedicadas de Categorias, Colaboradores e Escalas.
-- ==========================================================

-- 1. TABELA DE CATEGORIAS / FUNÇÕES DE FUNCIONÁRIOS (Garçom, Cozinha, Bar, etc.)
CREATE TABLE IF NOT EXISTS public.employee_roles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT UNIQUE NOT NULL,                      -- Ex: Garçom, Cozinheiro(a), Bartender
  default_daily_rate  DECIMAL(12,2) DEFAULT 150.00,              -- Valor sugerido da diária (R$)
  description         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir categorias padrão iniciais se não existirem
INSERT INTO public.employee_roles (name, default_daily_rate)
VALUES
  ('Garçom', 150.00),
  ('Cozinheiro(a)', 200.00),
  ('Auxiliar de Cozinha', 140.00),
  ('Auxiliar de Bar', 150.00),
  ('Recepcionista', 140.00),
  ('Segurança', 160.00),
  ('Limpeza & Apoio', 130.00),
  ('Coordenador(a) de Salão', 220.00)
ON CONFLICT (name) DO NOTHING;

-- Limpar funções descontinuadas se já existirem
DELETE FROM public.employee_roles WHERE name IN ('Cerimonialista', 'DJ / Sonorização', 'Bartender / Barman', 'DJ', 'Barman');

-- 2. TABELA DE FUNCIONÁRIOS / COLABORADORES
CREATE TABLE IF NOT EXISTS public.employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  role                TEXT NOT NULL,                             -- Garçom, Cozinheiro, Bartender, Segurança, etc.
  phone               TEXT,                                      -- Telefone / WhatsApp
  document            TEXT,                                      -- CPF
  pix_key             TEXT,                                      -- Chave PIX para pagamento de diárias
  default_daily_rate  DECIMAL(12,2) DEFAULT 0.00,                -- Valor padrão da diária/cachê (R$)
  active              BOOLEAN DEFAULT TRUE,
  notes               TEXT,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_name   ON public.employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_role   ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(active);

-- 3. TABELA DE ESCALA DA EQUIPE EM EVENTOS / FESTAS
CREATE TABLE IF NOT EXISTS public.event_staff (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role                TEXT NOT NULL,                             -- Função desempenhada neste evento específico
  daily_rate          DECIMAL(12,2) NOT NULL DEFAULT 0.00,       -- Diária combinada para este evento (R$)
  status              TEXT CHECK (status IN ('confirmed', 'pending', 'present', 'absent')) DEFAULT 'confirmed',
  payment_status      TEXT CHECK (payment_status IN ('pending', 'paid')) DEFAULT 'pending', -- Status de pagamento da diária
  paid_at             TIMESTAMPTZ,                                -- Data/hora do acerto
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas se tabela já existir
ALTER TABLE public.event_staff ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.event_staff ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_staff_event    ON public.event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_employee ON public.event_staff(employee_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_payment  ON public.event_staff(payment_status);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_staff    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON public.employee_roles;
CREATE POLICY "roles_select" ON public.employee_roles
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "roles_write" ON public.employee_roles;
CREATE POLICY "roles_write" ON public.employee_roles
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro', 'estoque'));

DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "employees_write" ON public.employees;
CREATE POLICY "employees_write" ON public.employees
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro', 'estoque'));

DROP POLICY IF EXISTS "event_staff_select" ON public.event_staff;
CREATE POLICY "event_staff_select" ON public.event_staff
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "event_staff_write" ON public.event_staff;
CREATE POLICY "event_staff_write" ON public.event_staff
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro', 'estoque'));

-- 5. TABELA DE PRÓ-LABORE DE COLABORADORES
-- Registra retiradas mensais fixas (pró-labore) por colaborador, separadas das diárias por evento.
CREATE TABLE IF NOT EXISTS public.employee_prolabore (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  competencia     TEXT NOT NULL,                                  -- Ex: "2024-09", "2025-01"
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,            -- Valor do pró-labore (R$)
  description     TEXT,                                           -- Observação / motivo
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
