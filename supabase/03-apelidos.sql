-- ============================================================
--  Play de Todas — apelidos das jogadoras
--  Rode no SQL Editor do Supabase (depois dos scripts 01 e 02).
--  Guarda as grafias que a lista do grupo já usou para cada atleta,
--  para a importação reconhecer sozinha na próxima vez.
-- ============================================================

alter table public.players
  add column if not exists aliases text[] not null default '{}';
