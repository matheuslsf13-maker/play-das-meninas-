import { isPlayed, matchPoints } from './scoring'
import type { AppData, Match, PlaySession } from './types'
import { monthOf } from './types'

export type PlayerStat = {
  player_id: string
  matches: number
  wins: number
  losses: number
  points: number
  gamesWon: number
  gamesLost: number
  days: number
}

export type PairKeyStat = {
  other_id: string
  matches: number
  wins: number
  losses: number
  points: number
}

export const emptyStat = (player_id: string): PlayerStat => ({
  player_id, matches: 0, wins: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0, days: 0,
})

export function winRate(s: PlayerStat): number {
  return s.matches === 0 ? 0 : s.wins / s.matches
}

export function balance(s: PlayerStat): number {
  return s.gamesWon - s.gamesLost
}

export function avgPoints(s: PlayerStat): number {
  return s.matches === 0 ? 0 : s.points / s.matches
}

/** Partidas ja jogadas (com placar valido), opcionalmente filtradas por mes. */
export function playedMatches(data: AppData, opts: { month?: string; sessionId?: string } = {}): Match[] {
  const byId = new Map(data.sessions.map((s) => [s.id, s]))
  return data.matches.filter((m) => {
    if (!isPlayed(m)) return false
    if (opts.sessionId && m.session_id !== opts.sessionId) return false
    const s = byId.get(m.session_id)
    if (!s) return false
    if (opts.month && monthOf(s.date) !== opts.month) return false
    return true
  })
}

export function computeStats(matches: Match[]): Map<string, PlayerStat> {
  const out = new Map<string, PlayerStat>()
  const daysSeen = new Map<string, Set<string>>()
  const get = (id: string) => {
    let s = out.get(id)
    if (!s) { s = emptyStat(id); out.set(id, s) }
    return s
  }
  for (const m of matches) {
    const a = m.score_a as number
    const b = m.score_b as number
    const [pa, pb] = matchPoints(a, b)
    for (const id of m.team_a) {
      const s = get(id)
      s.matches++; s.points += pa; s.gamesWon += a; s.gamesLost += b
      if (a > b) s.wins++; else s.losses++
      if (!daysSeen.has(id)) daysSeen.set(id, new Set())
      daysSeen.get(id)!.add(m.session_id)
    }
    for (const id of m.team_b) {
      const s = get(id)
      s.matches++; s.points += pb; s.gamesWon += b; s.gamesLost += a
      if (b > a) s.wins++; else s.losses++
      if (!daysSeen.has(id)) daysSeen.set(id, new Set())
      daysSeen.get(id)!.add(m.session_id)
    }
  }
  for (const [id, set] of daysSeen) get(id).days = set.size
  return out
}

/** Ordena o ranking: pontos > saldo de games > vitorias > nome. */
export function rankPlayers(
  stats: Map<string, PlayerStat>,
  nameOf: (id: string) => string,
): PlayerStat[] {
  return [...stats.values()].sort((x, y) =>
    y.points - x.points ||
    balance(y) - balance(x) ||
    y.wins - x.wins ||
    nameOf(x.player_id).localeCompare(nameOf(y.player_id), 'pt-BR'),
  )
}

/** Estatistica de parceria: com quem cada jogadora jogou e como foi. */
export function partnerStats(matches: Match[]): Map<string, Map<string, PairKeyStat>> {
  const out = new Map<string, Map<string, PairKeyStat>>()
  const bump = (id: string, other: string, win: boolean, pts: number) => {
    if (!out.has(id)) out.set(id, new Map())
    const inner = out.get(id)!
    let s = inner.get(other)
    if (!s) { s = { other_id: other, matches: 0, wins: 0, losses: 0, points: 0 }; inner.set(other, s) }
    s.matches++; s.points += pts
    if (win) s.wins++; else s.losses++
  }
  for (const m of matches) {
    const a = m.score_a as number
    const b = m.score_b as number
    const [pa, pb] = matchPoints(a, b)
    bump(m.team_a[0], m.team_a[1], a > b, pa)
    bump(m.team_a[1], m.team_a[0], a > b, pa)
    bump(m.team_b[0], m.team_b[1], b > a, pb)
    bump(m.team_b[1], m.team_b[0], b > a, pb)
  }
  return out
}

