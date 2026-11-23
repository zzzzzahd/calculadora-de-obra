import { describe, expect, it } from 'vitest'
import { GRUPOS } from './campos'
import { PARAMS_PADRAO } from './engine'
import { campoVisivel, flagsIniciais, grupoVisivel } from './assistente'

const chaves = GRUPOS.flatMap((g) => g.campos.map(([k]) => k as string))
const numericos = Object.entries(PARAMS_PADRAO).filter(([k, v]) => typeof v === 'number').map(([k]) => k)

describe('lista de campos dos parâmetros', () => {
  it('não repete campo nem título de grupo, e todo rótulo tem texto', () => {
    expect(new Set(chaves).size).toBe(chaves.length)
    expect(new Set(GRUPOS.map((g) => g.titulo)).size).toBe(GRUPOS.length)
    for (const g of GRUPOS) { expect(g.campos.length, g.titulo).toBeGreaterThan(0); for (const [k, rot] of g.campos) expect(rot.trim().length, `${g.titulo}/${k}`).toBeGreaterThan(2) }
  })
  it('todo campo listado existe nos parâmetros e é numérico', () => {
    for (const k of chaves) expect(typeof (PARAMS_PADRAO as unknown as Record<string, unknown>)[k], k).toBe('number')
  })
  it('todo parâmetro numérico aparece na tela em algum grupo, ou tem a edição em outro lugar documentada aqui', () => {
    // Parâmetros que não estão na lista de campos porque são editados por outro controle do Quantitativos.
    const EM_OUTRO_LUGAR: Record<string, string> = {
      fundTipo: 'seletor "Tipo de fundação"', escTipo: 'seletor "Tipo de escada"',
      chapCalKgM3: 'definido pelo traço do chapisco (tracos.ts)', embCalKgM3: 'definido pelo traço do emboço (tracos.ts)',
      aditivoConc: 'seção "Traços e aditivos"', aditivoConcPct: 'seção "Traços e aditivos"', aditivoArg: 'seção "Traços e aditivos"', aditivoArgPct: 'seção "Traços e aditivos"',
    }
    const semTela = numericos.filter((k) => !chaves.includes(k)).sort()
    expect(semTela).toEqual(Object.keys(EM_OUTRO_LUGAR).sort()) // parâmetro novo sem campo na tela (ou exceção que sumiu) faz este teste falhar
  })
  it('a visibilidade por perguntas Sim/Não trata todos os grupos e campos sem erro', () => {
    const flags = flagsIniciais(PARAMS_PADRAO)
    for (const g of GRUPOS) { expect(typeof grupoVisivel(g.titulo, flags, { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' })).toBe('boolean'); for (const [k] of g.campos) expect(typeof campoVisivel(k, flags, PARAMS_PADRAO)).toBe('boolean') }
  })
})
