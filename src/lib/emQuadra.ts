/**
 * Quais partidas estao em quadra agora, guardado tambem no proprio celular.
 *
 * O banco tem a coluna `started_at`, mas o app nao pode depender so dela: se o
 * script 04 ainda nao rodou, ou a escrita demora, o tempo real devolve a
 * partida sem o inicio e o botao "voltaria" sozinho. Com esta camada local o
 * inicio se mantem na tela de quem esta organizando, mesmo offline.
 */

const KEY = 'play-de-sexta:em-quadra'

export type Inicios = Record<string, string> // match_id -> ISO

export function loadInicios(): Inicios {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Inicios) : {}
  } catch {
    return {}
  }
}

export function saveInicios(v: Inicios) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* sem espaco: segue so em memoria */
  }
}
