import { computeStats, playedMatches, rankPlayers, type PlayerStat } from './stats'
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
  return 7
}

export type StreakLevel = { emoji: string; title: string }

export function streakLevel(streak: number): StreakLevel | null {
  if (streak <= 1) return null
  if (streak === 2) return { emoji: '🔥', title: 'Em chamas' }
  if (streak === 3) return { emoji: '🔥🔥', title: 'Pegando fogo' }
  if (streak === 4) return { emoji: '🔥🔥🔥', title: 'Imparável' }
  return { emoji: '👑🔥', title: 'Lenda do play' }
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
  /** Campea de cada play finalizado. */
  winnerOf: Map<string, string>
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
  const winnerOf = new Map<string, string>()
  const nameOf = (id: string) => data.players.find((p) => p.id === id)?.name ?? id

  for (const s of finished) {
    const ms = playedMatches(data, { sessionId: s.id })
    if (ms.length === 0) continue
    const rank = rankPlayers(computeStats(ms), nameOf)
    const champion = rank[0]
    if (!champion) continue
    winnerOf.set(s.id, champion.player_id)

    // quem nao venceu o dia zera a sequencia -- inclusive quem faltou ao play
    for (const p of data.players) {
      const next = p.id === champion.player_id ? (current.get(p.id) ?? 0) + 1 : 0
      current.set(p.id, next)
      if (next > (best.get(p.id) ?? 0)) best.set(p.id, next)
    }

    const streak = current.get(champion.player_id) ?? 1
    const bonus = streakBonus(streak)
    if (bonus > 0) {
      awards.push({ session_id: s.id, date: s.date, player_id: champion.player_id, streak, bonus })
    }
  }

  return { awards, current, best, winnerOf }
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
