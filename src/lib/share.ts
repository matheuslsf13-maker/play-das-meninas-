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
  const head = `🏆 RANKING DO MÊS — ${monthLabel(ym).toUpperCase()}\n_Play da Sexta · Beach Tennis_\n`
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
  award?: { player_id: string; streak: number; value: number },
): string {
  const head = `🎾 ${title.toUpperCase()} — ${dateLabel(date)}\nRanking do dia:\n`
  const body = rows.map((s, i) => line(i, nameOf(s.player_id), s)).join('\n')
  const lvl = award ? streakLevel(award.streak) : null
  const extra = award && lvl
    ? `\n\n${lvl.emoji} ${nameOf(award.player_id)} é ${lvl.title.toUpperCase()}: ${award.streak} sextas seguidas no pódio, status valendo ${award.value} pontos!`
    : ''
  return `${head}\n${body}${extra}`
}

/**
 * A ordem das partidas para mandar no grupo. Nao ha rodadas: a lista e a fila,
 * e cada partida entra na quadra que vagar primeiro.
 */
export function scheduleText(
  date: string,
  title: string,
  courts: number,
  partidas: { round: number; team_a: [string, string]; team_b: [string, string] }[],
  nameOf: (id: string) => string,
  grupos?: string[][] | null,
): string {
  const head =
    `🎾 ${title.toUpperCase()} — ${dateLabel(date)}\n` +
    `${partidas.length} partidas · ${courts} quadra(s)\n` +
    `As partidas entram na ordem, conforme as quadras vão vagando.\n`

  const emGrupos = Boolean(grupos && grupos.length > 1)
  const grupoDe = new Map<string, number>()
  grupos?.forEach((g, i) => g.forEach((id) => grupoDe.set(id, i + 1)))
  const listaGrupos = emGrupos
    ? `\n*Grupos*\n${(grupos as string[][])
        .map((g, i) => `Grupo ${i + 1}: ${g.map(nameOf).join(', ')}`)
        .join('\n')}\n`
    : ''

  const corpo = [...partidas]
    .sort((a, b) => a.round - b.round)
    .map((m) => {
      const g = grupoDe.get(m.team_a[0])
      const tag = emGrupos && g ? `[G${g}] ` : ''
      const n = String(m.round).padStart(2, ' ')
      return `${n}. ${tag}${nameOf(m.team_a[0])} + ${nameOf(m.team_a[1])}  x  ${nameOf(m.team_b[0])} + ${nameOf(m.team_b[1])}`
    })
    .join('\n')

  return `${head}${listaGrupos}\n*Ordem das partidas*\n${corpo}\n\nBora jogar! 💗`
}

