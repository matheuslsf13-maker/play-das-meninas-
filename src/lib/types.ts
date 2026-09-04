export type Player = {
  id: string
  name: string
  photo_url: string | null
  active: boolean
  created_at: string
}

export type SessionStatus = 'open' | 'finished'

/** Um "Play de Sexta": um dia de jogos. */
export type PlaySession = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  courts: number
  rounds: number
  target: number // pontos para vencer a partida (padrao 4)
  player_ids: string[]
  status: SessionStatus
  created_at: string
}

export type Match = {
  id: string
  session_id: string
  round: number
  court: number
  team_a: [string, string]
  team_b: [string, string]
  score_a: number | null
  score_b: number | null
}

export type AppData = {
  players: Player[]
  sessions: PlaySession[]
  matches: Match[]
}

export const emptyData = (): AppData => ({ players: [], sessions: [], matches: [] })

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7) // YYYY-MM
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const name = MONTHS[Number(m) - 1] ?? m
  return `${name[0].toUpperCase()}${name.slice(1)} de ${y}`
}

export function dateLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split('-')
  return `${d}/${m}/${y}`
}
