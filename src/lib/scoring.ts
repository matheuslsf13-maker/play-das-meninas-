import type { Match } from './types'

/**
 * Pontuacao individual (regra do cartaz, partida ate 4 pontos, sem empate):
 *   4x0 -> 4 pontos | 4x1 -> 3 | 4x2 -> 2 | 4x3 -> 1
 * Ou seja: pontos = games do vencedor - games do perdedor (minimo 1).
 * Quem perde nao pontua. Generaliza para partidas ate N pontos.
 */
export function matchPoints(scoreA: number, scoreB: number): [number, number] {
  if (scoreA === scoreB) return [0, 0]
  const diff = Math.abs(scoreA - scoreB)
  const pts = Math.max(1, diff)
  return scoreA > scoreB ? [pts, 0] : [0, pts]
}

export function isPlayed(m: Match): boolean {
  return m.score_a !== null && m.score_b !== null && m.score_a !== m.score_b
}

export const POINTS_TABLE = [
  { label: '4 x 0', points: 4, color: '#f5c518' },
  { label: '4 x 1', points: 3, color: '#ef4b7d' },
  { label: '4 x 2', points: 2, color: '#6d3fa0' },
  { label: '4 x 3', points: 1, color: '#f28a2e' },
]
