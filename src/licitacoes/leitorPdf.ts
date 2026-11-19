import { PDFDocument } from 'pdf-lib'
import { avaliar, chaveItem, numero, type ItemImportado } from './importacao'
import type { Processo } from './tipos'
import { uid } from '../lib/uid'
import { postarIA } from '../lib/acesso'

export const PAGINAS_POR_BLOCO = 4
export const MAX_PAGINAS = 60
export const MAX_BYTES_BLOCO = 3_000_000 // ~4 MB em base64, abaixo do limite de 4,5 MB da Vercel

export type Metadados = Partial<Pick<Processo, 'tipo' | 'numeroProcesso' | 'modalidade' | 'numeroInstrumento' | 'ano' | 'fornecedor' | 'cnpj' | 'dataAssinatura' | 'vigenciaInicio' | 'vigenciaFim'>>
export interface Resultado { metadados: Metadados; itens: ItemImportado[]; avisos: string[] }
export type Chamar = (corpo: { dados: string; tipo: string }) => Promise<{ texto: string; truncado?: boolean }>
export class ErroFatal extends Error {}

const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
const num = (v: unknown) => (typeof v === 'string' ? numero(v) : typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
const dif = (a: number, b: number) => Math.abs(a - b) > 0.01

/** Alertas do documento lido: pendências, baixa confiança da IA e valor total que não fecha. */
export function alertasPdf(i: ItemImportado): string[] {
  const a = avaliar(i)
  if (i.confianca !== undefined && i.confianca < 0.7) a.push(`Baixa confiança na leitura (${Math.round(i.confianca * 100)}%)`)
  if (i.valorPlanilha !== null && i.precoUnitario !== null && i.quantidadeAta !== null && dif(i.valorPlanilha, i.quantidadeAta * i.precoUnitario)) a.push('Valor total do documento difere de quantidade × preço')
  return a
}

/** Valida e saneia a resposta da IA para um trecho. `deslocamento` converte a página do trecho em página do documento. */
export function validarLicitacao(texto: string, nome: string, deslocamento = 0): Resultado {
  const t = texto.replace(/```json|```/g, '')
  const i0 = t.indexOf('{'), f0 = t.lastIndexOf('}')
  if (i0 < 0 || f0 < i0) throw new Error('A resposta da IA não trouxe dados válidos.')
  const j = JSON.parse(t.slice(i0, f0 + 1)) as { processo?: Record<string, unknown>; itens?: unknown; avisos?: unknown }
  const p = j.processo ?? {}
  const tipo = p.tipoInstrumento
  const metadados: Metadados = {}
  const put = <K extends keyof Metadados>(k: K, v: Metadados[K]) => { if (v !== '' && v !== null && v !== undefined) metadados[k] = v }
  put('numeroProcesso', txt(p.numeroProcesso)); put('modalidade', txt(p.modalidade)); put('numeroInstrumento', txt(p.numeroInstrumento))
  put('fornecedor', txt(p.fornecedor)); put('cnpj', txt(p.cnpj)); put('ano', typeof p.ano === 'number' ? p.ano : undefined)
  put('dataAssinatura', data(p.dataAssinatura)); put('vigenciaInicio', data(p.vigenciaInicio)); put('vigenciaFim', data(p.vigenciaFim))
  if (tipo === 'ata' || tipo === 'contrato' || tipo === 'processo') metadados.tipo = tipo
  const avisos = Array.isArray(j.avisos) ? j.avisos.filter((a): a is string => typeof a === 'string') : []
  const itens: ItemImportado[] = (Array.isArray(j.itens) ? j.itens : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !!txt((x as Record<string, unknown>).descricao)).map((x) => {
    const desc = txt(x.descricao), m = desc.match(/^\s*(\d+)\s*[-–]\s*([\s\S]+)$/), cod = txt(x.codigo)
    const pg = typeof x.pagina === 'number' ? x.pagina + deslocamento : undefined
    const it: ItemImportado = {
      id: uid(), aba: nome, linha: 0, pagina: pg, trecho: txt(x.trecho).slice(0, 200), confianca: typeof x.confianca === 'number' ? Math.min(1, Math.max(0, x.confianca)) : 0.5,
      numeroItem: txt(x.item), codigo: cod || (m ? m[1] : ''), descricaoOriginal: desc, nome: cod || !m ? desc : m[2].trim(), marca: txt(x.marca), unidade: txt(x.unidade), fornecedor: txt(x.fornecedor),
      quantidadeLicitada: null, quantidadeAta: num(x.quantidade), aditivo: null, precoUnitario: num(x.valorUnitario), quantidadeSolicitada: null, quantidadeFornecida: null,
      disponivelPlanilha: null, valorPlanilha: num(x.valorTotal), alertas: [],
    }
    return it
  })
  return { metadados, itens, avisos }
}

export async function dividirPdf(dados: ArrayBuffer) {
  const src = await PDFDocument.load(dados, { ignoreEncryption: true })
  const total = src.getPageCount()
  const blocos: { inicio: number; fim: number; bytes: Uint8Array }[] = []
  const fatiar = async (ini: number, fim: number): Promise<void> => {
    const doc = await PDFDocument.create()
    const pgs = await doc.copyPages(src, Array.from({ length: fim - ini + 1 }, (_, k) => ini - 1 + k))
    pgs.forEach((p) => doc.addPage(p))
    const bytes = await doc.save()
    if (bytes.length > MAX_BYTES_BLOCO && fim > ini) { const meio = Math.floor((ini + fim) / 2); await fatiar(ini, meio); await fatiar(meio + 1, fim); return }
    if (bytes.length > MAX_BYTES_BLOCO) throw new Error(`A página ${ini} sozinha tem mais de 3 MB. Reduza o arquivo.`)
    blocos.push({ inicio: ini, fim, bytes })
  }
  for (let i = 1; i <= total; i += PAGINAS_POR_BLOCO) await fatiar(i, Math.min(total, i + PAGINAS_POR_BLOCO - 1))
  return { total, blocos }
}

export function paraBase64(b: Uint8Array): string {
  let s = ''
  for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode(...b.subarray(k, k + 0x8000))
  return btoa(s)
}

function finalizar(itens: ItemImportado[], metadados: Metadados, avisos: string[]): Resultado {
  const vistos = new Set<string>()
  const unicos = itens.filter((i) => { const k = `${i.numeroItem}|${chaveItem(i.codigo, i.descricaoOriginal, i.fornecedor)}|${i.quantidadeAta}`; if (vistos.has(k)) return false; vistos.add(k); return true })
  for (const i of unicos) { if (!i.fornecedor && metadados.fornecedor) i.fornecedor = metadados.fornecedor; i.alertas = alertasPdf(i) }
  if (unicos.length < itens.length) avisos.push(`${itens.length - unicos.length} item(ns) repetido(s) entre páginas foram descartados.`)
  return { metadados, itens: unicos, avisos }
}

function mesclar(base: Metadados, novo: Metadados) { for (const [k, v] of Object.entries(novo)) if (!(k in base)) (base as Record<string, unknown>)[k] = v }

export const chamarApi: Chamar = async (corpo) => {
  const r = await postarIA('/api/ler-licitacao', corpo)
  const j = (await r.json().catch(() => ({}))) as { texto?: string; truncado?: boolean; erro?: string }
  if (!r.ok || j.texto === undefined) { const m = j.erro ?? `Erro ao ler o documento (HTTP ${r.status}).`; throw [401, 403, 429, 503].includes(r.status) ? new ErroFatal(m) : new Error(m) }
  return { texto: j.texto, truncado: j.truncado }
}

/** Lê o PDF em blocos de poucas páginas. Falha em um bloco não perde os demais; tudo vai para a conferência. */
export async function lerPdfIA(nome: string, dados: ArrayBuffer, chamar: Chamar, onProgresso?: (m: string) => void): Promise<Resultado> {
  const { total, blocos } = await dividirPdf(dados)
  if (total > MAX_PAGINAS) throw new Error(`O PDF tem ${total} páginas; o limite por importação é ${MAX_PAGINAS}. Divida o arquivo.`)
  const itens: ItemImportado[] = [], avisos: string[] = [], meta: Metadados = {}
  for (const b of blocos) {
    onProgresso?.(`Lendo páginas ${b.inicio}–${b.fim} de ${total}…`)
    try {
      const r = await chamar({ dados: paraBase64(b.bytes), tipo: 'application/pdf' })
      const v = validarLicitacao(r.texto, nome, b.inicio - 1)
      itens.push(...v.itens); avisos.push(...v.avisos); mesclar(meta, v.metadados)
      if (r.truncado) avisos.push(`Páginas ${b.inicio}–${b.fim}: a resposta foi cortada e podem faltar itens. Divida o documento.`)
    } catch (e) {
      avisos.push(`Páginas ${b.inicio}–${b.fim} não puderam ser lidas: ${(e as Error).message}`)
      if (e instanceof ErroFatal) break
    }
  }
  return finalizar(itens, meta, avisos)
}

export async function lerImagemIA(nome: string, base64: string, chamar: Chamar): Promise<Resultado> {
  const r = await chamar({ dados: base64, tipo: 'image/jpeg' })
  const v = validarLicitacao(r.texto, nome, 0)
  if (r.truncado) v.avisos.push('A resposta foi cortada e podem faltar itens.')
  return finalizar(v.itens, v.metadados, v.avisos)
}
