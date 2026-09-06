import React from 'react'
import type { Player } from '../lib/types'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ player, size = 34 }: { player?: Player; size?: number }) {
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.38) }
  if (player?.photo_url) {
    return <img className="avatar" style={style} src={player.photo_url} alt={player.name} />
  }
  return <span className="avatar" style={style}>{player ? initials(player.name) : '?'}</span>
}

/**
 * Campo numerico com botoes - e +. No celular, digitar direto num
 * <input type=number> controlado e uma armadilha: apagar para trocar o valor
 * faz o campo saltar para o minimo e o proximo digito vira outro numero.
 * Aqui o texto digitado so e aplicado quando o campo perde o foco.
 */
export function Stepper({
  value,
  min,
  max,
  onChange,
  disabled,
  vazio,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  disabled?: boolean
  /** Texto no lugar do numero quando ainda nao ha o que mostrar. */
  vazio?: string
}) {
  const [rascunho, setRascunho] = React.useState<string | null>(null)
  const limitar = (n: number) => Math.min(max, Math.max(min, n))
  const aplicar = () => {
    const n = Number(rascunho)
    onChange(rascunho !== null && rascunho !== '' && Number.isFinite(n) ? limitar(n) : value)
    setRascunho(null)
  }
  return (
    <div className={`stepper${disabled ? ' off' : ''}`}>
      <button type="button" aria-label="diminuir" disabled={disabled || value <= min} onClick={() => onChange(limitar(value - 1))}>
        −
      </button>
      <input
        inputMode="numeric"
        value={rascunho ?? (vazio && value <= 0 ? vazio : String(value))}
        disabled={disabled}
        onFocus={(e) => { setRascunho(String(value)); e.currentTarget.select() }}
        onChange={(e) => setRascunho(e.target.value.replace(/\D/g, ''))}
        onBlur={aplicar}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <button type="button" aria-label="aumentar" disabled={disabled || value >= max} onClick={() => onChange(limitar(value + 1))}>
        +
      </button>
    </div>
  )
}

/**
 * Logo do campeonato. Enquanto o arquivo public/logo.png nao existir,
 * mostra um selo desenhado, para a tela nunca ficar com imagem quebrada.
 */
export function Logo({ size = 64 }: { size?: number }) {
  const [ok, setOk] = React.useState(true)
  if (ok) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="Play da Sexta"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', flex: 'none' }}
        onError={() => setOk(false)}
      />
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex: 'none' }} aria-label="Play da Sexta">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5c518" />
          <stop offset="1" stopColor="#ef4b7d" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#lg)" strokeWidth="4" />
      <circle cx="50" cy="42" r="24" fill="url(#lg)" />
      <path d="M32 30c10 8 10 18 0 26M68 30c-10 8-10 18 0 26" stroke="#141a3c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <rect x="30" y="34" width="40" height="11" rx="5" fill="#2b1b4d" />
      <text x="50" y="80" textAnchor="middle" fontSize="17" fontWeight="800" fill="#6d3fa0" fontFamily="system-ui, sans-serif">SEXTA</text>
    </svg>
  )
}

export function Empty({ icon = '🎾', children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="big">{icon}</span>
      {children}
    </div>
  )
}

export function StatBox({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="stat-box">
      <div className="v">{v}</div>
      <div className="k">{k}</div>
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <strong>{title}</strong>
          <button className="btn ghost sm" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="toast">{message}</div>
}

export function useToast() {
  const [msg, setMsg] = React.useState<string | null>(null)
  const show = React.useCallback((m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return { msg, show }
}

/** Copia texto e cai para um prompt quando a area de transferencia nao esta disponivel. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function shareOrCopy(text: string): Promise<boolean> {
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
  if (nav.share) {
    return nav.share({ text }).then(() => true).catch(() => copyText(text))
  }
  return copyText(text)
}
