import { useEffect, useMemo, useState } from 'react'
import ImportarLista from '../components/ImportarLista'
import { Avatar, Empty, Modal, StatBox, Stepper, shareOrCopy } from '../components/ui'
import { fullRotationRounds, generateSchedule, matchesPerPlayer, planToMatches, type RoundPlan } from '../lib/pairing'
import { dayRankingText, scheduleText } from '../lib/share'
import { isPlayed, matchPoints } from '../lib/scoring'
import { buildHistory, computeStats, playedMatches, ratings, rankPlayers } from '../lib/stats'
import { buildDayPoster } from '../lib/poster'
import { computeStreaks, streakLevel } from '../lib/streaks'
import { useWakeLock } from '../lib/wakelock'
import { useStore } from '../lib/store'
import { dateLabel, todayISO, uid, type Match, type PlaySession } from '../lib/types'
import { RankTable } from './Ranking'

export default function Play({
  onToast,
  abrir,
  onAbriu,
}: {
  onToast: (m: string) => void
  abrir?: string | null
  onAbriu?: () => void
}) {
  const { data } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  // veio da tela inicial pedindo para abrir um play especifico
  useEffect(() => {
    if (abrir) {
      setOpenId(abrir)
      onAbriu?.()
    }
  }, [abrir, onAbriu])
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
  const [rodizio, setRodizio] = useState(true)
  const [importando, setImportando] = useState(false)
  const [target, setTarget] = useState(preset.target ?? 4)
  const [selected, setSelected] = useState<string[]>(preset.player_ids ?? [])
  const [busy, setBusy] = useState(false)

  const available = [...data.players]
    .filter((p) => p.active || selected.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const maxCourts = Math.max(1, Math.floor(selected.length / 4))
  const effCourts = Math.min(courts, maxCourts)

  // rodizio completo: rodadas suficientes para cada uma jogar com cada uma
  const autoRounds = useMemo(
    () => (selected.length >= 4 ? fullRotationRounds(selected.length, effCourts) : 0),
    [selected.length, effCourts],
  )
  const effRounds = rodizio ? autoRounds : rounds
  const perPlayer = rodizio
    ? selected.length - 1
    : matchesPerPlayer(selected.length, effCourts, effRounds)
  const restPerRound = selected.length - effCourts * 4
  const possiveis = Math.max(0, selected.length - 1)

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
      const plans = generateSchedule({
        playerIds: selected,
        courts: effCourts,
        rounds: effRounds,
        ratings: ratings(data, date),
        history: buildHistory(playedMatches(data)),
        mode: rodizio ? 'completo' : 'fixo',
      })
      const session: PlaySession = {
        id: uid(),
        date,
        title: title.trim() || 'Play de Sexta',
        courts: effCourts,
        rounds: plans.length, // no rodizio, quem manda no total e o proprio rodizio
        target,
        player_ids: selected,
        status: 'open',
        created_at: new Date().toISOString(),
      }
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
            <div className="field">
              <span>Quadras</span>
              <Stepper value={courts} min={1} max={12} onChange={setCourts} />
              <em className={`hint${selected.length >= 4 && effCourts < courts ? ' aviso' : ''}`}>
                {selected.length < 4
                  ? 'cada quadra comporta 4 meninas por vez'
                  : effCourts < courts
                    ? `com ${selected.length} jogadoras cabem ${maxCourts} quadra(s); vou usar ${effCourts}`
                    : 'quadras disponíveis hoje'}
              </em>
            </div>
            <div className="field">
              <span>Rodadas</span>
              <Stepper
                value={rodizio ? effRounds : rounds}
                min={1}
                max={40}
                onChange={setRounds}
                disabled={rodizio}
                vazio="—"
              />
              <em className="hint">
                {rodizio ? 'calculado pelo rodízio completo' : 'quantas vezes vão trocar de dupla'}
              </em>
            </div>
            <div className="field">
              <span>Vai até</span>
              <Stepper value={target} min={1} max={21} onChange={setTarget} />
              <em className="hint">pontos para vencer a partida — o padrão é 4</em>
            </div>
          </div>
          <div className="toggle-card">
            <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={rodizio} onChange={(e) => setRodizio(e.target.checked)} />
              <span className="grow">
                <strong>🔁 Todas jogam com todas</strong>
                <span className="hint" style={{ marginTop: 2 }}>
                  o app calcula quantas rodadas são necessárias para cada uma fazer dupla
                  com cada uma das outras, exatamente uma vez
                </span>
              </span>
            </label>
          </div>

          <p className="tiny muted" style={{ margin: '2px 2px 0' }}>
            {selected.length < 4 ? (
              'Escolha as jogadoras abaixo para o app calcular as rodadas.'
            ) : rodizio ? (
              <>
                <strong>{effRounds} rodadas × {effCourts} quadras = {effRounds * effCourts} partidas.</strong>{' '}
                Cada uma joga <strong>{perPlayer} partidas</strong> e faz dupla com{' '}
                <strong>cada uma das outras {possiveis}</strong> exatamente uma vez.
              </>
            ) : (
              <>
                <strong>{effRounds} rodadas × {effCourts} quadras = {effRounds * effCourts} partidas.</strong>{' '}
                Cada uma joga <strong>{perPlayer} partidas</strong>, ou seja, faz dupla com{' '}
                {Math.min(perPlayer, possiveis)} das {possiveis} possíveis parceiras.
              </>
            )}{' '}
            Quem vence leva <strong>{target} menos os games da adversária</strong> em pontos.
          </p>

          {rodizio && effRounds > 12 && (
            <div className="banner warn" style={{ margin: '10px 0 0' }}>
              ⏱️ São <strong>{effRounds} rodadas</strong> — pode ser longo para uma noite só.
              Se o tempo for curto, desmarque o rodízio e escolha quantas rodadas cabem;
              o app continua evitando repetir duplas.
            </div>
          )}
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
        <button className="btn purple block sm" style={{ marginTop: 10 }} onClick={() => setImportando(true)}>
          📋 Colar lista de confirmação do grupo
        </button>

        {available.length === 0 ? (
          <Empty icon="👯">
            Cadastre as jogadoras na aba <strong>Meninas</strong> — ou cole a lista do grupo no botão acima.
          </Empty>
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
            {restPerRound > 0 ? ` (${restPerRound} folga(m) a cada rodada, revezando de forma justa)` : ' (todas jogam todas as rodadas)'}.
            {effCourts < courts && ' Ajustei o número de quadras para caber todo mundo.'}
          </div>
        )}
      </div>

      {importando && (
        <ImportarLista
          onAplicar={(ids) => setSelected(ids)}
          onClose={() => setImportando(false)}
          onToast={onToast}
        />
      )}

      <button className="btn pink block" disabled={selected.length < 4 || busy} onClick={() => void create()}>
        {busy ? 'Montando as duplas…' : `✨ Gerar ${effRounds || ''} rodadas e começar`}
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
  const { data, nameOf, playerById, canEdit, saveMatches, saveSession, replaceSessionMatches } = useStore()
  const [showRank, setShowRank] = useState(false)
  const [arte, setArte] = useState<{ url: string; blob: Blob } | null>(null)
  const [gerando, setGerando] = useState(false)

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

  // sequencias que avancaram neste play (so existe depois de finalizado)
  const passos = useMemo(
    () => computeStreaks(data).steps.filter((x) => x.session_id === session.id && x.streak >= 2),
    [data, session.id],
  )
  const award = passos[0]
  const awardLevel = award ? streakLevel(award.streak) : null

  function setScore(m: Match, a: number | null, b: number | null) {
    saveMatches([{ ...m, score_a: a, score_b: b }])
  }

  useWakeLock(!finished)

  async function gerarArteDoDia() {
    setGerando(true)
    try {
      const passosDoDia = new Map(passos.map((x) => [x.player_id, x]))
      const linhas = dayRows.slice(0, 8).map((s, i) => {
        // o fogo so aparece para a campea do dia, se ela tem status
        const st = i === 0 ? passosDoDia.get(s.player_id) : undefined
        const lvl = st && st.streak >= 2 ? streakLevel(st.streak) : null
        return {
          name: nameOf(s.player_id),
          points: s.points,
          wins: s.wins,
          losses: s.losses,
          photo: playerById(s.player_id)?.photo_url ?? null,
          streak: st?.streak ?? 0,
          statusTitle: lvl?.title,
          statusEmoji: lvl?.emoji,
          statusPoints: undefined,
        }
      })
      const blob = await buildDayPoster(dateLabel(session.date), linhas, `${import.meta.env.BASE_URL}logo.png`)
      setArte({ url: URL.createObjectURL(blob), blob })
    } catch (e) {
      onToast('Não consegui gerar a imagem')
      console.error(e)
    } finally {
      setGerando(false)
    }
  }

  async function salvarArte() {
    if (!arte) return
    const arquivo = new File([arte.blob], `play-${session.date}.png`, { type: 'image/png' })
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean
      share?: (d: { files: File[]; text?: string }) => Promise<void>
    }
    if (nav.canShare?.({ files: [arquivo] }) && nav.share) {
      try {
        await nav.share({ files: [arquivo], text: `${session.title} — ${dateLabel(session.date)} 🏐` })
        return
      } catch {
        /* cancelou: cai para o download */
      }
    }
    const a = document.createElement('a')
    a.href = arte.url
    a.download = arquivo.name
    a.click()
    onToast('Imagem salva 📸')
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

      <RoundBoard
        rounds={rounds}
        session={session}
        editable={canEdit && !finished}
        onScore={setScore}
      />

      {canEdit && !finished && (
        <button className="btn teal block" onClick={() => void finish()}>
          ✅ Finalizar o play e somar os pontos
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

      {arte && (
        <Modal
          title={`Play de ${dateLabel(session.date)}`}
          onClose={() => { URL.revokeObjectURL(arte.url); setArte(null) }}
        >
          <img src={arte.url} alt="Imagem do ranking do dia" style={{ width: '100%', borderRadius: 14 }} />
          <button className="btn pink block" style={{ marginTop: 12 }} onClick={() => void salvarArte()}>
            📲 Compartilhar / salvar imagem
          </button>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            No celular também dá para segurar o dedo na imagem e escolher <em>salvar</em>.
          </p>
        </Modal>
      )}

      {showRank && (
        <Modal title={`Ranking do dia — ${dateLabel(session.date)}`} onClose={() => setShowRank(false)}>
          {dayRows.length === 0 ? (
            <Empty>Nenhum placar lançado ainda.</Empty>
          ) : (
            <>
              {award && awardLevel && (
                <div className="banner warn" style={{ background: '#ffe9d6', color: '#8a4b06' }}>
                  {awardLevel.emoji} <strong>{nameOf(award.player_id)}</strong> é {awardLevel.title.toLowerCase()}!
                  {' '}{award.streak} sextas seguidas no pódio do dia — status vale{' '}
                  <strong>{award.value} pontos</strong>, que ela decide se usa no fechamento do mês.
                  {award.usouVida && ' (uma vida foi consumida para segurar o status hoje)'}
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
              <button
                className="btn purple block"
                style={{ marginTop: 8 }}
                disabled={gerando}
                onClick={() => void gerarArteDoDia()}
              >
                {gerando ? 'Montando a arte…' : '🏐 Gerar imagem do dia'}
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  )
}

function RoundBoard({
  rounds,
  session,
  editable,
  onScore,
}: {
  rounds: [number, Match[]][]
  session: PlaySession
  editable: boolean
  onScore: (m: Match, a: number | null, b: number | null) => void
}) {
  const { nameOf } = useStore()
  // primeira rodada que ainda falta placar; se acabou tudo, fica na ultima
  const firstOpen =
    rounds.find(([, ms]) => ms.some((m) => !isPlayed(m)))?.[0] ?? rounds[rounds.length - 1]?.[0] ?? 1
  const [round, setRound] = useState(firstOpen)
  const [all, setAll] = useState(false)

  // ao abrir/atualizar, pula para a primeira rodada que ainda falta placar
  useEffect(() => setRound(firstOpen), [firstOpen])

  if (rounds.length === 0) return null
  const idx = rounds.findIndex(([r]) => r === round)
  const shown = all ? rounds : rounds.slice(Math.max(idx, 0), Math.max(idx, 0) + 1)

  return (
    <>
      <div className="card round-nav">
        <div className="row spread" style={{ marginBottom: 8 }}>
          <strong style={{ fontSize: 15 }}>{all ? 'Todas as rodadas' : `Rodada ${round} de ${rounds.length}`}</strong>
          <button className="btn ghost sm" onClick={() => setAll((v) => !v)}>
            {all ? 'Ver uma por vez' : 'Ver todas'}
          </button>
        </div>
        {!all && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost step" disabled={idx <= 0} onClick={() => setRound(rounds[idx - 1][0])}>‹</button>
            <div className="chips-scroll grow">
              {rounds.map(([r, ms]) => {
                const done = ms.every(isPlayed)
                return (
                  <button
                    key={r}
                    className={`round-chip${r === round ? ' on' : ''}${done ? ' done' : ''}`}
                    onClick={() => setRound(r)}
                  >
                    {done ? '✓' : r}
                  </button>
                )
              })}
            </div>
            <button className="btn ghost step" disabled={idx >= rounds.length - 1} onClick={() => setRound(rounds[idx + 1][0])}>›</button>
          </div>
        )}
      </div>

      {shown.map(([r, ms]) => {
        const byes = session.player_ids.filter((p) => !ms.some((m) => [...m.team_a, ...m.team_b].includes(p)))
        return (
          <div className="card" key={r}>
            {all && <div className="section-title">🔄 Rodada {r}</div>}
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} target={session.target} editable={editable} onScore={onScore} />
            ))}
            {byes.length > 0 && <div className="tiny muted">Folga nesta rodada: {byes.map(nameOf).join(', ')}</div>}
          </div>
        )
      })}
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
  onScore: (m: Match, a: number | null, b: number | null) => void
}) {
  const { nameOf, playerById } = useStore()
  const [winner, setWinner] = useState<'a' | 'b' | null>(null)
  const played = isPlayed(match)
  const [pa, pb] = played ? matchPoints(match.score_a as number, match.score_b as number) : [0, 0]
  const aWin = played && (match.score_a as number) > (match.score_b as number)

  const duo = (ids: [string, string]) => (
    <>
      <Avatar player={playerById(ids[0])} size={26} />
      <Avatar player={playerById(ids[1])} size={26} />
      <span className="names ellipsis">
        {nameOf(ids[0])} <span className="muted">+</span> {nameOf(ids[1])}
      </span>
    </>
  )

  // ---- ja tem placar: mostra o resultado ----
  if (played) {
    return (
      <div className="match done">
        <div className="match-head">
          <span>Quadra {match.court}</span>
          <span>{editable ? '' : 'placar'}</span>
        </div>
        <div className={`team ${aWin ? 'win' : 'lose'}`}>
          {duo(match.team_a)}
          {pa > 0 && <span className="pts-tag">+{pa}</span>}
          <span className="score-box">{match.score_a}</span>
        </div>
        <div className={`team ${aWin ? 'lose' : 'win'}`}>
          {duo(match.team_b)}
          {pb > 0 && <span className="pts-tag">+{pb}</span>}
          <span className="score-box">{match.score_b}</span>
        </div>
        {editable && (
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => { setWinner(null); onScore(match, null, null) }}>
            ✏️ Trocar placar
          </button>
        )}
      </div>
    )
  }

  // ---- so leitura e ainda sem placar ----
  if (!editable) {
    return (
      <div className="match">
        <div className="match-head"><span>Quadra {match.court}</span><span>sem placar</span></div>
        <div className="team">{duo(match.team_a)}</div>
        <div className="vs">X</div>
        <div className="team">{duo(match.team_b)}</div>
      </div>
    )
  }

  // ---- passo 2: quantos games a perdedora fez ----
  if (winner) {
    const loserIds = winner === 'a' ? match.team_b : match.team_a
    return (
      <div className="match live">
        <div className="match-head">
          <span>Quadra {match.court}</span>
          <button className="linkish" onClick={() => setWinner(null)}>‹ voltar</button>
        </div>
        <div className="team win">{duo(winner === 'a' ? match.team_a : match.team_b)}<span className="score-box">{target}</span></div>
        <div className="ask">Quantos games <strong>{nameOf(loserIds[0])} + {nameOf(loserIds[1])}</strong> fez?</div>
        <div className="games-row">
          {Array.from({ length: target }, (_, n) => (
            <button
              key={n}
              className="game-btn"
              onClick={() => {
                setWinner(null)
                if (winner === 'a') onScore(match, target, n)
                else onScore(match, n, target)
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ---- passo 1: quem venceu ----
  return (
    <div className="match live">
      <div className="match-head"><span>Quadra {match.court}</span><span>quem venceu?</span></div>
      <button className="pick-team" onClick={() => setWinner('a')}>
        {duo(match.team_a)}
        <span className="pick-tag">venceu</span>
      </button>
      <div className="vs">X</div>
      <button className="pick-team" onClick={() => setWinner('b')}>
        {duo(match.team_b)}
        <span className="pick-tag">venceu</span>
      </button>
    </div>
  )
}
