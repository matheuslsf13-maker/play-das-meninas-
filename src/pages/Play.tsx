import { useMemo, useState } from 'react'
import { Avatar, Empty, Modal, StatBox, shareOrCopy } from '../components/ui'
import { generateSchedule, matchesPerPlayer, planToMatches, type RoundPlan } from '../lib/pairing'
import { dayRankingText, scheduleText } from '../lib/share'
import { isPlayed, matchPoints } from '../lib/scoring'
import { buildHistory, computeStats, playedMatches, ratings, rankPlayers } from '../lib/stats'
import { computeStreaks, streakLevel } from '../lib/streaks'
import { useStore } from '../lib/store'
import { dateLabel, todayISO, uid, type Match, type PlaySession } from '../lib/types'
import { RankTable } from './Ranking'

export default function Play({ onToast }: { onToast: (m: string) => void }) {
  const { data } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState<Partial<PlaySession> | null>(null)

  const sessions = useMemo(
    () => [...data.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [data.sessions],
  )

  const open = sessions.find((s) => s.id === openId) ?? null

  if (creating) {
    return (
      <NewPlay
        preset={creating}
        onCancel={() => setCreating(null)}
        onCreated={(id) => { setCreating(null); setOpenId(id) }}
        onToast={onToast}
      />
    )
  }

  if (open) {
    return (
      <PlayDetail
        session={open}
        onBack={() => setOpenId(null)}
        onNext={(preset) => { setOpenId(null); setCreating(preset) }}
        onToast={onToast}
      />
    )
  }

  return <PlayList sessions={sessions} onOpen={setOpenId} onNew={() => setCreating({})} />
}

/* ------------------------------------------------------------------ lista */

function PlayList({
  sessions,
  onOpen,
  onNew,
}: {
  sessions: PlaySession[]
  onOpen: (id: string) => void
  onNew: () => void
}) {
  const { data, canEdit, deleteSession } = useStore()
  return (
    <>
      {canEdit && (
        <button className="btn pink block" style={{ marginBottom: 14 }} onClick={onNew}>
          🎾 Novo Play
        </button>
      )}
      <div className="card">
        <div className="section-title">📅 Plays</div>
        {sessions.length === 0 ? (
          <Empty>Nenhum play ainda. Crie o primeiro e o app monta as duplas pra você.</Empty>
        ) : (
          <div className="stack">
            {sessions.map((s) => {
              const ms = data.matches.filter((m) => m.session_id === s.id)
              const done = ms.filter(isPlayed).length
              return (
                <div key={s.id} className="row" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 10 }}>
                  <div className="grow" onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong className="ellipsis">{s.title}</strong>
                      <span className={`badge ${s.status}`}>{s.status === 'open' ? 'em andamento' : 'finalizado'}</span>
                    </div>
                    <div className="tiny muted">
                      {dateLabel(s.date)} · {s.player_ids.length} jogadoras · {s.courts} quadras · {done}/{ms.length} partidas
                    </div>
                  </div>
                  <button className="btn ghost sm" onClick={() => onOpen(s.id)}>Abrir</button>
                  {canEdit && (
                    <button
                      className="btn danger sm"
                      onClick={() => {
                        if (confirm(`Apagar "${s.title}" (${dateLabel(s.date)}) e todas as partidas dele?`)) {
                          void deleteSession(s.id)
                        }
                      }}
                    >🗑</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------- novo play */

function NewPlay({
  preset,
  onCancel,
  onCreated,
  onToast,
}: {
  preset: Partial<PlaySession>
  onCancel: () => void
  onCreated: (id: string) => void
  onToast: (m: string) => void
}) {
  const { data, saveSession, saveMatches, playerById } = useStore()
  const [date, setDate] = useState(preset.date ?? todayISO())
  const [title, setTitle] = useState(preset.title ?? 'Play de Sexta')
  const [courts, setCourts] = useState(preset.courts ?? 3)
  const [rounds, setRounds] = useState(preset.rounds ?? 8)
  const [target, setTarget] = useState(preset.target ?? 4)
  const [selected, setSelected] = useState<string[]>(preset.player_ids ?? [])
  const [busy, setBusy] = useState(false)

  const available = [...data.players]
    .filter((p) => p.active || selected.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const maxCourts = Math.max(1, Math.floor(selected.length / 4))
  const effCourts = Math.min(courts, maxCourts)
  const perPlayer = matchesPerPlayer(selected.length, effCourts, rounds)
  const restPerRound = selected.length - effCourts * 4

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  async function create() {
    if (selected.length < 4) {
      onToast('Precisa de pelo menos 4 jogadoras')
      return
    }
    setBusy(true)
    try {
      const session: PlaySession = {
        id: uid(),
        date,
        title: title.trim() || 'Play de Sexta',
        courts: effCourts,
        rounds,
        target,
        player_ids: selected,
        status: 'open',
        created_at: new Date().toISOString(),
      }
      const plans = generateSchedule({
        playerIds: selected,
        courts: effCourts,
        rounds,
        ratings: ratings(data, date),
        history: buildHistory(playedMatches(data)),
      })
      await saveSession(session)
      await saveMatches(planToMatches(session.id, plans))
      onToast('Duplas geradas! 🎾')
      onCreated(session.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>🎾 Novo Play</div>
          <button className="btn ghost sm" onClick={onCancel}>Cancelar</button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Nome do play</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="grid3">
            <label className="field">
              <span>Quadras</span>
              <input className="input" type="number" min={1} max={12} value={courts}
                onChange={(e) => setCourts(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label className="field">
              <span>Rodadas</span>
              <input className="input" type="number" min={1} max={30} value={rounds}
                onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label className="field">
              <span>Vai até</span>
              <input className="input" type="number" min={1} max={21} value={target}
                onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 4))} />
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row spread">
          <div className="section-title" style={{ margin: 0 }}>👯 Quem vai jogar ({selected.length})</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setSelected(available.map((p) => p.id))}>Todas</button>
            <button className="btn ghost sm" onClick={() => setSelected([])}>Limpar</button>
          </div>
        </div>
        {available.length === 0 ? (
          <Empty icon="👯">Cadastre as jogadoras na aba <strong>Meninas</strong>.</Empty>
        ) : (
          <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
            {available.map((p) => {
              const on = selected.includes(p.id)
              return (
                <button key={p.id} className={`chip ${on ? 'on' : 'off'}`} onClick={() => toggle(p.id)}>
                  <Avatar player={playerById(p.id)} size={22} />
                  {p.name}
                </button>
              )
            })}
          </div>
        )}

        {selected.length >= 4 && (
          <div className="banner info" style={{ marginTop: 14, marginBottom: 0 }}>
            Com <strong>{selected.length} jogadoras</strong> dá para usar <strong>{effCourts} quadra(s)</strong> por rodada
            {restPerRound > 0 ? ` (${restPerRound} folga(m) a cada rodada, revezando)` : ' (todas jogam todas as rodadas)'}.
            Cada uma joga cerca de <strong>{perPlayer} partidas</strong>.
            {effCourts < courts && ' Ajustei o número de quadras para caber todo mundo.'}
          </div>
        )}
      </div>

      <button className="btn pink block" disabled={selected.length < 4 || busy} onClick={() => void create()}>
        {busy ? 'Montando as duplas…' : '✨ Gerar duplas e começar'}
      </button>
    </>
  )
}

/* ------------------------------------------------------------- detalhe */

function PlayDetail({
  session,
  onBack,
  onNext,
  onToast,
}: {
  session: PlaySession
  onBack: () => void
  onNext: (preset: Partial<PlaySession>) => void
  onToast: (m: string) => void
}) {
  const { data, nameOf, canEdit, saveMatches, saveSession, replaceSessionMatches } = useStore()
  const [showRank, setShowRank] = useState(false)

  const matches = useMemo(
    () =>
      data.matches
        .filter((m) => m.session_id === session.id)
        .sort((a, b) => a.round - b.round || a.court - b.court),
    [data.matches, session.id],
  )

  const rounds = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const m of matches) {
      if (!map.has(m.round)) map.set(m.round, [])
      map.get(m.round)!.push(m)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [matches])

  const dayRows = useMemo(() => {
    const ms = playedMatches(data, { sessionId: session.id })
    return rankPlayers(computeStats(ms), nameOf)
  }, [data, session.id, nameOf])

  const doneCount = matches.filter(isPlayed).length
  const finished = session.status === 'finished'

  // bonus "em chamas" creditado neste play (so existe depois de finalizado)
  const award = useMemo(
    () => computeStreaks(data).awards.find((a) => a.session_id === session.id),
    [data, session.id],
  )
  const awardLevel = award ? streakLevel(award.streak) : null

  async function setScore(m: Match, a: number | null, b: number | null) {
    await saveMatches([{ ...m, score_a: a, score_b: b }])
  }

  async function regenerate() {
    if (doneCount > 0 && !confirm('Já existem placares lançados. Gerar novas duplas apaga todos os resultados deste play. Continuar?')) return
    const plans = generateSchedule({
      playerIds: session.player_ids,
      courts: session.courts,
      rounds: session.rounds,
      ratings: ratings(data, session.date),
      history: buildHistory(playedMatches(data).filter((m) => m.session_id !== session.id)),
    })
    await replaceSessionMatches(session.id, planToMatches(session.id, plans))
    onToast('Novas duplas geradas 🔄')
  }

  async function finish() {
    if (doneCount < matches.length && !confirm(`Ainda faltam ${matches.length - doneCount} partidas sem placar. Finalizar mesmo assim?`)) return
    await saveSession({ ...session, status: 'finished' })
    setShowRank(true)
    onToast('Play finalizado! Pontos somados ao ranking do mês 🏆')
  }

  const plansForShare: RoundPlan[] = rounds.map(([round, ms]) => ({
    round,
    matches: ms.map((m) => ({ court: m.court, team_a: m.team_a, team_b: m.team_b })),
    byes: session.player_ids.filter((p) => !ms.some((m) => [...m.team_a, ...m.team_b].includes(p))),
  }))

  return (
    <>
      <div className="card">
        <div className="row spread">
          <button className="btn ghost sm" onClick={onBack}>← Plays</button>
          <span className={`badge ${session.status}`}>{finished ? 'finalizado' : 'em andamento'}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{session.title}</div>
          <div className="small muted">
            {dateLabel(session.date)} · {session.player_ids.length} jogadoras · {session.courts} quadras · {session.rounds} rodadas · até {session.target} pontos
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <StatBox k="Partidas" v={`${doneCount}/${matches.length}`} />
          <StatBox k="Rodadas" v={rounds.length} />
          <StatBox k="Líder do dia" v={<span style={{ fontSize: 13 }}>{dayRows[0] ? nameOf(dayRows[0].player_id).split(' ')[0] : '—'}</span>} />
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn ghost sm" onClick={async () => {
            const ok = await shareOrCopy(scheduleText(session.date, session.title, plansForShare, nameOf))
            onToast(ok ? 'Duplas copiadas 💬' : 'Não consegui copiar')
          }}>💬 Enviar duplas</button>
          <button className="btn ghost sm" onClick={() => setShowRank(true)}>🏆 Ranking do dia</button>
          {canEdit && !finished && <button className="btn ghost sm" onClick={() => void regenerate()}>🔄 Refazer duplas</button>}
        </div>
      </div>

      {rounds.map(([round, ms]) => {
        const byes = session.player_ids.filter((p) => !ms.some((m) => [...m.team_a, ...m.team_b].includes(p)))
        return (
          <div className="card" key={round}>
            <div className="section-title">🔄 Rodada {round}</div>
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} target={session.target} editable={canEdit && !finished} onScore={setScore} />
            ))}
            {byes.length > 0 && (
              <div className="tiny muted">Folga nesta rodada: {byes.map(nameOf).join(', ')}</div>
            )}
          </div>
        )
      })}

      {canEdit && !finished && (
        <button className="btn teal block" onClick={() => void finish()}>
          ✅ Finalizar o dia e somar os pontos
        </button>
      )}

      {finished && canEdit && (
        <button
          className="btn purple block"
          onClick={() =>
            onNext({
              title: session.title,
              courts: session.courts,
              rounds: session.rounds,
              target: session.target,
              player_ids: session.player_ids,
            })
          }
        >
          ➡️ Gerar as duplas do próximo play
        </button>
      )}

      {showRank && (
        <Modal title={`Ranking do dia — ${dateLabel(session.date)}`} onClose={() => setShowRank(false)}>
          {dayRows.length === 0 ? (
            <Empty>Nenhum placar lançado ainda.</Empty>
          ) : (
            <>
              {award && awardLevel && (
                <div className="banner warn" style={{ background: '#ffe9d6', color: '#8a4b06' }}>
                  {awardLevel.emoji} <strong>{nameOf(award.player_id)}</strong> está {awardLevel.title.toLowerCase()}!
                  {' '}{award.streak} plays seguidos vencendo — <strong>+{award.bonus} pontos</strong> de bônus no ranking do mês.
                </div>
              )}
              <RankTable rows={dayRows} />
              <button
                className="btn pink block"
                style={{ marginTop: 12 }}
                onClick={async () => {
                  const ok = await shareOrCopy(dayRankingText(session.date, session.title, dayRows, nameOf, award))
                  onToast(ok ? 'Ranking do dia copiado 💬' : 'Não consegui copiar')
                }}
              >💬 Compartilhar no WhatsApp</button>
            </>
          )}
        </Modal>
      )}
    </>
  )
}

function MatchCard({
  match,
  target,
  editable,
  onScore,
}: {
  match: Match
  target: number
  editable: boolean
  onScore: (m: Match, a: number | null, b: number | null) => Promise<void>
}) {
  const { nameOf, playerById } = useStore()
  const played = isPlayed(match)
  const [pa, pb] = played ? matchPoints(match.score_a as number, match.score_b as number) : [0, 0]
  const aWin = played && (match.score_a as number) > (match.score_b as number)
  const options = Array.from({ length: target + 1 }, (_, i) => i)

  const teamRow = (ids: [string, string], score: number | null, win: boolean, pts: number, onChange: (v: number | null) => void) => (
    <div className={`team ${played ? (win ? 'win' : 'lose') : ''}`}>
      <Avatar player={playerById(ids[0])} size={26} />
      <Avatar player={playerById(ids[1])} size={26} />
      <div className="names ellipsis">
        {nameOf(ids[0])} <span className="muted">+</span> {nameOf(ids[1])}
        {played && pts > 0 && <span className="tiny" style={{ color: 'var(--pink)', fontWeight: 800 }}> +{pts}</span>}
      </div>
      {editable ? (
        <select
          className="score-input"
          value={score === null ? '' : String(score)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">–</option>
          {options.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      ) : (
        <span className="score-input" style={{ display: 'inline-block' }}>{score ?? '–'}</span>
      )}
    </div>
  )

  return (
    <div className={`match ${played ? 'done' : ''}`}>
      <div className="match-head">
        <span>Quadra {match.court}</span>
        <span>{played ? `${match.score_a} x ${match.score_b}` : 'sem placar'}</span>
      </div>
      {teamRow(match.team_a, match.score_a, aWin, pa, (v) => void onScore(match, v, match.score_b))}
      <div className="vs">X</div>
      {teamRow(match.team_b, match.score_b, played && !aWin, pb, (v) => void onScore(match, match.score_a, v))}
      {match.score_a !== null && match.score_b !== null && match.score_a === match.score_b && (
        <div className="tiny" style={{ color: '#c02626', marginTop: 6 }}>Não pode empatar — ajuste o placar.</div>
      )}
    </div>
  )
}
