/**
 * Dados do projeto Supabase.
 *
 * Preencha aqui OU use as variaveis de ambiente VITE_SUPABASE_URL e
 * VITE_SUPABASE_ANON_KEY (que tem prioridade sobre estes valores).
 *
 * Pode commitar sem medo: a "anon key" e publica por natureza -- ela vai
 * dentro do JavaScript do site publicado de qualquer jeito. Quem protege os
 * dados sao as politicas de RLS criadas por supabase/schema.sql: qualquer
 * pessoa com o link LE o ranking, mas so quem tem login ESCREVE.
 *
 * Onde achar: painel do Supabase -> Project Settings -> API
 *   SUPABASE_URL      = "Project URL"        (https://xxxx.supabase.co)
 *   SUPABASE_ANON_KEY = chave "publishable"  (sb_publishable_... ou anon eyJ...)
 *
 * NUNCA coloque aqui a chave "secret" / "service_role": ela ignora todas as
 * regras de permissao do banco e nao pode ir para o site.
 *
 * Deixando em branco, o app roda em modo local (dados so no navegador).
 */
export const SUPABASE_URL = 'https://yavxfubztyuonryuvdhn.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_2Txknu1egyRRED_Y5exMXQ_64DSmH5q'
