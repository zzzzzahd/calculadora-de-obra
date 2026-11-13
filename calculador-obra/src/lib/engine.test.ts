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
  it('cobertura usa a área inclinada, não a horizontal', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0 }
    const itens = calcular(obra, sala, p)
    const t = get(itens, 'Cobertura e madeiramento', 'Telha')
    expect(t.bruto).toBeCloseTo(10 * 6 * Math.sqrt(1.09) * 16 * 1.05, 3)
    expect(t.bruto).toBeGreaterThan(60 * 16 * 1.05)
    expect(itens.some((i) => i.material === 'Cumeeira')).toBe(true)
    expect(calcular(obra, sala, { ...p, aguas: 1 }).some((i) => i.material === 'Cumeeira')).toBe(false)
  })
  it('sem dimensões do telhado não inventa cobertura', () => {
    expect(calcular(obra, sala, PARAMS_PADRAO).some((i) => i.etapa === 'Cobertura e madeiramento')).toBe(false)
  })
  it('fundação e estrutura só com dimensões informadas', () => {
    expect(calcular(obra, sala, PARAMS_PADRAO).some((i) => i.etapa === 'Fundação' || i.etapa === 'Estrutura')).toBe(false)
    const p = { ...PARAMS_PADRAO, fundComp: 24, fundLarg: 0.3, fundAlt: 0.4 }
    const itens = calcular(obra, sala, p)
    expect(get(itens, 'Fundação', 'Concreto da fundação').bruto).toBeCloseTo(24 * 0.3 * 0.4 * 1.05, 4)
    expect(itens.some((i) => i.material.startsWith('Aço'))).toBe(false)
    expect(calcular(obra, sala, { ...p, acoKgM3: 80 }).some((i) => i.material.startsWith('Aço'))).toBe(true)
  })
  it('aterro só se a obra tem aterro', () => {
    const p = { ...PARAMS_PADRAO, aterroH: 0.3 }
    expect(calcular(obra, sala, p).some((i) => i.material === 'Aterro')).toBe(false)
    expect(get(calcular({ ...obra, movimentoTerra: 'aterro' }, sala, p), 'Preparação do terreno', 'Aterro').bruto).toBeCloseTo(35 * 0.3 * 1.2, 4)
  })
  it('revestimento usa área líquida × faces', () => {
    expect(get(calcular(obra, sala, PARAMS_PADRAO), 'Revestimentos', 'Chapisco').bruto).toBeCloseTo(67.2 * 2, 4)
  })
})
