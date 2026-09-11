-- ═══════════════════════════════════════════════════════════════════
-- COA — Schema Supabase
-- Execute no SQL Editor: https://supabase.com/dashboard/project/srujirreecfntfikenen/sql
-- ═══════════════════════════════════════════════════════════════════

-- 1. Criar tabela de manutenções
create table if not exists public.manutencoes (
  id               uuid        primary key default gen_random_uuid(),
  titulo           text        not null,
  descricao        text,
  solucao          text,
  status           text        not null default 'Na Fila'
                               check (status in ('Na Fila', 'Em Andamento', 'Aguardando Terceiro', 'Realizada')),
  categoria        text        not null
                               check (categoria in ('Software', 'Hardware', 'Mecânica', 'Elétrica', 'Apoio', 'Solinftec', 'Administrativo')),
  solicitante_id   uuid        references auth.users(id) on delete set null,
  solicitante_nome text,
  responsavel_id   uuid        references auth.users(id) on delete set null,
  responsavel_nome text,
  fazenda          text,
  frota            text,
  equipamento      text,
  data_solicitacao timestamptz not null default now(),
  data_conclusao   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 2. Habilitar RLS (Row Level Security)
alter table public.manutencoes enable row level security;

-- 3. Política: qualquer usuário autenticado pode ler e escrever
create policy "Autenticados podem ler manutenções"
  on public.manutencoes for select
  using (auth.role() = 'authenticated');

create policy "Autenticados podem inserir manutenções"
  on public.manutencoes for insert
  with check (auth.role() = 'authenticated');

create policy "Autenticados podem atualizar manutenções"
  on public.manutencoes for update
  using (auth.role() = 'authenticated');

-- 4. Função para atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_manutencoes_updated_at
  before update on public.manutencoes
  for each row execute procedure public.set_updated_at();

-- 5. Índices para performance nas queries mais comuns
create index if not exists idx_manutencoes_status    on public.manutencoes (status);
create index if not exists idx_manutencoes_categoria on public.manutencoes (categoria);
create index if not exists idx_manutencoes_created   on public.manutencoes (created_at desc);

-- 6. Migração (caso a tabela já tenha sido criada anteriormente):
-- Execute no SQL Editor do Supabase se as novas colunas ainda não existirem:
alter table public.manutencoes
  add column if not exists responsavel_id   uuid references auth.users(id) on delete set null,
  add column if not exists responsavel_nome text,
  add column if not exists fazenda          text,
  add column if not exists frota            text,
  add column if not exists equipamento      text;

create index if not exists idx_manutencoes_responsavel on public.manutencoes (responsavel_id);
create index if not exists idx_manutencoes_fazenda     on public.manutencoes (fazenda);
create index if not exists idx_manutencoes_frota       on public.manutencoes (frota);
