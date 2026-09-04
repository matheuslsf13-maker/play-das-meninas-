import type { Match, PlaySession, Player, StreakChoice } from '../lib/types'

/**
 * Operacoes de escrita em formato serializavel: assim a fila sobrevive a um
 * refresh ou a um celular sem sinal no meio do play.
 */
export type WriteOp =
  | { id: string; type: 'savePlayer'; player: Player }
  | { id: string; type: 'deletePlayer'; playerId: string }
  | { id: string; type: 'saveSession'; session: PlaySession }
  | { id: string; type: 'deleteSession'; sessionId: string }
  | { id: string; type: 'saveMatches'; matches: Match[] }
  | { id: string; type: 'replaceSessionMatches'; sessionId: string; matches: Match[] }
  | { id: string; type: 'saveChoice'; choice: StreakChoice }
  | { id: string; type: 'mergePlayers'; fromId: string; intoId: string; matches: Match[]; sessions: PlaySession[] }

const QUEUE_KEY = 'play-das-meninas:queue'
const CACHE_KEY = 'play-das-meninas:cache'

export function loadQueue(): WriteOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as WriteOp[]) : []
  } catch {
    return []
  }
}

export function saveQueue(ops: WriteOp[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
  } catch {
    /* sem espaco: a fila continua so em memoria */
  }
}

export function loadCache<T>(): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveCache(data: unknown) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    /* sem espaco: segue sem cache offline */
  }
}
