import type { PlayerStat } from './stats'
import { balance } from './stats'
import { streakLevel } from './streaks'
import { dateLabel, monthLabel } from './types'

const MEDALS = ['🥇', '🥈', '🥉']

function line(i: number, name: string, s: PlayerStat, streak = 0): string {
  const medal = MEDALS[i] ?? `${i + 1}º`
  const bal = balance(s)
  const sign = bal > 0 ? '+' : ''
  const fire = streak >= 2 ? ` ${streakLevel(streak)?.emoji}` : ''
  const bonus = s.bonus > 0 ? ` [+${s.bonus} 🔥]` : ''
  return `${medal} ${name}${fire} — ${s.points} pts${bonus} (${s.wins}V/${s.losses}D, saldo ${sign}${bal})`
}

export function monthRankingText(
  ym: string,
  rows: PlayerStat[],
  nameOf: (id: string) => string,
  fire?: Map<string, number>,
): string {
  const head = `🏆 RANKING DO MÊS — ${monthLabel(ym).toUpperCase()}\n_Play das Meninas · Super 8_\n`
  const body = rows
    .map((s, i) => line(i, nameOf(s.player_id), s, fire?.get(s.player_id) ?? 0))
    .join('\n')
  const emChamas = rows
    .filter((s) => (fire?.get(s.player_id) ?? 0) >= 2)
    .map((s) => `${streakLevel(fire!.get(s.player_id) as number)?.emoji} ${nameOf(s.player_id)} venceu os ${fire!.get(s.player_id)} últimos plays!`)
    .join('\n')
  const extra = emChamas ? `\n\n${emChamas}` : ''
  return `${head}\n${body}${extra}\n\nMais que um play, uma experiência! 💗`
}

export function dayRankingText(
  date: string,
  title: string,
  rows: PlayerStat[],
  nameOf: (id: string) => string,
  award?: { player_id: string; streak: number; bonus: number },
): string {
  const head = `🎾 ${title.toUpperCase()} — ${dateLabel(date)}\nRanking do dia:\n`
  const body = rows.map((s, i) => line(i, nameOf(s.player_id), s)).join('\n')
  const lvl = award ? streakLevel(award.streak) : null
  const extra = award && lvl
    ? `\n\n${lvl.emoji} ${nameOf(award.player_id)} está ${lvl.title.toUpperCase()}: ${award.streak} plays seguidos vencendo e +${award.bonus} pontos de bônus no ranking do mês!`
    : ''
  return `${head}\n${body}${extra}`
}

export function scheduleText(
  date: string,
  title: string,
  rounds: { round: number; matches: { court: number; team_a: [string, string]; team_b: [string, string] }[]; byes: string[] }[],
  nameOf: (id: string) => string,
): string {
  const head = `🎾 ${title.toUpperCase()} — ${dateLabel(date)}\nDuplas de cada rodada:\n`
  const body = rounds
    .map((r) => {
      const games = r.matches
        .map(
          (m) =>
            `  Quadra ${m.court}: ${nameOf(m.team_a[0])} + ${nameOf(m.team_a[1])}  x  ${nameOf(m.team_b[0])} + ${nameOf(m.team_b[1])}`,
        )
        .join('\n')
      const bye = r.byes.length ? `\n  Folga: ${r.byes.map(nameOf).join(', ')}` : ''
      return `\n*Rodada ${r.round}*\n${games}${bye}`
    })
    .join('\n')
  return `${head}${body}\n\nBora jogar! 💗`
}
