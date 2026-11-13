import { describe, expect, it } from 'vitest'
import { calcular, consolidar, PARAMS_PADRAO } from './engine'
import type { Ambiente, Obra } from '../types'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const sala: Ambiente[] = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' }]
const get = (i: ReturnType<typeof calcular>, etapa: string, mat: string) => i.find((x) => x.etapa === etapa && x.material === mat)!

describe('motor de cálculo — sala 5×7', () => {
  it('blocos com perda e arredondamento', () => {
    const b = get(calcular(obra, sala, PARAMS_PADRAO), 'Alvenaria', 'Bloco')
    expect(b.bruto).toBeCloseTo((67.2 / (0.39 * 0.19)) * 1.05, 3)
    expect(b.final).toBe(Math.ceil(b.bruto))
  })
  it('desconta portas e janelas da alvenaria', () => {
    const p = { ...PARAMS_PADRAO, aberturas: [{ id: 'a', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 1 }] }
    const sem = get(calcular(obra, sala, PARAMS_PADRAO), 'Alvenaria', 'Bloco').bruto
    expect(get(calcular(obra, sala, p), 'Alvenaria', 'Bloco').bruto).toBeLessThan(sem)
  })
  it('volume do contrapiso = 35 × 0,05 × 1,05', () => {
    expect(get(calcular(obra, sala, PARAMS_PADRAO), 'Contrapiso e piso', 'Concreto do contrapiso').bruto).toBeCloseTo(1.8375, 4)
  })
  it('consolida cimento de várias etapas', () => {
    const itens = calcular(obra, sala, PARAMS_PADRAO)
    const c = consolidar(itens).find((x) => x.material === 'Cimento')!
    expect(c.bruto).toBeCloseTo(itens.filter((i) => i.material === 'Cimento').reduce((s, i) => s + i.bruto, 0))
    expect(c.etapas).toContain('Alvenaria')
  })
  it('sem medidas não gera itens', () => {
    expect(calcular(obra, [], PARAMS_PADRAO)).toEqual([])
  })
})
