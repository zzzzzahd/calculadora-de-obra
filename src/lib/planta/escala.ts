/**
 * Calibração de escala da planta. Coordenadas normalizadas (0 a 1, origem no canto superior esquerdo) sobre a MESMA imagem
 * que o usuário vê e que é enviada à IA. Como x e y têm tamanhos diferentes em pixels, as distâncias usam as dimensões da página.
 * A escala vem de uma distância real informada pelo usuário entre dois pontos; medidas tiradas dela são ESTIMADAS
 * (dependem da precisão dos cliques e do desenho), nunca cotas.
 */
export interface Ponto { x: number; y: number }
export interface Caixa { x: number; y: number; w: number; h: number }
export interface Pagina { largura: number; altura: number } // em pixels da imagem exibida
export interface Escala { metrosPorPx: number; pagina: Pagina; p1: Ponto; p2: Ponto; metros: number }

const MIN_PX = 20 // pontos muito próximos dão uma escala instável
export const dentro = (p: Ponto) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1

export function distanciaPx(a: Ponto, b: Ponto, pg: Pagina): number {
  return Math.hypot((b.x - a.x) * pg.largura, (b.y - a.y) * pg.altura)
}

/** Cria a escala a partir de dois pontos e da distância real entre eles (em metros). */
export function criarEscala(p1: Ponto, p2: Ponto, metros: number, pagina: Pagina): Escala {
  if (!dentro(p1) || !dentro(p2)) throw new Error('Os pontos precisam estar dentro da planta.')
  if (!(pagina.largura > 0 && pagina.altura > 0)) throw new Error('Tamanho da imagem inválido.')
  if (!(Number.isFinite(metros) && metros > 0 && metros <= 1000)) throw new Error('Informe a distância real em metros (maior que zero).')
  const px = distanciaPx(p1, p2, pagina)
  if (px < MIN_PX) throw new Error(`Os pontos estão muito próximos (${Math.round(px)} px); escolha dois pontos mais distantes para uma escala confiável.`)
  return { metrosPorPx: metros / px, pagina, p1, p2, metros }
}

export const distanciaM = (e: Escala, a: Ponto, b: Ponto) => distanciaPx(a, b, e.pagina) * e.metrosPorPx

/** Dimensões da caixa em metros: [maior lado, menor lado]. */
export function dimensoesCaixaM(e: Escala, c: Caixa): { comprimento: number; largura: number } {
  const w = c.w * e.pagina.largura * e.metrosPorPx, h = c.h * e.pagina.altura * e.metrosPorPx
  return { comprimento: Math.max(w, h), largura: Math.min(w, h) }
}

export interface Conferencia { status: 'ok' | 'divergente' | 'sem_medida'; comprimentoM: number; larguraM: number; difComprimento: number; difLargura: number }
/**
 * Compara a medida lida (cota ou estimada pela IA) com a medida da caixa pela escala. Diferença relativa acima de `tolerancia`
 * (padrão 15%, só um alerta visual: a caixa da IA é aproximada) marca "divergente" para o usuário conferir na planta.
 */
export function conferir(e: Escala, lida: { comprimento: number; largura: number }, caixa: Caixa, tolerancia = 0.15): Conferencia {
  const d = dimensoesCaixaM(e, caixa)
  const lc = Math.max(lida.comprimento, lida.largura), ll = Math.min(lida.comprimento, lida.largura)
  if (!(lc > 0 && ll > 0)) return { status: 'sem_medida', comprimentoM: d.comprimento, larguraM: d.largura, difComprimento: NaN, difLargura: NaN }
  const dc = (d.comprimento - lc) / lc, dl = (d.largura - ll) / ll
  return { status: Math.abs(dc) > tolerancia || Math.abs(dl) > tolerancia ? 'divergente' : 'ok', comprimentoM: d.comprimento, larguraM: d.largura, difComprimento: dc, difLargura: dl }
}

/** Converte um clique (pixels dentro do elemento exibido) em coordenada normalizada. */
export function normalizar(clique: { x: number; y: number }, exibido: { largura: number; altura: number }): Ponto {
  return { x: Math.min(1, Math.max(0, clique.x / exibido.largura)), y: Math.min(1, Math.max(0, clique.y / exibido.altura)) }
}
