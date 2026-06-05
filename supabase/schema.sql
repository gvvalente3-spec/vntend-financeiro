-- ============================================================
-- VNTEND Financeiro — Schema Supabase
-- Execute no SQL Editor do Supabase (projeto > SQL Editor > New query)
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- WORKSPACES (multi-tenant)
-- ============================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz default now()
);

create table workspace_users (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (workspace_id, user_id)
);

-- ============================================================
-- CONTAS
-- ============================================================
create table contas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null,
  tipo text not null default 'corrente' check (tipo in ('corrente', 'poupanca', 'investimento', 'outro')),
  saldo numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- CARTÕES
-- ============================================================
create table cartoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null,
  limite numeric(12,2) not null default 0,
  venc int not null default 1,
  created_at timestamptz default now()
);

-- ============================================================
-- LANÇAMENTOS
-- ============================================================
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'receita')),
  valor numeric(12,2) not null,
  descricao text not null default '',
  data date not null,
  cat text not null default '',
  sub text,
  subsub text,
  conta_id uuid references contas(id) on delete set null,
  cartao_id uuid references cartoes(id) on delete set null,
  pago boolean not null default true,
  fiscal text not null default '' check (fiscal in ('', 'pgbl', 'saude', 'educacao')),
  rec_id uuid,
  parcela_num int,
  parcela_total int,
  created_at timestamptz default now()
);

create index on lancamentos(workspace_id, data);
create index on lancamentos(workspace_id, cartao_id);

-- ============================================================
-- ORÇAMENTOS
-- ============================================================
create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cat text not null,
  sub text,
  subsub text,
  limite numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- RECORRÊNCIAS
-- ============================================================
create table recorrencias (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'receita')),
  descricao text not null default '',
  valor numeric(12,2) not null,
  dia int not null default 1,
  cat text not null default '',
  sub text,
  subsub text,
  conta_id uuid references contas(id) on delete set null,
  cartao_id uuid references cartoes(id) on delete set null,
  postados text[] not null default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- MISSÕES
-- ============================================================
create table missoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null default '',
  inicio date not null,
  fim date not null,
  etapas int not null default 0,
  grat_rep_pct numeric(5,2) not null default 2,
  diarias numeric(12,2) not null default 0,
  grat_rep_conf boolean not null default false,
  grat_rep_mes text,
  aux_conf boolean not null default false,
  aux_mes text,
  diarias_conf boolean not null default false,
  diarias_mes text,
  obs text not null default '',
  created_at timestamptz default now()
);

-- ============================================================
-- CONTRACHEQUES
-- ============================================================
create table contracheques (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  mes text not null, -- YYYY-MM
  tributavel numeric(12,2) not null default 0,
  previdencia numeric(12,2) not null default 0,
  ir_retido numeric(12,2) not null default 0,
  arquivo text, -- Supabase Storage path
  created_at timestamptz default now(),
  unique (workspace_id, mes)
);

-- ============================================================
-- INVESTIMENTOS
-- ============================================================
create table investimentos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null,
  ticker text,
  categoria text not null check (categoria in ('reserva','rendaFixa','rendaVar','exterior','cripto','pgbl','objetivo')),
  cotas numeric(15,6),
  pm numeric(12,4),
  preco_atual numeric(12,4),
  moeda text not null default 'BRL' check (moeda in ('BRL', 'USD')),
  valor numeric(12,2),
  obj text check (obj in ('reserva', 'leilao', 'aluguel27')),
  created_at timestamptz default now()
);

-- ============================================================
-- METAS DE INVESTIMENTO (1 linha por workspace)
-- ============================================================
create table invest_metas (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  leilao numeric(12,2) not null default 100000,
  reserva numeric(12,2) not null default 30000,
  aluguel27 numeric(12,2) not null default 37200,
  pgbl numeric(12,2) not null default 13000,
  consorcio numeric(12,2) not null default 200000,
  ptax numeric(8,4) not null default 5.70,
  alvo_pct jsonb not null default '{"rendaFixa":40,"rendaVar":20,"exterior":15,"cripto":5,"pgbl":20}'::jsonb
);