/** Estatistica de confronto: contra quem cada jogadora jogou e como foi. */
export function opponentStats(matches: Match[]): Map<string, Map<string, PairKeyStat>> {
  const out = new Map<string, Map<string, PairKeyStat>>()
  const bump = (id: string, other: string, win: boolean, pts: number) => {
    if (!out.has(id)) out.set(id, new Map())
    const inner = out.get(id)!
    let s = inner.get(other)
    if (!s) { s = { other_id: other, matches: 0, wins: 0, losses: 0, points: 0 }; inner.set(other, s) }
    s.matches++; s.points += pts
    if (win) s.wins++; else s.losses++
  }
  for (const m of matches) {
    const a = m.score_a as number
    const b = m.score_b as number
    const [pa, pb] = matchPoints(a, b)
    for (const x of m.team_a) for (const y of m.team_b) bump(x, y, a > b, pa)
    for (const x of m.team_b) for (const y of m.team_a) bump(x, y, b > a, pb)
  }
  return out
}

/**
 * Forca estimada de cada jogadora (media de pontos por partida), usada para
 * montar duplas equilibradas. Historico recente pesa mais.
 */
export function ratings(data: AppData, upToDate?: string): Map<string, number> {
  const played = playedMatches(data)
  const byId = new Map(data.sessions.map((s) => [s.id, s]))
  const acc = new Map<string, { w: number; p: number }>()
  const DEFAULT = 2
  for (const m of played) {
    const s = byId.get(m.session_id) as PlaySession | undefined
    if (!s) continue
    if (upToDate && s.date > upToDate) continue
    // decaimento: cada dia de play anterior pesa menos
    const ageDays = upToDate ? daysBetween(s.date, upToDate) : 0
    const w = Math.pow(0.97, ageDays)
    const a = m.score_a as number
    const b = m.score_b as number
    const [pa, pb] = matchPoints(a, b)
    for (const id of m.team_a) add(acc, id, w, pa * w)
    for (const id of m.team_b) add(acc, id, w, pb * w)
  }
  const out = new Map<string, number>()
  for (const p of data.players) {
    const e = acc.get(p.id)
    if (!e || e.w < 1) {
      // poucas partidas: puxa para a media
      const known = e ? e.p / Math.max(e.w, 0.0001) : DEFAULT
      const conf = e ? Math.min(e.w, 1) : 0
      out.set(p.id, known * conf + DEFAULT * (1 - conf))
    } else {
      out.set(p.id, e.p / e.w)
    }
  }
  return out
}

function add(acc: Map<string, { w: number; p: number }>, id: string, w: number, p: number) {
  const e = acc.get(id) ?? { w: 0, p: 0 }
  e.w += w; e.p += p
  acc.set(id, e)
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00')
  const b = Date.parse(to + 'T00:00:00')
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

/** Historico de parcerias/confrontos, para evitar repetir duplas. */
export type History = {
  partner: Map<string, number>
  opponent: Map<string, number>
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function buildHistory(matches: Match[], decay = 1): History {
  const partner = new Map<string, number>()
  const opponent = new Map<string, number>()
  matches.forEach((m, i) => {
    const w = Math.pow(decay, matches.length - 1 - i)
    inc(partner, pairKey(m.team_a[0], m.team_a[1]), w)
    inc(partner, pairKey(m.team_b[0], m.team_b[1]), w)
    for (const x of m.team_a) for (const y of m.team_b) inc(opponent, pairKey(x, y), w)
  })
  return { partner, opponent }
}

function inc(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by)
}
