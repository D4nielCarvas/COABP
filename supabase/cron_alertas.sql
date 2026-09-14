-- ═══════════════════════════════════════════════════════════════════
-- COA — Configuração do Cron de Alertas de Manutenção
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/srujirreecfntfikenen/sql
--
-- PRÉ-REQUISITO:
--   1. Habilitar extensão pg_cron e pg_net no Supabase (Database → Extensions)
--   2. Fazer deploy da Edge Function: supabase functions deploy alertas-manutencao
--   3. Configurar os Secrets da Edge Function (ver README abaixo)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Habilitar extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Criar job cron que executa todos os dias às 08:00 (horário de Brasília = 11:00 UTC)
select cron.schedule(
  'alertas-manutencao-diario',
  '0 11 * * *',
  $$
    select net.http_post(
      url     := 'https://srujirreecfntfikenen.supabase.co/functions/v1/alertas-manutencao',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable__BX6iM0x3zjzqh070tELzA_tKvPaIUT"}'::jsonb,
      body    := '{"source":"pg_cron"}'::jsonb
    );
  $$
);

-- 3. Verificar jobs agendados
-- select * from cron.job;

-- 4. Para remover o job (se necessário):
-- select cron.unschedule('alertas-manutencao-diario');
