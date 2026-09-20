-- ==========================================================
-- MIGRAÇÃO: ADICIONAR COLUNA DE DESCRIÇÃO NA TABELA PRODUCTS
-- Execute este comando no SQL Editor do Supabase:
-- ==========================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
