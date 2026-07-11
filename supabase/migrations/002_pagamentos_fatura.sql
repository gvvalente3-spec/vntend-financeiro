-- ============================================================
-- Migration 002: pagamentos de fatura de cartão
-- Execute no Supabase > SQL Editor ANTES de fazer o deploy
-- (JÁ APLICADA em produção em 11/07/2026 via MCP)
-- ============================================================

create table if not exists pagamentos_fatura (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  cartao_id uuid not null references cartoes(id) on delete cascade,
  conta_id uuid references contas(id) on delete set null,
  valor numeric(12,2) not null,
  data_pagamento date not null default current_date,
  mes_referencia text not null, -- YYYY-MM da fatura paga
  created_at timestamptz default now()
);

create index if not exists idx_pagfat_ws_cartao_mes
  on pagamentos_fatura(workspace_id, cartao_id, mes_referencia);

alter table pagamentos_fatura enable row level security;

create policy "select_pagamentos_fatura" on pagamentos_fatura
  for select using (workspace_id in (select my_workspace_ids()));
create policy "insert_pagamentos_fatura" on pagamentos_fatura
  for insert with check (workspace_id in (select my_workspace_ids()));
create policy "update_pagamentos_fatura" on pagamentos_fatura
  for update using (workspace_id in (select my_workspace_ids()));
create policy "delete_pagamentos_fatura" on pagamentos_fatura
  for delete using (workspace_id in (select my_workspace_ids()));
