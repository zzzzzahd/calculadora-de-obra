import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { aplicarImportacao, avaliar, chaveItem, extrairItens, indexarExistentes, lerCsv, lerXlsx, numero } from './importacao'
import { saldos } from './regras'
import type { Processo } from './tipos'

const CAB = ['N°', 'PRODUTO', 'MARCA', 'UNID', 'QTDE LICITADA', 'QTDE ATA', 'ADITIVO', 'VALOR UNIT', 'QTDE SOLICITADA', 'QTDE EMPENHADA', 'QTDE FORNECIDA', 'QUANTIDADE', 'VALOR', 'EXECUTADO', 'FORNECEDOR']
// Teste 1 do documento: 1.000 sacos de cimento, 20 m³ de areia, 15 m³ de brita, 5.000 blocos cerâmicos
const DADOS: (string | number)[][] = [
  [1, '100001 - CIMENTO PORTLAND COMPOSTO CP II-Z-32, SACO COM 50 KG.', 'sem marca', 'SC', 1000, 1000, 0, 38, 0, 0, 0, 1000, 38000, '0,00%', 'FORN A'],
  [2, '100002 - AREIA LAVADA MÉDIA', 'sem marca', 'M³', 20, 20, 0, 100, 0, 0, 0, 20, 2000, '0,00%', 'FORN A'],
  [3, '100003 - PEDRA BRITADA 1', 'sem marca', 'M³', 15, 15, 0, 220, 0, 0, 0, 15, 3300, '0,00%', 'FORN B'],
  [4, '100004 - BLOCO CERÂMICO 9X19X19', 'sem marca', 'UND', 5000, 5000, 0, 1.2, 0, 0, 0, 5000, 6000, '0,00%', 'FORN B'],
]
const linhas = [['MEMÓRIA DE CÁLCULO'], [], [null, null, null, null, null, null, null, null, null, null, null, 'DISPONÍVEL'], CAB, ...DADOS]

async function xlsx(rows: unknown[][], nome = 'GERAL') {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(nome)
  rows.forEach((r) => ws.addRow(r))
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe('importação (Teste 1)', () => {
  it('lê o cabeçalho abaixo de títulos e extrai os 4 itens com rastreabilidade', async () => {
    const abas = await lerXlsx(await xlsx(linhas))
    expect(abas).toHaveLength(1)
    const it = abas[0].itens
    expect(it).toHaveLength(4)
    expect(it[0]).toMatchObject({ codigo: '100001', nome: 'CIMENTO PORTLAND COMPOSTO CP II-Z-32, SACO COM 50 KG.', unidade: 'SC', quantidadeAta: 1000, precoUnitario: 38, fornecedor: 'FORN A', aba: 'GERAL', linha: 5 })
    expect(it[3]).toMatchObject({ unidade: 'UND', quantidadeAta: 5000, precoUnitario: 1.2 })
    expect(it.every((i) => i.alertas.length === 0)).toBe(true)
  })
  it('ignora abas sem cabeçalho de materiais', async () => {
    expect(await lerXlsx(await xlsx([['qualquer coisa'], ['sem colunas']], 'Outra'))).toEqual([])
  })
  it('sinaliza baixa confiança e permite recalcular após correção', () => {
    const [a] = extrairItens([CAB, [1, '1 - X', '', '', 10, 10, 0, null, 2, 0, 0, 99, 5, '', '']], 'T')!
    expect(a.alertas).toEqual(expect.arrayContaining(['Unidade pendente', 'Preço unitário pendente', 'Fornecedor pendente', 'Disponível da planilha difere de ata + aditivo − solicitada']))
    expect(avaliar({ ...a, unidade: 'UND', precoUnitario: 1, fornecedor: 'F', disponivelPlanilha: 8, valorPlanilha: 8 })).toEqual([])
  })
  it('lê números brasileiros e CSV com ponto e vírgula', () => {
    expect(numero('1.234,56')).toBe(1234.56); expect(numero('28,57%')).toBe(28.57); expect(numero('abc')).toBeNull(); expect(numero('1.000.000')).toBe(1000000)
    const csv = CAB.join(';') + '\n1;"100001 - CIMENTO; CP II";sem marca;SC;1000;1000;0;38,5;0;0;0;1000;38500;0,00%;FORN A\n'
    const [aba] = lerCsv(csv)
    expect(aba.itens[0]).toMatchObject({ nome: 'CIMENTO; CP II', precoUnitario: 38.5, quantidadeAta: 1000 })
  })
})

describe('duplicidades e estratégias', () => {
  const proc: Processo = { id: 'p1', tipo: 'ata', numeroProcesso: '1', modalidade: '', numeroInstrumento: '', ano: 2026, fornecedor: 'FORN A', cnpj: '', dataAssinatura: '', vigenciaInicio: '', vigenciaFim: '', observacoes: '' }
  const itens = extrairItens(linhas, 'GERAL')!
  const primeira = aplicarImportacao(itens, new Map(), { 'FORN A': 'p1', 'FORN B': 'p2' }, 'novos')
  it('primeira importação cadastra tudo; reimportação não duplica', () => {
    expect(primeira.novos).toBe(4)
    const existentes = indexarExistentes(primeira.salvar, [proc])
    expect(existentes.has(chaveItem('100001', '', 'FORN A'))).toBe(true)
    const novos = aplicarImportacao(itens, existentes, {}, 'novos')
    expect(novos).toMatchObject({ novos: 0, ignorados: 4 })
    expect(aplicarImportacao(itens, existentes, {}, 'ignorar').salvar).toHaveLength(0)
  })
  it('atualizar muda só os existentes e preserva o que foi editado e as movimentações', () => {
    const existentes = indexarExistentes(primeira.salvar.map((m) => ({ ...m, nomePadronizado: 'Cimento CP II-Z-32 50 kg', quantidadeUtilizada: 7 })), [proc])
    const alterados = itens.map((i) => (i.codigo === '100001' ? { ...i, precoUnitario: 40 } : i))
    const r = aplicarImportacao(alterados, existentes, {}, 'atualizar')
    expect(r).toMatchObject({ atualizados: 4, novos: 0 })
    const c = r.salvar.find((m) => m.codigo === '100001')!
    expect(c).toMatchObject({ precoUnitario: 40, nomePadronizado: 'Cimento CP II-Z-32 50 kg', quantidadeUtilizada: 7 })
    expect(c.descricaoOriginal).toContain('CP II-Z-32')
  })
  it('"novo processo" cria cópias mesmo com duplicidade', () => {
    const existentes = indexarExistentes(primeira.salvar, [proc])
    expect(aplicarImportacao(itens, existentes, { 'FORN A': 'n1', 'FORN B': 'n2' }, 'novo-processo').novos).toBe(4)
  })
  it('saldos da planilha: DISPONÍVEL é saldo da ata a solicitar, não estoque físico', () => {
    const m = aplicarImportacao(extrairItens([CAB, [10, '9 - CAPACETE', 'sem marca', 'PAR', 35, 10, 0, 28, 10, 10, 10, 0, 0, '28,57%', 'F']], 'T')!, new Map(), { F: 'p' }, 'novos').salvar[0]
    expect(saldos(m)).toMatchObject({ saldoASolicitar: 0, aguardandoEntrega: 0, disponivel: 10, aReceber: 0 })
  })
})
