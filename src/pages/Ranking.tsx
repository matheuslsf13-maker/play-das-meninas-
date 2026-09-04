import { useMemo, useState } from 'react'
import { Avatar, Empty, StatBox, shareOrCopy } from '../components/ui'
import { monthRankingText } from '../lib/share'
import { POINTS_TABLE } from '../lib/scoring'
import {
  balance,
  computeStats,
  playedMatches,
  rankPlayers,
  winRate,
  type PlayerStat,
} from '../lib/stats'
import { applyBonuses, computeStreaks, onFire, streakBonus, streakLevel } from '../lib/streaks'
import { useStore } from '../lib/store'
import { monthLabel, monthOf, todayISO } from '../lib/types'

export default function Ranking({ onToast }: { onToast: (m: string) => void }) {
  const { data, nameOf, playerById } = useStore()

  const months = useMemo(() => {
    const set = new Set(data.sessions.map((s) => monthOf(s.date)))
    set.add(monthOf(todayISO()))
    return [...set].sort().reverse()
  }, [data.sessions])

  const [month, setMonth] = useState(months[0])
  const activeMonth = months.includes(month) ? month : months[0]

  const streaks = useMemo(() => computeStreaks(data), [data])

  const rows = useMemo(() => {
    const ms = playedMatches(data, { month: activeMonth })
    const awards = streaks.awards.filter((a) => monthOf(a.date) === activeMonth)
    return rankPlayers(applyBonuses(computeStats(ms), awards), nameOf)
  }, [data, activeMonth, nameOf, streaks])

  const fire = useMemo(() => onFire(streaks), [streaks])

  const totals = useMemo(() => {
    const ms = playedMatches(data, { month: activeMonth })
    const days = new Set(ms.map((m) => m.session_id)).size
    return { games: ms.length, days, players: rows.length }
  }, [data, activeMonth, rows.length])

  const podium = rows.slice(0, 3)
  const order = [1, 0, 2] // 2º, 1º, 3º na tela

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>🏆 Ranking do mês</div>
          <select className="select" style={{ width: 'auto' }} value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <Empty>Nenhuma partida registrada neste mês ainda.<br />Vá em <strong>Play</strong> e crie o play do dia.</Empty>
        ) : (
          <>
            <div className="podium">
              {order.map((idx) => {
                const s = podium[idx]
                if (!s) return <div key={idx} />
                const pos = idx + 1
                return (
                  <div className={`slot p${pos}`} key={s.player_id}>
                    <Avatar player={playerById(s.player_id)} size={pos === 1 ? 66 : 52} />
                    <div className="nm ellipsis">{nameOf(s.player_id)}</div>
                    <div className="base">
                      <div className="pos">{pos}º</div>
                      <div className="pts">{s.points} pts</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid3" style={{ marginTop: 14 }}>
              <StatBox k="Plays" v={totals.days} />
              <StatBox k="Partidas" v={totals.games} />
              <StatBox k="Jogadoras" v={totals.players} />
            </div>
          </>
        )}
      </div>

      {fire.length > 0 && (
        <div className="card">
          <div className="section-title">🔥 Em chamas</div>
          <div className="stack">
            {fire.map((f) => {
              const lvl = streakLevel(f.streak)
              return (
                <div className="row" key={f.player_id}>
                  <Avatar player={playerById(f.player_id)} size={38} />
                  <div className="grow">
                    <div style={{ fontWeight: 800 }} className="ellipsis">
                      {nameOf(f.player_id)} {lvl?.emoji}
                    </div>
                    <div className="tiny muted">
                      {lvl?.title} · venceu os {f.streak} últimos plays
                    </div>
                  </div>
                  <span className="badge open nowrap">+{streakBonusOf(f.streak)} se ganhar de novo</span>
                </div>
              )
            })}
          </div>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Bônus por vencer o ranking do dia em sequência: 2 seguidas <strong>+2</strong>,
            3 seguidas <strong>+3</strong>, 4 seguidas <strong>+5</strong>, 5 ou mais <strong>+7</strong> pontos.
            Perder o dia ou faltar ao play zera a sequência.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card">
          <div className="section-title">📊 Classificação completa</div>
          <RankTable rows={rows} fire={streaks.current} />
          <button
            className="btn pink block"
            style={{ marginTop: 12 }}
            onClick={async () => {
              const ok = await shareOrCopy(monthRankingText(activeMonth, rows, nameOf, streaks.current))
              onToast(ok ? 'Ranking pronto para colar no grupo 💬' : 'Não consegui copiar 😕')
            }}
          >
            💬 Compartilhar no WhatsApp
          </button>
        </div>
      )}

      <div className="card dark">
        <div className="section-title">⭐ Pontuação individual</div>
        <div className="grid2" style={{ gap: 8 }}>
          {POINTS_TABLE.map((p) => (
            <div key={p.label} style={{ background: p.color, borderRadius: 12, padding: '8px 10px', color: '#fff' }}>
              <div className="tiny" style={{ fontWeight: 800, letterSpacing: '.5px' }}>VITÓRIA POR {p.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{p.points} <span style={{ fontSize: 11 }}>PONTOS</span></div>
            </div>
          ))}
        </div>
        <p className="small" style={{ color: '#c9c6e0' }}>
          Cada partida vai até 4 pontos, sem empate. Quem vence leva os pontos da tabela; a derrota não pontua.
          Ao final do play, os pontos são somados ao ranking mensal.
        </p>
        <hr className="sep" style={{ borderColor: 'rgba(255,255,255,.15)' }} />
        <div className="section-title" style={{ marginBottom: 6 }}>🔥 Bônus em chamas</div>
        <p className="small" style={{ color: '#c9c6e0', marginTop: 0, marginBottom: 8 }}>
          Venceu o ranking do dia várias vezes seguidas? Ganha ponto extra no mês:
        </p>
        <div className="grid2" style={{ gap: 8 }}>
          {[
            { n: '2 seguidos', e: '🔥', b: 2 },
            { n: '3 seguidos', e: '🔥🔥', b: 3 },
            { n: '4 seguidos', e: '🔥🔥🔥', b: 5 },
            { n: '5 ou mais', e: '👑🔥', b: 7 },
          ].map((x) => (
            <div key={x.n} style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '8px 10px' }}>
              <div className="tiny" style={{ fontWeight: 800, letterSpacing: '.5px' }}>{x.e} {x.n.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>+{x.b} <span style={{ fontSize: 11 }}>PONTOS</span></div>
            </div>
          ))}
        </div>
        <p className="tiny" style={{ color: '#9d99bb', marginBottom: 0 }}>
          Perder o dia ou faltar ao play zera a sequência — tem que estar lá e vencer!
        </p>
      </div>
    </>
  )
}

function streakBonusOf(streak: number): number {
  return streakBonus(streak + 1)
}

export function RankTable({ rows, fire }: { rows: PlayerStat[]; fire?: Map<string, number> }) {
  const { nameOf, playerById } = useStore()
  const showBonus = rows.some((r) => r.bonus > 0)
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th style={{ textAlign: 'left' }}>Jogadora</th>
            <th>Pts</th>
            {showBonus && <th>🔥</th>}
            <th>J</th>
            <th>V</th>
            <th>D</th>
            <th>Saldo</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const bal = balance(s)
            return (
              <tr key={s.player_id}>
                <td className={`rank-pos top${i + 1}`} style={{ fontWeight: 800 }}>{i + 1}</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar player={playerById(s.player_id)} size={28} />
                    <span className="ellipsis">{nameOf(s.player_id)}</span>
                    {fire && (fire.get(s.player_id) ?? 0) >= 2 && (
                      <span className="nowrap" title={`${fire.get(s.player_id)} vitórias seguidas`}>
                        {streakLevel(fire.get(s.player_id) as number)?.emoji}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ fontWeight: 800, color: 'var(--pink)' }}>{s.points}</td>
                {showBonus && <td className="tiny" style={{ color: 'var(--orange)', fontWeight: 800 }}>{s.bonus > 0 ? `+${s.bonus}` : ''}</td>}
                <td>{s.matches}</td>
                <td>{s.wins}</td>
                <td>{s.losses}</td>
                <td>{bal > 0 ? `+${bal}` : bal}</td>
                <td>{Math.round(winRate(s) * 100)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
