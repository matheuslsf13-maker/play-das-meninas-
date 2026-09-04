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


/* ------------------------------------------------------------------
   Rodizio completo: todas jogam com todas exatamente uma vez.

   Usa o "metodo do circulo" (1-fatoracao do grafo completo): fixa uma
   jogadora e gira as outras, gerando N-1 conjuntos de duplas em que
   ninguem se repete dentro do conjunto e toda combinacao aparece uma
   unica vez. Depois distribui essas duplas pelas quadras disponiveis.
   ------------------------------------------------------------------ */

const BYE = '__folga__'

/** Conjuntos de duplas em que cada jogadora aparece no maximo uma vez. */
function circleMethod(ids: string[]): [string, string][][] {
  const list = ids.slice()
  if (list.length % 2 === 1) list.push(BYE)
  const n = list.length
  const fixed = list[0]
  let rot = list.slice(1)
  const out: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    if (fixed !== BYE && rot[0] !== BYE) pairs.push([fixed, rot[0]])
    for (let i = 1; i < n / 2; i++) {
      const x = rot[i]
      const y = rot[rot.length - i]
      if (x !== BYE && y !== BYE) pairs.push([x, y])
    }
    out.push(pairs)
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)]
  }
  return out
}

/** Distribui todas as duplas possiveis em rodadas com `courts` partidas. */
function buildFullRotation(ids: string[], courts: number): [string, string][][] {
  const perRound = courts * 2 // duas duplas por quadra
  const rounds: [string, string][][] = []
  let leftovers: [string, string][] = []

  for (const group of circleMethod(shuffle(ids))) {
    const pairs = shuffle(group)
    let i = 0
    for (; i + perRound <= pairs.length; i += perRound) rounds.push(pairs.slice(i, i + perRound))
    leftovers.push(...pairs.slice(i))
  }

  // Sobras: junta duplas de conjuntos diferentes que nao dividem jogadora.
  // Tenta varias ordens e fica com a rodada que aproveita mais duplas, senao
  // sobram rodadas de uma dupla so (que nao tem adversaria).
  while (leftovers.length > 1) {
    let best: [string, string][] = []
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      const ordem = shuffle(leftovers)
      const used = new Set<string>()
      const round: [string, string][] = []
      for (const pair of ordem) {
        if (round.length >= perRound) break
        if (used.has(pair[0]) || used.has(pair[1])) continue
        used.add(pair[0]); used.add(pair[1])
        round.push(pair)
      }
      if (round.length % 2 === 1) round.pop() // partida precisa de duas duplas
      if (round.length > best.length) best = round
      if (best.length === perRound) break
    }
    if (best.length === 0) break // nada mais combina; resolve abaixo
    const usadas = new Set(best.map(keyOf))
    leftovers = leftovers.filter((p) => !usadas.has(keyOf(p)))
    rounds.push(best)
  }

  // Restou dupla sem adversaria (acontece quando o total de combinacoes e
  // impar): repete uma combinacao ja jogada, so para ela ter contra quem jogar.
  for (const odd of leftovers) {
    const rival = findDisjointPair(rounds, odd)
    if (rival) rounds.push([odd, rival])
  }
  return rounds
}

function keyOf(p: [string, string]): string {
  return p[0] < p[1] ? `${p[0]}|${p[1]}` : `${p[1]}|${p[0]}`
}

function findDisjointPair(
  rounds: [string, string][][],
  pair: [string, string],
): [string, string] | null {
  for (const r of rounds) {
    for (const p of r) {
      if (p[0] !== pair[0] && p[0] !== pair[1] && p[1] !== pair[0] && p[1] !== pair[1]) return p
    }
  }
  return null
}

/** Melhor de varias tentativas: menos rodadas e menos duplas repetidas. */
function bestFullRotation(ids: string[], courts: number): [string, string][][] {
  let best: [string, string][][] | null = null
  let bestScore = Infinity
  for (let t = 0; t < 8; t++) {
    const cand = buildFullRotation(ids, courts)
    const vistas = new Set<string>()
    let repetidas = 0
    for (const r of cand) for (const p of r) {
      if (vistas.has(keyOf(p))) repetidas++
      else vistas.add(keyOf(p))
    }
    const score = cand.length * 100 + repetidas
    if (score < bestScore) { bestScore = score; best = cand }
  }
  return best ?? []
}

