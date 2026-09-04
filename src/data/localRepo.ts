import type { AppData, Match, PlaySession, Player } from '../lib/types'
import { emptyData } from '../lib/types'
import type { Repo } from './repo'

const KEY = 'play-das-meninas:v1'

function read(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      players: parsed.players ?? [],
      sessions: parsed.sessions ?? [],
      matches: parsed.matches ?? [],
    }
  } catch {
    return emptyData()
  }
}

function write(d: AppData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch (e) {
    console.error('nao foi possivel salvar localmente', e)
  }
}

export const localRepo: Repo = {
  kind: 'local',
  async load() {
    return read()
  },
  async savePlayer(p: Player) {
    const d = read()
    const i = d.players.findIndex((x) => x.id === p.id)
    if (i >= 0) d.players[i] = p
    else d.players.push(p)
    write(d)
  },
  async deletePlayer(id: string) {
    const d = read()
    d.players = d.players.filter((p) => p.id !== id)
    write(d)
  },
  async saveSession(s: PlaySession) {
    const d = read()
    const i = d.sessions.findIndex((x) => x.id === s.id)
    if (i >= 0) d.sessions[i] = s
    else d.sessions.push(s)
    write(d)
  },
  async deleteSession(id: string) {
    const d = read()
    d.sessions = d.sessions.filter((s) => s.id !== id)
    d.matches = d.matches.filter((m) => m.session_id !== id)
    write(d)
  },
  async saveMatches(ms: Match[]) {
    const d = read()
    for (const m of ms) {
      const i = d.matches.findIndex((x) => x.id === m.id)
      if (i >= 0) d.matches[i] = m
      else d.matches.push(m)
    }
    write(d)
  },
  async deleteMatchesOfSession(sessionId: string) {
    const d = read()
    d.matches = d.matches.filter((m) => m.session_id !== sessionId)
    write(d)
  },
  async deletePhoto(_url: string) {
    // no modo local a foto vive dentro do proprio registro da jogadora
  },
  async uploadPhoto(_playerId: string, file: File) {
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error)
      fr.readAsDataURL(file)
    })
  },
}
