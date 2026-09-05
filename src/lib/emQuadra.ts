/**
 * Quais partidas estao em quadra agora e quando cada uma terminou, guardado
 * tambem no proprio celular.
 *
 * O banco tem as colunas `started_at` e `ended_at`, mas o app nao pode
 * depender so delas: se o script 04/05 ainda nao rodou, ou a escrita demora, o
 * tempo real devolve a partida sem o inicio e o botao "voltaria" sozinho. Com
 * esta camada local o inicio e o fim se mantem na tela de quem esta
 * organizando, mesmo offline.
 *
 * O fim alimenta o "quem esta fora ha mais tempo", que decide quem entra na
 * proxima partida.
 */

const KEY = 'play-de-sexta:em-quadra'
const KEY_FIM = 'play-de-sexta:fim-das-partidas'

export type Horarios = Record<string, string> // match_id -> ISO

function ler(chave: string): Horarios {
  try {
    const raw = localStorage.getItem(chave)
    return raw ? (JSON.parse(raw) as Horarios) : {}
  } catch {
    return {}
  }
}

function gravar(chave: string, v: Horarios) {
  try {
    localStorage.setItem(chave, JSON.stringify(v))
  } catch {
    /* sem espaco: segue so em memoria */
  }
}

export type Inicios = Horarios

export function loadInicios(): Inicios {
  return ler(KEY)
}

export function saveInicios(v: Inicios) {
  gravar(KEY, v)
}

export function loadFins(): Horarios {
  return ler(KEY_FIM)
}

export function saveFins(v: Horarios) {
  gravar(KEY_FIM, v)
}
