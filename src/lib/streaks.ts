import { balance, computeStats, playedMatches, rankPlayers, type PlayerStat } from './stats'
import type { AppData, StreakChoice } from './types'
import { monthOf, todayISO } from './types'

/**
 * STATUS DE SEQUENCIA ("em chamas")
 *
 * Como as duplas sao equilibradas, a campea do dia e quase sorteio: medindo em
 * 400 sextas simuladas, emendar duas vitorias acontece em 11% das vezes e
 * ninguem chega perto de 4. Por isso o que mantem o status nao e vencer o dia,
 * e sim terminar no PODIO do dia (top 3) -- e quem preserva o status no
 * fechamento do mes ganha 1 VIDA, que absorve uma sexta fora do podio.
 *
 * O status vale pontos uma unica vez: no fechamento do mes, se ela ainda o
 * tiver, escolhe USAR (os pontos entram naquele mes e o status zera) ou
 * PRESERVAR (nao pontua, o status segue e cresce, e ela ganha a vida).
 *
 * O mes fecha de tres jeitos: quando aparece um play de um mes seguinte,
 * quando o calendario passa do mes, ou quando a organizadora aperta
 * "finalizar o mes" (`MonthClosure`). O botao existe porque a premiacao
 * acontece na ultima sexta, antes de o calendario virar.
 */

export type StreakLevel = { emoji: string; title: string }

export const STREAK_LADDER = [
  { from: 2, to: 2, emoji: '🔥', title: 'Em chamas', value: 3 },
  { from: 3, to: 3, emoji: '🔥🔥', title: 'Pegando fogo', value: 6 },
  { from: 4, to: 4, emoji: '🔥🔥🔥', title: 'Imparável', value: 10 },
  { from: 5, to: 5, emoji: '👑🔥', title: 'Lenda do Play', value: 16 },
  { from: 6, to: 6, emoji: '👑💎', title: 'Rainha do Play', value: 24 },
  { from: 7, to: 7, emoji: '👑🌟', title: 'Imperatriz do Play', value: 34 },
  { from: 8, to: null, emoji: '👑💎🌟', title: 'Duquesa da V3', value: 50 },
] as const

/** Quantos pontos vale o status que ela tem agora. */
export function streakValue(streak: number): number {
  if (streak <= 1) return 0
  const faixa = [...STREAK_LADDER].reverse().find((x) => streak >= x.from)
  return faixa ? faixa.value : 0
}

export function streakLevel(streak: number): StreakLevel | null {
  if (streak <= 1) return null
  const faixa = [...STREAK_LADDER].reverse().find((x) => streak >= x.from)
  return faixa ? { emoji: faixa.emoji, title: faixa.title } : null
}

/** Quantas jogadoras sobem ao podio do dia. */
export const PODIO = 3

/** O status maximo: 8 sextas seguidas no podio. */
export const MAX_STREAK = 8

export function isMaxLevel(streak: number): boolean {
  return streak >= MAX_STREAK
}

/** Pontos creditados num mes porque a jogadora decidiu usar o status. */
export type StreakAward = {
  month: string
  player_id: string
  streak: number
  bonus: number
}

/** O que aconteceu com a sequencia de alguem numa sexta. */
export type StreakStep = {
  session_id: string
  date: string
  player_id: string
  streak: number
  /** true quando a vida foi gasta para segurar o status nesta sexta. */
  usouVida: boolean
  value: number
}

/** Decisao de fechamento de mes: preservar (padrao) ou usar. */
export type MonthDecision = {
  month: string
  player_id: string
  streak: number
  /** Quanto vale usar o status agora. */
  value: number
  action: 'usar' | 'preservar'
  respondido: boolean
}

export type Streaks = {
  awards: StreakAward[]
  steps: StreakStep[]
  current: Map<string, number>
  /** Vidas disponiveis de cada jogadora (0 ou 1). */
  lives: Map<string, number>
  best: Map<string, number>
  winnersOf: Map<string, string[]>
  /** Quem subiu ao podio de cada play. */
  podiumOf: Map<string, string[]>
  decisions: MonthDecision[]
  closedMonths: string[]
}

/** O mes ja foi fechado (na mao, ou porque o calendario passou dele)? */
export function mesFechado(data: AppData, mes: string): boolean {
  if (data.closures.some((c) => c.month === mes)) return true
  return mes < monthOf(todayISO())
}

/** A escolha guardada no banco usa os nomes antigos; aqui viram usar/preservar. */
function acaoDe(c: StreakChoice | undefined): 'usar' | 'preservar' | null {
  if (!c) return null
  return c.action === 'sacar' ? 'usar' : 'preservar'
}

