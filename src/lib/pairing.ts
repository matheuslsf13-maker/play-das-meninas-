import { buildHistory, pairKey, type History } from './stats'
import type { Match } from './types'
import { uid } from './types'

export type PlannedMatch = { court: number; team_a: [string, string]; team_b: [string, string] }
export type RoundPlan = { round: number; matches: PlannedMatch[]; byes: string[] }

const W_PARTNER = 120 // repetir dupla e o que mais penaliza ("cada rodada, novas duplas!")
const W_OPPONENT = 22 // repetir adversaria penaliza menos
const W_BALANCE = 30 // diferenca de forca entre as duas duplas da partida
const W_SPREAD = 6 // evita juntar a mais forte com a mais fraca do dia na mesma quadra

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function matchCost(
  slot: string[],
  i: number,
  ratings: Map<string, number>,
  hist: History,
): number {
  const [p1, p2, p3, p4] = [slot[4 * i], slot[4 * i + 1], slot[4 * i + 2], slot[4 * i + 3]]
  const r = (id: string) => ratings.get(id) ?? 2
  let cost = 0
  cost += W_PARTNER * ((hist.partner.get(pairKey(p1, p2)) ?? 0) + (hist.partner.get(pairKey(p3, p4)) ?? 0))
  for (const x of [p1, p2]) {
    for (const y of [p3, p4]) cost += W_OPPONENT * (hist.opponent.get(pairKey(x, y)) ?? 0)
  }
  cost += W_BALANCE * Math.abs(r(p1) + r(p2) - r(p3) - r(p4))
  const rs = [r(p1), r(p2), r(p3), r(p4)]
  cost += W_SPREAD * (Math.max(...rs) - Math.min(...rs))
  return cost
}

function totalCost(slot: string[], courts: number, ratings: Map<string, number>, hist: History): number {
  let c = 0
  for (let i = 0; i < courts; i++) c += matchCost(slot, i, ratings, hist)
  return c
}

/** Busca local (troca de posicoes) para achar o melhor arranjo de quadras/duplas. */
function optimize(ids: string[], courts: number, ratings: Map<string, number>, hist: History): string[] {
  let best: string[] | null = null
  let bestCost = Infinity
  const restarts = 8
  const matchOf = (idx: number) => Math.floor(idx / 4)
  for (let r = 0; r < restarts; r++) {
    const cur = shuffle(ids)
    let curCost = totalCost(cur, courts, ratings, hist)
    let improved = true
    let guard = 0
    while (improved && guard++ < 25) {
      improved = false
      for (let i = 0; i < cur.length; i++) {
        for (let j = i + 1; j < cur.length; j++) {
          const mi = matchOf(i)
          const mj = matchOf(j)
          // so recalcula as partidas afetadas pela troca
          const before = mi === mj
            ? matchCost(cur, mi, ratings, hist)
            : matchCost(cur, mi, ratings, hist) + matchCost(cur, mj, ratings, hist)
          ;[cur[i], cur[j]] = [cur[j], cur[i]]
          const after = mi === mj
            ? matchCost(cur, mi, ratings, hist)
            : matchCost(cur, mi, ratings, hist) + matchCost(cur, mj, ratings, hist)
          if (after < before - 1e-9) {
            curCost += after - before
            improved = true
          } else {
            ;[cur[i], cur[j]] = [cur[j], cur[i]]
          }
        }
      }
    }
    if (curCost < bestCost) {
      bestCost = curCost
      best = cur.slice()
    }
  }
  return best ?? shuffle(ids)
}

export type ScheduleOptions = {
  playerIds: string[]
  courts: number
  rounds: number
  ratings: Map<string, number>
  /** Historico de partidas anteriores (outros dias), para variar as duplas. */
  history?: History
  /** Peso do historico antigo em relacao ao do proprio dia (0 a 1). */
  historyWeight?: number
}

/**
 * Monta as rodadas do dia:
 *  - todas jogam a mesma quantidade de partidas (folgas distribuidas de forma justa);
 *  - duplas novas a cada rodada;
 *  - duplas equilibradas pela pontuacao (forca estimada).
 */
export function generateSchedule(opts: ScheduleOptions): RoundPlan[] {
  const { playerIds, rounds, ratings } = opts
  const players = playerIds.slice()
  const maxCourts = Math.floor(players.length / 4)
  const courts = Math.max(0, Math.min(opts.courts, maxCourts))
  if (courts === 0 || rounds <= 0) return []

  const slots = courts * 4
  const hist: History = {
    partner: new Map(),
    opponent: new Map(),
  }
  const hw = opts.historyWeight ?? 0.45
  if (opts.history) {
    for (const [k, v] of opts.history.partner) hist.partner.set(k, v * hw)
    for (const [k, v] of opts.history.opponent) hist.opponent.set(k, v * hw)
  }

  const byes = new Map<string, number>(players.map((p) => [p, 0]))
  const plans: RoundPlan[] = []

  for (let round = 1; round <= rounds; round++) {
    // quem folga: prioridade para quem folgou menos vezes ate agora
    const sitting = shuffle(players)
      .sort((a, b) => (byes.get(a) ?? 0) - (byes.get(b) ?? 0))
      .slice(0, players.length - slots)
    const sittingSet = new Set(sitting)
    for (const id of sitting) byes.set(id, (byes.get(id) ?? 0) + 1)

    const playing = players.filter((p) => !sittingSet.has(p))
    const arranged = optimize(playing, courts, ratings, hist)

    const matches: PlannedMatch[] = []
    for (let i = 0; i < courts; i++) {
      const team_a: [string, string] = [arranged[4 * i], arranged[4 * i + 1]]
      const team_b: [string, string] = [arranged[4 * i + 2], arranged[4 * i + 3]]
      matches.push({ court: i + 1, team_a, team_b })
      // alimenta o historico para a proxima rodada do mesmo dia
      hist.partner.set(pairKey(team_a[0], team_a[1]), (hist.partner.get(pairKey(team_a[0], team_a[1])) ?? 0) + 1)
      hist.partner.set(pairKey(team_b[0], team_b[1]), (hist.partner.get(pairKey(team_b[0], team_b[1])) ?? 0) + 1)
      for (const x of team_a) {
        for (const y of team_b) {
          hist.opponent.set(pairKey(x, y), (hist.opponent.get(pairKey(x, y)) ?? 0) + 1)
        }
      }
    }
    plans.push({ round, matches, byes: sitting })
  }
  return plans
}

export function planToMatches(sessionId: string, plans: RoundPlan[]): Match[] {
  const out: Match[] = []
  for (const p of plans) {
    for (const m of p.matches) {
      out.push({
        id: uid(),
        session_id: sessionId,
        round: p.round,
        court: m.court,
        team_a: m.team_a,
        team_b: m.team_b,
        score_a: null,
        score_b: null,
      })
    }
  }
  return out
}

export function historyFromMatches(matches: Match[]): History {
  return buildHistory(matches)
}

/** Quantas rodadas cada jogadora joga, dado o formato do dia. */
export function matchesPerPlayer(players: number, courts: number, rounds: number): number {
  const c = Math.max(0, Math.min(courts, Math.floor(players / 4)))
  if (players === 0 || c === 0) return 0
  return Math.floor((c * 4 * rounds) / players)
}
