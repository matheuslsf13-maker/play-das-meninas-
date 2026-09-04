import { useEffect } from 'react'

type WakeLockSentinel = { release: () => Promise<void>; released: boolean }
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } }

/**
 * Segura a tela acesa enquanto o play esta aberto -- a organizadora fica
 * lancando placar entre uma rodada e outra e o celular apagando atrapalha.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request('screen')
        if (cancelled) { void s.release(); return }
        sentinel = s
      } catch {
        /* navegador pode negar (bateria baixa, aba em segundo plano) */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel && !sentinel.released) void sentinel.release()
    }
  }, [active])
}
