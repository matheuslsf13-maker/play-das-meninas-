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
 * FORCA DE CADA JOGADORA
 *
 * Usada para dois trabalhos: equilibrar as duplas de cada partida e dividir os
 * grupos por nivel. E um Elo -- cada partida move a nota das quatro conforme a
 * nota de quem estava do outro lado. **Vencer quem esta melhor rende muito;
 * vencer quem esta pior rende pouco, e perder para quem esta pior custa caro.**
 *
 * O jeito antigo era a media de pontos por partida, e ela nao sabe DE QUEM
 * voce ganhou. No modo em grupos isso quebra: cada grupo e um rodizio fechado,
 * entao dominar o grupo fraco rende a mesma media que dominar o grupo forte --
 * as notas dos dois grupos deixam de ser comparaveis e a divisao dos grupos
 * passa a errar cada vez mais. Medido em 12 sextas simuladas (ver DECISOES.md),
 * correlacao com a habilidade real no modo em grupos:
 *
 *   media de pontos   0,56 -> 0,77 -> 0,73 -> 0,70   (piora com o tempo)
 *   Elo               0,61 -> 0,81 -> 0,89 -> 0,92   (melhora)
 *
 * O Elo tambem resolve sozinho o que a janela de "ultimos 4 plays" resolvia:
 * quem foi boa ha um ano e anda perdendo vai devolvendo nota partida a partida.
 * E quem falta simplesmente fica com a nota parada, que e o certo -- sem jogo,
 * sem informacao nova.
 */

/** Todo mundo comeca na media; o valor em si nao importa, so as diferencas. */
const ELO_INICIAL = 1500
/** Quanto uma partida move a nota. Entre 12 e 60 o resultado quase nao muda. */
const ELO_K = 24
/** Quantos pontos de Elo valem 1 ponto na escala 0-4 que o resto do app usa. */
const ELO_ESCALA = 110

/** Nota de quem ainda nao jogou: a media do grupo. */
export const FORCA_PADRAO = 2

export function ratings(data: AppData, upToDate?: string): Map<string, number> {
  const sessao = new Map(data.sessions.map((s) => [s.id, s]))

  // o Elo depende da ordem: cada partida e avaliada com as notas que existiam
  // naquele momento, entao as partidas entram em ordem cronologica
  const jogos = playedMatches(data)
    .filter((m) => {
      const s = sessao.get(m.session_id)
      return Boolean(s) && (!upToDate || (s as PlaySession).date <= upToDate)
    })
    .sort((x, y) => {
      const sx = sessao.get(x.session_id) as PlaySession
      const sy = sessao.get(y.session_id) as PlaySession
      return (
        sx.date.localeCompare(sy.date) ||
        sx.created_at.localeCompare(sy.created_at) ||
        x.round - y.round
      )
    })

  const elo = new Map<string, number>()
  const nota = (id: string) => elo.get(id) ?? ELO_INICIAL

  for (const m of jogos) {
    const ga = m.score_a as number
    const gb = m.score_b as number
    if (ga + gb === 0) continue
    const forcaA = (nota(m.team_a[0]) + nota(m.team_a[1])) / 2
    const forcaB = (nota(m.team_b[0]) + nota(m.team_b[1])) / 2
    const esperado = 1 / (1 + Math.pow(10, (forcaB - forcaA) / 400))
    // a margem conta, como na pontuacao do campeonato: 4x0 vale 1,00 e 4x3, 0,57
    const real = ga / (ga + gb)
    const delta = ELO_K * (real - esperado)
    for (const id of m.team_a) elo.set(id, nota(id) + delta)
    for (const id of m.team_b) elo.set(id, nota(id) - delta)
  }

  // devolve na escala 0-4 (a mesma da media de pontos), para os pesos do
  // emparelhamento em pairing.ts continuarem valendo
  const out = new Map<string, number>()
  for (const p of data.players) {
    out.set(p.id, Math.max(0, FORCA_PADRAO + (nota(p.id) - ELO_INICIAL) / ELO_ESCALA))
  }
  return out
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
