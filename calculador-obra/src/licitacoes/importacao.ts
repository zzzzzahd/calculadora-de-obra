import ExcelJS from 'exceljs'
import type { Material, Processo } from './tipos'

/** Item lido de planilha, ainda NÃO cadastrado. Guarda aba e linha de origem para conferência. */
export interface ItemImportado {
  id: string; aba: string; linha: number
  numeroItem: string; codigo: string; descricaoOriginal: string; nome: string; marca: string; unidade: string; fornecedor: string
  quantidadeLicitada: number | null; quantidadeAta: number | null; aditivo: number | null
  precoUnitario: number | null; quantidadeSolicitada: number | null; quantidadeFornecida: number | null
  disponivelPlanilha: number | null; valorPlanilha: number | null // referência da planilha: saldo da ata ainda não solicitado, NÃO estoque físico
  alertas: string[]
  pagina?: number; trecho?: string; confianca?: number // documentos lidos por IA: página, trecho de origem e confiança (0 a 1)
}
export interface AbaLida { nome: string; itens: ItemImportado[] }
export type Estrategia = 'ignorar' | 'atualizar' | 'novos' | 'novo-processo'

export const norm = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[°º.]/g, '').replace(/\s+/g, ' ').trim()

// Só estas colunas são lidas. QTDE EMPENHADA e EXECUTADO (%) não são usadas.
const COLUNAS: Record<string, string[]> = {
  item: ['n', 'no', 'item', 'numero'], produto: ['produto', 'descricao', 'material'], marca: ['marca'], unidade: ['unid', 'unidade', 'un'],
  licitada: ['qtde licitada', 'quantidade licitada'], ata: ['qtde ata', 'quantidade ata', 'qtde registrada'], aditivo: ['aditivo'],
  preco: ['valor unit', 'valor unitario', 'vl unit', 'preco unitario'], solicitada: ['qtde solicitada', 'quantidade solicitada'],
  fornecida: ['qtde fornecida', 'quantidade fornecida', 'qtde entregue'], disponivel: ['quantidade'], valor: ['valor'], fornecedor: ['fornecedor'],
}

export function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  let t = v.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(t)) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.') // 1.234,56
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

const dif = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) > tol * Math.max(1, Math.abs(a), Math.abs(b))

/** Alertas de baixa confiança / pendências. Recalculado a cada edição na tela de conferência. */
export function avaliar(i: ItemImportado): string[] {
  const a: string[] = []
  if (!i.unidade.trim()) a.push('Unidade pendente')
  if (i.precoUnitario === null) a.push('Preço unitário pendente')
  if (i.quantidadeAta === null) a.push('Quantidade da ata pendente')
  if (!i.fornecedor.trim()) a.push('Fornecedor pendente')
  const ata = i.quantidadeAta, sol = i.quantidadeSolicitada
  if (ata !== null && sol !== null && i.disponivelPlanilha !== null && dif(i.disponivelPlanilha, ata + (i.aditivo ?? 0) - sol)) a.push('Disponível da planilha difere de ata + aditivo − solicitada')
  if (i.disponivelPlanilha !== null && i.precoUnitario !== null && i.valorPlanilha !== null && dif(i.valorPlanilha, i.disponivelPlanilha * i.precoUnitario, 0.01)) a.push('Valor da planilha difere de quantidade × preço')
  if (sol !== null && i.quantidadeFornecida !== null && i.quantidadeFornecida > sol + 1e-6) a.push('Fornecida maior que solicitada')
  return a
}

/** Procura a linha de cabeçalho (títulos acima, como "DISPONÍVEL", são ignorados) e extrai os itens. */
export function extrairItens(linhas: unknown[][], aba: string): ItemImportado[] | null {
  for (let h = 0; h < Math.min(40, linhas.length); h++) {
    const mapa: Record<string, number> = {}
    linhas[h].forEach((c, j) => { const t = norm(c); for (const [k, nomes] of Object.entries(COLUNAS)) if (nomes.includes(t) && !(k in mapa)) mapa[k] = j })
    if (mapa.produto === undefined || mapa.ata === undefined) continue // exige PRODUTO e QTDE ATA (evita ler abas de outro tipo, como a de previsão de consumo)
    const txt = (r: unknown[], k: string) => (mapa[k] === undefined ? '' : String(r[mapa[k]] ?? '').trim())
    const num = (r: unknown[], k: string) => (mapa[k] === undefined ? null : numero(r[mapa[k]]))
    const itens: ItemImportado[] = []
    for (let n = h + 1; n < linhas.length; n++) {
      const r = linhas[n], desc = txt(r, 'produto')
      if (!desc) continue
      const m = desc.match(/^\s*(\d+)\s*[-–]\s*([\s\S]+)$/)
      const it: ItemImportado = {
        id: crypto.randomUUID(), aba, linha: n + 1, numeroItem: txt(r, 'item'), codigo: m ? m[1] : '', descricaoOriginal: desc, nome: (m ? m[2] : desc).trim(),
        marca: txt(r, 'marca'), unidade: txt(r, 'unidade'), fornecedor: txt(r, 'fornecedor'),
        quantidadeLicitada: num(r, 'licitada'), quantidadeAta: num(r, 'ata'), aditivo: num(r, 'aditivo'), precoUnitario: num(r, 'preco'),
        quantidadeSolicitada: num(r, 'solicitada'), quantidadeFornecida: num(r, 'fornecida'), disponivelPlanilha: num(r, 'disponivel'), valorPlanilha: num(r, 'valor'), alertas: [],
      }
      it.alertas = avaliar(it)
      itens.push(it)
    }
    return itens
  }
  return null
}

