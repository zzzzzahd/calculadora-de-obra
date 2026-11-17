import ExcelJS from 'exceljs'
import type { Ambiente, Obra } from '../types'
import { areaAmbiente, areaParedeBruta } from './geometry'
import { toMetros } from './units'
import { consolidar, type Item } from './engine'

const COR = 'FFD97706'
const AVISO = 'Estimativa baseada em geometria e composições. Não substitui projeto executivo; estruturas, instalações elétricas e hidráulicas exigem profissional habilitado.'

function tabela(ws: ExcelJS.Worksheet, cab: string[], linhas: (string | number)[][], larguras: number[], numCols: number[] = []) {
  ws.addRow(cab)
  const h = ws.getRow(1)
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR } }
  h.alignment = { vertical: 'middle', wrapText: true }
  linhas.forEach((l) => ws.addRow(l))
  larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  numCols.forEach((c) => { ws.getColumn(c).numFmt = '#,##0.00' })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } }
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' }
}

type Precos = Record<string, number>
const preco = (p: Precos, material: string, unidade: string) => p[`${material}|${unidade}`] || 0

const listaCompras = (wb: ExcelJS.Workbook, itens: Item[], precos: Precos) => {
  const ws = wb.addWorksheet('Lista geral de compras')
  const lista = consolidar(itens)
  const comPreco = lista.some((l) => preco(precos, l.material, l.unidade) > 0)
  const cab = ['Material', 'Quantidade', 'Unidade', 'Etapas', 'Observações', ...(comPreco ? ['Preço unitário (R$)', 'Custo (R$)'] : [])]
  tabela(ws, cab,
    lista.map((l) => [l.material, l.final, l.unidade, l.etapas, l.etapas.includes(',') ? 'Total consolidado de várias etapas' : '',
      ...(comPreco ? [preco(precos, l.material, l.unidade), l.final * preco(precos, l.material, l.unidade)] : [])]),
    [34, 14, 12, 40, 36, 20, 16], comPreco ? [2, 6, 7] : [2])
  if (comPreco) {
    ws.addRow([])
    const t = ws.addRow(['Custo total estimado (R$)', '', '', '', '', '', lista.reduce((s, l) => s + l.final * preco(precos, l.material, l.unidade), 0)])
    t.font = { bold: true }
  }
}

/** Gera o .xlsx. `completo = false` gera somente a lista geral de compras. */
export async function gerarXlsx(obra: Obra, ambientes: Ambiente[], itens: Item[], completo: boolean, precos: Precos = {}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  if (!completo) { listaCompras(wb, itens, precos); return (await wb.xlsx.writeBuffer()) as ArrayBuffer }

  const h = toMetros(obra.alturaParede, obra.unidadeAltura)
  const area1 = ambientes.reduce((s, a) => s + areaAmbiente(a), 0)
  const parede = ambientes.reduce((s, a) => s + areaParedeBruta(a, h), 0) * obra.pavimentos
  const r = wb.addWorksheet('Resumo geral')
  ;[['Obra', obra.nome || 'Sem identificação'], ['Tipo de construção', obra.tipo], ['Data de geração', new Date().toLocaleDateString('pt-BR')],
    ['Altura das paredes (m)', h], ['Pavimentos', obra.pavimentos], ['Área construída, 1 pavimento (m²)', area1],
    ['Área total (m²)', area1 * obra.pavimentos], ['Parede bruta, sem aberturas (m²)', parede], ['Terreno', obra.terreno], ['Aviso', AVISO]]
    .forEach((l) => ws0(r, l))
  r.addRow([]); r.addRow(['Ambientes', 'Comprimento (m)', 'Largura (m)', 'Área (m²)']).font = { bold: true }
  ambientes.forEach((a) => r.addRow([a.nome, toMetros(a.comprimento, a.unidade), toMetros(a.largura, a.unidade), areaAmbiente(a)]))
  const porEtapa = [...new Set(itens.map((i) => i.etapa))].map((e) => [e, itens.filter((i) => i.etapa === e).reduce((s, i) => s + i.bruto * preco(precos, i.material, i.unidade), 0)] as [string, number])
  const custoTotal = porEtapa.reduce((s, [, v]) => s + v, 0)
  if (custoTotal > 0) {
    r.addRow([]); r.addRow(['Custo por etapa (R$)', 'Proporcional à quantidade antes de arredondar']).font = { bold: true }
    porEtapa.filter(([, v]) => v > 0).forEach(([e, v]) => r.addRow([e, v]))
    r.addRow(['Custo total estimado (R$)', custoTotal]).font = { bold: true }
    if (area1 > 0) r.addRow(['Custo estimado por m² (R$)', custoTotal / (area1 * obra.pavimentos)])
  }
  r.getColumn(1).width = 36; r.getColumn(2).width = 40; r.getColumn(3).width = 14; r.getColumn(4).width = 14
  r.getCell('B10').alignment = { wrapText: true }

  for (const etapa of [...new Set(itens.map((i) => i.etapa))]) {
    tabela(wb.addWorksheet(etapa), ['Material', 'Antes de arredondar', 'Quantidade para compra', 'Unidade', 'Tipo', 'Observações'],
      itens.filter((i) => i.etapa === etapa).map((i) => [i.material, i.bruto, i.final, i.unidade, i.tipo, `Perda ${i.perda}%`]),
      [32, 20, 22, 12, 28, 18], [2, 3])
  }
  listaCompras(wb, itens, precos)
  tabela(wb.addWorksheet('Memória de cálculo'),
    ['Etapa', 'Material', 'Fórmula', 'Dimensões consideradas', 'Coeficiente', 'Perda (%)', 'Antes de arredondar', 'Compra', 'Unidade', 'Tipo'],
    itens.map((i) => [i.etapa, i.material, i.formula, i.dimensoes, i.coef, i.perda, i.bruto, i.final, i.unidade, i.tipo]),
    [20, 26, 44, 52, 24, 10, 18, 12, 10, 26], [7])
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

function ws0(ws: ExcelJS.Worksheet, l: (string | number)[]) { const row = ws.addRow(l); row.getCell(1).font = { bold: true } }

export function baixar(dados: ArrayBuffer, nome: string, mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const url = URL.createObjectURL(new Blob([dados], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
