import type { PlayerStat } from './stats'
import { balance } from './stats'
import { dateLabel, monthLabel } from './types'

const MEDALS = ['🥇', '🥈', '🥉']

function line(i: number, name: string, s: PlayerStat): string {
  const medal = MEDALS[i] ?? `${i + 1}º`
  const bal = balance(s)
  const sign = bal > 0 ? '+' : ''
  return `${medal} ${name} — ${s.points} pts (${s.wins}V/${s.losses}D, saldo ${sign}${bal})`
}

export function monthRankingText(ym: string, rows: PlayerStat[], nameOf: (id: string) => string): string {
  const head = `🏆 RANKING DO MÊS — ${monthLabel(ym).toUpperCase()}\n_Play das Meninas · Super 8_\n`
  const body = rows.map((s, i) => line(i, nameOf(s.player_id), s)).join('\n')
  return `${head}\n${body}\n\nMais que um play, uma experiência! 💗`
}

export function dayRankingText(
  date: string,
  title: string,
  rows: PlayerStat[],
  nameOf: (id: string) => string,
): string {
  const head = `🎾 ${title.toUpperCase()} — ${dateLabel(date)}\nRanking do dia:\n`
  const body = rows.map((s, i) => line(i, nameOf(s.player_id), s)).join('\n')
  return `${head}\n${body}`
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
