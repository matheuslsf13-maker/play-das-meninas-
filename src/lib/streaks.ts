import { balance, computeStats, playedMatches, rankPlayers, type PlayerStat } from './stats'
import type { AppData } from './types'

/**
 * Bonus "em chamas": quem vence o ranking do dia varias vezes seguidas ganha
 * pontos extras no ranking do mes. O bonus e creditado no dia que estende a
 * sequencia, entao ele entra no mes daquele play.
 */
export function streakBonus(streak: number): number {
  if (streak <= 1) return 0
  if (streak === 2) return 2
  if (streak === 3) return 3
  if (streak === 4) return 5
  if (streak < 10) return 7
  return 10
}

export type StreakLevel = { emoji: string; title: string }

/** A escada de status, do primeiro fogo ate o topo. */
export const STREAK_LADDER = [
  { from: 2, to: 2, emoji: '🔥', title: 'Em chamas', bonus: 2 },
  { from: 3, to: 3, emoji: '🔥🔥', title: 'Pegando fogo', bonus: 3 },
  { from: 4, to: 4, emoji: '🔥🔥🔥', title: 'Imparável', bonus: 5 },
  { from: 5, to: 9, emoji: '👑🔥', title: 'Lenda do play', bonus: 7 },
  { from: 10, to: null, emoji: '👑💎', title: 'Rainha do Play', bonus: 10 },
] as const

export function streakLevel(streak: number): StreakLevel | null {
  if (streak <= 1) return null
  if (streak === 2) return { emoji: '🔥', title: 'Em chamas' }
  if (streak === 3) return { emoji: '🔥🔥', title: 'Pegando fogo' }
  if (streak === 4) return { emoji: '🔥🔥🔥', title: 'Imparável' }
  if (streak < 10) return { emoji: '👑🔥', title: 'Lenda do play' }
  return { emoji: '👑💎', title: 'Rainha do Play' }
}

/** O status maximo: 10 plays seguidos vencendo. */
export const MAX_STREAK = 10

export function isMaxLevel(streak: number): boolean {
  return streak >= MAX_STREAK
}

export type StreakAward = {
  session_id: string
  date: string
  player_id: string
  streak: number
  bonus: number
}

export type Streaks = {
  /** Bonus creditados, um por play vencido em sequencia. */
  awards: StreakAward[]
  /** Sequencia de vitorias em aberto de cada jogadora. */
  current: Map<string, number>
  /** Maior sequencia que cada jogadora ja teve. */
  best: Map<string, number>
  /** Campea(s) de cada play finalizado -- pode haver empate no topo. */
  winnersOf: Map<string, string[]>
}

/**
 * Percorre os plays finalizados em ordem de data e apura as sequencias.
 * So mantem o fogo aceso quem vence o dia: perder o dia OU faltar ao play
 * zera a sequencia.
 */
export function computeStreaks(data: AppData): Streaks {
  const finished = data.sessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

  const current = new Map<string, number>()
  const best = new Map<string, number>()
  const awards: StreakAward[] = []
  const winnersOf = new Map<string, string[]>()
  const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id

  for (const s of finished) {
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

    // quem nao venceu o dia zera a sequencia -- inclusive quem faltou ao play
    for (const p of data.players) {
      const next = isChampion.has(p.id) ? (current.get(p.id) ?? 0) + 1 : 0
      current.set(p.id, next)
      if (next > (best.get(p.id) ?? 0)) best.set(p.id, next)
    }

    for (const champion of champions) {
      const streak = current.get(champion.player_id) ?? 1
      const bonus = streakBonus(streak)
      if (bonus > 0) {
        awards.push({ session_id: s.id, date: s.date, player_id: champion.player_id, streak, bonus })
      }
    }
  }

  return { awards, current, best, winnersOf }
}

/** Soma os bonus do periodo na pontuacao do ranking. */
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

/** Jogadoras com sequencia em aberto, da maior para a menor. */
export function onFire(streaks: Streaks): { player_id: string; streak: number }[] {
  return [...streaks.current.entries()]
    .filter(([, n]) => n >= 2)
    .map(([player_id, streak]) => ({ player_id, streak }))
    .sort((a, b) => b.streak - a.streak)
}
