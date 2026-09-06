-- ============================================================
--  Play da Sexta — decisões de fechamento do mês
--  Rode este script no SQL Editor do Supabase (depois do schema.sql).
--  Guarda a escolha de cada jogadora que fecha o mês em chamas:
--  sacar o bônus acumulado agora, ou continuar apostando.
-- ============================================================

create table if not exists public.streak_choices (
  id          text primary key,          -- "<player_id>:<AAAA-MM>"
  player_id   text not null,
  month       text not null,             -- AAAA-MM do mês que fechou
  action      text not null check (action in ('sacar','continuar')),
  streak      int  not null default 0,   -- sequência no momento da decisão
  bonus       int  not null default 0,   -- bônus que estava em jogo
  created_at  timestamptz not null default now()
);

create index if not exists streak_choices_month_idx on public.streak_choices (month);

-- mesma regra das outras tabelas: todo mundo lê, só quem tem login escreve
alter table public.streak_choices enable row level security;

drop policy if exists "leitura publica"    on public.streak_choices;
drop policy if exists "escrita autenticada" on public.streak_choices;
create policy "leitura publica" on public.streak_choices for select using (true);
create policy "escrita autenticada" on public.streak_choices
  for all to authenticated using (true) with check (true);

-- tempo real, para a decisão aparecer no celular de todas
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.streak_choices';
  exception when duplicate_object then null; end;
end $$;