-- ============================================================
-- PERFIL MILITAR (1 linha por workspace)
-- ============================================================
create table perfil (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  posto text not null default 'Capitão',
  om text not null default '',
  cidade text not null default 'Manaus',
  gle_categoria text not null default 'A' check (gle_categoria in ('A','B','nenhuma')),
  compensacao_organica boolean not null default true,
  compensacao_pct numeric(5,2) not null default 20,
  dependentes int not null default 0,
  dependentes_pre_escolar int not null default 0,
  grat_representacao boolean not null default false,
  soldo_override numeric(12,2),
  habilitacao_pct numeric(5,2) not null default 45,
  adicional_militar_pct numeric(5,2) not null default 22,
  comp_disp_mil_pct numeric(5,2) not null default 12,
  fusex_pct numeric(5,2) not null default 3,
  pensao_pct numeric(5,2) not null default 10.5,
  cc_receitas_extras jsonb not null default '[]'::jsonb,
  cc_descontos_extras jsonb not null default '[]'::jsonb,
  valor_etapa numeric(8,2) not null default 13.50
);

-- ============================================================
-- DEDUÇÕES ANUAIS (1 linha por workspace)
-- ============================================================
create table deducoes (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  outras_anual numeric(12,2) not null default 0
);

-- ============================================================
-- METADADOS DE CATEGORIA (cor + ícone)
-- ============================================================
create table cat_meta (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  chave text not null, -- "despesa:Alimentação"
  cor text not null default '#6f7d77',
  icone text not null default 'tag',
  primary key (workspace_id, chave)
);

-- ============================================================
-- CATEGORIAS (hierarquia 3 níveis)
-- ============================================================
create table categorias (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'receita')),
  cat text not null,
  sub text,
  subsub text,
  ordem int not null default 0,
  unique (workspace_id, tipo, cat, sub, subsub)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Função helper: retorna workspace_ids do usuário autenticado
create or replace function my_workspace_ids()
returns setof uuid language sql security definer stable as $$
  select workspace_id from workspace_users where user_id = auth.uid()
$$;

-- Habilita RLS em todas as tabelas
alter table workspaces enable row level security;
alter table workspace_users enable row level security;
alter table contas enable row level security;
alter table cartoes enable row level security;
alter table lancamentos enable row level security;
alter table orcamentos enable row level security;
alter table recorrencias enable row level security;
alter table missoes enable row level security;
alter table contracheques enable row level security;
alter table investimentos enable row level security;
alter table invest_metas enable row level security;
alter table perfil enable row level security;
alter table deducoes enable row level security;
alter table cat_meta enable row level security;
alter table categorias enable row level security;

-- Políticas workspaces
create policy "ver próprios workspaces" on workspaces
  for select using (id in (select my_workspace_ids()));

create policy "criar workspace" on workspaces
  for insert with check (true);

-- Políticas workspace_users
create policy "ver membros do próprio workspace" on workspace_users
  for select using (workspace_id in (select my_workspace_ids()));

create policy "inserir em próprio workspace" on workspace_users
  for insert with check (workspace_id in (select my_workspace_ids()) or user_id = auth.uid());

-- Macro para tabelas com workspace_id
do $do$
declare
  tbl text;
begin
  foreach tbl in array array[
    'contas','cartoes','lancamentos','orcamentos','recorrencias',
    'missoes','contracheques','investimentos','invest_metas','perfil',
    'deducoes','cat_meta','categorias'
  ] loop
    execute format($f$
      create policy "select_%1$s" on %1$s for select using (workspace_id in (select my_workspace_ids()));
      create policy "insert_%1$s" on %1$s for insert with check (workspace_id in (select my_workspace_ids()));
      create policy "update_%1$s" on %1$s for update using (workspace_id in (select my_workspace_ids()));
      create policy "delete_%1$s" on %1$s for delete using (workspace_id in (select my_workspace_ids()));
    $f$, tbl);
  end loop;
end
$do$;

-- ============================================================
-- FUNÇÃO: criar workspace ao registrar usuário
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  ws_id uuid;
begin
  -- Cria workspace pessoal
  insert into workspaces (nome) values ('Meu espaço') returning id into ws_id;
  -- Adiciona usuário como owner
  insert into workspace_users (workspace_id, user_id, role) values (ws_id, new.id, 'owner');
  -- Cria perfil padrão
  insert into perfil (workspace_id) values (ws_id);
  -- Cria metas padrão
  insert into invest_metas (workspace_id) values (ws_id);
  -- Cria deduções padrão
  insert into deducoes (workspace_id) values (ws_id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
