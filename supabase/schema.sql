-- ================================================
-- SISTEMA ERP LUH RECEPÇÕES - SCHEMA v2
-- Autenticação customizada (sem Supabase Auth)
-- ================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- 2. TABELA DE USUÁRIOS (CUSTOMIZADA)
-- ================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,            -- bcrypt hash, nunca plain text
  role        TEXT CHECK (role IN ('admin', 'financeiro', 'estoque', 'leitura')) DEFAULT 'leitura',
  active      BOOLEAN DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice de performance no email (login rápido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ================================================
-- 3. FUNÇÃO CUSTOMIZADA DE RLS
-- Lê o user_id que o servidor Next.js injeta via SET LOCAL
-- ================================================
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('app.current_user_role', true);
$$;

-- ================================================
-- 4. TABELA DE CLIENTES E FORNECEDORES
-- ================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT CHECK (type IN ('client', 'supplier')),
  name        TEXT NOT NULL,
  document    TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.contacts(name);

-- ================================================
-- 5. TABELA DE EVENTOS
-- ================================================
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  event_date  DATE NOT NULL,
  location    TEXT,
  budget      DECIMAL(12,2) DEFAULT 0.00,
  status      TEXT CHECK (status IN ('budget', 'approved', 'completed', 'canceled')) DEFAULT 'budget',
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

-- ================================================
-- 6. CONTAS BANCÁRIAS
-- ================================================
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  initial_balance DECIMAL(12,2) DEFAULT 0.00,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 7. CATEGORIAS FINANCEIRAS
-- ================================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('income', 'expense')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 8. TRANSAÇÕES FINANCEIRAS
-- ================================================
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID REFERENCES public.financial_accounts(id),
  category_id   UUID REFERENCES public.financial_categories(id),
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  type          TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  due_date      DATE NOT NULL,
  paid_date     DATE,
  status        TEXT CHECK (status IN ('pending', 'paid', 'late', 'canceled')) DEFAULT 'pending',
  description   TEXT,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_due_date  ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_ft_status    ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ft_type      ON public.financial_transactions(type);

-- ================================================
-- 9. PRODUTOS
-- ================================================
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  sku           TEXT UNIQUE NOT NULL,
  category      TEXT,
  current_stock INT DEFAULT 0,
  min_stock     INT DEFAULT 0,
  cost_price    DECIMAL(12,2) DEFAULT 0.00,
  rental_price  DECIMAL(12,2) DEFAULT 0.00,
  image_url     TEXT,
  description   TEXT,
  active        BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku  ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- ================================================
-- 10. MOVIMENTAÇÕES DE ESTOQUE
-- ================================================
CREATE TABLE IF NOT EXISTS public.product_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  quantity    INT NOT NULL,
  type        TEXT CHECK (type IN ('in', 'out', 'loss', 'adjustment', 'return')) NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_product ON public.product_movements(product_id);

-- ================================================
-- 11. LOG DE AUDITORIA (append-only, nunca deletar)
-- ================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,        -- 'login', 'create', 'update', 'delete', 'export'
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at);

-- ================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- Usando current_user_id() injetado pelo Next.js
-- ================================================

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;

-- USERS: apenas admins podem gerenciar usuários
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    id = current_user_id()                        -- vê o próprio perfil
    OR current_user_role() = 'admin'              -- admin vê todos
  );

DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (current_user_role() = 'admin' OR id = current_user_id());

-- CONTACTS: todos usuários autenticados podem ler; financeiro/admin podem escrever
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "contacts_write" ON public.contacts;
CREATE POLICY "contacts_write" ON public.contacts
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro'));

-- EVENTS: todos leem, admin/financeiro/vendas escrevem
DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "events_write" ON public.events;
CREATE POLICY "events_write" ON public.events
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro'));

-- FINANCIAL ACCOUNTS
DROP POLICY IF EXISTS "fa_select" ON public.financial_accounts;
CREATE POLICY "fa_select" ON public.financial_accounts
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "fa_write" ON public.financial_accounts;
CREATE POLICY "fa_write" ON public.financial_accounts
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro'));

-- FINANCIAL CATEGORIES
DROP POLICY IF EXISTS "fc_select" ON public.financial_categories;
CREATE POLICY "fc_select" ON public.financial_categories
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "fc_write" ON public.financial_categories;
CREATE POLICY "fc_write" ON public.financial_categories
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro'));

-- FINANCIAL TRANSACTIONS
DROP POLICY IF EXISTS "ft_select" ON public.financial_transactions;
CREATE POLICY "ft_select" ON public.financial_transactions
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "ft_write" ON public.financial_transactions;
CREATE POLICY "ft_write" ON public.financial_transactions
  FOR ALL USING (current_user_role() IN ('admin', 'financeiro'));

-- PRODUCTS: todos leem; estoque/admin escrevem
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "products_write" ON public.products;
CREATE POLICY "products_write" ON public.products
  FOR ALL USING (current_user_role() IN ('admin', 'estoque'));

-- PRODUCT MOVEMENTS
DROP POLICY IF EXISTS "pm_select" ON public.product_movements;
CREATE POLICY "pm_select" ON public.product_movements
  FOR SELECT USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "pm_write" ON public.product_movements;
CREATE POLICY "pm_write" ON public.product_movements
  FOR ALL USING (current_user_role() IN ('admin', 'estoque'));

-- AUDIT LOGS: somente insert (servidor) e select (apenas admin)
DROP POLICY IF EXISTS "audit_select" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (true); -- servidor usa service_role key para inserir

-- ================================================
-- 13. SEED - Primeiro usuário ADMIN
-- Troque o hash pela saída do bcrypt da sua senha!
-- Para gerar: https://bcrypt-generator.com/ (cost 12)
-- ================================================

-- INSTRUÇÕES: Gere o hash da sua senha desejada e cole abaixo:
-- Exemplo: senha "Admin@2025!" → gera o hash e coloca aqui
INSERT INTO public.users (name, email, password_hash, role)
VALUES (
  'Administrador',
  'admin@luhrecepcoes.com.br',
  '$2b$12$SUBSTITUA_AQUI_PELO_HASH_BCRYPT_DA_SUA_SENHA',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
