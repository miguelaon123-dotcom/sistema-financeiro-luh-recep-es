-- ==============================================================================
-- SCRIPT DE LIMPEZA COMPLETA DE DADOS (RESET DE FÁBRICA / PRODUÇÃO)
-- LUH RECEPÇÕES & BUFFET
--
-- ATENÇÃO: Este script apaga TODOS os registros de teste e operacionais,
-- mantendo a conta de Administrador (admin@luhrecepcoes.com.br) e a estrutura
-- das tabelas 100% preservadas e prontas para uso real.
-- ==============================================================================

-- Desabilita temporariamente os gatilhos para evitar conflitos de FK
SET session_replication_role = 'replica';

-- 1. Limpar Escalas de Equipe e Itens de Eventos
TRUNCATE TABLE public.event_staff CASCADE;
TRUNCATE TABLE public.event_items CASCADE;

-- 2. Limpar Locações e Itens de Locação
TRUNCATE TABLE public.rental_items CASCADE;
TRUNCATE TABLE public.rentals CASCADE;

-- 3. Limpar Transações Financeiras
TRUNCATE TABLE public.financial_transactions CASCADE;

-- 4. Limpar Movimentações de Estoque e Produtos
TRUNCATE TABLE public.product_movements CASCADE;
TRUNCATE TABLE public.products CASCADE;

-- 5. Limpar Eventos / Festas
TRUNCATE TABLE public.events CASCADE;

-- 6. Limpar Funcionários e Clientes
TRUNCATE TABLE public.employees CASCADE;
TRUNCATE TABLE public.contacts CASCADE;

-- 7. Limpar Logs de Auditoria (Caixinhas, histórico, logs de sistema)
TRUNCATE TABLE public.audit_logs CASCADE;

-- 8. Limpar Usuários de teste (mantendo apenas o administrador)
DELETE FROM public.users WHERE role != 'admin' AND email != 'admin@luhrecepcoes.com.br';

-- Reativa a verificação normal de integridade
SET session_replication_role = 'origin';

-- Confirmação
SELECT 'Sistema limpo com sucesso! Pronto para cadastros reais.' AS status;
