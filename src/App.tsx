import { useState } from 'react'
import { Modal, Toast, useToast } from './components/ui'
import { useStore } from './lib/store'
import Play from './pages/Play'
import Players from './pages/Players'
import Ranking from './pages/Ranking'
import Stats from './pages/Stats'

type Tab = 'ranking' | 'play' | 'players' | 'stats'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'play', label: 'Play', icon: '🎾' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'players', label: 'Meninas', icon: '👯' },
]

export default function App() {
  const { loading, error, online, canEdit, userEmail, signIn, signOut, sync, pendingCount } = useStore()
  const [tab, setTab] = useState<Tab>('ranking')
  const [login, setLogin] = useState(false)
  const { msg, show } = useToast()

  return (
    <div className="app">
      <header className="topbar">
        <div className="row spread">
          <div>
            <h1>Play <span>das Meninas</span></h1>
            <div className="sub">
              <span>Super 8 · V3 Arena</span>
              {online && canEdit ? (
                <span className={`sync ${sync}`}>
                  <span className="dot" />
                  {sync === 'saved' ? 'tudo salvo' : sync === 'saving' ? 'salvando…' : `${pendingCount} para enviar`}
                </span>
              ) : (
                <>
                  <span className={`dot ${online ? 'on' : 'off'}`} />
                  <span>{online ? 'só leitura' : 'modo local'}</span>
                </>
              )}
            </div>
          </div>
          {online && (
            userEmail
              ? <button className="btn ghost sm" onClick={() => void signOut()}>Sair</button>
              : <button className="btn ghost sm" onClick={() => setLogin(true)}>Entrar</button>
          )}
        </div>
      </header>

      {pendingCount > 0 ? (
        <div className="banner warn">
          📶 Sem conexão no momento — <strong>{pendingCount} alteração(ões)</strong> guardada(s) no celular.
          Pode continuar lançando: assim que o sinal voltar eu envio tudo sozinho.
        </div>
      ) : (
        error && <div className="banner err">{error}</div>
      )}
      {online && !canEdit && (
        <div className="banner warn">
          Você está vendo o ranking em modo leitura. Quem organiza o play entra em <strong>Entrar</strong> para lançar os resultados.
        </div>
      )}
      {!online && (
        <div className="banner warn">
          Modo local: os dados ficam salvos só neste navegador. Configure o Supabase (veja o README) para todo mundo do grupo acessar.
        </div>
      )}

      {loading ? (
        <div className="card"><div className="empty">Carregando…</div></div>
      ) : (
        <main>
          {tab === 'ranking' && <Ranking onToast={show} />}
          {tab === 'play' && <Play onToast={show} />}
          {tab === 'stats' && <Stats />}
          {tab === 'players' && <Players onToast={show} />}
        </main>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="ic">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {login && <LoginModal onClose={() => setLogin(false)} onDone={() => { setLogin(false); show('Bem-vinda! 💗') }} signIn={signIn} />}
      <Toast message={msg} />
    </div>
  )
}

function LoginModal({
  onClose,
  onDone,
  signIn,
}: {
  onClose: () => void
  onDone: () => void
  signIn: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await signIn(email.trim(), password)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não consegui entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Entrar como organizadora" onClose={onClose}>
      <div className="stack">
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input className="input" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
        </label>
        {err && <div className="banner err" style={{ margin: 0 }}>{err}</div>}
        <button className="btn pink block" disabled={busy || !email || !password} onClick={() => void submit()}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          Só quem organiza precisa entrar. As outras meninas abrem o link e já veem o ranking.
        </p>
      </div>
    </Modal>
  )
}
