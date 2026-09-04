import { useMemo, useState } from 'react'
import { Avatar, Empty, Modal, StatBox, shareOrCopy } from '../components/ui'
import { buildMonthPoster } from '../lib/poster'
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

/** Empate de verdade (mesmos pontos, saldo e vitorias) fica na mesma posicao. */
function positionsOf(rows: PlayerStat[]): number[] {
  const pos: number[] = []
  rows.forEach((s, i) => {
    const ant = rows[i - 1]
    const igual = ant && ant.points === s.points && balance(ant) === balance(s) && ant.wins === s.wins
    pos.push(igual ? pos[i - 1] : i + 1)
  })
  return pos
}
import {
  applyBonuses,
  computeStreaks,
  isMaxLevel,
  newChoice,
  onFire,
  STREAK_LADDER,
  streakBonus,
  streakLevel,
} from '../lib/streaks'
import { useStore } from '../lib/store'
import { monthLabel, monthOf, todayISO } from '../lib/types'

export default function Ranking({ onToast }: { onToast: (m: string) => void }) {
  const { data, nameOf, playerById, canEdit, saveChoice } = useStore()

  const months = useMemo(() => {
    const set = new Set(data.sessions.map((s) => monthOf(s.date)))
    set.add(monthOf(todayISO()))
    return [...set].sort().reverse()
  }, [data.sessions])

  const [month, setMonth] = useState(months[0])
  const [verTodas, setVerTodas] = useState(false)
  const [poster, setPoster] = useState<{ url: string; blob: Blob } | null>(null)
  const [gerando, setGerando] = useState(false)
  const activeMonth = months.includes(month) ? month : months[0]

  const streaks = useMemo(() => computeStreaks(data), [data])

  const rows = useMemo(() => {
    const ms = playedMatches(data, { month: activeMonth })
    const awards = streaks.awards.filter((a) => a.month === activeMonth)
    return rankPlayers(applyBonuses(computeStats(ms), awards), nameOf)
  }, [data, activeMonth, nameOf, streaks])

  const fire = useMemo(() => onFire(streaks), [streaks])
  const decisoes = useMemo(
    () => streaks.decisions.filter((d) => d.month === activeMonth),
    [streaks, activeMonth],
  )

  const totals = useMemo(() => {
    const ms = playedMatches(data, { month: activeMonth })
    const days = new Set(ms.map((m) => m.session_id)).size
    return { games: ms.length, days, players: rows.length }
  }, [data, activeMonth, rows.length])

  const posicoes = useMemo(() => positionsOf(rows), [rows])
  const TOPO = 10
  const visiveis = verTodas ? rows : rows.slice(0, TOPO)

  async function gerarImagem() {
    setGerando(true)
    try {
      const linhas = rows.slice(0, 8).map((s) => ({
        name: nameOf(s.player_id),
        points: s.points,
        wins: s.wins,
        losses: s.losses,
        photo: playerById(s.player_id)?.photo_url ?? null,
        streak: streaks.current.get(s.player_id) ?? 0,
      }))
      const blob = await buildMonthPoster(monthLabel(activeMonth), linhas)
      setPoster({ url: URL.createObjectURL(blob), blob })
    } catch (e) {
      onToast('Não consegui gerar a imagem')
      console.error(e)
    } finally {
      setGerando(false)
    }
  }

  function fecharPoster() {
    if (poster) URL.revokeObjectURL(poster.url)
    setPoster(null)
  }

  async function salvarImagem() {
    if (!poster) return
    const arquivo = new File([poster.blob], `ranking-${activeMonth}.png`, { type: 'image/png' })
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean
      share?: (d: { files: File[]; text?: string }) => Promise<void>
    }
    if (nav.canShare?.({ files: [arquivo] }) && nav.share) {
      try {
        await nav.share({ files: [arquivo], text: `Ranking de ${monthLabel(activeMonth)} 🏆` })
        return
      } catch {
        /* cancelou: cai para o download */
      }
    }
    const a = document.createElement('a')
    a.href = poster.url
    a.download = arquivo.name
    a.click()
    onToast('Imagem salva 📸')
  }
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
                const pos = posicoes[idx] ?? idx + 1
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
              const max = isMaxLevel(f.streak)
              return (
                <div className={`row${max ? ' queen' : ''}`} key={f.player_id}>
                  <Avatar player={playerById(f.player_id)} size={max ? 46 : 38} />
                  <div className="grow">
                    <div style={{ fontWeight: 800 }} className="ellipsis">
                      {nameOf(f.player_id)} {lvl?.emoji}
                    </div>
                    <div className="tiny muted">
                      {lvl?.title} · {f.streak} sextas seguidas · <strong>{f.pending} pts acumulados</strong>
                      {' '}(+{streakBonusOf(f.streak)} se ganhar de novo)
                    </div>
                  </div>
                  <span className="badge open nowrap" title="bônus acumulado, ainda não sacado">
                    🔥 {f.pending}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            O bônus fica <strong>acumulado</strong> enquanto a sequência está viva. Ele só entra no
            ranking quando a jogadora <strong>saca</strong>, no fechamento do mês. Perder uma sexta
            ou faltar zera a sequência <em>e</em> o acumulado.
          </p>
        </div>
      )}

      {decisoes.length > 0 && (
        <div className="card">
          <div className="section-title">🏁 Fechamento de {monthLabel(activeMonth)}</div>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Estas jogadoras terminaram o mês em chamas. Pergunte a cada uma: <strong>sacar</strong> o
            bônus agora (entra na pontuação deste mês e a sequência zera) ou <strong>continuar
            apostando</strong> (o bônus não conta agora, mas cresce — e se ela perder uma sexta,
            perde tudo)?
          </p>
          <div className="stack">
            {decisoes.map((d) => {
              const lvl = streakLevel(d.streak)
              return (
                <div key={d.player_id} className="row bet-row">
                  <Avatar player={playerById(d.player_id)} size={40} />
                  <div className="grow">
                    <div style={{ fontWeight: 800 }} className="ellipsis">
                      {nameOf(d.player_id)} {lvl?.emoji}
                    </div>
                    <div className="tiny muted">
                      {d.streak} sextas seguidas · <strong>{d.bonus} pts</strong> em jogo
                      {!d.respondido && ' · ainda não respondeu'}
                    </div>
                    {canEdit && (
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        <button
                          className={`btn sm ${d.action === 'sacar' ? 'teal' : 'ghost'}`}
                          onClick={() => saveChoice(newChoice(d.player_id, d.month, 'sacar', d.streak, d.bonus))}
                        >
                          💰 Sacar +{d.bonus}
                        </button>
                        <button
                          className={`btn sm ${d.action === 'continuar' ? 'pink' : 'ghost'}`}
                          onClick={() => saveChoice(newChoice(d.player_id, d.month, 'continuar', d.streak, d.bonus))}
                        >
                          🔥 Continuar apostando
                        </button>
                      </div>
                    )}
                    {!canEdit && (
                      <div className="tiny" style={{ color: d.action === 'sacar' ? 'var(--teal)' : 'var(--pink)', fontWeight: 700 }}>
                        {d.action === 'sacar' ? `sacou +${d.bonus}` : 'continuou apostando'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card">
          <div className="section-title">📊 Classificação completa</div>
          <RankTable rows={visiveis} fire={streaks.current} />
          {rows.length > TOPO && (
            <button className="btn ghost block sm" style={{ marginTop: 10 }} onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? `Mostrar só o top ${TOPO}` : `Ver todas as ${rows.length} jogadoras`}
            </button>
          )}
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
          <button className="btn purple block" style={{ marginTop: 8 }} disabled={gerando} onClick={() => void gerarImagem()}>
            {gerando ? 'Montando a arte…' : '👑 Gerar imagem do fechamento do mês'}
          </button>
        </div>
      )}

      {poster && (
        <Modal title={`Fechamento de ${monthLabel(activeMonth)}`} onClose={fecharPoster}>
          <img src={poster.url} alt="Imagem do ranking do mês" style={{ width: '100%', borderRadius: 14 }} />
          <button className="btn pink block" style={{ marginTop: 12 }} onClick={() => void salvarImagem()}>
            📲 Compartilhar / salvar imagem
          </button>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            No celular também dá para segurar o dedo na imagem e escolher <em>salvar</em>.
          </p>
        </Modal>
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
          Venceu o play várias sextas seguidas? O bônus vai <strong>acumulando</strong>:
        </p>
        <div className="grid2" style={{ gap: 8 }}>
          {STREAK_LADDER.map((x) => {
            const faixa = x.to === null ? `${x.from} ou mais` : x.from === x.to ? `${x.from} seguidos` : `${x.from} a ${x.to}`
            const top = x.to === null
            return (
              <div
                key={x.title}
                style={{
                  background: top ? 'linear-gradient(135deg, #f5c518, #e08e00)' : 'rgba(255,255,255,.08)',
                  color: top ? '#3d2a00' : undefined,
                  borderRadius: 12,
                  padding: '8px 10px',
                  gridColumn: top ? '1 / -1' : undefined,
                }}
              >
                <div className="tiny" style={{ fontWeight: 800, letterSpacing: '.5px' }}>
                  {x.emoji} {faixa.toUpperCase()} · {x.title.toUpperCase()}
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>+{x.bonus} <span style={{ fontSize: 11 }}>PONTOS</span></div>
              </div>
            )
          })}
        </div>
        <p className="tiny" style={{ color: '#9d99bb', marginBottom: 0 }}>
          <strong>No fechamento do mês ela escolhe:</strong> sacar o acumulado (entra na pontuação
          do mês e a sequência zera) ou continuar apostando para valer mais. Perder uma sexta ou
          faltar zera a sequência <em>e</em> o que estava acumulado — é o risco da aposta.
          Por isso Rainha e Duquesa só aparecem para quem atravessa vários meses apostando.
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
  const posicoes = positionsOf(rows)
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
                <td className={`rank-pos top${posicoes[i]}`} style={{ fontWeight: 800 }}>{posicoes[i]}</td>
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
