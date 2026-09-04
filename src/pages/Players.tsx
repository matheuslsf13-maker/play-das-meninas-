import { useRef, useState } from 'react'
import { Avatar, Empty, Modal } from '../components/ui'
import { squareThumb } from '../lib/image'
import { useStore } from '../lib/store'
import { uid, type Player } from '../lib/types'

export default function Players({ onToast }: { onToast: (m: string) => void }) {
  const { data, savePlayer, deletePlayer, mergePlayers, canEdit, repo } = useStore()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [juntando, setJuntando] = useState<Player | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const sorted = [...data.players].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'),
  )

  async function add() {
    const n = name.trim()
    if (!n) return
    const p: Player = {
      id: uid(),
      name: n,
      photo_url: null,
      active: true,
      created_at: new Date().toISOString(),
    }
    await savePlayer(p)
    setName('')
    onToast(`${n} entrou no grupo 🎾`)
  }

  async function pickPhoto(p: Player, file: File | undefined) {
    if (!file) return
    setBusy(p.id)
    try {
      const thumb = await squareThumb(file)
      const url = await repo.uploadPhoto(p.id, thumb)
      const antiga = p.photo_url
      savePlayer({ ...p, photo_url: url })
      if (antiga) await repo.deletePhoto(antiga) // nao deixa arquivo orfao
      onToast('Foto atualizada 📸')
    } catch (e) {
      onToast('Erro ao enviar a foto')
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  async function removePhoto(p: Player) {
    if (!p.photo_url) return
    if (!confirm(`Remover a foto de ${p.name}? No lugar dela voltam as iniciais.`)) return
    setBusy(p.id)
    try {
      const antiga = p.photo_url
      savePlayer({ ...p, photo_url: null })
      await repo.deletePhoto(antiga)
      onToast('Foto removida')
    } catch (e) {
      onToast('Erro ao remover a foto')
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {canEdit && (
        <div className="card">
          <div className="section-title">➕ Nova jogadora</div>
          <div className="row">
            <input
              className="input grow"
              placeholder="Nome da jogadora"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
            />
            <button className="btn pink" onClick={() => void add()} disabled={!name.trim()}>Add</button>
          </div>
        </div>
      )}

      {juntando && (
        <JuntarJogadoras
          origem={juntando}
          onClose={() => setJuntando(null)}
          onJuntar={(destinoId) => {
            mergePlayers(juntando.id, destinoId)
            setJuntando(null)
            onToast('Jogadoras juntadas 🔗')
          }}
        />
      )}

      <div className="card">
        <div className="section-title">👯 Jogadoras ({data.players.filter((p) => p.active).length} ativas)</div>
        {sorted.length === 0 ? (
          <Empty icon="👯">Cadastre as meninas do grupo para começar.</Empty>
        ) : (
          <div className="stack">
            {sorted.map((p) => (
              <div key={p.id} className="row" style={{ opacity: p.active ? 1 : 0.5 }}>
                <button
                  className="avatar"
                  title="Trocar foto"
                  style={{ width: 44, height: 44, border: 0, padding: 0, cursor: canEdit ? 'pointer' : 'default' }}
                  onClick={() => canEdit && fileRefs.current[p.id]?.click()}
                >
                  <Avatar player={p} size={44} />
                </button>
                <input
                  ref={(el) => { fileRefs.current[p.id] = el }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void pickPhoto(p, e.target.files?.[0])}
                />
                <div className="grow">
                  <div style={{ fontWeight: 700 }} className="ellipsis">{p.name}</div>
                  <div className="tiny muted">
                    {busy === p.id ? (
                      'salvando foto…'
                    ) : (
                      <>
                        {p.active ? 'ativa' : 'inativa'}
                        {canEdit && (
                          <>
                            {' · '}
                            <button className="linkish" onClick={() => fileRefs.current[p.id]?.click()}>
                              {p.photo_url ? 'trocar foto' : 'pôr foto'}
                            </button>
                            {p.photo_url && (
                              <>
                                {' · '}
                                <button className="linkish" onClick={() => void removePhoto(p)}>
                                  remover foto
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <>
                    <button className="btn ghost sm" onClick={() => void savePlayer({ ...p, active: !p.active })}>
                      {p.active ? 'Pausar' : 'Ativar'}
                    </button>
                    <button className="btn ghost sm" title="juntar com outra jogadora" onClick={() => setJuntando(p)}>
                      🔗
                    </button>
                    <button
                      className="btn danger sm"
                      onClick={() => {
                        if (confirm(`Remover ${p.name}? O histórico de partidas dela continua salvo.`)) {
                          void deletePlayer(p.id)
                        }
                      }}
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Criou a mesma atleta duas vezes? Toque em <strong>🔗</strong> para juntar as duas:
          partidas, pontos e sequência das duas passam para a que ficar.{' '}
          A foto aparece no pódio do ranking mensal. Toque na foto (ou em <em>pôr/trocar foto</em>) para escolher,
          e em <em>remover foto</em> para voltar às iniciais.
          Quem está <strong>pausada</strong> não aparece na hora de montar o play, mas mantém o histórico.
        </p>
      </div>
    </>
  )
}

/** Junta uma jogadora duplicada em outra, preservando o historico das duas. */
function JuntarJogadoras({
  origem,
  onClose,
  onJuntar,
}: {
  origem: Player
  onClose: () => void
  onJuntar: (destinoId: string) => void
}) {
  const { data } = useStore()
  const [destino, setDestino] = useState('')
  const outras = [...data.players]
    .filter((p) => p.id !== origem.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const alvo = outras.find((p) => p.id === destino)
  const jogos = data.matches.filter((m) => [...m.team_a, ...m.team_b].includes(origem.id)).length

  return (
    <Modal title={`Juntar ${origem.name}`} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Use quando a mesma atleta foi criada duas vezes com nomes diferentes.
        As <strong>{jogos} partida(s)</strong> de {origem.name} passam para a jogadora escolhida,
        somando pontos e mantendo a sequência dela. Depois disso, <strong>{origem.name}</strong> deixa de existir.
      </p>
      <label className="field">
        <span>{origem.name} é a mesma pessoa que…</span>
        <select className="select" value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">escolha a jogadora que fica</option>
          {outras.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <button
        className="btn pink block"
        style={{ marginTop: 12 }}
        disabled={!alvo}
        onClick={() => {
          if (!alvo) return
          if (
            confirm(
              `Juntar "${origem.name}" em "${alvo.name}"?\n\n` +
                `As partidas de ${origem.name} passam para ${alvo.name} e o nome "${origem.name}" some da lista.\n\n` +
                `Essa ação não tem volta.`,
            )
          ) {
            onJuntar(alvo.id)
          }
        }}
      >
        🔗 Juntar em {alvo?.name ?? '…'}
      </button>
    </Modal>
  )
}
