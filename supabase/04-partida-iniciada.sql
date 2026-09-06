-- ============================================================
--  Play de Todas — partida iniciada
--  Rode no SQL Editor do Supabase (depois dos scripts 01, 02 e 03).
--  Marca a hora em que a partida entrou em quadra, para o app saber
--  exatamente quem está jogando agora e quem está livre para a próxima.
-- ============================================================

alter table public.matches
  add column if not exists started_at timestamptz;
