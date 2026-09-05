export type Player = {
  id: string
  name: string
  photo_url: string | null
  active: boolean
  created_at: string
  /** Outras grafias que a lista do grupo ja usou para essa jogadora. */
  aliases?: string[]
}

export type SessionStatus = 'open' | 'finished'

/**
 * Formato do dia:
 *  - 'todas'  : rodizio unico, cada uma faz dupla com cada uma das outras;
 *  - 'grupos' : o mesmo rodizio, mas dentro de grupos formados por nivel.
 *               Os pontos continuam individuais e o ranking do dia e unico.
 */
export type PlayFormat = 'todas' | 'grupos'

/** Um "Play de Sexta": um dia de jogos. */
export type PlaySession = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  courts: number
  /**
   * Quantas partidas o play tem no total.
   * A coluna do banco se chama `rounds` de quando o play era organizado em
   * rodadas; hoje as partidas sao uma fila unica (ver DECISOES.md).
   */
  rounds: number
  target: number // pontos para vencer a partida (padrao 4)
  player_ids: string[]
  status: SessionStatus
  created_at: string
  format?: PlayFormat
  /** No modo em grupos, quem esta em cada grupo (o grupo 1 e o de nivel mais alto). */
  groups?: string[][] | null
}

export type Match = {
  id: string
  session_id: string
  /**
   * Posicao na fila de partidas do dia (1, 2, 3...).
   * A coluna do banco se chama `round` por historia; nao ha mais rodadas.
   */
  round: number
  /** Quadra em que a partida aconteceu. 0 = ainda nao entrou em quadra. */
  court: number
  team_a: [string, string]
  team_b: [string, string]
  score_a: number | null
  score_b: number | null
  /** Quando a partida entrou em quadra. Null = ainda nao comecou. */
  started_at?: string | null
  /** Quando o placar foi lancado. Alimenta o "quem esta fora ha mais tempo". */
  ended_at?: string | null
}

/**
 * Escolha da jogadora no fechamento do mes, quando ela esta em chamas:
 * sacar o bonus acumulado agora (e zerar a sequencia) ou continuar apostando
 * para valer mais la na frente.
 */
export type StreakChoice = {
  id: string // `${player_id}:${month}`
  player_id: string
  month: string // YYYY-MM do mes que fechou
  action: 'sacar' | 'continuar'
  streak: number // sequencia no momento da decisao
  bonus: number // bonus acumulado em jogo
  created_at: string
}

/**
 * Fechamento de mes feito na mao pela organizadora ("finalizar o mes").
 * Sem isso o mes so fecha quando o calendario vira, o que atrapalha testes e
 * impede fechar na ultima sexta, que e quando a premiacao acontece.
 */
export type MonthClosure = {
  id: string // o proprio mes, YYYY-MM
  month: string // YYYY-MM
  closed_at: string
}

export type AppData = {
  players: Player[]
  sessions: PlaySession[]
  matches: Match[]
  choices: StreakChoice[]
  closures: MonthClosure[]
}

export const emptyData = (): AppData => ({
  players: [], sessions: [], matches: [], choices: [], closures: [],
})

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
