import { describe, expect, it } from 'vitest'
import { ADITIVOS, TRACOS } from './tracos'
import { calcular, PARAMS_PADRAO } from './engine'
import type { Obra } from '../types'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const sala = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' as const }]
const get = (i: ReturnType<typeof calcular>, e: string, m: string) => i.find((x) => x.etapa === e && x.material === m)!
const sacos = (i: ReturnType<typeof calcular>, etapas: string[]) => i.filter((x) => x.material === 'Cimento' && etapas.includes(x.etapa)).reduce((s, x) => s + x.bruto, 0)

describe('traços pré-definidos', () => {
  const por = (chave: string, nome: string) => TRACOS.find((g) => g.chave === chave)!.lista.find((x) => x.nome.includes(nome))!
  it('concreto 1:2:3 e argamassa 1:2:8 geram consumos coerentes', () => {
    expect(por('concEst', '1:2:3')).toMatchObject({ estCimentoKg: 315, estAreiaM3: 0.45, estBritaM3: 0.675 })
    expect(por('assent', '1:2:8')).toMatchObject({ argCimentoKg: 165, calKgM3: 142, argAreiaM3: 0.945 })
    expect(por('assent', '1:3')).toMatchObject({ calKgM3: 0 })
  })
  it('reboco forte 1:1:1 existe como exemplo informado e todos os presets têm nome único', () => {
    expect(por('emb', 'forte')).toMatchObject({ embCimentoKg: expect.any(Number), embCalKgM3: expect.any(Number) })
    for (const g of TRACOS) expect(new Set(g.lista.map((x) => x.nome)).size).toBe(g.lista.length)
  })
  it('o traço escolhido altera o cálculo e o cal do reboco entra na lista', () => {
    const base = sacos(calcular(obra, sala, PARAMS_PADRAO), ['Revestimentos']) // chapisco + emboço
    const forte = { ...PARAMS_PADRAO, ...(({ nome: _n, ...c }) => c)(por('emb', 'forte')) }
    const i = calcular(obra, sala, forte)
    expect(sacos(i, ['Revestimentos'])).toBeGreaterThan(base)
    expect(i.some((x) => x.etapa === 'Revestimentos' && x.material === 'Cal hidratada')).toBe(true)
    expect(calcular(obra, sala, { ...PARAMS_PADRAO, embCalKgM3: 100 }).find((x) => x.etapa === 'Revestimentos' && x.material === 'Cal hidratada')!.bruto).toBeCloseTo((134.4 * 0.025 * 1.1 * 100) / 20, 4)
  })
})

describe('aditivos', () => {
  it('sem aditivo não há linha; com aditivo = cimento do escopo × %', () => {
    expect(calcular(obra, sala, PARAMS_PADRAO).some((x) => x.etapa === 'Aditivos')).toBe(false)
    const p = { ...PARAMS_PADRAO, calcArea: 30, aditivoConc: 1, aditivoConcPct: 1, aditivoArg: 3, aditivoArgPct: 5 }
    const i = calcular(obra, sala, p)
    expect(get(i, 'Aditivos', `${ADITIVOS[1].nome} (concreto)`).bruto).toBeCloseTo(sacos(i, ['Contrapiso e piso', 'Calçada e áreas externas']) * 50 * 0.01, 4)
    expect(get(i, 'Aditivos', `${ADITIVOS[3].nome} (argamassas)`).bruto).toBeCloseTo(sacos(i, ['Alvenaria', 'Revestimentos']) * 50 * 0.05, 4)
  })
})
