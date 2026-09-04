import { balance, computeStats, playedMatches, rankPlayers, type PlayerStat } from './stats'
import type { AppData, StreakChoice } from './types'
import { monthOf, todayISO } from './types'

/**
 * Bonus "em chamas": vencer o ranking do dia em sextas seguidas rende pontos
 * extras. O bonus fica ACUMULADO enquanto a sequencia esta viva e so entra no
 * ranking quando a jogadora saca, no fechamento do mes. Quebrar a sequencia
 * antes disso perde o acumulado -- e o risco da aposta.
 */
export function streakBonus(streak: number): number {
  if (streak <= 1) return 0
  if (streak === 2) return 2
  if (streak === 3) return 3
  if (streak === 4) return 5
  if (streak < 10) return 7
  if (streak < 20) return 10
  return 15
}

export type StreakLevel = { emoji: string; title: string }

/** A escada de status, do primeiro fogo ate o topo. */
export const STREAK_LADDER = [
  { from: 2, to: 2, emoji: '🔥', title: 'Em chamas', bonus: 2 },
  { from: 3, to: 3, emoji: '🔥🔥', title: 'Pegando fogo', bonus: 3 },
  { from: 4, to: 4, emoji: '🔥🔥🔥', title: 'Imparável', bonus: 5 },
  { from: 5, to: 9, emoji: '👑🔥', title: 'Lenda do play', bonus: 7 },
  { from: 10, to: 19, emoji: '👑💎', title: 'Rainha do Play', bonus: 10 },
  { from: 20, to: null, emoji: '👑🌟', title: 'Duquesa da V3', bonus: 15 },
] as const

export function streakLevel(streak: number): StreakLevel | null {
  if (streak <= 1) return null
  const faixa = [...STREAK_LADDER].reverse().find((x) => streak >= x.from)
  return faixa ? { emoji: faixa.emoji, title: faixa.title } : null
}

/** O status maximo: 20 sextas seguidas vencendo. */
export const MAX_STREAK = 20

export function isMaxLevel(streak: number): boolean {
  return streak >= MAX_STREAK
}

/** Bonus efetivamente creditado num mes (a jogadora sacou). */
export type StreakAward = {
  month: string
  player_id: string
  streak: number
  bonus: number
}

/** O que aconteceu com a sequencia de alguem num play. */
export type StreakStep = {
  session_id: string
  date: string
  player_id: string
  streak: number
  bonus: number // ganho neste play
  pending: number // acumulado depois deste play
}

/** Decisao de fechamento de mes: ja tomada ou ainda pendente. */
export type MonthDecision = {
  month: string
  player_id: string
  streak: number
  bonus: number
  action: 'sacar' | 'continuar'
  respondido: boolean
}

export type Streaks = {
  awards: StreakAward[]
  steps: StreakStep[]
  /** Sequencia viva de cada jogadora. */
  current: Map<string, number>
  /** Bonus acumulado ainda nao sacado. */
  pending: Map<string, number>
  best: Map<string, number>
  winnersOf: Map<string, string[]>
  decisions: MonthDecision[]
  closedMonths: string[]
}

export function computeStreaks(data: AppData): Streaks {
  const escolhas = new Map(data.choices.map((c) => [`${c.player_id}:${c.month}`, c]))
  const finished = data.sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

  const current = new Map<string, number>()
  const pending = new Map<string, number>()
  const best = new Map<string, number>()
  const awards: StreakAward[] = []
  const steps: StreakStep[] = []
  const decisions: MonthDecision[] = []
  const closedMonths: string[] = []
  const winnersOf = new Map<string, string[]>()
  const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id

  /** No fim do mes, quem esta em chamas saca ou continua apostando. */
  const fecharMes = (mes: string) => {
    closedMonths.push(mes)
    for (const p of data.players) {
      const seq = current.get(p.id) ?? 0
      if (seq < 2) continue // sem fogo, nao ha o que decidir
      const acumulado = pending.get(p.id) ?? 0
      const escolha = escolhas.get(`${p.id}:${mes}`)
      const action = escolha?.action ?? 'sacar' // sem resposta, o seguro: saca
      decisions.push({
        month: mes,
        player_id: p.id,
        streak: seq,
        bonus: acumulado,
        action,
        respondido: Boolean(escolha),
      })
      if (action === 'sacar') {
        if (acumulado > 0) awards.push({ month: mes, player_id: p.id, streak: seq, bonus: acumulado })
        current.set(p.id, 0)
        pending.set(p.id, 0)
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
    const top = rank[0]
    if (!top) continue

    // empate real no topo (mesmos pontos, saldo e vitorias) da o dia as duas:
    // desempatar por ordem alfabetica seria sorte, nao merito
    const champions = rank.filter(
      (x) => x.points === top.points && balance(x) === balance(top) && x.wins === top.wins,
    )
    const isChampion = new Set(champions.map((c) => c.player_id))
    winnersOf.set(s.id, [...isChampion])

    for (const p of data.players) {
      if (isChampion.has(p.id)) {
        const seq = (current.get(p.id) ?? 0) + 1
        const ganho = streakBonus(seq)
        const acumulado = (pending.get(p.id) ?? 0) + ganho
        current.set(p.id, seq)
        pending.set(p.id, acumulado)
        if (seq > (best.get(p.id) ?? 0)) best.set(p.id, seq)
        steps.push({ session_id: s.id, date: s.date, player_id: p.id, streak: seq, bonus: ganho, pending: acumulado })
      } else {
        // perdeu o dia ou faltou: zera a sequencia e o que estava apostado
        current.set(p.id, 0)
        pending.set(p.id, 0)
      }
    }
  }

  // mes ja virado no calendario tambem fecha, mesmo sem play no mes seguinte:
  // a premiacao acontece na ultima semana, nao da para esperar a proxima sexta
  if (mesCorrente && mesCorrente < monthOf(todayISO())) fecharMes(mesCorrente)

  return { awards, steps, current, pending, best, winnersOf, decisions, closedMonths }
}

/** Soma no ranking os bonus sacados no periodo. */
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

/** Jogadoras com sequencia viva, da maior para a menor. */
export function onFire(streaks: Streaks): { player_id: string; streak: number; pending: number }[] {
  return [...streaks.current.entries()]
    .filter(([, n]) => n >= 2)
    .map(([player_id, streak]) => ({ player_id, streak, pending: streaks.pending.get(player_id) ?? 0 }))
    .sort((a, b) => b.streak - a.streak)
}

export function choiceId(playerId: string, month: string): string {
  return `${playerId}:${month}`
}

export function newChoice(
  playerId: string,
  month: string,
  action: 'sacar' | 'continuar',
  streak: number,
  bonus: number,
): StreakChoice {
  return {
    id: choiceId(playerId, month),
    player_id: playerId,
    month,
    action,
    streak,
    bonus,
    created_at: new Date().toISOString(),
  }
}
