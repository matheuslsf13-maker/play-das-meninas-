/**
 * Nomes das chaves guardadas no navegador de quem usa o app.
 *
 * O app ja carregou dois nomes errados: `play-das-meninas` (que e o nome do
 * campeonato CONCORRENTE, herdado do repositorio) e `play-de-sexta` (o nome
 * certo e "Play da Sexta", como esta no logo). Trocar a chave sem mais nada
 * apagaria, para quem ja usava o app, o cache offline e principalmente a
 * FILA DE LANCAMENTOS feitos sem sinal -- entao as chaves antigas sao
 * renomeadas na primeira abertura.
 *
 * A renomeacao roda no import deste modulo, que e o unico lugar onde os nomes
 * existem: quem le o localStorage passa por aqui e portanto ja pega migrado.
 */

export const CHAVE = {
  /** Dados completos, no modo local (sem Supabase). */
  dados: 'play-da-sexta:v1',
  /** Escritas pendentes, que sobrevivem a refresh e a celular sem sinal. */
  fila: 'play-da-sexta:queue',
  /** Ultimo estado conhecido, para o app abrir offline. */
  cache: 'play-da-sexta:cache',
  /** Quais partidas entraram em quadra e quando. */
  emQuadra: 'play-da-sexta:em-quadra',
  /** Quando cada partida terminou (alimenta o "fora ha mais tempo"). */
  fimDasPartidas: 'play-da-sexta:fim-das-partidas',
} as const

const RENOMEADAS: [antiga: string, nova: string][] = [
  ['play-das-meninas:v1', CHAVE.dados],
  ['play-das-meninas:queue', CHAVE.fila],
  ['play-das-meninas:cache', CHAVE.cache],
  ['play-de-sexta:em-quadra', CHAVE.emQuadra],
  ['play-de-sexta:fim-das-partidas', CHAVE.fimDasPartidas],
]

function migrar() {
  try {
    for (const [antiga, nova] of RENOMEADAS) {
      const valor = localStorage.getItem(antiga)
      if (valor === null) continue
      // se a chave nova ja tem conteudo, ela manda: o app novo ja rodou aqui
      if (localStorage.getItem(nova) === null) localStorage.setItem(nova, valor)
      localStorage.removeItem(antiga)
    }
  } catch {
    /* navegador sem localStorage (aba anonima, armazenamento bloqueado):
       o app continua funcionando so em memoria */
  }
}

migrar()
