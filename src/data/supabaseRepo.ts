import { supabase } from '../lib/supabase'
import type { AppData, Match, PlaySession, Player } from '../lib/types'
import type { Repo } from './repo'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

export const supabaseRepo: Repo = {
  kind: 'supabase',
  async load(): Promise<AppData> {
    const sb = client()
    const [players, sessions, matches] = await Promise.all([
      sb.from('players').select('*').order('name'),
      sb.from('sessions').select('*').order('date', { ascending: false }),
      sb.from('matches').select('*'),
    ])
    const err = players.error || sessions.error || matches.error
    if (err) throw err
    return {
      players: (players.data ?? []) as Player[],
      sessions: (sessions.data ?? []) as PlaySession[],
      matches: (matches.data ?? []) as Match[],
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
    if (error) throw error
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
  subscribe(cb: () => void) {
    const sb = client()
    const ch = sb
      .channel('play-das-meninas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, cb)
      .subscribe()
    return () => {
      void sb.removeChannel(ch)
    }
  },
}