/** Quantas rodadas o rodizio completo exige, com esse numero de jogadoras/quadras. */
export function fullRotationRounds(players: number, courts: number): number {
  if (players < 4) return 0
  const c = Math.max(1, Math.min(courts, Math.floor(players / 4)))
  const ids = Array.from({ length: players }, (_, i) => 'x' + i)
  return bestFullRotation(ids, c).length
}

/** Quantas partidas cada jogadora faz no rodizio completo. */
export function fullRotationMatches(players: number): number {
  return Math.max(0, players - 1)
}

/** Monta as partidas de uma rodada a partir das duplas ja definidas. */
function duosToMatches(
  duos: [string, string][],
  ratings: Map<string, number>,
  hist: History,
): PlannedMatch[] {
  const r = (id: string) => ratings.get(id) ?? 2
  const strength = (d: [string, string]) => r(d[0]) + r(d[1])
  const cost = (arr: [string, string][]) => {
    let c = 0
    for (let i = 0; i + 1 < arr.length; i += 2) {
      c += W_BALANCE * Math.abs(strength(arr[i]) - strength(arr[i + 1]))
      for (const x of arr[i]) {
        for (const y of arr[i + 1]) c += W_OPPONENT * (hist.opponent.get(pairKey(x, y)) ?? 0)
      }
    }
    return c
  }
  let best = duos.slice()
  let bestCost = cost(best)
  for (let restart = 0; restart < 6; restart++) {
    const cur = shuffle(duos)
    let curCost = cost(cur)
    let improved = true
    let guard = 0
    while (improved && guard++ < 20) {
      improved = false
      for (let i = 0; i < cur.length; i++) {
        for (let j = i + 1; j < cur.length; j++) {
          ;[cur[i], cur[j]] = [cur[j], cur[i]]
          const c = cost(cur)
          if (c < curCost - 1e-9) { curCost = c; improved = true }
          else [cur[i], cur[j]] = [cur[j], cur[i]]
        }
      }
    }
    if (curCost < bestCost) { bestCost = curCost; best = cur.slice() }
  }
  const out: PlannedMatch[] = []
  for (let i = 0; i + 1 < best.length; i += 2) {
    out.push({ court: out.length + 1, team_a: best[i], team_b: best[i + 1] })
  }
  return out
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
  /**
   * 'completo' ignora `rounds` e joga o rodizio inteiro: todas jogam com
   * todas exatamente uma vez. 'fixo' respeita o numero de rodadas pedido.
   */
  mode?: 'completo' | 'fixo'
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

  const plans: RoundPlan[] = []

  // Rodizio completo (pedido explicitamente, ou porque ha rodadas de sobra):
  // metodo do circulo, que garante todas jogando com todas exatamente uma vez.
  const full = bestFullRotation(players, courts)
  if (opts.mode === 'completo' || rounds >= full.length) {
    for (const duos of full) {
      const matches = duosToMatches(duos, ratings, hist)
      if (matches.length === 0) continue
      const jogando = new Set(matches.flatMap((m) => [...m.team_a, ...m.team_b]))
      plans.push({
        round: plans.length + 1,
        matches,
        byes: players.filter((p) => !jogando.has(p)),
      })
      for (const m of matches) registerMatch(hist, m)
    }
    // pediu mais rodadas do que o rodizio precisa: segue no modo normal
    if (opts.mode !== 'completo' && rounds > plans.length) {
      const extra = generateSchedule({
        ...opts,
        rounds: rounds - plans.length,
        history: hist,
        historyWeight: 1,
      })
      for (const p of extra) plans.push({ ...p, round: plans.length + 1 })
    }
    return plans
  }

  const byes = new Map<string, number>(players.map((p) => [p, 0]))

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
      const m = { court: i + 1, team_a, team_b }
      matches.push(m)
      registerMatch(hist, m) // alimenta o historico para a proxima rodada
    }
    plans.push({ round, matches, byes: sitting })
  }
  return plans
}