export function computeStreaks(data: AppData): Streaks {
  const escolhas = new Map(data.choices.map((c) => [`${c.player_id}:${c.month}`, c]))
  const finished = data.sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

  const current = new Map<string, number>()
  const lives = new Map<string, number>()
  const best = new Map<string, number>()
  const awards: StreakAward[] = []
  const steps: StreakStep[] = []
  const decisions: MonthDecision[] = []
  const closedMonths: string[] = []
  const winnersOf = new Map<string, string[]>()
  const podiumOf = new Map<string, string[]>()
  const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id

  const fecharMes = (mes: string) => {
    closedMonths.push(mes)
    for (const p of data.players) {
      const seq = current.get(p.id) ?? 0
      if (seq < 2) continue // sem status, nao ha o que decidir
      const escolha = escolhas.get(`${p.id}:${mes}`)
      // preservar e o padrao: usar o status e irreversivel, entao so acontece
      // quando alguem escolhe de proposito
      const action = acaoDe(escolha) ?? 'preservar'
      decisions.push({
        month: mes,
        player_id: p.id,
        streak: seq,
        value: streakValue(seq),
        action,
        respondido: Boolean(escolha),
      })
      if (action === 'usar') {
        awards.push({ month: mes, player_id: p.id, streak: seq, bonus: streakValue(seq) })
        current.set(p.id, 0)
        lives.set(p.id, 0)
      } else {
        lives.set(p.id, 1) // preservou: ganha uma vida (nao acumula)
      }
    }
  }

  let mesCorrente: string | null = null

  for (const s of finished) {
    const mes = monthOf(s.date)
    if (mesCorrente && mes !== mesCorrente) fecharMes(mesCorrente)
    mesCorrente = mes

    const ms = playedMatches(data, { sessionId: s.id })
    if (ms.length === 0) continue
    const rank = rankPlayers(computeStats(ms), nameOf)
    if (rank.length === 0) continue

    // campeas do dia (para os titulos e a arte do mes)
    const top = rank[0]
    const champions = rank.filter(
      (x) => x.points === top.points && balance(x) === balance(top) && x.wins === top.wins,
    )
    winnersOf.set(s.id, champions.map((c) => c.player_id))

    // podio do dia: o top 3, incluindo quem empata com a terceira
    const corte = rank[Math.min(PODIO, rank.length) - 1]
    const podio = rank.filter(
      (x) =>
        x.points > corte.points ||
        (x.points === corte.points && balance(x) >= balance(corte)),
    )
    const noPodio = new Set(podio.map((x) => x.player_id))
    podiumOf.set(s.id, [...noPodio])

    const jogaram = new Set<string>()
    for (const m of ms) for (const id of [...m.team_a, ...m.team_b]) jogaram.add(id)

    for (const p of data.players) {
      const seq = current.get(p.id) ?? 0
      if (noPodio.has(p.id)) {
        const nova = seq + 1
        current.set(p.id, nova)
        if (nova > (best.get(p.id) ?? 0)) best.set(p.id, nova)
        steps.push({
          session_id: s.id, date: s.date, player_id: p.id,
          streak: nova, usouVida: false, value: streakValue(nova),
        })
      } else if (seq >= 2 && jogaram.has(p.id) && (lives.get(p.id) ?? 0) > 0) {
        // veio, ficou fora do podio, mas tinha vida: o status sobrevive
        lives.set(p.id, 0)
        steps.push({
          session_id: s.id, date: s.date, player_id: p.id,
          streak: seq, usouVida: true, value: streakValue(seq),
        })
      } else {
        // faltou, ou ficou fora do podio sem vida: perde tudo
        current.set(p.id, 0)
        lives.set(p.id, 0)
      }
    }
  }

  // O ultimo mes fecha quando a organizadora aperta "finalizar o mes" ou,
  // como rede de seguranca, quando o calendario ja passou dele.
  const fechadoNaMao = new Set(data.closures.map((c) => c.month))
  if (mesCorrente && (fechadoNaMao.has(mesCorrente) || mesCorrente < monthOf(todayISO()))) {
    fecharMes(mesCorrente)
  }

  return { awards, steps, current, lives, best, winnersOf, podiumOf, decisions, closedMonths }
}

/** Soma no ranking os status usados no periodo. */
export function applyBonuses(
  stats: Map<string, PlayerStat>,
  awards: StreakAward[],
): Map<string, PlayerStat> {
  const out = new Map<string, PlayerStat>()
  for (const [id, s] of stats) out.set(id, { ...s })
  for (const a of awards) {
    const s = out.get(a.player_id)
    if (!s) continue
    s.points += a.bonus
    s.bonus += a.bonus
  }
  return out
}

/** Jogadoras com status vivo, da maior sequencia para a menor. */
export function onFire(
  streaks: Streaks,
): { player_id: string; streak: number; value: number; life: number }[] {
  return [...streaks.current.entries()]
    .filter(([, n]) => n >= 2)
    .map(([player_id, streak]) => ({
      player_id,
      streak,
      value: streakValue(streak),
      life: streaks.lives.get(player_id) ?? 0,
    }))
    .sort((a, b) => b.streak - a.streak)
}

export function choiceId(playerId: string, month: string): string {
  return `${playerId}:${month}`
}

export function newChoice(
  playerId: string,
  month: string,
  action: 'usar' | 'preservar',
  streak: number,
  value: number,
): StreakChoice {
  return {
    id: choiceId(playerId, month),
    player_id: playerId,
    month,
    action: action === 'usar' ? 'sacar' : 'continuar', // nomes ja gravados no banco
    streak,
    bonus: value,
    created_at: new Date().toISOString(),
  }
}
