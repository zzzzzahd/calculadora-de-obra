import { describe, expect, it } from 'vitest'
import type { Ambiente } from '../types'
import { definirDivisa, limpar, removerAmbiente } from './cadastro'
import { resolverLevantamento } from './paredes'

const a = (id: string, extra: Partial<Ambiente> = {}): Ambiente => ({ id, nome: id.toUpperCase(), comprimento: 7, largura: 7, unidade: 'm', ...extra })
const obra = { nome: '', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm' as const, pavimentos: 1, terreno: 'plano' as const, desnivel: false, movimentoTerra: 'nenhum' as const }

describe('cadastro central de ambientes', () => {
  it('marcar uma divisa preenche o lado oposto do outro ambiente (sem avisos de reciprocidade)', () => {
    const r = definirDivisa([a('s1'), a('s2')], 's1', 1, 's2')
    expect(r[0].divisas).toEqual({ 1: { com: 's2' } })
    expect(r[1].divisas).toEqual({ 3: { com: 's1' } })
    const l = resolverLevantamento(obra, r, [])
    expect(l.compartilhadaM).toBeCloseTo(7, 6)
    expect(l.avisos).toEqual([])
  })
  it('não sobrescreve um lado que o outro ambiente já usa', () => {
    const base = [a('s1'), a('s2', { divisas: { 3: { com: 's3' } } }), a('s3')]
    const r = definirDivisa(base, 's1', 1, 's2')
    expect(r[1].divisas).toEqual({ 3: { com: 's3' } })
  })
  it('limpar a divisa retira também o retorno no outro ambiente', () => {
    const r = definirDivisa(definirDivisa([a('s1'), a('s2')], 's1', 1, 's2'), 's1', 1, null)
    expect(r[0].divisas).toBeUndefined()
    expect(r[1].divisas).toBeUndefined()
  })
  it('trocar o destino retira o retorno do ambiente antigo', () => {
    const r = definirDivisa(definirDivisa([a('s1'), a('s2'), a('s3')], 's1', 1, 's2'), 's1', 1, 's3')
    expect(r[1].divisas).toBeUndefined()
    expect(r[2].divisas).toEqual({ 3: { com: 's1' } })
  })
  it('remover um ambiente limpa as divisas que apontavam para ele', () => {
    const r = removerAmbiente(definirDivisa([a('s1'), a('s2')], 's1', 1, 's2'), 's2')
    expect(r).toHaveLength(1)
    expect(r[0].divisas).toBeUndefined()
  })
  it('trecho informado vai para os dois lados', () => {
    const r = definirDivisa([a('s1'), a('s2')], 's1', 1, 's2', 3)
    expect(r[0].divisas![1]).toEqual({ com: 's2', trecho: 3 })
    expect(r[1].divisas![3]).toEqual({ com: 's1', trecho: 3 })
  })
  it('limpar remove campos vazios', () => {
    expect(limpar(a('x', { peDireito: 0, aberturas: [], acabamento: {} }))).toEqual(a('x'))
  })
})
