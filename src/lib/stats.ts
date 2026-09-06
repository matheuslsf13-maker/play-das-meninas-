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
  /** Pontos de bonus por sequencia de vitorias ("em chamas"). */
  bonus: number
}

export type PairKeyStat = {
  other_id: string
  matches: number
  wins: number
  losses: number
  points: number
}

export const emptyStat = (player_id: string): PlayerStat => ({
  player_id, matches: 0, wins: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0, days: 0, bonus: 0,
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
export function playedMatches(
  data: AppData,
  opts: {
    month?: string
    sessionId?: string
    /** So os plays que valem para o campeonato (deixa de fora os avulsos). */
    ranked?: boolean
  } = {},
): Match[] {
  const byId = new Map(data.sessions.map((s) => [s.id, s]))
  return data.matches.filter((m) => {
    if (!isPlayed(m)) return false
    if (opts.sessionId && m.session_id !== opts.sessionId) return false
    const s = byId.get(m.session_id)
    if (!s) return false
    if (opts.month && monthOf(s.date) !== opts.month) return false
    // plays antigos nao tem o campo: contam como valendo
    if (opts.ranked && s.ranked === false) return false
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

/** Uma dupla que ja jogou junta, com o retrospecto dela. */
export type DuoStat = {
  key: string
  a: string
  b: string
  matches: number
  wins: number
  losses: number
  points: number
  gamesWon: number
  gamesLost: number
  /** Ids dos plays em que a dupla jogou. */
  sessions: Set<string>
}

/** Todas as duplas ja formadas no periodo, agregadas. */
export function duoStats(matches: Match[]): Map<string, DuoStat> {
  const out = new Map<string, DuoStat>()
  const add = (ids: [string, string], venceu: boolean, pts: number, favor: number, contra: number, sid: string) => {
    const key = pairKey(ids[0], ids[1])
    let d = out.get(key)
    if (!d) {
      const [a, b] = ids[0] < ids[1] ? ids : [ids[1], ids[0]]
      d = { key, a, b, matches: 0, wins: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0, sessions: new Set() }
      out.set(key, d)
    }
    d.matches++
    d.points += pts
    d.gamesWon += favor
    d.gamesLost += contra
    d.sessions.add(sid)
    if (venceu) d.wins++
    else d.losses++
  }
  for (const m of matches) {
    const a = m.score_a as number
    const b = m.score_b as number
    const [pa, pb] = matchPoints(a, b)
    add(m.team_a, a > b, pa, a, b, m.session_id)
    add(m.team_b, b > a, pb, b, a, m.session_id)
  }
  return out
}

/** Partidas de uma dupla especifica, da mais recente para a mais antiga. */
export function duoMatches(matches: Match[], a: string, b: string): Match[] {
  const alvo = pairKey(a, b)
  return matches.filter(
    (m) => pairKey(m.team_a[0], m.team_a[1]) === alvo || pairKey(m.team_b[0], m.team_b[1]) === alvo,
  )
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
 * Quantos plays entram na conta da forca de cada jogadora.
 *
 * Nao e o historico inteiro de proposito: quem foi muito bem ha um ano e
 * andou jogando mal cairia no grupo forte sem estar em forma. Quatro plays
 * pegam o momento atual e atravessam a virada do mes -- entao o primeiro play
 * do mes ja sai equilibrado mesmo com o ranking zerado.
 */
export const PLAYS_PARA_FORCA = 4

const FORCA_PADRAO = 2

/** Soma de pontos e peso de cada jogadora, dentro de uma janela de plays. */
function mediaPorPartida(
  data: AppData,
  upToDate: string | undefined,
  maxPlays: number,
): Map<string, { w: number; p: number }> {
  const byId = new Map(data.sessions.map((s) => [s.id, s]))
  // as datas de play que contam: as `maxPlays` mais recentes ate a data pedida
  const datas = [...new Set(
    data.sessions
      .filter((s) => !upToDate || s.date <= upToDate)
      .map((s) => s.date),
  )]
    .sort()
    .reverse()
    .slice(0, maxPlays)
  const janela = new Set(datas)

  const acc = new Map<string, { w: number; p: number }>()
  for (const m of playedMatches(data)) {
    const s = byId.get(m.session_id) as PlaySession | undefined
    if (!s || !janela.has(s.date)) continue
    // decaimento: dentro da janela, o play mais recente ainda pesa um pouco mais
    const ageDays = upToDate ? daysBetween(s.date, upToDate) : 0
    const w = Math.pow(0.97, ageDays)
    const a = m.score_a as number
    const b = m.score_b as number
    const [pa, pb] = matchPoints(a, b)
    for (const id of m.team_a) add(acc, id, w, pa * w)
    for (const id of m.team_b) add(acc, id, w, pb * w)
  }
  return acc
}

/**
 * Forca estimada de cada jogadora (media de pontos por partida), usada para
 * montar duplas equilibradas e para dividir os grupos por nivel.
 *
 * Vale a forma dos ultimos `PLAYS_PARA_FORCA` plays. Quem jogou pouco nessa
 * janela nao cai direto na media do grupo: o app completa com o historico
 * dela, para quem faltou algumas sextas nao ser tratada como estreante.
 */
export function ratings(data: AppData, upToDate?: string): Map<string, number> {
  const recente = mediaPorPartida(data, upToDate, PLAYS_PARA_FORCA)
  const sempre = mediaPorPartida(data, upToDate, Number.MAX_SAFE_INTEGER)

  const out = new Map<string, number>()
  for (const p of data.players) {
    const r = recente.get(p.id)
    const g = sempre.get(p.id)
    // confianca cresce com quantas partidas ela tem no periodo
    const confR = r ? Math.min(r.w, 1) : 0
    const confG = g ? Math.min(g.w, 1) : 0
    const mediaR = r && r.w > 0 ? r.p / r.w : FORCA_PADRAO
    const mediaG = g && g.w > 0 ? g.p / g.w : FORCA_PADRAO
    // sem dados recentes, cai no historico dela; sem historico, na media geral
    const base = mediaG * confG + FORCA_PADRAO * (1 - confG)
    out.set(p.id, mediaR * confR + base * (1 - confR))
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
