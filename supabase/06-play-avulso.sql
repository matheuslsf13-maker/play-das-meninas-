-- ============================================================
--  Play de Todas — play avulso
--  Rode no SQL Editor do Supabase (depois dos scripts 01 a 05).
--
--  Marca se o play vale para o campeonato. Um play avulso (uma segunda
--  qualquer que as meninas resolveram jogar) continua no histórico de cada
--  jogadora e continua ajudando a equilibrar as duplas dos próximos plays,
--  mas NÃO soma pontos no ranking do mês nem mexe nas sequências 🔥.
--
--  Os plays que já existem ficam valendo para o campeonato (default true),
--  que é como eles sempre contaram.
-- ============================================================

alter table public.sessions
  add column if not exists ranked boolean not null default true;

comment on column public.sessions.ranked is
  'false = play avulso: conta no histórico, mas não no ranking do mês nem nas sequências';
