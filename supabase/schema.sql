-- ============================================================
--  Play das Meninas — Super 8
--  Cole este script inteiro no SQL Editor do Supabase e rode.
-- ============================================================

create table if not exists public.players (
  id          text primary key,
  name        text not null,
  photo_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.sessions (
  id          text primary key,
  date        date not null,
  title       text not null default 'Play de Sexta',
  courts      int  not null default 3,
  rounds      int  not null default 8,
  target      int  not null default 4,
  player_ids  text[] not null default '{}',
  status      text not null default 'open' check (status in ('open','finished')),
  created_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id          text primary key,
  session_id  text not null references public.sessions(id) on delete cascade,
  round       int  not null,
  court       int  not null,
  team_a      text[] not null,
  team_b      text[] not null,
  score_a     int,
  score_b     int
);

create index if not exists matches_session_idx on public.matches (session_id);
create index if not exists sessions_date_idx   on public.sessions (date desc);

-- ------------------------------------------------------------
--  Permissões: todo mundo LÊ (o grupo do WhatsApp),
--  só quem está logada ESCREVE (quem organiza o play).
-- ------------------------------------------------------------
alter table public.players  enable row level security;
alter table public.sessions enable row level security;
alter table public.matches  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players','sessions','matches'] loop
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('drop policy if exists "escrita autenticada" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format(
      'create policy "escrita autenticada" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ------------------------------------------------------------
--  Tempo real: o ranking atualiza sozinho no celular de todas.
-- ------------------------------------------------------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.players';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.sessions'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.matches';  exception when duplicate_object then null; end;
end $$;

-- ------------------------------------------------------------
--  Fotos das jogadoras (bucket público de leitura).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos leitura publica"   on storage.objects;
drop policy if exists "fotos envio autenticado" on storage.objects;
drop policy if exists "fotos update autenticado" on storage.objects;
drop policy if exists "fotos delete autenticado" on storage.objects;

create policy "fotos leitura publica" on storage.objects
  for select using (bucket_id = 'photos');
create policy "fotos envio autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "fotos update autenticado" on storage.objects
  for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');
create policy "fotos delete autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');