function valorCelula(v: unknown): unknown {
  if (v && typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown }
    if ('result' in o) return o.result
    if (o.richText) return o.richText.map((t) => t.text).join('')
    if ('text' in o) return o.text
  }
  return v
}

export async function lerXlsx(dados: ArrayBuffer): Promise<AbaLida[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(dados)
  const abas: AbaLida[] = []
  for (const ws of wb.worksheets) {
    const linhas: unknown[][] = []
    ws.eachRow({ includeEmpty: true }, (row, n) => { linhas[n - 1] = (row.values as unknown[]).slice(1).map(valorCelula) })
    for (let k = 0; k < linhas.length; k++) linhas[k] ??= []
    const itens = extrairItens(linhas, ws.name)
    if (itens) abas.push({ nome: ws.name, itens })
  }
  return abas
}

export function parseCsv(texto: string): unknown[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
  const sep = [';', '\t', ','].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const linhas: string[][] = [[]]
  const ultima = () => linhas[linhas.length - 1]
  let campo = '', aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ } else if (c === '"') aspas = false; else campo += c }
    else if (c === '"') aspas = true
    else if (c === sep) { ultima().push(campo); campo = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; ultima().push(campo); campo = ''; linhas.push([]) }
    else campo += c
  }
  ultima().push(campo)
  return linhas
}

export const lerCsv = (texto: string, nome = 'CSV'): AbaLida[] => { const it = extrairItens(parseCsv(texto), nome); return it ? [{ nome, itens: it }] : [] }

/** Chave de duplicidade: código + fornecedor (ou descrição, se não houver código). */
export const chaveItem = (codigo: string, descricao: string, fornecedor: string) => `${codigo || norm(descricao)}|${norm(fornecedor)}`

export function indexarExistentes(materiais: Material[], processos: Processo[]): Map<string, Material> {
  const forn = new Map(processos.map((p) => [p.id, p.fornecedor]))
  return new Map(materiais.map((m) => [chaveItem(m.codigo, m.descricaoOriginal, m.fornecedor || forn.get(m.processoId) || ''), m]))
}

const camposPlanilha = (i: ItemImportado) => ({
  marca: i.marca, unidadeFornecimento: i.unidade, quantidadeLicitada: i.quantidadeLicitada, quantidadeRegistrada: i.quantidadeAta, aditivo: i.aditivo ?? 0,
  precoUnitario: i.precoUnitario, quantidadeSolicitada: i.quantidadeSolicitada ?? 0, quantidadeEntregue: i.quantidadeFornecida ?? 0,
  disponivelPlanilha: i.disponivelPlanilha, valorPlanilha: i.valorPlanilha, fornecedor: i.fornecedor,
})

export function toMaterial(i: ItemImportado, processoId: string): Material {
  return { id: crypto.randomUUID(), processoId, lote: '', item: i.numeroItem, codigo: i.codigo, nomePadronizado: i.nome, descricaoOriginal: i.descricaoOriginal, especificacao: '',
    categoria: '', unidadeConsumo: '', fator: null, quantidadeUtilizada: 0, quantidadeComprometida: 0, observacoes: i.pagina ? `Origem: documento "${i.aba}", página ${i.pagina}` : `Origem: aba "${i.aba}", linha ${i.linha}`, ...camposPlanilha(i) }
}

/** Decide o que gravar conforme a estratégia escolhida para itens que já existem. Nunca duplica sem o usuário escolher. */
export function aplicarImportacao(itens: ItemImportado[], existentes: Map<string, Material>, processoPorFornecedor: Record<string, string>, estrategia: Estrategia) {
  const salvar: Material[] = []
  let atualizados = 0, novos = 0, ignorados = 0
  for (const i of itens) {
    const dup = existentes.get(chaveItem(i.codigo, i.descricaoOriginal, i.fornecedor))
    if (estrategia === 'ignorar' || (dup && estrategia === 'novos') || (!dup && estrategia === 'atualizar')) { ignorados++; continue }
    if (dup && estrategia === 'atualizar') { salvar.push({ ...dup, ...camposPlanilha(i) }); atualizados++ }
    else { salvar.push(toMaterial(i, processoPorFornecedor[i.fornecedor])); novos++ }
  }
  return { salvar, atualizados, novos, ignorados }
}
