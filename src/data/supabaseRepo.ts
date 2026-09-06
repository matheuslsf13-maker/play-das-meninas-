import { supabase } from '../lib/supabase'
import type { AppData, Match, MonthClosure, PlaySession, Player, StreakChoice } from '../lib/types'
import type { Repo } from './repo'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

export const supabaseRepo: Repo = {
  kind: 'supabase',
  async load(): Promise<AppData> {
    const sb = client()
    const [players, sessions, matches, choices, closures] = await Promise.all([
      sb.from('players').select('*').order('name'),
      sb.from('sessions').select('*').order('date', { ascending: false }),
      sb.from('matches').select('*'),
      sb.from('streak_choices').select('*'),
      sb.from('month_closures').select('*'),
    ])
    const err = players.error || sessions.error || matches.error
    if (err) throw err
    // estas tabelas sao mais novas: se ainda nao foram criadas, o app segue
    // funcionando sem elas em vez de nao abrir
    if (choices.error) console.warn('streak_choices indisponível:', choices.error.message)
    if (closures.error) console.warn('month_closures indisponível:', closures.error.message)
    return {
      players: (players.data ?? []) as Player[],
      sessions: (sessions.data ?? []) as PlaySession[],
      matches: (matches.data ?? []) as Match[],
      choices: (choices.data ?? []) as StreakChoice[],
      closures: (closures.data ?? []) as MonthClosure[],
    }
  },
  async savePlayer(p: Player) {
    const { error } = await client().from('players').upsert(p)
    if (error) throw error
  },
  async deletePlayer(id: string) {
    const { error } = await client().from('players').delete().eq('id', id)
    if (error) throw error
  },
  async saveSession(s: PlaySession) {
    const { error } = await client().from('sessions').upsert(s)
    if (!error) return
    // banco ainda sem as colunas do modo em grupos (script 05 nao rodou):
    // salva o resto, que e o que o play precisa para funcionar
    if (/format|groups|ranked/.test(error.message ?? '')) {
      const { format: _f, groups: _g, ranked: _r, ...resto } = s
      const retry = await client().from('sessions').upsert(resto)
      if (retry.error) throw retry.error
      return
    }
    throw error
  },
  async deleteSession(id: string) {
    const sb = client()
    const m = await sb.from('matches').delete().eq('session_id', id)
    if (m.error) throw m.error
    const { error } = await sb.from('sessions').delete().eq('id', id)
    if (error) throw error
  },
  async saveMatches(ms: Match[]) {
    if (ms.length === 0) return
    const { error } = await client().from('matches').upsert(ms)
    if (!error) return
    // banco ainda sem as colunas de horario (scripts 04/05 nao rodaram):
    // salva o resto, que o app compensa com a copia local
    if (/started_at|ended_at/.test(error.message ?? '')) {
      const semHorarios = ms.map(({ started_at: _i, ended_at: _f, ...resto }) => resto)
      const retry = await client().from('matches').upsert(semHorarios)
      if (retry.error) throw retry.error
      return
    }
    throw error
  },
  async deleteMatchesOfSession(sessionId: string) {
    const { error } = await client().from('matches').delete().eq('session_id', sessionId)
    if (error) throw error
  },
  async uploadPhoto(playerId: string, file: File) {
    const sb = client()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${playerId}/${Date.now()}.${ext}`
    const up = await sb.storage.from('photos').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (up.error) throw up.error
    const { data } = sb.storage.from('photos').getPublicUrl(path)
    return data.publicUrl
  },
  async saveChoice(choice: StreakChoice) {
    const { error } = await client().from('streak_choices').upsert(choice)
    if (error) throw error
  },
  async saveClosure(closure: MonthClosure) {
    const { error } = await client().from('month_closures').upsert(closure)
    if (error) throw error
  },
  async deleteClosure(month: string) {
    const { error } = await client().from('month_closures').delete().eq('month', month)
    if (error) throw error
  },
  async deletePhoto(url: string) {
    const marca = '/storage/v1/object/public/photos/'
    const i = url.indexOf(marca)
    if (i < 0) return // foto de outra origem: nada a apagar aqui
    const path = decodeURIComponent(url.slice(i + marca.length).split('?')[0])
    const { error } = await client().storage.from('photos').remove([path])
    if (error) console.warn('não consegui apagar a foto antiga:', error.message)
  },
  subscribe(cb: () => void) {
    const sb = client()
    const ch = sb
      .channel('play-da-sexta')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streak_choices' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_closures' }, cb)
      .subscribe()
    return () => {
      void sb.removeChannel(ch)
    }
  },
}
