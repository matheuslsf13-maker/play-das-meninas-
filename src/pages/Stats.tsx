import { useMemo, useState } from 'react'
import { Avatar, Empty, StatBox } from '../components/ui'
import {
  avgPoints,
  balance,
  computeStats,
  emptyStat,
  opponentStats,
  partnerStats,
  playedMatches,
  rankPlayers,
  winRate,
  type PairKeyStat,
} from '../lib/stats'
import { applyBonuses, computeStreaks, streakLevel } from '../lib/streaks'
import { useStore } from '../lib/store'
import { monthLabel, monthOf } from '../lib/types'

export default function Stats() {
  const { data, nameOf, playerById } = useStore()

  const months = useMemo(() => {
    const set = new Set(data.sessions.map((s) => monthOf(s.date)))
    return [...set].sort().reverse()
  }, [data.sessions])

  const [period, setPeriod] = useState<string>('all')
  const [playerId, setPlayerId] = useState<string>('')

  const matches = useMemo(
    () => playedMatches(data, period === 'all' ? {} : { month: period }),
    [data, period],
  )

  const streaks = useMemo(() => computeStreaks(data), [data])
  const stats = useMemo(() => {
    const awards = period === 'all' ? streaks.awards : streaks.awards.filter((a) => monthOf(a.date) === period)
    return applyBonuses(computeStats(matches), awards)
  }, [matches, streaks, period])
  const ranked = useMemo(() => rankPlayers(stats, nameOf), [stats, nameOf])
  const partners = useMemo(() => partnerStats(matches), [matches])
  const opponents = useMemo(() => opponentStats(matches), [matches])

  const selected = playerId || ranked[0]?.player_id || ''
  const s = stats.get(selected) ?? emptyStat(selected)
  const dateOfSession = new Map(data.sessions.map((x) => [x.id, x.date]))
  const dayTitles = [...streaks.winnerOf.entries()].filter(
    ([sid, id]) => id === selected && (period === 'all' || monthOf(dateOfSession.get(sid) ?? '') === period),
  ).length
  const curStreak = streaks.current.get(selected) ?? 0
  const bestStreak = streaks.best.get(selected) ?? 0
  const curLevel = streakLevel(curStreak)
  const myPartners = sortPairs(partners.get(selected))
  const myOpponents = sortPairs(opponents.get(selected))

  // "com qual dupla eu ganhei mais": mais vitorias juntas, depois aproveitamento
  const bestPartner = myPartners.filter((p) => p.wins > 0)
    .sort((a, b) => b.wins - a.wins || b.points - a.points || rate(b) - rate(a))[0]
  const worstPartner = myPartners.filter((p) => p.losses > 0)
    .sort((a, b) => b.losses - a.losses || rate(a) - rate(b))[0]
  const favVictim = myOpponents.filter((p) => p.wins > 0)
    .sort((a, b) => b.wins - a.wins || rate(b) - rate(a))[0]
  const nemesis = myOpponents.filter((p) => p.losses > 0)
    .sort((a, b) => b.losses - a.losses || rate(a) - rate(b))[0]

  if (data.players.length === 0) {
    return <div className="card"><Empty icon="📊">Cadastre as jogadoras e registre um play para ver as estatísticas.</Empty></div>
  }

  return (
    <>
      <div className="card">
        <div className="section-title">📊 Estatísticas</div>
        <div className="grid2">
          <label className="field">
            <span>Período</span>
            <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">Desde o início</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Jogadora</span>
            <select className="select" value={selected} onChange={(e) => setPlayerId(e.target.value)}>
              {[...data.players]
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <Avatar player={playerById(selected)} size={56} />
          <div className="grow">
            <div style={{ fontSize: 18, fontWeight: 800 }}>{nameOf(selected)}</div>
            <div className="small muted">
              {s.days} play(s) · média de {avgPoints(s).toFixed(2)} pontos por partida
              {dayTitles > 0 && ` · ${dayTitles} play(s) vencido(s)`}
            </div>
          </div>
        </div>
        <div className="grid3">
          <StatBox k="Pontos" v={s.points} />
          <StatBox k="Partidas" v={s.matches} />
          <StatBox k="Aproveit." v={`${Math.round(winRate(s) * 100)}%`} />
          <StatBox k="Vitórias" v={s.wins} />
          <StatBox k="Derrotas" v={s.losses} />
          <StatBox k="Saldo" v={balance(s) > 0 ? `+${balance(s)}` : balance(s)} />
          <StatBox k="Bônus 🔥" v={s.bonus > 0 ? `+${s.bonus}` : 0} />
          <StatBox k="Sequência" v={curStreak} />
          <StatBox k="Melhor seq." v={bestStreak} />
        </div>
        {curLevel && (
          <div className="banner warn" style={{ background: '#ffe9d6', color: '#8a4b06', margin: '12px 0 0' }}>
            {curLevel.emoji} <strong>{curLevel.title}!</strong> Venceu os {curStreak} últimos plays.
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">💫 Destaques</div>
        <div className="stack">
          <Highlight icon="🤝" label="Melhor parceria" pair={bestPartner} kind="partner" />
          <Highlight icon="😅" label="Parceria mais difícil" pair={worstPartner} kind="partner" />
          <Highlight icon="🎯" label="Ganha mais de" pair={favVictim} kind="opponent" />
          <Highlight icon="🔥" label="Perde mais para" pair={nemesis} kind="opponent" />
        </div>
        {myPartners.length === 0 && <p className="tiny muted" style={{ marginBottom: 0 }}>Sem partidas registradas neste período.</p>}
      </div>

      <div className="card">
        <div className="section-title">🤝 Duplas — com quem jogou</div>
        <PairTable rows={myPartners} firstCol="Parceira" />
      </div>

      <div className="card">
        <div className="section-title">⚔️ Confrontos — contra quem jogou</div>
        <PairTable rows={myOpponents} firstCol="Adversária" />
      </div>

      <div className="card">
        <div className="section-title">🏅 Melhores duplas do período</div>
        <BestDuos matches={matches} />
      </div>
    </>
  )
}

function rate(p: PairKeyStat): number {
  return p.matches === 0 ? 0 : p.wins / p.matches
}

function sortPairs(m: Map<string, PairKeyStat> | undefined): PairKeyStat[] {
  return m ? [...m.values()].sort((a, b) => b.matches - a.matches || b.wins - a.wins) : []
}

function Highlight({
  icon,
  label,
  pair,
  kind,
}: {
  icon: string
  label: string
  pair: PairKeyStat | undefined
  kind: 'partner' | 'opponent'
}) {
  const { nameOf, playerById } = useStore()
  if (!pair) return null
  const detail =
    kind === 'partner'
      ? `${pair.wins}V/${pair.losses}D em ${pair.matches} jogo(s) · ${pair.points} pts juntas`
      : `${pair.wins}V/${pair.losses}D em ${pair.matches} confronto(s)`
  return (
    <div className="row">
      <span style={{ fontSize: 20 }}>{icon}</span>
      <Avatar player={playerById(pair.other_id)} size={34} />
      <div className="grow">
        <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{label}</div>
        <div style={{ fontWeight: 700 }} className="ellipsis">{nameOf(pair.other_id)}</div>
        <div className="tiny muted">{detail}</div>
      </div>
    </div>
  )
}

function PairTable({ rows, firstCol }: { rows: PairKeyStat[]; firstCol: string }) {
  const { nameOf, playerById } = useStore()
  if (rows.length === 0) return <Empty icon="🎾">Nada por aqui ainda.</Empty>
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{firstCol}</th>
            <th>J</th><th>V</th><th>D</th><th>%</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
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

function BestDuos({ matches }: { matches: ReturnType<typeof playedMatches> }) {
  const { nameOf } = useStore()
  const duos = useMemo(() => {
    const map = new Map<string, { a: string; b: string; matches: number; wins: number; points: number }>()
    for (const m of matches) {
      const a = m.score_a as number
      const b = m.score_b as number
      const add = (ids: [string, string], win: boolean, pts: number) => {
        const key = ids[0] < ids[1] ? `${ids[0]}|${ids[1]}` : `${ids[1]}|${ids[0]}`
        const [x, y] = key.split('|')
        const e = map.get(key) ?? { a: x, b: y, matches: 0, wins: 0, points: 0 }
        e.matches++; e.points += pts; if (win) e.wins++
        map.set(key, e)
      }
      add(m.team_a, a > b, a > b ? Math.abs(a - b) : 0)
      add(m.team_b, b > a, b > a ? Math.abs(a - b) : 0)
    }
    return [...map.values()]
      .sort((x, y) => y.points - x.points || y.wins - x.wins || y.matches - x.matches)
      .slice(0, 10)
  }, [matches])

  if (duos.length === 0) return <Empty icon="🏅">Ainda não há duplas registradas.</Empty>
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr><th style={{ textAlign: 'left' }}>Dupla</th><th>J</th><th>V</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {duos.map((d) => (
            <tr key={`${d.a}|${d.b}`}>
              <td className="ellipsis">{nameOf(d.a)} + {nameOf(d.b)}</td>
              <td>{d.matches}</td>
              <td>{d.wins}</td>
              <td style={{ fontWeight: 700 }}>{d.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
