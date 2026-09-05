import { useMemo, useState } from 'react'
import { Avatar, Empty, Modal, StatBox } from '../components/ui'
import {
  avgPoints,
  balance,
  computeStats,
  duoMatches,
  duoStats,
  emptyStat,
  opponentStats,
  partnerStats,
  playedMatches,
  winRate,
  type DuoStat,
  type PairKeyStat,
} from '../lib/stats'
import { matchPoints } from '../lib/scoring'
import { applyBonuses, computeStreaks, streakLevel, streakValue } from '../lib/streaks'
import { useStore } from '../lib/store'
import { dateLabel, monthLabel, monthOf } from '../lib/types'

type Modo = 'jogadora' | 'duplas'

export default function Stats() {
  const { data } = useStore()

  const months = useMemo(() => {
    const set = new Set(data.sessions.map((s) => monthOf(s.date)))
    return [...set].sort().reverse()
  }, [data.sessions])

  const [modo, setModo] = useState<Modo>('jogadora')
  const [period, setPeriod] = useState<string>('all')
  const [playerId, setPlayerId] = useState<string>('')

  const matches = useMemo(
    () => playedMatches(data, period === 'all' ? {} : { month: period }),
    [data, period],
  )
  const streaks = useMemo(() => computeStreaks(data), [data])
  const stats = useMemo(() => {
    const awards = period === 'all' ? streaks.awards : streaks.awards.filter((a) => a.month === period)
    return applyBonuses(computeStats(matches), awards)
  }, [matches, streaks, period])

  const comJogo = useMemo(
    () => [...data.players].filter((p) => (stats.get(p.id)?.matches ?? 0) > 0),
    [data.players, stats],
  )
  const selected = playerId || comJogo[0]?.id || data.players[0]?.id || ''

  if (data.players.length === 0) {
    return (
      <div className="card">
        <Empty icon="📊">Cadastre as jogadoras e registre um play para ver as estatísticas.</Empty>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <div className="segmented">
          <button className={modo === 'jogadora' ? 'on' : ''} onClick={() => setModo('jogadora')}>
            👤 Por jogadora
          </button>
          <button className={modo === 'duplas' ? 'on' : ''} onClick={() => setModo('duplas')}>
            🤝 Por dupla
          </button>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Período</span>
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">🏅 Histórico completo</option>
            {months.map((m, i) => (
              <option key={m} value={m}>
                {i === 0 ? `${monthLabel(m)} (mês atual)` : monthLabel(m)}
              </option>
            ))}
          </select>
          <em className="hint">
            O ranking zera todo mês, mas as partidas ficam guardadas para sempre — é o histórico
            completo que o app usa para montar as duplas equilibradas.
          </em>
        </label>
      </div>

      {modo === 'jogadora' ? (
        <PainelJogadora
          selected={selected}
          setPlayerId={setPlayerId}
          matches={matches}
          stats={stats}
          streaks={streaks}
          period={period}
        />
      ) : (
        <PainelDuplas matches={matches} />
      )}
    </>
  )
}

/* ------------------------------------------------------- por jogadora */

function PainelJogadora({
  selected,
  setPlayerId,
  matches,
  stats,
  streaks,
  period,
}: {
  selected: string
  setPlayerId: (id: string) => void
  matches: ReturnType<typeof playedMatches>
  stats: ReturnType<typeof computeStats>
  streaks: ReturnType<typeof computeStreaks>
  period: string
}) {
  const { data, nameOf, playerById } = useStore()
  const partners = useMemo(() => partnerStats(matches), [matches])
  const opponents = useMemo(() => opponentStats(matches), [matches])

  const s = stats.get(selected) ?? emptyStat(selected)
  const meusPares = sortPairs(partners.get(selected))
  const meusRivais = sortPairs(opponents.get(selected))

  const melhorPar = meusPares.filter((p) => p.wins > 0).sort((a, b) => b.wins - a.wins || b.points - a.points)[0]
  const parDificil = meusPares.filter((p) => p.losses > 0).sort((a, b) => b.losses - a.losses || rate(a) - rate(b))[0]
  const freguesa = meusRivais.filter((p) => p.wins > 0).sort((a, b) => b.wins - a.wins || rate(b) - rate(a))[0]
  const pedra = meusRivais.filter((p) => p.losses > 0).sort((a, b) => b.losses - a.losses || rate(a) - rate(b))[0]

  const seq = streaks.current.get(selected) ?? 0
  const melhorSeq = streaks.best.get(selected) ?? 0
  const vidas = streaks.lives.get(selected) ?? 0
  const nivel = streakLevel(seq)
  const dataDaSessao = new Map(data.sessions.map((x) => [x.id, x.date]))
  const noPeriodo = (sid: string) => period === 'all' || monthOf(dataDaSessao.get(sid) ?? '') === period
  const diasVencidos = [...streaks.winnersOf.entries()].filter(([sid, ids]) => ids.includes(selected) && noPeriodo(sid)).length
  const podios = [...streaks.podiumOf.entries()].filter(([sid, ids]) => ids.includes(selected) && noPeriodo(sid)).length
  const statusUsados = streaks.awards.filter((a) => a.player_id === selected && (period === 'all' || a.month === period))

  return (
    <>
      <div className="card">
        <label className="field">
          <span>Jogadora</span>
          <select className="select" value={selected} onChange={(e) => setPlayerId(e.target.value)}>
            {[...data.players]
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </label>

        <div className="row" style={{ margin: '14px 0 12px' }}>
          <Avatar player={playerById(selected)} size={62} />
          <div className="grow">
            <div style={{ fontSize: 19, fontWeight: 800 }} className="ellipsis">{nameOf(selected)}</div>
            <div className="small muted">
              {s.days} play(s) · {avgPoints(s).toFixed(2)} pontos por partida
            </div>
            {nivel && (
              <div className="tiny" style={{ color: 'var(--pink)', fontWeight: 800, marginTop: 2 }}>
                {nivel.emoji} {nivel.title} · vale {streakValue(seq)} pts
                {vidas > 0 && ' · 💚 1 vida'}
              </div>
            )}
          </div>
        </div>

        <Barra titulo="Aproveitamento" pct={winRate(s)} legenda={`${s.wins}V · ${s.losses}D em ${s.matches} partidas`} />

        <div className="grid3" style={{ marginTop: 12 }}>
          <StatBox k="Pontos" v={s.points} />
          <StatBox k="Saldo" v={balance(s) > 0 ? `+${balance(s)}` : balance(s)} />
          <StatBox k="Games" v={`${s.gamesWon}/${s.gamesLost}`} />
        </div>
      </div>

      <div className="card">
        <div className="section-title">🔥 Sequência e status</div>
        <div className="grid3">
          <StatBox k="Sequência" v={seq} />
          <StatBox k="Melhor seq." v={melhorSeq} />
          <StatBox k="Vidas" v={vidas > 0 ? '💚 1' : '—'} />
          <StatBox k="Pódios" v={podios} />
          <StatBox k="Dias vencidos" v={diasVencidos} />
          <StatBox k="Bônus" v={s.bonus > 0 ? `+${s.bonus}` : 0} />
        </div>
        {statusUsados.length > 0 ? (
          <div className="stack" style={{ marginTop: 10 }}>
            {statusUsados.map((a) => {
              const lvl = streakLevel(a.streak)
              return (
                <div key={a.month} className="tiny" style={{ background: '#fff3d6', color: '#7a5606', borderRadius: 10, padding: '8px 10px' }}>
                  {lvl?.emoji} usou <strong>{lvl?.title}</strong> no fechamento de {monthLabel(a.month)} — <strong>+{a.bonus} pts</strong>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Terminar a sexta no pódio mantém o status. Ele vira pontos só quando ela usa, no fechamento do mês.
          </p>
        )}
      </div>

      <div className="card">
        <div className="section-title">💫 Destaques</div>
        {meusPares.length === 0 && meusRivais.length === 0 ? (
          <Empty icon="🏐">Sem partidas neste período.</Empty>
        ) : (
          <div className="stack">
            <Destaque icone="🤝" rotulo="Melhor parceria" par={melhorPar} tipo="parceira" />
            <Destaque icone="😅" rotulo="Parceria mais difícil" par={parDificil} tipo="parceira" />
            <Destaque icone="🎯" rotulo="Ganha mais de" par={freguesa} tipo="rival" />
            <Destaque icone="🔥" rotulo="Perde mais para" par={pedra} tipo="rival" />
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">🤝 Com quem já jogou</div>
        <TabelaPares linhas={meusPares} primeira="Parceira" />
      </div>

      <div className="card">
        <div className="section-title">⚔️ Contra quem já jogou</div>
        <TabelaPares linhas={meusRivais} primeira="Adversária" />
      </div>
    </>
  )
}

/* ---------------------------------------------------------- por dupla */

type Ordem = 'jogos' | 'aproveitamento' | 'pontos'

function PainelDuplas({ matches }: { matches: ReturnType<typeof playedMatches> }) {
  const { nameOf, playerById } = useStore()
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('jogos')
  const [aberta, setAberta] = useState<DuoStat | null>(null)

  const duplas = useMemo(() => [...duoStats(matches).values()], [matches])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtradas = termo
      ? duplas.filter((d) => `${nameOf(d.a)} ${nameOf(d.b)}`.toLowerCase().includes(termo))
      : duplas
    const aprov = (d: DuoStat) => (d.matches === 0 ? 0 : d.wins / d.matches)
    return [...filtradas].sort((a, b) => {
      if (ordem === 'pontos') return b.points - a.points || b.matches - a.matches
      if (ordem === 'aproveitamento') return aprov(b) - aprov(a) || b.matches - a.matches
      return b.matches - a.matches || b.wins - a.wins
    })
  }, [duplas, busca, ordem, nameOf])

  if (duplas.length === 0) {
    return (
      <div className="card">
        <Empty icon="🤝">Nenhuma dupla se formou neste período ainda.</Empty>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <div className="section-title">🤝 Duplas que já jogaram juntas ({duplas.length})</div>
        <input
          className="input"
          placeholder="Buscar por nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          {([['jogos', 'Mais jogos'], ['aproveitamento', 'Melhor %'], ['pontos', 'Mais pontos']] as [Ordem, string][]).map(
            ([id, txt]) => (
              <button key={id} className={`chip ${ordem === id ? 'on' : 'off'}`} onClick={() => setOrdem(id)}>
                {txt}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="card">
        {lista.length === 0 ? (
          <Empty icon="🔎">Nenhuma dupla com esse nome.</Empty>
        ) : (
          <div className="stack">
            {lista.slice(0, 40).map((d) => {
              const pct = d.matches === 0 ? 0 : d.wins / d.matches
              return (
                <button key={d.key} className="duo-row" onClick={() => setAberta(d)}>
                  <span className="duo-fotos">
                    <Avatar player={playerById(d.a)} size={30} />
                    <Avatar player={playerById(d.b)} size={30} />
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="duo-nomes ellipsis">{nameOf(d.a)} + {nameOf(d.b)}</span>
                    <span className="mini-barra"><i style={{ width: `${Math.round(pct * 100)}%` }} /></span>
                    <span className="tiny muted">{d.matches} jogo(s) · {d.wins}V {d.losses}D · {d.points} pts</span>
                  </span>
                  <span className="duo-pct">{Math.round(pct * 100)}%</span>
                </button>
              )
            })}
            {lista.length > 40 && (
              <p className="tiny muted center" style={{ margin: 0 }}>
                mostrando as 40 primeiras de {lista.length} — use a busca para achar uma dupla
              </p>
            )}
          </div>
        )}
      </div>

      {aberta && <DetalheDupla duo={aberta} matches={matches} onClose={() => setAberta(null)} />}
    </>
  )
}

function DetalheDupla({
  duo,
  matches,
  onClose,
}: {
  duo: DuoStat
  matches: ReturnType<typeof playedMatches>
  onClose: () => void
}) {
  const { data, nameOf, playerById } = useStore()
  const jogos = useMemo(() => duoMatches(matches, duo.a, duo.b), [matches, duo])
  const dataDaSessao = new Map(data.sessions.map((s) => [s.id, s.date]))
  const pct = duo.matches === 0 ? 0 : duo.wins / duo.matches

  // contra quem essa dupla mais jogou
  const rivais = useMemo(() => {
    const m = new Map<string, { key: string; a: string; b: string; v: number; d: number }>()
    for (const j of jogos) {
      const somosA = j.team_a.includes(duo.a) && j.team_a.includes(duo.b)
      const outros = (somosA ? j.team_b : j.team_a) as [string, string]
      const key = [...outros].sort().join('|')
      const e = m.get(key) ?? { key, a: outros[0], b: outros[1], v: 0, d: 0 }
      const venceu = somosA ? (j.score_a as number) > (j.score_b as number) : (j.score_b as number) > (j.score_a as number)
      if (venceu) e.v++
      else e.d++
      m.set(key, e)
    }
    return [...m.values()].sort((x, y) => y.v + y.d - (x.v + x.d))
  }, [jogos, duo])

  return (
    <Modal title={`${nameOf(duo.a)} + ${nameOf(duo.b)}`} onClose={onClose}>
      <div className="row center" style={{ justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar player={playerById(duo.a)} size={52} />
        <Avatar player={playerById(duo.b)} size={52} />
      </div>
      <div className="grid3">
        <StatBox k="Jogos" v={duo.matches} />
        <StatBox k="Vitórias" v={duo.wins} />
        <StatBox k="Aproveit." v={`${Math.round(pct * 100)}%`} />
        <StatBox k="Pontos" v={duo.points} />
        <StatBox k="Games" v={`${duo.gamesWon}/${duo.gamesLost}`} />
        <StatBox k="Plays" v={duo.sessions.size} />
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>⚔️ Contra quem jogaram</div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th style={{ textAlign: 'left' }}>Dupla adversária</th><th>V</th><th>D</th></tr></thead>
          <tbody>
            {rivais.map((r) => (
              <tr key={r.key}>
                <td className="ellipsis">{nameOf(r.a)} + {nameOf(r.b)}</td>
                <td>{r.v}</td>
                <td>{r.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>📅 Partidas</div>
      <div className="stack">
        {jogos.map((j) => {
          const somosA = j.team_a.includes(duo.a) && j.team_a.includes(duo.b)
          const nosso = somosA ? (j.score_a as number) : (j.score_b as number)
          const deles = somosA ? (j.score_b as number) : (j.score_a as number)
          const outros = (somosA ? j.team_b : j.team_a) as [string, string]
          const [pa, pb] = matchPoints(j.score_a as number, j.score_b as number)
          const nossosPts = somosA ? pa : pb
          return (
            <div key={j.id} className="row tiny" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
              <span className="muted nowrap">{dateLabel(dataDaSessao.get(j.session_id) ?? '')}</span>
              <span className="grow ellipsis">vs {nameOf(outros[0])} + {nameOf(outros[1])}</span>
              <strong style={{ color: nosso > deles ? 'var(--teal)' : 'var(--muted)' }}>{nosso} x {deles}</strong>
              {nossosPts > 0 && <span style={{ color: 'var(--pink)', fontWeight: 800 }}>+{nossosPts}</span>}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------- apoio */

function Barra({ titulo, pct, legenda }: { titulo: string; pct: number; legenda: string }) {
  return (
    <div>
      <div className="row spread tiny muted" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{titulo}</span>
        <span style={{ fontWeight: 800, color: 'var(--pink)' }}>{Math.round(pct * 100)}%</span>
      </div>
      <div className="barra"><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      <div className="tiny muted" style={{ marginTop: 4 }}>{legenda}</div>
    </div>
  )
}

function rate(p: PairKeyStat): number {
  return p.matches === 0 ? 0 : p.wins / p.matches
}

function sortPairs(m: Map<string, PairKeyStat> | undefined): PairKeyStat[] {
  return m ? [...m.values()].sort((a, b) => b.matches - a.matches || b.wins - a.wins) : []
}

function Destaque({
  icone,
  rotulo,
  par,
  tipo,
}: {
  icone: string
  rotulo: string
  par: PairKeyStat | undefined
  tipo: 'parceira' | 'rival'
}) {
  const { nameOf, playerById } = useStore()
  if (!par) return null
  const detalhe =
    tipo === 'parceira'
      ? `${par.wins}V/${par.losses}D em ${par.matches} jogo(s) · ${par.points} pts juntas`
      : `${par.wins}V/${par.losses}D em ${par.matches} confronto(s)`
  return (
    <div className="row">
      <span style={{ fontSize: 20 }}>{icone}</span>
      <Avatar player={playerById(par.other_id)} size={34} />
      <div className="grow">
        <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{rotulo}</div>
        <div style={{ fontWeight: 700 }} className="ellipsis">{nameOf(par.other_id)}</div>
        <div className="tiny muted">{detalhe}</div>
      </div>
    </div>
  )
}

function TabelaPares({ linhas, primeira }: { linhas: PairKeyStat[]; primeira: string }) {
  const { nameOf, playerById } = useStore()
  if (linhas.length === 0) return <Empty icon="🏐">Nada por aqui ainda.</Empty>
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{primeira}</th>
            <th>J</th><th>V</th><th>D</th><th>%</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((p) => (
            <tr key={p.other_id}>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar player={playerById(p.other_id)} size={26} />
                  <span className="ellipsis">{nameOf(p.other_id)}</span>
                </div>
              </td>
              <td>{p.matches}</td>
              <td>{p.wins}</td>
              <td>{p.losses}</td>
              <td>{Math.round(rate(p) * 100)}%</td>
              <td style={{ fontWeight: 700 }}>{p.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
