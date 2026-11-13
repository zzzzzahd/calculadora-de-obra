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
})
