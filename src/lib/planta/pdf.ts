/**
 * Leitura de PDF no navegador com PDF.js (carregado sob demanda, para não pesar o início do site):
 *  - texto de cada página com posição normalizada (0 a 1, origem no canto superior esquerdo);
 *  - renderização da página em imagem, que é a MESMA imagem exibida ao usuário e enviada à IA (as coordenadas combinam).
 * PDFs vetoriais têm camada de texto: as cotas vêm exatas, sem OCR. PDFs escaneados não têm; nesse caso só a IA lê a imagem.
 */
import type { ItemTexto } from './cotas'
import type { Pagina } from './escala'

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
export type DocumentoPdf = Awaited<ReturnType<Pdfjs['getDocument']>['promise']>

let carregando: Promise<Pdfjs> | null = null
export function carregarPdfjs(): Promise<Pdfjs> {
  carregando ??= (async () => {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    if (typeof window !== 'undefined') lib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
    return lib
  })()
  return carregando
}

export async function abrirPdf(bytes: Uint8Array): Promise<DocumentoPdf> {
  const lib = await carregarPdfjs()
  // cópia: o PDF.js "consome" o buffer; scripts do PDF e fontes remotas ficam desligados
  return lib.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise
}

export interface TextoPagina { itens: ItemTexto[]; pagina: Pagina }

/** Itens de texto da página (1 = primeira) com caixas normalizadas. `pagina` está em pontos PDF (escala 1). */
export async function textoDaPagina(doc: DocumentoPdf, numero: number): Promise<TextoPagina> {
  const lib = await carregarPdfjs()
  const page = await doc.getPage(numero)
  const vp = page.getViewport({ scale: 1 })
  const conteudo = await page.getTextContent()
  const itens: ItemTexto[] = []
  for (const it of conteudo.items) {
    if (!('str' in it) || !it.str.trim()) continue
    const [, , , , x, y] = lib.Util.transform(vp.transform, it.transform)
    const w = it.width * vp.scale, h = Math.max(it.height, 1) * vp.scale
    itens.push({ texto: it.str, caixa: { x: clamp(x / vp.width), y: clamp((y - h) / vp.height), w: clamp(w / vp.width), h: clamp(h / vp.height) } })
  }
  return { itens, pagina: { largura: vp.width, altura: vp.height } }
}
const clamp = (v: number) => Math.min(1, Math.max(0, v))

/** Renderiza a página em JPEG (fundo branco) com o maior lado em `ladoMax` pixels. Só no navegador (usa canvas). */
export async function renderizarPagina(doc: DocumentoPdf, numero: number, ladoMax = 1800): Promise<{ dataUrl: string; pagina: Pagina }> {
  const page = await doc.getPage(numero)
  const base = page.getViewport({ scale: 1 })
  const vp = page.getViewport({ scale: ladoMax / Math.max(base.width, base.height) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.88), pagina: { largura: canvas.width, altura: canvas.height } }
}
