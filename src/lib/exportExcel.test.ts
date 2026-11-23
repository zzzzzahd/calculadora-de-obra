import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { gerarXlsx } from './exportExcel'
import { calcular, PARAMS_PADRAO } from './engine'
import type { Ambiente, Obra } from '../types'

const obra: Obra = { nome: 'Teste', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const amb: Ambiente[] = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' }]
const abrir = async (b: ArrayBuffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(b); return wb }

describe('exportação Excel', () => {
  const itens = calcular(obra, amb, PARAMS_PADRAO)
  it('completo: só abas das etapas usadas, com lista e memória', async () => {
    const nomes = (await abrir(await gerarXlsx(obra, amb, itens, true))).worksheets.map((w) => w.name)
    expect(nomes).toEqual(['Resumo geral', 'Preparação do terreno', 'Alvenaria', 'Contrapiso e piso', 'Revestimentos', 'Pintura', 'Lista geral de compras', 'Memória de cálculo'])
  })
  it('simplificado: somente lista de compras, com cimento consolidado', async () => {
    const wb = await abrir(await gerarXlsx(obra, amb, itens, false))
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Lista geral de compras'])
    const linhas = wb.worksheets[0].getSheetValues().map((v) => (Array.isArray(v) ? v[1] : undefined))
    expect(linhas.filter((m) => m === 'Cimento')).toHaveLength(1)
  })
  it('com preços: lista com custo e resumo com custo por etapa, total e por m²', async () => {
    const wb = await abrir(await gerarXlsx(obra, amb, itens, true, { 'Bloco|un': 2, 'Tinta|lata': 300 }))
    const cab = wb.getWorksheet('Lista geral de compras')!.getRow(1).values as unknown[]
    expect(cab).toContain('Custo (R$)')
    const r: unknown[] = []
    wb.getWorksheet('Resumo geral')!.eachRow((row) => r.push((row.values as unknown[])[1]))
    expect(r).toEqual(expect.arrayContaining(['Custo por etapa (R$)', 'Custo total estimado (R$)', 'Custo estimado por m² (R$)']))
  })
})

describe('exportação Excel com o cadastro central', () => {
  const amb2: Ambiente[] = [
    { id: 's1', nome: 'Sala 1', comprimento: 7, largura: 7, unidade: 'm', tipo: 'sala', divisas: { 1: { com: 's2' } } },
    { id: 's2', nome: 'Sala 2', comprimento: 7, largura: 7, unidade: 'm', tipo: 'sala', peDireito: 3, divisas: { 3: { com: 's1' } } },
  ]
  it('resumo traz tipo, pé-direito, paredes compartilhadas e o total de parede sem dupla contagem', async () => {
    const o = { ...obra, alturaParede: 3 }
    const wb = await abrir(await gerarXlsx(o, amb2, calcular(o, amb2, PARAMS_PADRAO), true))
    const linhas: unknown[][] = []
    wb.getWorksheet('Resumo geral')!.eachRow((row) => linhas.push(row.values as unknown[]))
    const cab = linhas.find((l) => l[1] === 'Ambientes')!
    expect(cab).toEqual(expect.arrayContaining(['Tipo', 'Pé-direito (m)', 'Paredes compartilhadas']))
    expect(linhas.find((l) => l[1] === 'Sala 1')).toEqual(expect.arrayContaining(['Sala', 3, 'Lado 2: Sala 2']))
    expect(linhas.find((l) => l[1] === 'Parede bruta, sem aberturas (m²)')![2]).toBeCloseTo(147, 6)
    expect(linhas.find((l) => l[1] === 'Parede compartilhada (contada uma vez)')![2]).toBeCloseTo(7, 6)
  })
})
