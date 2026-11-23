import { describe, expect, it } from 'vitest'
import type { Ambiente, Obra } from '../types'
import { calcular, PARAMS_PADRAO, type Params } from './engine'
import { criarContexto } from './motor/contexto'
import { terreno } from './motor/terreno'
import { fundacao } from './motor/fundacao'
import { lajeFormas } from './motor/lajes'
import { alvenaria } from './motor/alvenaria'
import { aditivos } from './motor/aditivos'
import { demolicao } from './motor/demolicao'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const amb: Ambiente[] = [{ id: 'a', nome: 'Sala', comprimento: 5, largura: 7, unidade: 'm' }]
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })

describe('motor modular: cada etapa funciona sozinha sobre o contexto', () => {
  it('o contexto traz o levantamento resolvido e começa sem itens', () => {
    const c = criarContexto(obra, amb, P())
    expect(c.area1).toBe(35); expect(c.h).toBe(2.8); expect(c.lev.alvBruta).toBeCloseTo(67.2, 6); expect(c.liq).toBeCloseTo(67.2, 6)
    expect(c.itens).toEqual([]); expect(c.estado).toEqual({ cimConcKg: 0, cimArgKg: 0, formaTotal: 0 })
  })
  it('uma etapa isolada acrescenta só os seus itens', () => {
    const c = criarContexto(obra, amb, P())
    terreno(c)
    expect(c.itens.map((i) => [i.etapa, i.material, i.bruto])).toEqual([['Preparação do terreno', 'Limpeza do terreno', 35]])
    alvenaria(c)
    const bloco = c.itens.find((i) => i.material === 'Bloco')!
    expect(bloco.bruto).toBeCloseTo((67.2 / (0.39 * 0.19)) * 1.05, 4)
    expect(calcular(obra, amb, P()).find((i) => i.material === 'Bloco')).toEqual(bloco) // igual ao de calcular()
  })
  it('estado compartilhado: formas da fundação alimentam o escoramento; cimento por escopo alimenta os aditivos', () => {
    const p = P({ fundComp: 28, fundLarg: 0.3, fundAlt: 0.5, reusoForma: 3, aditivoConc: 1, aditivoConcPct: 1 })
    const c = criarContexto(obra, amb, p)
    fundacao(c)
    expect(c.estado.formaTotal).toBeCloseTo(28 * 0.5 * 2, 6)
    expect(c.estado.cimConcKg).toBeGreaterThan(0)
    lajeFormas(c)
    expect(c.itens.some((i) => i.etapa === 'Formas e escoramento')).toBe(true)
    aditivos(c)
    expect(c.itens.some((i) => i.etapa === 'Aditivos')).toBe(true)
  })
  it('sem reaproveitamento informado não há etapa de formas (0 = não calcular)', () => {
    const c = criarContexto(obra, amb, P({ fundComp: 28, fundLarg: 0.3, fundAlt: 0.5, reusoForma: 0 }))
    fundacao(c); lajeFormas(c)
    expect(c.itens.some((i) => i.etapa === 'Formas e escoramento')).toBe(false)
  })
  it('demolição é uma etapa independente e só aparece com ações no cadastro', () => {
    const c0 = criarContexto(obra, amb, P()); demolicao(c0)
    expect(c0.itens).toEqual([])
    const c1 = criarContexto(obra, [{ ...amb[0], acoes: { paredes: 'demolir' } }], P({ demolEspParedeM: 0.14 })); demolicao(c1)
    expect(c1.itens.map((i) => i.material)).toContain('Demolição de alvenaria')
  })
  it('calcular não acrescenta nada quando não há área construída', () => {
    expect(calcular(obra, [], P())).toEqual([])
    expect(calcular(obra, [{ id: 'a', nome: 'X', comprimento: 0, largura: 0, unidade: 'm' }], P())).toEqual([])
  })
  it('as etapas saem sempre na mesma ordem', () => {
    const itens = calcular({ ...obra, movimentoTerra: 'ambos' }, amb, P({ aterroH: 0.4, fundComp: 28, fundLarg: 0.3, fundAlt: 0.5, roofC: 8, roofL: 6, eltTomadas: 5, forro: 1, aditivoArg: 1, aditivoArgPct: 1 }))
    const ordem = [...new Set(itens.map((i) => i.etapa))]
    const pos = (e: string) => ordem.indexOf(e)
    const esperada = ['Preparação do terreno', 'Fundação', 'Alvenaria', 'Contrapiso e piso', 'Revestimentos', 'Forro', 'Pintura', 'Instalações elétricas', 'Cobertura e madeiramento', 'Aditivos']
    for (let i = 1; i < esperada.length; i++) expect(pos(esperada[i - 1]), `${esperada[i - 1]} antes de ${esperada[i]}`).toBeLessThan(pos(esperada[i]))
  })
})
