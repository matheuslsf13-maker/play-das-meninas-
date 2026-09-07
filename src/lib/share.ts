import type { PlayerStat } from './stats'
import { balance } from './stats'
import { streakLevel, type PodioDoDia } from './streaks'
import { dateLabel, monthLabel } from './types'

/**
 * Textos prontos para colar no grupo do WhatsApp.
 *
 * O WhatsApp so tem *negrito*, _italico_ e ~riscado~ -- nao tem tabela nem
 * fonte de largura fixa, entao alinhar em colunas com espacos NAO funciona:
 * cada celular quebra a linha num lugar diferente. Por isso quem esta no podio
 * ocupa duas linhas curtas (nome em destaque, numeros embaixo) em vez de uma
 * linha longa cheia de parenteses, que era como estava e embolava na tela.
 */

const MEDALHAS = ['🥇', '🥈', '🥉']

function posicao(i: number): string {
  return MEDALHAS[i] ?? `${i + 1}º`
}

function comSinal(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function pts(n: number): string {
  return `${n} ${n === 1 ? 'pt' : 'pts'}`
}

/** Duas linhas: nome em destaque, numeros embaixo. */
function bloco(i: number, nome: string, s: PlayerStat, streak = 0): string {
  const fogo = streak >= 2 ? ` ${streakLevel(streak)?.emoji}` : ''
  const bonus = s.bonus > 0 ? ` _(${s.points - s.bonus} + ${s.bonus} de status)_` : ''
  return (
    `${posicao(i)} *${nome}*${fogo} — *${pts(s.points)}*${bonus}\n` +
    `     ${s.wins}V ${s.losses}D · saldo ${comSinal(balance(s))}`
  )
}

export function monthRankingText(
  ym: string,
  rows: PlayerStat[],
  nameOf: (id: string) => string,
  fire?: Map<string, number>,
): string {
  const partes: string[] = [
    `🏆 *RANKING DE ${monthLabel(ym).toUpperCase()}*`,
    `_Play de Todas · Beach Tennis · V3 Arena_`,
  ]

  const podio = rows.slice(0, 3)
  const resto = rows.slice(3)

  if (podio.length > 0) {
    partes.push(
      '\n' +
        podio
          .map((s, i) => bloco(i, nameOf(s.player_id), s, fire?.get(s.player_id) ?? 0))
          .join('\n'),
    )
  }

  // da quarta em diante, uma linha so: a lista do mes pode ficar longa
  if (resto.length > 0) {
    partes.push(
      '\n' +
        resto
          .map((s, i) => {
            const n = fire?.get(s.player_id) ?? 0
            const fogo = n >= 2 ? ` ${streakLevel(n)?.emoji}` : ''
            return `${i + 4}º ${nameOf(s.player_id)}${fogo} — ${pts(s.points)}`
          })
          .join('\n'),
    )
  }

  const emChamas = rows.filter((s) => (fire?.get(s.player_id) ?? 0) >= 2)
  if (emChamas.length > 0) {
    partes.push(
      '\n🔥 *Em chamas*\n' +
        emChamas
          .map((s) => {
            const n = fire?.get(s.player_id) ?? 0
            const lvl = streakLevel(n)
            return `${lvl?.emoji} *${nameOf(s.player_id)}* — ${lvl?.title}, ${n} semanas seguidas no pódio`
          })
          .join('\n'),
    )
  }

  partes.push('\n_Mais que um play, uma experiência!_ 💗')
  return partes.join('\n')
}

export function dayRankingText(
  date: string,
  title: string,
  rows: PlayerStat[],
  nameOf: (id: string) => string,
  award?: { player_id: string; streak: number; value: number },
  podios?: PodioDoDia[],
): string {
  const partes: string[] = [`🎾 *${title.toUpperCase()}*`, `_${dateLabel(date)}_`]

  const emGrupos = Boolean(podios && podios.length > 1)
  const noPodio = new Set((podios ?? []).flatMap((p) => p.rows.map((x) => x.player_id)))

  if (emGrupos) {
    // um podio por grupo: cada grupo e um rodizio fechado e so compete consigo
    const grupoDe = new Map<string, number>()
    for (const p of podios as PodioDoDia[]) {
      for (const id of p.membros) grupoDe.set(id, p.grupo as number)
      partes.push(
        `\n*👥 GRUPO ${p.grupo}*\n` +
          p.rows.map((s, i) => bloco(i, nameOf(s.player_id), s)).join('\n'),
      )
    }
    const fora = rows.filter((s) => !noPodio.has(s.player_id))
    if (fora.length > 0) {
      // com varios podios a posicao geral nao diz nada, entao aqui vale marcar
      // de que grupo cada uma veio -- e o que explica quem subiu com quantos pts
      partes.push(
        '\n*Demais jogadoras*\n' +
          fora
            .map((s) => `· ${nameOf(s.player_id)} _[G${grupoDe.get(s.player_id)}]_ — ${pts(s.points)}`)
            .join('\n'),
      )
    }
  } else {
    partes.push('\n' + rows.slice(0, 3).map((s, i) => bloco(i, nameOf(s.player_id), s)).join('\n'))
    const resto = rows.slice(3)
    if (resto.length > 0) {
      partes.push(
        '\n' + resto.map((s, i) => `${i + 4}º ${nameOf(s.player_id)} — ${pts(s.points)}`).join('\n'),
      )
    }
  }

  const lvl = award ? streakLevel(award.streak) : null
  if (award && lvl) {
    partes.push(
      `\n${lvl.emoji} *${nameOf(award.player_id)} é ${lvl.title.toUpperCase()}!*\n` +
        `${award.streak} semanas seguidas no pódio. O status vale *${award.value} pontos*, ` +
        `que ela decide se usa no fechamento do mês.`,
    )
  }

  partes.push('\n_Os pontos já entraram no ranking do mês._ 🏐')
  return partes.join('\n')
}

/**
 * A ordem das partidas para mandar no grupo. Nao ha rodadas: a lista e a fila,
 * e cada partida entra na quadra que vagar primeiro.
 */
export function scheduleText(
  date: string,
  title: string,
  courts: number,
  partidas: { round: number; team_a: [string, string]; team_b: [string, string] }[],
  nameOf: (id: string) => string,
  grupos?: string[][] | null,
): string {
  const emGrupos = Boolean(grupos && grupos.length > 1)
  const grupoDe = new Map<string, number>()
  grupos?.forEach((g, i) => g.forEach((id) => grupoDe.set(id, i + 1)))

  const partes: string[] = [
    `🎾 *${title.toUpperCase()}*`,
    `_${dateLabel(date)} · ${partidas.length} partidas · ${courts} quadra(s)_`,
  ]

  if (emGrupos) {
    partes.push(
      '\n*👥 Os grupos*\n' +
        (grupos as string[][])
          .map((g, i) => `*Grupo ${i + 1}:* ${g.map(nameOf).join(', ')}`)
          .join('\n'),
    )
  }

  partes.push(
    '\n*Ordem das partidas*\n' +
      [...partidas]
        .sort((a, b) => a.round - b.round)
        .map((m) => {
          const g = grupoDe.get(m.team_a[0])
          const tag = emGrupos && g ? `_[G${g}]_ ` : ''
          return (
            `*${m.round}.* ${tag}${nameOf(m.team_a[0])} + ${nameOf(m.team_a[1])}\n` +
            `     ✖️ ${nameOf(m.team_b[0])} + ${nameOf(m.team_b[1])}`
          )
        })
        .join('\n'),
  )

  partes.push('\n_Entram na ordem, conforme as quadras vão vagando._\nBora jogar! 💗')
  return partes.join('\n')
}
