import { describe, expect, it } from 'vitest'
import { aplicarFlags, campoVisivel, flagsIniciais, grupoVisivel } from './assistente'
import { calcular, PARAMS_PADRAO } from './engine'
import type { Obra } from '../types'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const sala = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' as const }]

describe('assistente de perguntas', () => {
  it('parte do que já foi preenchido', () => {
    expect(flagsIniciais(PARAMS_PADRAO)).toMatchObject({ fundacao: false, cobertura: false, revest: true, pintura: true })
    expect(flagsIniciais({ ...PARAMS_PADRAO, roofC: 10, roofL: 6 }).cobertura).toBe(true)
  })
  it('resposta "não" tira o item do cálculo, mesmo com valores preenchidos', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, calha: 1, fundComp: 20, fundLarg: 0.3, fundAlt: 0.4 }
    const f = { ...flagsIniciais(p), cobertura: false, fundacao: false }
    const itens = calcular(obra, sala, aplicarFlags(p, f))
    expect(itens.some((i) => i.etapa === 'Cobertura e madeiramento' || i.etapa === 'Fundação')).toBe(false)
  })
  it('calha exige telhado; aço exige projeto de armadura', () => {
    const f = { ...flagsIniciais(PARAMS_PADRAO), cobertura: false, calha: true, estrutura: true, projetoAco: false }
    const q = aplicarFlags({ ...PARAMS_PADRAO, acoKgM3: 80 }, f)
    expect(q.calha).toBe(0)
    expect(q.acoKgM3).toBe(0)
  })
  it('pintura e revestimento desligados não geram itens', () => {
    const f = { ...flagsIniciais(PARAMS_PADRAO), pintura: false, revest: false }
    const e = calcular(obra, sala, aplicarFlags(PARAMS_PADRAO, f)).map((i) => i.etapa)
    expect(e).not.toContain('Pintura')
    expect(e).not.toContain('Revestimentos')
  })
  it('visibilidade dinâmica de grupos e campos', () => {
    const f = flagsIniciais(PARAMS_PADRAO)
    expect(grupoVisivel('Terreno (0 = não calcular)', f, obra)).toBe(false)
    expect(grupoVisivel('Terreno (0 = não calcular)', f, { ...obra, movimentoTerra: 'aterro' })).toBe(true)
    expect(campoVisivel('cumeeiraM', f, { ...PARAMS_PADRAO, aguas: 1 })).toBe(false)
    expect(campoVisivel('cor2Pct', f, PARAMS_PADRAO)).toBe(false)
  })
  it('laje e impermeabilização respondem ao assistente', () => {
    const p = { ...PARAMS_PADRAO, lajeArea: 20, imperArea: 6 }
    const off = { ...flagsIniciais(p), laje: false, imper: false }
    const e = calcular(obra, sala, aplicarFlags(p, off)).map((i) => i.etapa)
    expect(e).not.toContain('Laje')
    expect(e).not.toContain('Impermeabilização')
    expect(grupoVisivel('Laje', off, obra)).toBe(false)
  })
  it('muro, calçada e escada respondem ao assistente', () => {
    const p = { ...PARAMS_PADRAO, muroComp: 20, calcArea: 30, escLarg: 1, escAlt: 2.7 }
    expect(flagsIniciais(p)).toMatchObject({ muro: true, calcada: true, escada: true })
    const off = { ...flagsIniciais(p), muro: false, calcada: false, escada: false }
    const e = calcular(obra, sala, aplicarFlags(p, off)).map((i) => i.etapa)
    for (const x of ['Muro', 'Calçada e áreas externas', 'Escada']) expect(e).not.toContain(x)
    expect(grupoVisivel('Muro', off, obra)).toBe(false)
  })
  it('laje pré-moldada, fossa e piscina respondem ao assistente', () => {
    const p = { ...PARAMS_PADRAO, preLajeArea: 20, fosCompr: 2, fosLarg: 1, fosProf: 1.5, pisC: 6, pisL: 3 }
    expect(flagsIniciais(p)).toMatchObject({ prelaje: true, fossa: true, piscina: true })
    const off = { ...flagsIniciais(p), prelaje: false, fossa: false, piscina: false }
    const e = calcular(obra, sala, aplicarFlags(p, off)).map((i) => i.etapa)
    for (const x of ['Laje pré-moldada', 'Fossa séptica e sumidouro', 'Piscina']) expect(e).not.toContain(x)
    expect(grupoVisivel('Laje pré-moldada', { ...off, laje: true }, obra)).toBe(false)
    expect(grupoVisivel('Laje', { ...off, laje: true }, obra)).toBe(true)
  })
  it('drywall, estrutura metálica e de madeira respondem ao assistente; grupos não se confundem', () => {
    const p = { ...PARAMS_PADRAO, dwComp: 10, metComp: 60, madComp: 30, radierArea: 40, fundTipo: 1 }
    expect(flagsIniciais(p)).toMatchObject({ drywall: true, metalica: true, madeira: true, fundacao: true })
    const off = { ...flagsIniciais(p), drywall: false, metalica: false, madeira: false, fundacao: false }
    const e = calcular(obra, sala, aplicarFlags(p, off)).map((i) => i.etapa)
    for (const x of ['Gesso e drywall', 'Estrutura metálica', 'Estrutura de madeira', 'Fundação']) expect(e).not.toContain(x)
    expect(grupoVisivel('Estrutura metálica (perfis informados)', { ...off, estrutura: true }, obra)).toBe(false)
    expect(grupoVisivel('Estrutura (só com dimensões)', { ...off, estrutura: true }, obra)).toBe(true)
    expect(campoVisivel('radierArea', off, { ...PARAMS_PADRAO, fundTipo: 1 })).toBe(true)
    expect(campoVisivel('fundComp', off, { ...PARAMS_PADRAO, fundTipo: 1 })).toBe(false)
  })
})
