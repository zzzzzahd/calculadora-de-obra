import { expect, it } from 'vitest'
import { exportarConfig, importarConfig, sanear } from './config'
import { calcular, PARAMS_PADRAO } from './engine'
import type { Obra } from '../types'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const sala = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' as const }]
const comp = { id: 'c1', nome: 'Manta asfáltica', etapa: 'Impermeabilização', unidade: 'rolo', base: 'area' as const, coef: 0.1, perda: 10 }

it('composição própria entra no cálculo: base × coeficiente × (1 + perda)', () => {
  const i = calcular(obra, sala, { ...PARAMS_PADRAO, composicoes: [comp] }).find((x) => x.material === 'Manta asfáltica')!
  expect(i.etapa).toBe('Impermeabilização')
  expect(i.bruto).toBeCloseTo(35 * 0.1 * 1.1, 4)
  expect(calcular(obra, sala, { ...PARAMS_PADRAO, composicoes: [{ ...comp, base: 'fixa', coef: 3, perda: 0 }] }).find((x) => x.material === 'Manta asfáltica')!.bruto).toBe(3)
})
it('backup JSON preserva composições e descarta as inválidas', () => {
  const volta = importarConfig(exportarConfig({ ...PARAMS_PADRAO, composicoes: [comp] }))
  expect(volta.composicoes).toHaveLength(1)
  expect(volta.composicoes[0]).toMatchObject({ nome: 'Manta asfáltica', unidade: 'rolo' })
  expect(sanear({ composicoes: [{ nome: '' }, 5, { nome: 'X', coef: -3, base: 'lixo' }] }).composicoes).toEqual([expect.objectContaining({ nome: 'X', coef: 0, base: 'area', etapa: 'Outros' })])
  expect(() => importarConfig('{}')).toThrow()
})
