-- ============================================================
--  Play de Sexta — fila de partidas, modo em grupos e
--  fechamento de mês na mão.
--  Rode no SQL Editor do Supabase (depois dos scripts 01 a 04).
--
--  O app funciona sem este script (ele guarda o que falta no próprio
--  celular de quem organiza), mas sem ele o modo em grupos, o tempo de
--  descanso e o "finalizar o mês" não chegam aos outros aparelhos.
-- ============================================================

-- ------------------------------------------------------------
--  1. Quando a partida terminou.
--     Junto com started_at é o que diz quem está fora há mais tempo,
--     para a próxima partida não chamar quem acabou de sair da quadra.
-- ------------------------------------------------------------
alter table public.matches
  add column if not exists ended_at timestamptz;

-- ------------------------------------------------------------
--  2. Formato do dia e os grupos, quando o play é em grupos.
--     `groups` é uma lista de listas de ids: o grupo 1 é o de nível
--     mais alto. Fora do modo em grupos fica nulo.
-- ------------------------------------------------------------
alter table public.sessions
  add column if not exists format text not null default 'todas'
    check (format in ('todas', 'grupos'));

alter table public.sessions
  add column if not exists groups jsonb;

-- A coluna `round` das partidas agora guarda a POSIÇÃO NA FILA, não a
-- rodada — o play não tem mais rodadas. O nome ficou para não migrar
-- dados que já existem. Mesma coisa com `sessions.rounds`, que passou a
-- ser o total de partidas do dia.
comment on column public.matches.round  is 'posição na fila de partidas do dia';
comment on column public.matches.court  is 'quadra em que a partida aconteceu; 0 = ainda não entrou';
comment on column public.sessions.rounds is 'total de partidas do dia';

-- ------------------------------------------------------------
--  3. Fechamento de mês feito na mão.
--     Sem isto o mês só fecha quando o calendário vira, mas a premiação
--     acontece na última sexta.
-- ------------------------------------------------------------
create table if not exists public.month_closures (
  id         text primary key,          -- o próprio mês, YYYY-MM
  month      text not null unique,      -- YYYY-MM
  closed_at  timestamptz not null default now()
);

alter table public.month_closures enable row level security;

drop policy if exists "leitura publica"     on public.month_closures;
drop policy if exists "escrita autenticada" on public.month_closures;
create policy "leitura publica" on public.month_closures
  for select using (true);
create policy "escrita autenticada" on public.month_closures
  for all to authenticated using (true) with check (true);

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.month_closures';
  exception when duplicate_object then null;
  end;
end $$;
