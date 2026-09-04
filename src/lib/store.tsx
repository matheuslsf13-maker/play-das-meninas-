import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { localRepo } from '../data/localRepo'
import type { Repo } from '../data/repo'
import { supabaseRepo } from '../data/supabaseRepo'
import { hasSupabase, supabase } from './supabase'
import type { AppData, Match, PlaySession, Player } from './types'
import { emptyData } from './types'

type Ctx = {
  data: AppData
  loading: boolean
  error: string | null
  online: boolean
  canEdit: boolean
  userEmail: string | null
  reload: () => Promise<void>
  repo: Repo
  savePlayer: (p: Player) => Promise<void>
  deletePlayer: (id: string) => Promise<void>
  saveSession: (s: PlaySession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  saveMatches: (ms: Match[]) => Promise<void>
  replaceSessionMatches: (sessionId: string, ms: Match[]) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  playerById: (id: string) => Player | undefined
  nameOf: (id: string) => string
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const repo = hasSupabase ? supabaseRepo : localRepo
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const reloadTimer = useRef<number | null>(null)

  const reload = useCallback(async () => {
    try {
      setError(null)
      const d = await repo.load()
      setData(d)
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data: s }) => setUserEmail(s.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserEmail(s?.user.email ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!repo.subscribe) return
    return repo.subscribe(() => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
      reloadTimer.current = window.setTimeout(() => void reload(), 400)
    })
  }, [repo, reload])

  const wrap = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        setError(null)
        await fn()
        await reload()
      } catch (e) {
        setError(messageOf(e))
        throw e
      }
    },
    [reload],
  )

  const value = useMemo<Ctx>(() => {
    const byId = new Map(data.players.map((p) => [p.id, p]))
    return {
      data,
      loading,
      error,
      repo,
      online: repo.kind === 'supabase',
      canEdit: repo.kind === 'local' || userEmail !== null,
      userEmail,
      reload,
      savePlayer: (p) => wrap(() => repo.savePlayer(p)),
      deletePlayer: (id) => wrap(() => repo.deletePlayer(id)),
      saveSession: (s) => wrap(() => repo.saveSession(s)),
      deleteSession: (id) => wrap(() => repo.deleteSession(id)),
      saveMatches: (ms) => wrap(() => repo.saveMatches(ms)),
      replaceSessionMatches: (sessionId, ms) =>
        wrap(async () => {
          await repo.deleteMatchesOfSession(sessionId)
          await repo.saveMatches(ms)
        }),
      signIn: async (email, password) => {
        if (!supabase) return
        const { error: e } = await supabase.auth.signInWithPassword({ email, password })
        if (e) throw e
      },
      signOut: async () => {
        if (!supabase) return
        await supabase.auth.signOut()
      },
      playerById: (id) => byId.get(id),
      nameOf: (id) => byId.get(id)?.name ?? '—',
    }
  }, [data, loading, error, repo, userEmail, reload, wrap])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore precisa estar dentro de <StoreProvider>')
  return ctx
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
