import type { AppData, Match, PlaySession, Player, StreakChoice } from '../lib/types'

export interface Repo {
  readonly kind: 'local' | 'supabase'
  load(): Promise<AppData>
  savePlayer(p: Player): Promise<void>
  deletePlayer(id: string): Promise<void>
  saveSession(s: PlaySession): Promise<void>
  deleteSession(id: string): Promise<void>
  saveMatches(ms: Match[]): Promise<void>
  deleteMatchesOfSession(sessionId: string): Promise<void>
  saveChoice(choice: StreakChoice): Promise<void>
  uploadPhoto(playerId: string, file: File): Promise<string>
  /** Apaga o arquivo da foto. Silencioso se a url nao for do nosso storage. */
  deletePhoto(url: string): Promise<void>
  /** Notifica mudancas feitas por outras pessoas (so no modo online). */
  subscribe?(cb: () => void): () => void
}
