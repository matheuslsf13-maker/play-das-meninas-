import type { AppData, Match, PlaySession, Player } from '../lib/types'

export interface Repo {
  readonly kind: 'local' | 'supabase'
  load(): Promise<AppData>
  savePlayer(p: Player): Promise<void>
  deletePlayer(id: string): Promise<void>
  saveSession(s: PlaySession): Promise<void>
  deleteSession(id: string): Promise<void>
  saveMatches(ms: Match[]): Promise<void>
  deleteMatchesOfSession(sessionId: string): Promise<void>
  uploadPhoto(playerId: string, file: File): Promise<string>
  /** Notifica mudancas feitas por outras pessoas (so no modo online). */
  subscribe?(cb: () => void): () => void
}
