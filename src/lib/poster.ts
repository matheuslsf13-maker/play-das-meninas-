/**
 * Gera a imagem de fechamento do mes (1080x1350, formato de post/status)
 * com o podio, as fotos das tres primeiras e a coroa na campea.
 */

export type PosterRow = {
  name: string
  points: number
  wins: number
  losses: number
  photo: string | null
  streak: number
}

const W = 1080
const H = 1350
const NAVY = '#141a3c'
const PINK = '#ef4b7d'
const CREAM = '#fdf6ec'
const GOLD = '#f5c518'
const SILVER = '#c9cede'
const BRONZE = '#e0a06a'

export async function buildMonthPoster(mes: string, rows: PosterRow[]): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')
  if (!c) throw new Error('Este navegador não conseguiu gerar a imagem.')

  const fotos = await Promise.all(rows.slice(0, 3).map((r) => loadImage(r.photo)))

  fundo(c)
  cabecalho(c, mes)
  podio(c, rows, fotos)
  demais(c, rows)
  rodape(c)

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/png'),
  )
}

/* ----------------------------------------------------------- partes */

function fundo(c: CanvasRenderingContext2D) {
  const g = c.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, NAVY)
  g.addColorStop(1, '#2f2168')
  c.fillStyle = g
  c.fillRect(0, 0, W, H)

  // bolinhas decorativas, bem discretas
  c.save()
  c.globalAlpha = 0.07
  for (const [x, y, r, cor] of [
    [80, 210, 150, PINK], [1000, 120, 110, GOLD], [980, 900, 190, PINK], [60, 1080, 130, GOLD],
  ] as [number, number, number, string][]) {
    c.fillStyle = cor
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function cabecalho(c: CanvasRenderingContext2D, mes: string) {
  c.textAlign = 'center'
  c.font = '800 30px system-ui, Segoe UI, Arial, sans-serif'
  c.fillStyle = 'rgba(255,255,255,.55)'
  c.letterSpacing = '6px'
  c.fillText('V3 ARENA · BEACH TENNIS', W / 2, 92)
  c.letterSpacing = '0px'

  c.font = '900 66px system-ui, Segoe UI, Arial, sans-serif'
  const a = 'PLAY '
  const b = 'DE SEXTA'
  const inicio = (W - c.measureText(a).width - c.measureText(b).width) / 2
  c.textAlign = 'left'
  c.fillStyle = '#fff'
  c.fillText(a, inicio, 168)
  c.fillStyle = PINK
  c.fillText(b, inicio + c.measureText(a).width, 168)
  c.textAlign = 'center'

  // faixa do mes
  c.fillStyle = PINK
  faixa(c, W / 2 - 330, 208, 660, 76, 38)
  c.fillStyle = '#fff'
  c.font = '800 38px system-ui, Segoe UI, Arial, sans-serif'
  c.letterSpacing = '2px'
  c.fillText(`RANKING DE ${mes.toUpperCase()}`, W / 2, 259)
  c.letterSpacing = '0px'
}

function podio(c: CanvasRenderingContext2D, rows: PosterRow[], fotos: (HTMLImageElement | null)[]) {
  const bases = [
    { i: 1, x: 175, alturaBarra: 205, raio: 86, cor: SILVER, rotulo: '2º' },
    { i: 0, x: W / 2, alturaBarra: 265, raio: 106, cor: GOLD, rotulo: '1º' },
    { i: 2, x: 905, alturaBarra: 178, raio: 86, cor: BRONZE, rotulo: '3º' },
  ]
  const chao = 952

  for (const b of bases) {
    const r = rows[b.i]
    if (!r) continue
    const topoBarra = chao - b.alturaBarra
    const cy = topoBarra - b.raio - 78 // espaco para o nome entre a foto e a barra

    if (b.i === 0) coroa(c, b.x, cy - b.raio - 56, 104)
    retrato(c, fotos[b.i], r.name, b.x, cy, b.raio, b.cor)

    // nome
    c.textAlign = 'center'
    c.fillStyle = '#fff'
    c.font = `800 ${b.i === 0 ? 40 : 34}px system-ui, Segoe UI, Arial, sans-serif`
    c.fillText(cortar(c, r.name, 270), b.x, topoBarra - 26)

    // barra do podio
    const larguraBarra = b.i === 0 ? 300 : 250
    const g = c.createLinearGradient(0, topoBarra, 0, chao)
    g.addColorStop(0, b.cor)
    g.addColorStop(1, escurecer(b.cor))
    c.fillStyle = g
    faixa(c, b.x - larguraBarra / 2, topoBarra, larguraBarra, b.alturaBarra + 4, 22, true)

    c.fillStyle = '#3a2a05'
    c.font = '900 62px system-ui, Segoe UI, Arial, sans-serif'
    c.fillText(b.rotulo, b.x, topoBarra + 70)
    c.font = '800 40px system-ui, Segoe UI, Arial, sans-serif'
    c.fillText(`${r.points} pts`, b.x, topoBarra + 122)
    c.font = '700 26px system-ui, Segoe UI, Arial, sans-serif'
    c.fillStyle = 'rgba(0,0,0,.55)'
    c.fillText(`${r.wins}V · ${r.losses}D`, b.x, topoBarra + 164)
  }
}

function demais(c: CanvasRenderingContext2D, rows: PosterRow[]) {
  const resto = rows.slice(3, 8)
  if (resto.length === 0) return
  let y = 1024
  c.textAlign = 'left'
  resto.forEach((r, i) => {
    c.fillStyle = 'rgba(255,255,255,.08)'
    faixa(c, 110, y - 30, W - 220, 44, 14)
    c.fillStyle = 'rgba(255,255,255,.5)'
    c.font = '800 26px system-ui, Segoe UI, Arial, sans-serif'
    c.fillText(`${i + 4}º`, 132, y)
    c.fillStyle = '#fff'
    c.font = '700 27px system-ui, Segoe UI, Arial, sans-serif'
    c.fillText(cortar(c, r.name, 560), 196, y)
    c.textAlign = 'right'
    c.fillStyle = GOLD
    c.font = '800 27px system-ui, Segoe UI, Arial, sans-serif'
    c.fillText(`${r.points} pts`, W - 132, y)
    c.textAlign = 'left'
    y += 54
  })
}

function rodape(c: CanvasRenderingContext2D) {
  c.textAlign = 'center'
  c.fillStyle = 'rgba(255,255,255,.75)'
  c.font = 'italic 700 34px system-ui, Segoe UI, Arial, sans-serif'
  c.fillText('Mais que um play, uma experiência!', W / 2, H - 42)
}

/* ---------------------------------------------------------- desenho */

/** Coroa dourada, desenhada em vetor para nao depender de fonte de emoji. */
function coroa(c: CanvasRenderingContext2D, cx: number, cy: number, largura: number) {
  const h = largura * 0.62
  const x = cx - largura / 2
  const y = cy - h / 2
  c.save()
  c.fillStyle = GOLD
  c.strokeStyle = '#c99400'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(x, y + h)
  c.lineTo(x, y + h * 0.28)
  c.lineTo(x + largura * 0.25, y + h * 0.66)
  c.lineTo(x + largura * 0.5, y)
  c.lineTo(x + largura * 0.75, y + h * 0.66)
  c.lineTo(x + largura, y + h * 0.28)
  c.lineTo(x + largura, y + h)
  c.closePath()
  c.fill()
  c.stroke()
  // pedrinhas
  c.fillStyle = '#fff6d0'
  for (const px of [0.16, 0.5, 0.84]) {
    c.beginPath()
    c.arc(x + largura * px, y + h * 0.78, largura * 0.045, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function retrato(
  c: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  nome: string,
  cx: number,
  cy: number,
  raio: number,
  cor: string,
) {
  c.save()
  c.beginPath()
  c.arc(cx, cy, raio, 0, Math.PI * 2)
  c.closePath()
  c.clip()
  if (img) {
    const lado = Math.min(img.width, img.height)
    c.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, cx - raio, cy - raio, raio * 2, raio * 2)
  } else {
    const g = c.createLinearGradient(cx - raio, cy - raio, cx + raio, cy + raio)
    g.addColorStop(0, '#6d3fa0')
    g.addColorStop(1, PINK)
    c.fillStyle = g
    c.fillRect(cx - raio, cy - raio, raio * 2, raio * 2)
    c.fillStyle = '#fff'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `800 ${Math.round(raio * 0.8)}px system-ui, Segoe UI, Arial, sans-serif`
    c.fillText(iniciais(nome), cx, cy + 2)
    c.textBaseline = 'alphabetic'
  }
  c.restore()

  c.beginPath()
  c.arc(cx, cy, raio + 6, 0, Math.PI * 2)
  c.strokeStyle = cor
  c.lineWidth = 9
  c.stroke()
}

function faixa(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  soTopo = false,
) {
  const rb = soTopo ? 0 : r
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - rb)
  c.quadraticCurveTo(x + w, y + h, x + w - rb, y + h)
  c.lineTo(x + rb, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - rb)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
  c.fill()
}

/* ------------------------------------------------------------ apoio */

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // sem isso a imagem "suja" o canvas
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // sem foto, entra a inicial
    img.src = url
  })
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function cortar(c: CanvasRenderingContext2D, texto: string, max: number): string {
  if (c.measureText(texto).width <= max) return texto
  let t = texto
  while (t.length > 2 && c.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

function escurecer(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const f = 0.72
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `rgb(${r},${g},${b})`
}

export const POSTER_BG = CREAM
