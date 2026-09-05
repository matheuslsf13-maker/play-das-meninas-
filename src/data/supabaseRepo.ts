import { supabase } from '../lib/supabase'
import type { AppData, Match, PlaySession, Player, StreakChoice } from '../lib/types'
import type { Repo } from './repo'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

export const supabaseRepo: Repo = {
  kind: 'supabase',
  async load(): Promise<AppData> {
    const sb = client()
    const [players, sessions, matches, choices] = await Promise.all([
      sb.from('players').select('*').order('name'),
      sb.from('sessions').select('*').order('date', { ascending: false }),
      sb.from('matches').select('*'),
      sb.from('streak_choices').select('*'),
    ])
    const err = players.error || sessions.error || matches.error
    if (err) throw err
    // a tabela de escolhas e mais nova: se ainda nao foi criada, o app segue
    // funcionando sem ela em vez de nao abrir
    if (choices.error) console.warn('streak_choices indisponível:', choices.error.message)
    return {
      players: (players.data ?? []) as Player[],
      sessions: (sessions.data ?? []) as PlaySession[],
      matches: (matches.data ?? []) as Match[],
      choices: (choices.data ?? []) as StreakChoice[],
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
    if (error) throw error
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
    // banco ainda sem a coluna started_at (script 04 nao rodou): salva o resto
    if (/started_at/.test(error.message ?? '')) {
      const semInicio = ms.map(({ started_at: _ignora, ...resto }) => resto)
      const retry = await client().from('matches').upsert(semInicio)
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
      .channel('play-das-meninas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streak_choices' }, cb)
      .subscribe()
    return () => {
      void sb.removeChannel(ch)
    }
  },
}