/** Anota no historico as duplas e os confrontos de uma partida. */
function registerMatch(hist: History, m: PlannedMatch) {
  hist.partner.set(pairKey(m.team_a[0], m.team_a[1]), (hist.partner.get(pairKey(m.team_a[0], m.team_a[1])) ?? 0) + 1)
  hist.partner.set(pairKey(m.team_b[0], m.team_b[1]), (hist.partner.get(pairKey(m.team_b[0], m.team_b[1])) ?? 0) + 1)
  for (const x of m.team_a) {
    for (const y of m.team_b) hist.opponent.set(pairKey(x, y), (hist.opponent.get(pairKey(x, y)) ?? 0) + 1)
  }
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

/* ------------------------------------------------------------------
   Ajuste ao vivo: quadra livre esperando quem ainda esta jogando.

   Na pratica as quadras nao terminam juntas. Quando uma acaba antes, a
   proxima partida dela costuma pedir alguem que ainda esta em jogo na outra
   quadra -- e a quadra fica parada por causa de uma pessoa so. Aqui a gente
   troca quem esta ocupada por quem esta livre, mantendo o mesmo criterio das
   duplas: quem jogou menos entra primeiro, sem repetir parceira e com as
   duplas equilibradas.
   ------------------------------------------------------------------ */

export type SubstituicaoOpts = {
  /** As quatro jogadoras da partida que se quer comecar. */
  time: [string, string, string, string]
  /** Quem esta em quadra agora, em outras partidas. */
  ocupadas: Set<string>
  /** Todas as jogadoras do play. */
  todas: string[]
  /** Quantas partidas cada uma ja jogou hoje. */
  jogos: Map<string, number>
  ratings: Map<string, number>
  history: History
}

export type Substituicao = { sai: string; entra: string }

/**
 * Troca as jogadoras ocupadas da partida por jogadoras livres.
 * Devolve as trocas; vazio quando ninguem esta ocupada ou nao ha substituta.
 */
export function liberarPartida(opts: SubstituicaoOpts): Substituicao[] {
  const { time, ocupadas, todas, jogos, ratings, history } = opts
  const noTime = new Set(time)
  const presas = time.filter((id) => ocupadas.has(id))
  if (presas.length === 0) return []

  const livres = todas.filter((id) => !ocupadas.has(id) && !noTime.has(id))
  if (livres.length === 0) return []

  const trocas: Substituicao[] = []
  const time2 = [...time] as string[]
  const usadas = new Set<string>()

  for (const sai of presas) {
    const candidatas = livres.filter((id) => !usadas.has(id))
    if (candidatas.length === 0) break

    const posicao = time2.indexOf(sai)
    const melhor = candidatas
      .map((entra) => {
        const proposto = time2.map((id) => (id === sai ? entra : id))
        return { entra, custo: custoDaPartida(proposto, ratings, history) + (jogos.get(entra) ?? 0) * 45 }
      })
      .sort((a, b) => a.custo - b.custo)[0]

    time2[posicao] = melhor.entra
    usadas.add(melhor.entra)
    trocas.push({ sai, entra: melhor.entra })
  }
  return trocas
}

/** Custo de uma partida ja montada, nos mesmos pesos do sorteio das rodadas. */
function custoDaPartida(time: string[], ratings: Map<string, number>, hist: History): number {
  const [p1, p2, p3, p4] = time
  const r = (id: string) => ratings.get(id) ?? 2
  let c = 0
  c += W_PARTNER * ((hist.partner.get(pairKey(p1, p2)) ?? 0) + (hist.partner.get(pairKey(p3, p4)) ?? 0))
  for (const x of [p1, p2]) {
    for (const y of [p3, p4]) c += W_OPPONENT * (hist.opponent.get(pairKey(x, y)) ?? 0)
  }
  c += W_BALANCE * Math.abs(r(p1) + r(p2) - r(p3) - r(p4))
  return c
}

/** Quantas rodadas cada jogadora joga, dado o formato do dia. */
export function matchesPerPlayer(players: number, courts: number, rounds: number): number {
  const c = Math.max(0, Math.min(courts, Math.floor(players / 4)))
  if (players === 0 || c === 0) return 0
  return Math.floor((c * 4 * rounds) / players)
}
