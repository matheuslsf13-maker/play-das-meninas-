import { useEffect, useMemo, useState } from 'react'
import ImportarLista from '../components/ImportarLista'
import { Avatar, Empty, Modal, StatBox, Stepper, shareOrCopy } from '../components/ui'
import {
  formarGrupos,
  gerarFila,
  jogadorasDaPartida,
  liberarPartida,
  ordemDeEspera,
  ordemPrevista,
  parceirasDoRodizio,
  partidasDoRodizio,
  planToMatches,
  proximasDasQuadras,
  refazerFila,
} from '../lib/pairing'
import { dayRankingText, scheduleText } from '../lib/share'
import { isPlayed, matchPoints } from '../lib/scoring'
import { loadFins, loadInicios, saveFins, saveInicios, type Horarios } from '../lib/emQuadra'
import {
  buildHistory,
  computeStats,
  pairKey,
  playedMatches,
  PLAYS_PARA_FORCA,
  ratings,
  rankPlayers,
} from '../lib/stats'
import { buildDayPoster } from '../lib/poster'
import { computeStreaks, streakLevel } from '../lib/streaks'
import { useWakeLock } from '../lib/wakelock'
import { useStore } from '../lib/store'
import { dateLabel, todayISO, uid, type Match, type PlayFormat, type PlaySession } from '../lib/types'
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
  const { data, canEdit } = useStore()
  const [apagando, setApagando] = useState<PlaySession | null>(null)
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
              const grupos = s.groups?.length ?? 0
              return (
                <div key={s.id} className="row" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 10 }}>
                  <div className="grow" onClick={() => onOpen(s.id)} style={{ cursor: 'pointer', minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong className="ellipsis">{s.title}</strong>
                      <span className={`badge ${s.status}`}>{s.status === 'open' ? 'em andamento' : 'finalizado'}</span>
                      {s.ranked === false && <span className="badge avulso">avulso</span>}
                    </div>
                    <div className="tiny muted">
                      {dateLabel(s.date)} · {s.player_ids.length} jogadoras · {s.courts} quadras
                      {grupos > 1 && ` · ${grupos} grupos`} · {done}/{ms.length} partidas
                    </div>
                  </div>
                  <button className="btn ghost sm" onClick={() => onOpen(s.id)}>Abrir</button>
                  {canEdit && (
                    <button className="btn danger sm" onClick={() => setApagando(s)}>🗑</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {apagando && <ConfirmarExclusao session={apagando} onClose={() => setApagando(null)} />}
    </>
  )
}

/**
 * Apagar um play tira os pontos das meninas do ranking do mes e pode derrubar
 * sequencias, entao nao basta um "ok": tem que escrever APAGAR.
 */
function ConfirmarExclusao({ session, onClose }: { session: PlaySession; onClose: () => void }) {
  const { data, nameOf, deleteSession } = useStore()
  const [texto, setTexto] = useState('')
  const PALAVRA = 'APAGAR'

  const jogadas = useMemo(
    () => playedMatches(data, { sessionId: session.id }),
    [data, session.id],
  )
  const perdas = useMemo(() => rankPlayers(computeStats(jogadas), nameOf), [jogadas, nameOf])
  const finalizado = session.status === 'finished'
  const avulso = session.ranked === false

  return (
    <Modal title="Apagar este play?" onClose={onClose}>
      <div className="banner err" style={{ marginTop: 0 }}>
        <strong>{session.title}</strong> — {dateLabel(session.date)}
        <br />
        Isso apaga <strong>{jogadas.length} partida(s) já jogada(s)</strong> e não tem como desfazer.
      </div>

      {perdas.length > 0 && (
        <>
          <p className="tiny muted" style={{ marginBottom: 6 }}>
            {avulso
              ? 'Este play é avulso, então nada sai do ranking do mês — mas estes pontos somem do histórico das jogadoras:'
              : 'Estes pontos saem do ranking do mês:'}
          </p>
          <div className="stack" style={{ marginBottom: 12 }}>
            {perdas.slice(0, 5).map((s) => (
              <div key={s.player_id} className="row tiny" style={{ gap: 8 }}>
                <span className="grow ellipsis">{nameOf(s.player_id)}</span>
                <strong style={{ color: 'var(--pink)' }}>−{s.points} pts</strong>
              </div>
            ))}
            {perdas.length > 5 && (
              <div className="tiny muted">e mais {perdas.length - 5} jogadora(s).</div>
            )}
          </div>
        </>
      )}

      {finalizado && !avulso && (
        <div className="banner warn">
          🔥 Este play já foi finalizado. Apagar também <strong>refaz as sequências</strong>: quem
          subiu ao pódio nesse dia pode perder o status.
        </div>
      )}

      <label className="field">
        <span>Para confirmar, escreva {PALAVRA}</span>
        <input
          className="input"
          value={texto}
          autoCapitalize="characters"
          placeholder={PALAVRA}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      <button
        className="btn danger block"
        style={{ marginTop: 12 }}
        disabled={texto.trim().toUpperCase() !== PALAVRA}
        onClick={() => { void deleteSession(session.id); onClose() }}
      >
        🗑 Apagar o play e os {jogadas.length} resultado(s)
      </button>
      <button className="btn ghost block sm" style={{ marginTop: 8 }} onClick={onClose}>
        Cancelar
      </button>
    </Modal>
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
  const { data, saveSession, saveMatches, playerById, nameOf } = useStore()
  const [date, setDate] = useState(preset.date ?? todayISO())
  const [title, setTitle] = useState(preset.title ?? 'Play de Sexta')
  const [courts, setCourts] = useState(preset.courts ?? 3)
  const [format, setFormat] = useState<PlayFormat>(preset.format ?? 'todas')
  const [porGrupo, setPorGrupo] = useState(8)
  const [ranked, setRanked] = useState(preset.ranked ?? true)
  const [importando, setImportando] = useState(false)
  const [target, setTarget] = useState(preset.target ?? 4)
  const [selected, setSelected] = useState<string[]>(preset.player_ids ?? [])
  const [busy, setBusy] = useState(false)

  const available = [...data.players]
    .filter((p) => p.active || selected.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const maxCourts = Math.max(1, Math.floor(selected.length / 4))
  const effCourts = Math.min(courts, maxCourts)

  const forca = useMemo(() => ratings(data, date), [data, date])

  // no modo em grupos o app decide quantos grupos cabem: quem escolhe e o
  // tamanho, e a conta sai do numero de meninas que confirmaram
  const grupos = useMemo(
    () =>
      format === 'grupos' && selected.length >= 8
        ? formarGrupos(selected, forca, porGrupo)
        : [selected],
    [format, selected, forca, porGrupo],
  )
  const tamanhos = grupos.map((g) => g.length)

  const totalPartidas = tamanhos.reduce((t, n) => t + partidasDoRodizio(n), 0)
  const parceirasMin = Math.min(...tamanhos.map(parceirasDoRodizio))
  const parceirasMax = Math.max(...tamanhos.map(parceirasDoRodizio))
  const restPorVez = selected.length - effCourts * 4

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
      const emGrupos = format === 'grupos' && grupos.length > 1
      const fila = gerarFila({
        playerIds: selected,
        ratings: forca,
        history: buildHistory(playedMatches(data)),
        groups: emGrupos ? grupos : undefined,
      })
      const session: PlaySession = {
        id: uid(),
        date,
        title: title.trim() || 'Play de Sexta',
        courts: effCourts,
        rounds: fila.length, // a coluna se chama rounds; hoje e o total de partidas
        target,
        player_ids: selected,
        status: 'open',
        created_at: new Date().toISOString(),
        format: emGrupos ? 'grupos' : 'todas',
        groups: emGrupos ? grupos : null,
        ranked,
      }
      await saveSession(session)
      await saveMatches(planToMatches(session.id, fila))
      onToast('Partidas geradas! 🎾')
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
          <div className="grid2">
            <div className="field">
              <span>Quadras</span>
              <Stepper value={courts} min={1} max={12} onChange={setCourts} />
              <em className={`hint${selected.length >= 4 && effCourts < courts ? ' aviso' : ''}`}>
                {selected.length < 4
                  ? 'cada quadra comporta 4 meninas por vez'
                  : effCourts < courts
                    ? `só dá para usar ${effCourts}`
                    : 'quadras disponíveis hoje'}
              </em>
            </div>
            <div className="field">
              <span>Vai até</span>
              <Stepper value={target} min={1} max={21} onChange={setTarget} />
              <em className="hint">pontos para vencer a partida — o padrão é 4</em>
            </div>
          </div>

          <div className="field">
            <span>Formato</span>
            <div className="segmented">
              <button className={format === 'todas' ? 'on' : ''} onClick={() => setFormat('todas')}>
                🔁 Todas com todas
              </button>
              <button className={format === 'grupos' ? 'on' : ''} onClick={() => setFormat('grupos')}>
                🅰️ Em grupos
              </button>
            </div>
            <em className="hint">
              {format === 'todas'
                ? 'cada menina faz dupla com cada uma das outras exatamente uma vez'
                : 'o mesmo rodízio, mas dentro de cada grupo — os grupos saem por nível, os pontos continuam individuais e o ranking do dia é um só'}
            </em>
          </div>

          <div className={`toggle-card${ranked ? '' : ' avulso'}`}>
            <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={ranked} onChange={(e) => setRanked(e.target.checked)} />
              <span className="grow">
                <strong>{ranked ? '🏆 Vale para o campeonato' : '🎈 Play avulso'}</strong>
                <span className="hint" style={{ marginTop: 2 }}>
                  {ranked
                    ? 'os pontos entram no ranking do mês e as sequências 🔥 correm normalmente'
                    : 'não soma pontos no ranking do mês e não mexe nas sequências 🔥 — mas conta no histórico da jogadora e no equilíbrio das duplas dos próximos plays'}
                </span>
              </span>
            </label>
          </div>

          {format === 'grupos' && (
            <div className="toggle-card">
              <div className="field" style={{ marginBottom: 0 }}>
                <span>Meninas por grupo</span>
                <Stepper value={porGrupo} min={4} max={12} onChange={setPorGrupo} />
                <em className="hint">
                  {selected.length < 8
                    ? 'com menos de 8 confirmadas não dá para dividir: vai sair um grupo só'
                    : `com ${selected.length} confirmadas o app monta ${descreverGrupos(tamanhos)} — grupo 1 com quem está indo melhor nos últimos ${PLAYS_PARA_FORCA} plays`}
                </em>
              </div>
            </div>
          )}

          <p className="tiny muted" style={{ margin: '2px 2px 0' }}>
            {selected.length < 4 ? (
              'Escolha as jogadoras abaixo para o app calcular as partidas.'
            ) : (
              <>
                <strong>{totalPartidas} partidas</strong> no total, entrando conforme as quadras vagam.
                Cada uma faz dupla com{' '}
                <strong>
                  {parceirasMin === parceirasMax
                    ? `as outras ${parceirasMin}`
                    : `${parceirasMin} a ${parceirasMax} parceiras`}
                </strong>
                , exatamente uma vez com cada.
              </>
            )}{' '}
            Quem vence leva <strong>{target} menos os games da adversária</strong> em pontos.
          </p>

          {selected.length >= 4 && effCourts < courts && (
            <div className="banner err" style={{ margin: '10px 0 0' }}>
              🏐 <strong>Não dá para usar {courts} quadras com {selected.length} jogadoras.</strong>{' '}
              Cada quadra ocupa 4 meninas ao mesmo tempo, então {courts} quadras precisam de{' '}
              <strong>{courts * 4} jogadoras</strong> jogando juntas —{' '}
              {courts * 4 - selected.length === 1
                ? 'falta 1 jogadora'
                : `faltam ${courts * 4 - selected.length} jogadoras`}.
              <br />
              Vou montar o play com <strong>{effCourts} quadra(s)</strong>
              {restPorVez > 0 && <>, revezando quem fica de fora</>}.
            </div>
          )}

          {selected.length >= 4 && effCourts === courts && restPorVez === 0 && (
            <div className="banner warn" style={{ margin: '10px 0 0' }}>
              🪑 Com <strong>{selected.length} jogadoras em {effCourts} quadras</strong> todas jogam
              ao mesmo tempo e <strong>ninguém fica de fora</strong>. Só que as quadras nunca
              terminam juntas: a que acabar primeiro vai esperar as outras, porque as quatro meninas
              da próxima partida ainda estão jogando. Com pelo menos <strong>4 de folga</strong>{' '}
              ({effCourts * 4 + 4} jogadoras para {effCourts} quadras) o rodízio anda sozinho e todo
              mundo descansa entre um jogo e outro.
            </div>
          )}

          {format === 'todas' && totalPartidas > 40 && (
            <div className="banner warn" style={{ margin: '10px 0 0' }}>
              ⏱️ São <strong>{totalPartidas} partidas</strong> e cada uma joga {parceirasMax} vezes —
              pode ser longo para uma noite só. O modo <strong>em grupos</strong> resolve isso:
              com grupos de 8 cada menina joga 7 partidas.
            </div>
          )}

          {format === 'grupos' && grupos.length > 1 && (
            <div className="stack" style={{ marginTop: 4 }}>
              {grupos.map((g, i) => (
                <div key={i} className="grupo-box">
                  <div className="grupo-nome">Grupo {i + 1} · {g.length} meninas · {partidasDoRodizio(g.length)} partidas</div>
                  <div className="tiny">{g.map(nameOf).join(' · ')}</div>
                </div>
              ))}
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
            Com <strong>{selected.length} jogadoras</strong> dá para usar <strong>{effCourts} quadra(s)</strong> ao mesmo tempo
            {restPorVez > 0 ? ` (${restPorVez} esperam a vez, e entra sempre quem está fora há mais tempo)` : ' (todas jogam ao mesmo tempo)'}.
            {effCourts < courts && ' Ajustei o número de quadras para caber todo mundo.'}
            <br />
            Para equilibrar as duplas e dividir os grupos, o app usa a forma dos{' '}
            <strong>últimos {PLAYS_PARA_FORCA} plays</strong> — não o ranking do mês nem o
            histórico inteiro. Assim quem está indo bem agora é que pega o grupo forte, e a
            virada do mês não desequilibra nada.
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
        {busy ? 'Montando as duplas…' : `✨ Gerar ${totalPartidas || ''} partidas e começar`}
      </button>
    </>
  )
}

/** "2 grupos de 8" quando dao certo, "3 grupos: 7, 7 e 6" quando nao. */
function descreverGrupos(tamanhos: number[]): string {
  const n = tamanhos.length
  if (n === 1) return `1 grupo de ${tamanhos[0]}`
  if (tamanhos.every((t) => t === tamanhos[0])) return `${n} grupos de ${tamanhos[0]}`
  const lista = tamanhos.slice(0, -1).join(', ') + ' e ' + tamanhos[n - 1]
  return `${n} grupos: ${lista}`
}

/** Devolve a partida com uma jogadora trocada por outra. */
function trocarNaPartida(m: Match, sai: string, entra: string): Match {
  const troca = (id: string) => (id === sai ? entra : id)
  return {
    ...m,
    team_a: m.team_a.map(troca) as [string, string],
    team_b: m.team_b.map(troca) as [string, string],
  }
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
  /** Partida escolhida na mao para uma quadra, no lugar da sugestao. */
  const [manuais, setManuais] = useState<Record<number, string>>({})
  const [escolhendo, setEscolhendo] = useState<number | null>(null)

  const matches = useMemo(
    () =>
      data.matches
        .filter((m) => m.session_id === session.id)
        .sort((a, b) => a.round - b.round || a.court - b.court),
    [data.matches, session.id],
  )

  const dayRows = useMemo(() => {
    const ms = playedMatches(data, { sessionId: session.id })
    return rankPlayers(computeStats(ms), nameOf)
  }, [data, session.id, nameOf])

  const doneCount = matches.filter(isPlayed).length
  const finished = session.status === 'finished'
  const grupos = session.groups ?? null
  const grupoDe = useMemo(() => {
    const map = new Map<string, number>()
    grupos?.forEach((g, i) => g.forEach((id) => map.set(id, i + 1)))
    return map
  }, [grupos])

  // sequencias que avancaram neste play (so existe depois de finalizado)
  const passos = useMemo(
    () => computeStreaks(data).steps.filter((x) => x.session_id === session.id && x.streak >= 2),
    [data, session.id],
  )
  const award = passos[0]
  const awardLevel = award ? streakLevel(award.streak) : null

  // inicios e fins guardados no proprio celular, para nao dependerem da volta
  // do banco (ver src/lib/emQuadra.ts)
  const [inicios, setInicios] = useState<Horarios>(() => loadInicios())
  const [fins, setFins] = useState<Horarios>(() => loadFins())

  function marcarInicio(id: string, quando: string | null) {
    setInicios((prev) => {
      const next = { ...prev }
      if (quando) next[id] = quando
      else delete next[id]
      saveInicios(next)
      return next
    })
  }

  function marcarFim(id: string, quando: string | null) {
    setFins((prev) => {
      const next = { ...prev }
      if (quando) next[id] = quando
      else delete next[id]
      saveFins(next)
      return next
    })
  }

  // limpa marcacoes de inicio de partidas que ja tem placar
  useEffect(() => {
    const vivas = new Set(matches.filter((m) => !isPlayed(m)).map((m) => m.id))
    const sujas = Object.keys(inicios).filter((id) => !vivas.has(id) && matches.some((m) => m.id === id))
    if (sujas.length === 0) return
    setInicios((prev) => {
      const next = { ...prev }
      for (const id of sujas) delete next[id]
      saveInicios(next)
      return next
    })
  }, [matches, inicios])

  const iniciada = (m: Match) => !isPlayed(m) && !!(m.started_at ?? inicios[m.id])

  /** Hora em que a partida entrou em quadra (banco ou celular), se estiver rolando. */
  function inicioDe(m: Match): string | null {
    if (isPlayed(m)) return null
    return m.started_at ?? inicios[m.id] ?? null
  }

  const emJogo = useMemo(() => matches.filter(iniciada), [matches, inicios])
  const pendentes = useMemo(
    () => matches.filter((m) => !isPlayed(m) && !iniciada(m)),
    [matches, inicios],
  )
  const jogadas = useMemo(() => matches.filter(isPlayed), [matches])

  const ocupadas = useMemo(() => {
    const s = new Set<string>()
    for (const m of emJogo) for (const id of jogadorasDaPartida(m)) s.add(id)
    return s
  }, [emJogo])

  /** Quantas partidas cada uma ja fez hoje. */
  const jogos = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of jogadas) for (const id of jogadorasDaPartida(m)) map.set(id, (map.get(id) ?? 0) + 1)
    return map
  }, [jogadas])

  /**
   * Fila de espera: 0 e quem esta fora ha mais tempo. Sem hora registrada
   * (banco antigo, outro aparelho) a jogadora conta como "jogou ha muito".
   */
  const espera = useMemo(() => {
    const ultimo = new Map<string, number>()
    for (const m of jogadas) {
      const iso = m.ended_at ?? fins[m.id] ?? null
      const t = iso ? Date.parse(iso) : 0
      for (const id of jogadorasDaPartida(m)) {
        ultimo.set(id, Math.max(ultimo.get(id) ?? 0, Number.isNaN(t) ? 0 : t))
      }
    }
    return ordemDeEspera(session.player_ids, (id) => ultimo.get(id) ?? null)
  }, [jogadas, fins, session.player_ids])

  const quadras = useMemo(
    () => Array.from({ length: Math.max(1, session.courts) }, (_, i) => i + 1),
    [session.courts],
  )
  const emQuadra = useMemo(() => {
    const map = new Map<number, Match>()
    for (const m of emJogo) if (!map.has(m.court)) map.set(m.court, m)
    return map
  }, [emJogo])
  const quadrasLivres = quadras.filter((q) => !emQuadra.has(q))

  /** Sugestao de proxima partida por quadra livre, respeitando escolhas na mao. */
  const proximas = useMemo(() => {
    const escolhidasNaMao = new Map<number, Match>()
    const reservadas = new Set<string>()
    for (const q of quadrasLivres) {
      const id = manuais[q]
      const m = id ? pendentes.find((x) => x.id === id) : undefined
      if (m) {
        escolhidasNaMao.set(q, m)
        reservadas.add(m.id)
      }
    }
    const restantes = quadrasLivres.filter((q) => !escolhidasNaMao.has(q))
    const ocupadasComManuais = new Set(ocupadas)
    for (const m of escolhidasNaMao.values()) {
      for (const id of jogadorasDaPartida(m)) ocupadasComManuais.add(id)
    }
    const auto = proximasDasQuadras({
      pendentes: pendentes.filter((m) => !reservadas.has(m.id)),
      ocupadas: ocupadasComManuais,
      espera,
      jogos,
      quadrasLivres: restantes,
    })
    return new Map([...escolhidasNaMao, ...auto])
  }, [quadrasLivres, manuais, pendentes, ocupadas, espera, jogos])

  /**
   * Quem nao esta disponivel para esta partida: as que estao em quadra agora e
   * as que ja foram escaladas para a proxima partida de outra quadra.
   */
  function ocupadasFora(m: Match): Set<string> {
    const fora = new Set<string>()
    for (const atual of [...emJogo, ...proximas.values()]) {
      if (atual.id === m.id) continue
      for (const id of jogadorasDaPartida(atual)) fora.add(id)
    }
    return fora
  }

  /** Quem nao esta nem jogando nem escalada para nenhuma quadra. */
  const livresAgora = useMemo(() => {
    const comprometidas = new Set(ocupadas)
    for (const m of proximas.values()) for (const id of jogadorasDaPartida(m)) comprometidas.add(id)
    return session.player_ids.filter((id) => !comprometidas.has(id))
  }, [ocupadas, proximas, session.player_ids])

  /**
   * A fila de verdade: o que sobra depois das quadras, na ordem em que deve
   * acontecer. Sem isto a tela mostrava a ordem de geracao, e quem tinha
   * acabado de jogar aparecia na frente de quem ainda nem tinha entrado.
   */
  const filaPrevista = useMemo(() => {
    const naQuadra = new Set([...proximas.values()].map((m) => m.id))
    const comprometidas = new Set(ocupadas)
    for (const m of proximas.values()) {
      for (const id of jogadorasDaPartida(m)) comprometidas.add(id)
    }
    return ordemPrevista({
      pendentes: pendentes.filter((m) => !naQuadra.has(m.id)),
      espera,
      ocupadas: comprometidas,
      jogadoras: session.player_ids,
    })
  }, [pendentes, proximas, ocupadas, espera, session.player_ids])

  /** Duplas que aparecem mais de uma vez no dia (sobra do rodizio impar). */
  const duplasRepetidas = useMemo(() => {
    const vistas = new Map<string, string>() // dupla -> id da primeira partida
    const repetidas = new Set<string>() // ids de partida que repetem uma dupla
    for (const m of matches) {
      for (const d of [m.team_a, m.team_b]) {
        const k = pairKey(d[0], d[1])
        if (vistas.has(k) && vistas.get(k) !== m.id) repetidas.add(m.id)
        else if (!vistas.has(k)) vistas.set(k, m.id)
      }
    }
    return repetidas
  }, [matches])

  function setScore(m: Match, a: number | null, b: number | null) {
    // lancar o placar tambem encerra a partida: a quadra fica livre de novo
    const agora = new Date().toISOString()
    marcarInicio(m.id, null)
    const encerrando = a !== null && b !== null
    marcarFim(m.id, encerrando ? agora : null)
    saveMatches([{ ...m, score_a: a, score_b: b, started_at: null, ended_at: encerrando ? agora : null }])
  }

  /** Botao "partida iniciada": e a partir daqui que o app sabe quem esta em quadra. */
  function iniciar(m: Match, quadra: number) {
    const agora = new Date().toISOString()
    marcarInicio(m.id, agora)
    setManuais((prev) => {
      const next = { ...prev }
      delete next[quadra]
      return next
    })
    saveMatches([{ ...m, court: quadra, started_at: agora }])
  }

  function cancelarInicio(m: Match) {
    marcarInicio(m.id, null)
    saveMatches([{ ...m, court: 0, started_at: null }])
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

  /**
   * Refaz so o que ainda nao aconteceu: junta as duplas que ainda faltam
   * formar e monta as partidas em cima do que ja foi jogado hoje.
   */
  async function regenerarPendentes() {
    const naFila = matches.filter((m) => !isPlayed(m) && !iniciada(m))
    if (naFila.length === 0) {
      onToast('Não há partidas na fila para refazer')
      return
    }
    const fila = refazerFila({
      playerIds: session.player_ids,
      groups: session.groups ?? undefined,
      jogadas,
      ratings: ratings(data, session.date),
      history: buildHistory(playedMatches(data).filter((m) => m.session_id !== session.id)),
      historyWeight: 1,
    })
    const preservadas = matches.filter((m) => isPlayed(m) || iniciada(m))
    // a fila nova entra depois da ultima posicao ja usada, para nao haver duas
    // partidas com o mesmo numero na lista
    const ultima = preservadas.reduce((n, m) => Math.max(n, m.round), 0)
    const novas = planToMatches(session.id, fila).map((m, i) => ({
      ...m,
      round: ultima + i + 1,
    }))
    await replaceSessionMatches(session.id, [...preservadas, ...novas])
    await saveSession({ ...session, rounds: preservadas.length + novas.length })
    onToast(`${novas.length} partida(s) refeita(s) 🔄`)
  }

  async function regenerate() {
    if (doneCount > 0 && !confirm('Já existem placares lançados. Gerar novas duplas apaga todos os resultados deste play. Continuar?')) return
    const fila = gerarFila({
      playerIds: session.player_ids,
      groups: session.groups ?? undefined,
      ratings: ratings(data, session.date),
      history: buildHistory(playedMatches(data).filter((m) => m.session_id !== session.id)),
    })
    await replaceSessionMatches(session.id, planToMatches(session.id, fila))
    await saveSession({ ...session, rounds: fila.length })
    onToast('Novas duplas geradas 🔄')
  }

  async function finish() {
    if (doneCount < matches.length && !confirm(`Ainda faltam ${matches.length - doneCount} partidas sem placar. Finalizar mesmo assim?`)) return
    await saveSession({ ...session, status: 'finished' })
    setShowRank(true)
    onToast('Play finalizado! Pontos somados ao ranking do mês 🏆')
  }

  /** Troca as ocupadas por quem esta livre, mantendo equilibrio e duplas novas. */
  function liberarQuadra(m: Match) {
    const indisponiveis = new Set(ocupadas)
    for (const p of proximas.values()) {
      if (p.id === m.id) continue
      for (const id of jogadorasDaPartida(p)) indisponiveis.add(id)
    }
    const trocas = liberarPartida({
      time: jogadorasDaPartida(m) as [string, string, string, string],
      ocupadas: indisponiveis,
      todas: session.player_ids,
      espera,
      ratings: ratings(data, session.date),
      history: buildHistory(playedMatches(data)),
    })
    if (trocas.length === 0) {
      onToast('Não há ninguém livre para entrar agora')
      return
    }
    let atualizada = m
    for (const t of trocas) atualizada = trocarNaPartida(atualizada, t.sai, t.entra)
    saveMatches([atualizada])
    onToast(trocas.map((t) => `${nameOf(t.sai)} → ${nameOf(t.entra)}`).join(' · '))
  }

  function trocar(m: Match, sai: string, entra: string) {
    saveMatches([trocarNaPartida(m, sai, entra)])
  }

  const editable = canEdit && !finished

  return (
    <>
      <div className="card">
        <div className="row spread">
          <button className="btn ghost sm" onClick={onBack}>← Plays</button>
          <span className="row" style={{ gap: 6 }}>
            {session.ranked === false && <span className="badge avulso">avulso</span>}
            <span className={`badge ${session.status}`}>{finished ? 'finalizado' : 'em andamento'}</span>
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{session.title}</div>
          <div className="small muted">
            {dateLabel(session.date)} · {session.player_ids.length} jogadoras · {session.courts} quadras
            {grupos && grupos.length > 1 && ` · ${grupos.length} grupos`} · até {session.target} pontos
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <StatBox k="Partidas" v={`${doneCount}/${matches.length}`} />
          <StatBox k="Em quadra" v={emJogo.length} />
          <StatBox k="Líder do dia" v={<span style={{ fontSize: 13 }}>{dayRows[0] ? nameOf(dayRows[0].player_id).split(' ')[0] : '—'}</span>} />
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn ghost sm" onClick={async () => {
            const ok = await shareOrCopy(
              scheduleText(session.date, session.title, session.courts, matches, nameOf, grupos),
            )
            onToast(ok ? 'Partidas copiadas 💬' : 'Não consegui copiar')
          }}>💬 Enviar partidas</button>
          <button className="btn ghost sm" onClick={() => setShowRank(true)}>🏆 Ranking do dia</button>
          {editable && (
            <>
              <button className="btn ghost sm" onClick={() => void regenerarPendentes()}>
                🔄 Refazer a fila
              </button>
              <button className="btn ghost sm" onClick={() => void regenerate()}>♻️ Refazer tudo</button>
            </>
          )}
        </div>
      </div>

      {session.ranked === false && (
        <div className="banner info">
          🎈 <strong>Play avulso.</strong> Os pontos deste dia <strong>não entram no ranking
          do mês</strong> e não mexem nas sequências 🔥 — mas ficam no histórico de cada
          jogadora e continuam ajudando a equilibrar as duplas dos próximos plays.
        </div>
      )}

      {grupos && grupos.length > 1 && (
        <div className="card">
          <div className="section-title">🅰️ Grupos</div>
          <div className="stack">
            {grupos.map((g, i) => (
              <div key={i} className="grupo-box">
                <div className="grupo-nome">Grupo {i + 1} · {g.length} meninas</div>
                <div className="tiny">{g.map(nameOf).join(' · ')}</div>
              </div>
            ))}
          </div>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Cada grupo é um rodízio próprio, mas os pontos são individuais e o ranking do dia é um só.
          </p>
        </div>
      )}

      <div className="card">
        <div className="section-title">🏐 Quadras agora</div>
        {matches.length === 0 ? (
          <Empty>Nenhuma partida gerada.</Empty>
        ) : (
          quadras.map((q) => {
            const atual = emQuadra.get(q)
            const proxima = proximas.get(q)
            const m = atual ?? proxima
            if (!m) {
              return (
                <QuadraEsperando
                  key={q}
                  quadra={q}
                  restam={pendentes.length}
                  livres={livresAgora}
                  editable={editable}
                  onMontar={() => {
                    const alvo = pendentes[0]
                    if (alvo) liberarQuadra(alvo)
                  }}
                />
              )
            }
            return (
              <MatchCard
                key={m.id}
                match={m}
                quadra={q}
                target={session.target}
                editable={editable}
                iniciada={!!atual}
                inicio={inicioDe(m)}
                ocupadas={ocupadasFora(m)}
                jogando={ocupadas}
                grupo={grupoDe.get(m.team_a[0])}
                totalGrupos={grupos?.length ?? 1}
                repetida={duplasRepetidas.has(m.id)}
                espera={espera}
                onScore={setScore}
                onIniciar={() => iniciar(m, q)}
                onCancelarInicio={() => cancelarInicio(m)}
                onTrocar={(sai, entra) => trocar(m, sai, entra)}
                onTrocarPartida={pendentes.length > 1 ? () => setEscolhendo(q) : undefined}
                jogadorasDoPlay={session.player_ids}
              />
            )
          })
        )}
      </div>

      <ListaDePartidas
        titulo="⏭️ Próximas na fila"
        vazio="Nada na fila."
        rodape="A ordem segue quem está fora há mais tempo, igual às quadras — não é a ordem em que as partidas foram geradas. As duplas não mudam."
        partidas={filaPrevista}
        numerar
        jogos={jogos}
        grupoDe={grupoDe}
        totalGrupos={grupos?.length ?? 1}
        repetidas={duplasRepetidas}
        emQuadra={ocupadas}
      />

      <ListaDePartidas
        titulo={`✅ Já jogadas (${jogadas.length})`}
        vazio="Nenhum placar lançado ainda."
        partidas={[...jogadas].reverse()}
        grupoDe={grupoDe}
        totalGrupos={grupos?.length ?? 1}
        repetidas={duplasRepetidas}
        emQuadra={ocupadas}
        target={session.target}
        editable={editable}
        onLimparPlacar={(m) => setScore(m, null, null)}
      />

      {editable && (
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
              target: session.target,
              player_ids: session.player_ids,
              format: session.format,
              ranked: session.ranked,
            })
          }
        >
          ➡️ Gerar as duplas do próximo play
        </button>
      )}

      {escolhendo !== null && (
        <EscolherPartida
          quadra={escolhendo}
          partidas={pendentes}
          ocupadas={ocupadas}
          espera={espera}
          grupoDe={grupoDe}
          totalGrupos={grupos?.length ?? 1}
          onEscolher={(m) => {
            setManuais((prev) => ({ ...prev, [escolhendo]: m.id }))
            setEscolhendo(null)
          }}
          onClose={() => setEscolhendo(null)}
        />
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

/* ------------------------------------------------------------ partidas */

/**
 * Quadra vaga sem partida possivel: todas as partidas que faltam pegam
 * alguem que ja esta em quadra ou escalada para outra. Em vez de sugerir a
 * mesma menina em duas quadras, a tela diz o que esta travando e oferece
 * montar uma partida com quem esta livre.
 */
function QuadraEsperando({
  quadra,
  restam,
  livres,
  editable,
  onMontar,
}: {
  quadra: number
  restam: number
  livres: string[]
  editable: boolean
  onMontar: () => void
}) {
  const { nameOf } = useStore()
  return (
    <div className="match vazia">
      <div className="match-head"><span>Quadra {quadra}</span><span>livre</span></div>
      {restam === 0 ? (
        <div className="tiny muted">
          Acabou a fila — todas as partidas já foram jogadas ou estão em quadra.
        </div>
      ) : (
        <>
          <div className="tiny muted">
            Nenhuma das {restam} partidas que faltam tem quatro meninas livres agora.
          </div>
          {livres.length > 0 ? (
            <>
              <div className="tiny" style={{ marginTop: 6 }}>
                <strong>Livres agora:</strong> {livres.map(nameOf).join(', ')}
              </div>
              {editable && livres.length >= 1 && (
                <button className="btn pink sm block" style={{ marginTop: 8 }} onClick={onMontar}>
                  🔄 Montar partida com quem está livre
                </button>
              )}
            </>
          ) : (
            <div className="tiny muted" style={{ marginTop: 6 }}>
              Todas as meninas estão em quadra. Assim que um placar for lançado, esta quadra recebe
              a próxima partida.
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Livre · escalada para a próxima de outra quadra · jogando agora. */
function Situacao({
  id,
  ocupadas,
  jogando,
}: {
  id: string
  ocupadas: Set<string>
  jogando: Set<string>
}) {
  const texto = jogando.has(id) ? 'em quadra' : ocupadas.has(id) ? 'próxima partida' : 'livre'
  const cor = jogando.has(id) ? 'var(--orange)' : ocupadas.has(id) ? 'var(--purple)' : 'var(--teal)'
  return (
    <span className="tiny nowrap" style={{ fontWeight: 800, color: cor }}>{texto}</span>
  )
}

function GrupoTag({ grupo, total }: { grupo?: number; total: number }) {
  if (!grupo || total <= 1) return null
  return <span className={`grupo-tag g${((grupo - 1) % 4) + 1}`}>G{grupo}</span>
}

function Duo({ ids, ocupadas }: { ids: [string, string]; ocupadas?: Set<string> }) {
  const { nameOf, playerById } = useStore()
  return (
    <>
      <Avatar player={playerById(ids[0])} size={26} />
      <Avatar player={playerById(ids[1])} size={26} />
      <span className="names">
        {ids.map((id, i) => (
          <span key={id}>
            {i > 0 && <span className="muted"> + </span>}
            <span className={ocupadas?.has(id) ? 'ocupada' : undefined}>
              {nameOf(id)}
              {ocupadas?.has(id) && ' ⏳'}
            </span>
          </span>
        ))}
      </span>
    </>
  )
}

function MatchCard({
  match,
  quadra,
  target,
  editable,
  iniciada,
  inicio,
  ocupadas,
  jogando,
  grupo,
  totalGrupos,
  repetida,
  espera,
  jogadorasDoPlay,
  onScore,
  onIniciar,
  onCancelarInicio,
  onTrocar,
  onTrocarPartida,
}: {
  match: Match
  quadra: number
  target: number
  editable: boolean
  iniciada: boolean
  inicio: string | null
  /** Indisponiveis: jogando agora ou ja escaladas para outra quadra. */
  ocupadas: Set<string>
  /** Das indisponiveis, quem esta de fato com a partida rolando. */
  jogando: Set<string>
  grupo?: number
  totalGrupos: number
  repetida: boolean
  espera: Map<string, number>
  jogadorasDoPlay: string[]
  onScore: (m: Match, a: number | null, b: number | null) => void
  onIniciar: () => void
  onCancelarInicio: () => void
  onTrocar: (sai: string, entra: string) => void
  onTrocarPartida?: () => void
}) {
  const { nameOf } = useStore()
  const [winner, setWinner] = useState<'a' | 'b' | null>(null)
  const [trocando, setTrocando] = useState(false)
  const noTime = jogadorasDaPartida(match)

  const modalTroca = trocando && (
    <TrocarJogadoras
      noTime={noTime}
      ocupadas={ocupadas}
      jogando={jogando}
      espera={espera}
      jogadorasDoPlay={jogadorasDoPlay}
      onTrocar={(sai, entra) => { onTrocar(sai, entra); setTrocando(false) }}
      onClose={() => setTrocando(false)}
    />
  )

  const cabecalho = (
    <div className="match-head">
      <span>
        Quadra {quadra} <GrupoTag grupo={grupo} total={totalGrupos} />
        {repetida && <span className="repetida-tag" title="dupla que joga uma segunda vez">🔁</span>}
      </span>
      <span>{iniciada ? '🟢 em quadra' : editable ? 'próxima' : 'sem placar'}</span>
    </div>
  )

  // ---- so leitura ----
  if (!editable) {
    return (
      <div className={`match${iniciada ? ' em-quadra' : ''}`}>
        {cabecalho}
        <div className="team"><Duo ids={match.team_a} /></div>
        <div className="vs">X</div>
        <div className="team"><Duo ids={match.team_b} /></div>
      </div>
    )
  }

  // ---- passo 2: quantos games a perdedora fez ----
  if (winner) {
    const loserIds = winner === 'a' ? match.team_b : match.team_a
    return (
      <div className="match live">
        <div className="match-head">
          <span>Quadra {quadra}</span>
          <button className="linkish" onClick={() => setWinner(null)}>‹ voltar</button>
        </div>
        <div className="team win">
          <Duo ids={winner === 'a' ? match.team_a : match.team_b} />
          <span className="score-box">{target}</span>
        </div>
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
    <div className={`match live${iniciada ? ' em-quadra' : ''}`}>
      {cabecalho}

      {iniciada ? (
        <div className="row spread" style={{ marginBottom: 8 }}>
          <span className="tiny" style={{ fontWeight: 800, color: 'var(--teal)' }}>
            Jogando desde {horaCurta(inicio as string)} — lance o placar para encerrar
          </span>
          <button className="linkish" onClick={onCancelarInicio}>desfazer</button>
        </div>
      ) : (
        <button className="btn teal sm block" style={{ marginBottom: 8 }} onClick={onIniciar}>
          ▶️ Partida iniciada
        </button>
      )}

      <button className="pick-team" onClick={() => setWinner('a')}>
        <Duo ids={match.team_a} ocupadas={iniciada ? undefined : ocupadas} />
        <span className="pick-tag">venceu</span>
      </button>
      <div className="vs">X</div>
      <button className="pick-team" onClick={() => setWinner('b')}>
        <Duo ids={match.team_b} ocupadas={iniciada ? undefined : ocupadas} />
        <span className="pick-tag">venceu</span>
      </button>

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn ghost sm grow" onClick={() => setTrocando(true)}>🔄 Trocar jogadora</button>
        {!iniciada && onTrocarPartida && (
          <button className="btn ghost sm grow" onClick={onTrocarPartida}>⏭️ Outra partida</button>
        )}
      </div>
      {modalTroca}
    </div>
  )
}

/** Lista compacta de partidas (fila e já jogadas), colapsável. */
function ListaDePartidas({
  titulo,
  vazio,
  rodape,
  partidas,
  numerar,
  jogos,
  grupoDe,
  totalGrupos,
  repetidas,
  emQuadra,
  target,
  editable,
  onLimparPlacar,
}: {
  titulo: string
  vazio: string
  /** Explicacao curta embaixo da lista. */
  rodape?: string
  partidas: Match[]
  /** Numera pela posicao na lista (a ordem prevista), nao pelo campo do banco. */
  numerar?: boolean
  /** Quantas partidas cada jogadora ja fez hoje. */
  jogos?: Map<string, number>
  grupoDe: Map<string, number>
  totalGrupos: number
  repetidas: Set<string>
  emQuadra: Set<string>
  target?: number
  editable?: boolean
  onLimparPlacar?: (m: Match) => void
}) {
  const { nameOf } = useStore()
  const [aberta, setAberta] = useState(false)
  const LIMITE = 5
  const visiveis = aberta ? partidas : partidas.slice(0, LIMITE)

  return (
    <div className="card">
      <div className="row spread">
        <div className="section-title" style={{ margin: 0 }}>{titulo}</div>
        {partidas.length > LIMITE && (
          <button className="btn ghost sm" onClick={() => setAberta((v) => !v)}>
            {aberta ? 'Ver menos' : `Ver todas (${partidas.length})`}
          </button>
        )}
      </div>
      {partidas.length === 0 ? (
        <Empty>{vazio}</Empty>
      ) : (
        <div className="stack" style={{ marginTop: 10 }}>
          {visiveis.map((m, i) => {
            const jogada = isPlayed(m)
            const [pa, pb] = jogada ? matchPoints(m.score_a as number, m.score_b as number) : [0, 0]
            const aWin = jogada && (m.score_a as number) > (m.score_b as number)
            // Quem ainda nao entrou em quadra nenhuma vez E esta esperando: e
            // por ela que o organizador procura. Quem esta jogando agora nao
            // conta como "ainda nao jogou", mesmo sem placar lancado.
            const novatas = jogos
              ? jogadorasDaPartida(m).filter(
                  (id) => (jogos.get(id) ?? 0) === 0 && !emQuadra.has(id),
                )
              : []
            return (
              <div key={m.id} className="fila-linha">
                <span className="fila-num">
                  {numerar ? `${i + 1}ª` : m.round}
                  <GrupoTag grupo={grupoDe.get(m.team_a[0])} total={totalGrupos} />
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className={`fila-time${jogada && aWin ? ' venceu' : ''}`}>
                    {nameOf(m.team_a[0])} + {nameOf(m.team_a[1])}
                    {jogada && <b> {m.score_a}</b>}
                    {jogada && pa > 0 && <i> +{pa}</i>}
                  </span>
                  <span className={`fila-time${jogada && !aWin ? ' venceu' : ''}`}>
                    {nameOf(m.team_b[0])} + {nameOf(m.team_b[1])}
                    {jogada && <b> {m.score_b}</b>}
                    {jogada && pb > 0 && <i> +{pb}</i>}
                  </span>
                  {repetidas.has(m.id) && (
                    <span className="tiny muted">🔁 dupla repetida (sobra do rodízio)</span>
                  )}
                  {novatas.length > 0 && (
                    <span className="tiny" style={{ color: 'var(--teal)', fontWeight: 700 }}>
                      🆕 {novatas.length === 4
                        ? 'as quatro ainda estão esperando a primeira partida'
                        : `${novatas.map(nameOf).join(', ')} ainda não ${novatas.length === 1 ? 'entrou' : 'entraram'} em quadra`}
                    </span>
                  )}
                  {!jogada && jogadorasDaPartida(m).some((id) => emQuadra.has(id)) && (
                    <span className="tiny muted">⏳ tem gente desta partida em quadra agora</span>
                  )}
                </span>
                {jogada && editable && onLimparPlacar && (
                  <button
                    className="btn ghost sm"
                    title={`partida até ${target} pontos`}
                    onClick={() => onLimparPlacar(m)}
                  >✏️</button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {rodape && partidas.length > 0 && (
        <p className="tiny muted" style={{ marginBottom: 0 }}>{rodape}</p>
      )}
    </div>
  )
}

function horaCurta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Troca de jogadora em duas etapas, com linhas grandes.
 * Antes era um toque no nome dentro da partida -- no celular, com nome
 * comprido, o nome era cortado e nao dava para acertar o dedo nele.
 */
function TrocarJogadoras({
  noTime,
  ocupadas,
  jogando,
  espera,
  jogadorasDoPlay,
  onTrocar,
  onClose,
}: {
  noTime: string[]
  ocupadas: Set<string>
  jogando: Set<string>
  espera: Map<string, number>
  jogadorasDoPlay: string[]
  onTrocar: (sai: string, entra: string) => void
  onClose: () => void
}) {
  const { nameOf, playerById } = useStore()
  const [sai, setSai] = useState<string | null>(null)

  const candidatas = jogadorasDoPlay
    .filter((id) => !noTime.includes(id))
    .sort((a, b) => {
      const oa = ocupadas.has(a) ? 1 : 0
      const ob = ocupadas.has(b) ? 1 : 0
      // livres primeiro, e entre elas quem esta fora ha mais tempo
      return oa - ob || (espera.get(a) ?? 0) - (espera.get(b) ?? 0)
    })

  if (!sai) {
    return (
      <Modal title="Quem sai da partida?" onClose={onClose}>
        <div className="stack">
          {noTime.map((id) => (
            <button key={id} className="duo-row" onClick={() => setSai(id)}>
              <Avatar player={playerById(id)} size={38} />
              <span className="grow ellipsis" style={{ fontWeight: 700 }}>{nameOf(id)}</span>
              {ocupadas.has(id) && <Situacao id={id} ocupadas={ocupadas} jogando={jogando} />}
            </button>
          ))}
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Quem entra no lugar de ${nameOf(sai)}?`} onClose={onClose}>
      <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => setSai(null)}>
        ‹ escolher outra
      </button>
      {candidatas.length === 0 ? (
        <Empty icon="👯">Todas as jogadoras já estão nesta partida.</Empty>
      ) : (
        <div className="stack">
          {candidatas.map((id) => (
            <button key={id} className="duo-row" onClick={() => onTrocar(sai, id)}>
              <Avatar player={playerById(id)} size={38} />
              <span className="grow ellipsis" style={{ fontWeight: 700 }}>{nameOf(id)}</span>
              <Situacao id={id} ocupadas={ocupadas} jogando={jogando} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

/** Escolher na mao qual partida da fila entra nesta quadra. */
function EscolherPartida({
  quadra,
  partidas,
  ocupadas,
  espera,
  grupoDe,
  totalGrupos,
  onEscolher,
  onClose,
}: {
  quadra: number
  partidas: Match[]
  ocupadas: Set<string>
  espera: Map<string, number>
  grupoDe: Map<string, number>
  totalGrupos: number
  onEscolher: (m: Match) => void
  onClose: () => void
}) {
  const { nameOf } = useStore()
  const ordenadas = [...partidas].sort((a, b) => {
    const la = jogadorasDaPartida(a).every((id) => !ocupadas.has(id)) ? 0 : 1
    const lb = jogadorasDaPartida(b).every((id) => !ocupadas.has(id)) ? 0 : 1
    const ea = jogadorasDaPartida(a).reduce((t, id) => t + (espera.get(id) ?? 0), 0)
    const eb = jogadorasDaPartida(b).reduce((t, id) => t + (espera.get(id) ?? 0), 0)
    return la - lb || ea - eb || a.round - b.round
  })

  return (
    <Modal title={`Qual partida entra na quadra ${quadra}?`} onClose={onClose}>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        As de cima são as que têm as quatro meninas livres e esperando há mais tempo.
      </p>
      <div className="stack">
        {ordenadas.slice(0, 30).map((m) => {
          const presas = jogadorasDaPartida(m).filter((id) => ocupadas.has(id))
          return (
            <button key={m.id} className="duo-row" onClick={() => onEscolher(m)} disabled={presas.length > 0}>
              <span className="fila-num">
                {m.round}
                <GrupoTag grupo={grupoDe.get(m.team_a[0])} total={totalGrupos} />
              </span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="fila-time">{nameOf(m.team_a[0])} + {nameOf(m.team_a[1])}</span>
                <span className="fila-time">{nameOf(m.team_b[0])} + {nameOf(m.team_b[1])}</span>
                {presas.length > 0 && (
                  <span className="tiny" style={{ color: 'var(--orange)' }}>
                    ⏳ {presas.map(nameOf).join(', ')} em quadra
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
