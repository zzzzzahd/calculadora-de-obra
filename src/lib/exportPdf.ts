import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TIPOS_AMBIENTE, type Ambiente, type Obra } from '../types'
import { areaAmbiente } from './geometry'
import { descreverAcoes, descreverDivisas } from './cadastro'
import { descreverPontos } from './hidraulica'
import { descreverPontosEl } from './eletrica'
import { resolverLevantamento } from './paredes'
import { toMetros } from './units'
import { consolidar, type Item } from './engine'

const n2 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const AVISOS = [
  'Quantitativos geométricos e estimativas baseadas em composição; não são projeto executivo.',
  'Dimensionamentos estruturais, elétricos e hidráulicos devem ser validados por profissional habilitado.',
  'Coeficientes e perdas são editáveis; confira-os antes da compra.',
]

/** Relatório PDF. `precos` (chave "material|unidade") é opcional. */
export function gerarPdf(obra: Obra, ambientes: Ambiente[], itens: Item[], precos: Record<string, number> = {}): ArrayBuffer {
  const doc = new jsPDF()
  const fim = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  const area1 = ambientes.reduce((s, a) => s + areaAmbiente(a), 0)
  doc.setFontSize(16); doc.text('Relatório de quantitativos', 14, 16)
  doc.setFontSize(10)
  doc.text(`Obra: ${obra.nome || 'Sem identificação'}  |  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 23)
  doc.text(`Tipo: ${obra.tipo}  |  Pavimentos: ${obra.pavimentos}  |  Altura das paredes: ${n2(toMetros(obra.alturaParede, obra.unidadeAltura))} m  |  Área (1 pav.): ${n2(area1)} m²`, 14, 29)
  const lev = resolverLevantamento(obra, ambientes, [])
  autoTable(doc, { startY: 34, head: [['Ambiente', 'Comprimento (m)', 'Largura (m)', 'Área (m²)', 'Tipo', 'Pé-direito (m)', 'Paredes compartilhadas', 'O que será feito', 'Pontos hidráulicos', 'Pontos elétricos']], headStyles: { fillColor: [217, 119, 6] }, styles: { fontSize: 8 },
    body: ambientes.map((a, k) => [a.nome, n2(toMetros(a.comprimento, a.unidade)), n2(toMetros(a.largura, a.unidade)), n2(areaAmbiente(a)), a.tipo ? TIPOS_AMBIENTE[a.tipo] : '', n2(lev.ambientes[k].altura), descreverDivisas(a, ambientes), descreverAcoes(a) || 'construir tudo', descreverPontos(a), descreverPontosEl(a)]) })
  if (lev.compartilhadaM > 0) doc.text(`Paredes (1 pavimento): ${n2(lev.externaM)} m externas + ${n2(lev.compartilhadaM)} m compartilhadas (contadas uma vez)`, 14, fim())
  let desloc = lev.compartilhadaM > 0 ? 6 : 0 // espaço para a linha de paredes, só na primeira tabela seguinte
  for (const e of [...new Set(itens.map((i) => i.etapa))]) {
    autoTable(doc, { startY: fim() + desloc, head: [[e, 'Tipo', 'Antes de arredondar', 'Compra', 'Un.']], headStyles: { fillColor: [217, 119, 6] },
      body: itens.filter((i) => i.etapa === e).map((i) => [i.material, i.tipo, n2(i.bruto), n2(i.final), i.unidade]) })
    desloc = 0
  }
  const lista = consolidar(itens)
  const comPreco = lista.some((l) => precos[`${l.material}|${l.unidade}`] > 0)
  const custo = (l: (typeof lista)[number]) => l.final * (precos[`${l.material}|${l.unidade}`] || 0)
  autoTable(doc, { startY: fim(), head: [['Lista geral de compras', 'Quantidade', 'Un.', 'Etapas', ...(comPreco ? ['Custo (R$)'] : [])]], headStyles: { fillColor: [217, 119, 6] },
    body: lista.map((l) => [l.material, n2(l.final), l.unidade, l.etapas, ...(comPreco ? [n2(custo(l))] : [])]) })
  let y = fim()
  if (comPreco) {
    const total = lista.reduce((s, l) => s + custo(l), 0)
    doc.text(`Custo total estimado: R$ ${n2(total)}${area1 > 0 ? `  |  R$ ${n2(total / (area1 * obra.pavimentos))}/m²` : ''}`, 14, y); y += 8
  }
  doc.setFontSize(9); doc.text(doc.splitTextToSize(`Limitações e alertas: ${AVISOS.join(' ')}`, 180), 14, y)
  autoTable(doc, { startY: y + 20, head: [['Memória de cálculo', 'Fórmula', 'Dimensões', 'Coeficiente', 'Perda %']], headStyles: { fillColor: [217, 119, 6] }, styles: { fontSize: 7 },
    body: itens.map((i) => [`${i.etapa}: ${i.material}`, i.formula, i.dimensoes, i.coef, String(i.perda)]) })
  return doc.output('arraybuffer')
}
