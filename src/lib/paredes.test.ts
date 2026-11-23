import { describe, expect, it } from 'vitest'
import type { Abertura, Ambiente, Obra } from '../types'
import { calcular, PARAMS_PADRAO, type Item, type Params } from './engine'
import { resolverLevantamento, todasAberturas } from './paredes'

const obra = (o: Partial<Obra> = {}): Obra => ({ nome: '', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum', ...o })
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })
const ab = (id: string, tipo: 'Porta' | 'Janela', largura: number, altura: number, qtd: number, lado?: 0 | 1 | 2 | 3): Abertura => ({ id, tipo, largura, altura, qtd, lado })
const sala = (id: string, nome: string, c = 7, l = 7, extra: Partial<Ambiente> = {}): Ambiente => ({ id, nome, comprimento: c, largura: l, unidade: 'm', ...extra })
const achar = (itens: Item[], etapa: string, material: string) => itens.find((i) => i.etapa === etapa && i.material === material)

// Cenário A (dados de teste hipotéticos, não são medidas de projeto): duas salas 7 × 7 m, pé-direito 3 m, lado a lado.
// Sala 1 (lado 2) ↔ Sala 2 (lado 4). Aberturas: porta entre as salas (cadastrada só na Sala 1), porta externa, 4 janelas.
const cenarioA = (): Ambiente[] => [
  sala('s1', 'Sala 1', 7, 7, { divisas: { 1: { com: 's2' } }, aberturas: [ab('pd', 'Porta', 0.8, 2.1, 1, 1), ab('pe', 'Porta', 0.9, 2.1, 1, 3), ab('j1', 'Janela', 1.2, 1, 2, 0)] }),
  sala('s2', 'Sala 2', 7, 7, { divisas: { 3: { com: 's1' } }, aberturas: [ab('j2', 'Janela', 1.2, 1, 2, 2)] }),
]
const paramsA = () => P({ roofC: 14, roofL: 7, tesouras: 3, eltTomadas: 8, eltInterruptores: 3, eltPontosLuz: 4, eltDisjuntores: 4 })

describe('cenário A — duas salas 7×7, pé-direito 3 m, tijolo cerâmico, contrapiso, piso, fibrocimento, portas e janelas, elétrica', () => {
  const lev = resolverLevantamento(obra(), cenarioA(), [])
  const itens = calcular(obra(), cenarioA(), paramsA())

  it('parede compartilhada conta uma vez: 42 m externos + 7 m compartilhados', () => {
    expect(lev.externaM).toBeCloseTo(42, 6)
    expect(lev.compartilhadaM).toBeCloseTo(7, 6)
    expect(lev.alvBruta).toBeCloseTo(147, 6) // v24 daria 168
    expect(lev.avisos).toEqual([])
  })
  it('aberturas: porta da divisa desconta uma vez na alvenaria e uma vez em cada face interna', () => {
    expect(lev.areaAberturas).toBeCloseTo(1.68 + 1.89 + 4.8, 6)
    expect(lev.alvLiquida).toBeCloseTo(147 - 8.37, 6)
    expect(lev.revInterno).toBeCloseTo(168 - (1.68 + 1.89 + 2.4) - (1.68 + 2.4), 6)
    expect(lev.extLiquida).toBeCloseTo(126 - (1.89 + 4.8), 6)
  })
  it('alvenaria: blocos a partir da área líquida e memória de cálculo com a decomposição', () => {
    const bloco = achar(itens, 'Alvenaria', 'Bloco')!
    expect(bloco.bruto).toBeCloseTo(((147 - 8.37) / (0.39 * 0.19)) * 1.05, 4)
    expect(bloco.dimensoes).toContain('42 m externa + 7 m compartilhada')
  })
  it('revestimento: faces internas + faces externas, sem contar a divisa em quatro faces', () => {
    const chap = achar(itens, 'Revestimentos', 'Chapisco')!
    expect(chap.bruto).toBeCloseTo(157.95 + 119.31, 6) // v24 daria 319,26
    expect(chap.dimensoes).toContain('faces internas')
  })
  it('pintura (1 face, padrão): só faces internas', () => {
    const tinta = achar(itens, 'Pintura', 'Tinta')!
    expect(tinta.dimensoes).toContain('157,95')
  })
  it('contrapiso e piso: 98 m² (os dois ambientes)', () => {
    expect(lev.areaContrapiso).toBeCloseTo(98, 6)
    expect(achar(itens, 'Contrapiso e piso', 'Piso (área)')!.bruto).toBeCloseTo(98 * 1.1, 6)
  })
  it('rodapé desconta a porta da divisa nos dois ambientes e a porta externa uma vez', () => {
    expect(lev.perimRodape).toBeCloseTo(56 - (0.8 * 2 + 0.9), 6)
  })
  it('esquadrias e vergas leem as aberturas dos ambientes (cada abertura uma vez)', () => {
    expect(achar(itens, 'Esquadrias', 'Porta 0,8 × 2,1 m')!.bruto).toBe(1)
    expect(achar(itens, 'Esquadrias', 'Janela 1,2 × 1 m')!.bruto).toBe(4)
    expect(achar(itens, 'Esquadrias', 'Fechadura e dobradiças (jogo)')!.bruto).toBe(2)
    expect(itens.some((i) => i.material === 'Concreto de vergas e contravergas')).toBe(true)
  })
  it('fita crepe conta a abertura da divisa nos dois ambientes', () => {
    const per = 2 * (0.8 + 2.1) * 2 + 2 * (0.9 + 2.1) + 2 * (1.2 + 1) * 4
    expect(achar(itens, 'Pintura', 'Fita crepe')!.bruto).toBeCloseTo(per / 50, 6)
  })
  it('cobertura e instalações elétricas continuam vindo dos parâmetros', () => {
    expect(itens.some((i) => i.etapa === 'Cobertura e madeiramento')).toBe(true)
    expect(itens.some((i) => i.etapa === 'Instalações elétricas')).toBe(true)
  })
  it('mesma obra sem marcar a divisa dá o resultado do v24 (parede contada duas vezes)', () => {
    const semDivisa = cenarioA().map((a) => ({ ...a, divisas: undefined }))
    expect(resolverLevantamento(obra(), semDivisa, []).alvBruta).toBeCloseTo(168, 6)
  })
})

describe('paredes compartilhadas — casos de borda', () => {
  it('ambientes de tamanhos diferentes: o trecho compartilhado é o menor; o resto do lado maior fica externo', () => {
    // A (7 × 7) encosta no lado de 14 m de B: o trecho é 7 m e os outros 7 m do lado de B ficam externos
    const a = [sala('a', 'A', 7, 7, { divisas: { 1: { com: 'b' } } }), sala('b', 'B', 14, 7, { divisas: { 0: { com: 'a' } } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.compartilhadaM).toBeCloseTo(7, 6)
    expect(l.externaM).toBeCloseTo(28 + 42 - 14, 6)
  })
  it('trecho informado menor que o lado deixa o restante como parede externa nos dois ambientes', () => {
    const a = [sala('a', 'A', 7, 7, { divisas: { 1: { com: 'b', trecho: 3 } } }), sala('b', 'B', 7, 7, { divisas: { 3: { com: 'a', trecho: 3 } } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.compartilhadaM).toBeCloseTo(3, 6)
    expect(l.externaM).toBeCloseTo(56 - 6, 6)
  })
  it('pés-direitos diferentes: o trecho compartilhado usa o maior e há aviso', () => {
    const a = [sala('a', 'A', 7, 7, { peDireito: 2.6, divisas: { 1: { com: 'b' } } }), sala('b', 'B', 7, 7, { peDireito: 3, divisas: { 3: { com: 'a' } } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.alvBruta).toBeCloseTo(21 * 2.6 + 21 * 3 + 7 * 3, 6) // externos de A + externos de B + compartilhado (maior altura)
    const ext = l.trechos.filter((t) => t.tipo === 'externa').reduce((s, t) => s + t.comprimento * t.altura, 0)
    expect(ext).toBeCloseTo(21 * 2.6 + 21 * 3, 6)
    expect(l.trechos.find((t) => t.tipo === 'compartilhada')!.altura).toBe(3)
    expect(l.avisos.some((x) => x.includes('pés-direitos diferentes'))).toBe(true)
  })
  it('divisa declarada só de um lado: conta como compartilhada e avisa', () => {
    const a = [sala('a', 'A', 7, 7, { divisas: { 1: { com: 'b' } } }), sala('b', 'B')]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.compartilhadaM).toBeCloseTo(7, 6)
    expect(l.avisos.some((x) => x.includes('não informa o lado correspondente'))).toBe(true)
  })
  it('referência inválida (ambiente inexistente ou o próprio) vira parede externa com aviso', () => {
    const a = [sala('a', 'A', 7, 7, { divisas: { 0: { com: 'x' }, 1: { com: 'a' } } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.compartilhadaM).toBe(0)
    expect(l.alvBruta).toBeCloseTo(84, 6)
    expect(l.avisos).toHaveLength(2)
  })
  it('abertura sem lado em ambiente com divisas: tratada como externa, com aviso', () => {
    const a = [sala('a', 'A', 7, 7, { divisas: { 1: { com: 'b' } }, aberturas: [ab('j', 'Janela', 1, 1, 1)] }), sala('b', 'B', 7, 7, { divisas: { 3: { com: 'a' } } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.avisos.some((x) => x.includes('sem lado informado'))).toBe(true)
    expect(l.extLiquida).toBeCloseTo(126 - 1, 6)
  })
  it('vários pavimentos multiplicam paredes e faces, não as aberturas (como no v24)', () => {
    const l = resolverLevantamento(obra({ pavimentos: 2 }), cenarioA(), [])
    expect(l.alvBruta).toBeCloseTo(294, 6)
    expect(l.areaAberturas).toBeCloseTo(8.37, 6)
  })
  it('lista geral de aberturas (sem ambiente) continua valendo e soma com as dos ambientes', () => {
    const geral = [ab('g', 'Janela', 1, 1, 2)]
    const l = resolverLevantamento(obra(), cenarioA(), geral)
    expect(l.areaAberturas).toBeCloseTo(8.37 + 2, 6)
    expect(todasAberturas(cenarioA(), geral)).toHaveLength(5)
  })
})

describe('pé-direito, piso, revestimentos e forro por ambiente', () => {
  it('pé-direito próprio altera a parede só daquele ambiente', () => {
    const l = resolverLevantamento(obra({ alturaParede: 2.8 }), [sala('a', 'A', 4, 5, { peDireito: 3 }), sala('b', 'B', 4, 5)], [])
    expect(l.alvBruta).toBeCloseTo(18 * 3 + 18 * 2.8, 6)
  })
  it('pé-direito na unidade do ambiente (cm)', () => {
    const l = resolverLevantamento(obra(), [{ id: 'a', nome: 'A', comprimento: 400, largura: 500, unidade: 'cm', peDireito: 250 }], [])
    expect(l.alvBruta).toBeCloseTo(18 * 2.5, 6)
  })
  it('piso "nenhum" tira o ambiente do contrapiso e do piso; "cimentado" só do piso (peças)', () => {
    const a = [sala('a', 'A', 4, 5), sala('b', 'B', 4, 5, { acabamento: { piso: 'nenhum' } }), sala('c', 'C', 4, 5, { acabamento: { piso: 'cimentado' } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.areaContrapiso).toBeCloseTo(40, 6)
    expect(l.areaPecas).toBeCloseTo(20, 6)
    const itens = calcular(obra(), a, P())
    expect(achar(itens, 'Contrapiso e piso', 'Piso (área)')!.bruto).toBeCloseTo(20 * 1.1, 6)
    expect(achar(itens, 'Contrapiso e piso', 'Concreto do contrapiso')!.bruto).toBeCloseTo(40 * 0.05 * 1.05, 6)
    expect(achar(itens, 'Contrapiso e piso', 'Concreto do contrapiso')!.dimensoes).toContain('de 60 m² construídos')
  })
  it('só contrapiso, sem peças: não gera piso nem rodapé', () => {
    const itens = calcular(obra(), [sala('a', 'A', 4, 5, { acabamento: { piso: 'cimentado' } })], P())
    expect(achar(itens, 'Contrapiso e piso', 'Concreto do contrapiso')).toBeDefined()
    expect(achar(itens, 'Contrapiso e piso', 'Piso (área)')).toBeUndefined()
    expect(achar(itens, 'Contrapiso e piso', 'Rodapé (peças)')).toBeUndefined()
  })
  it('forro por ambiente: true força, false retira, ausente segue o parâmetro geral', () => {
    const a = [sala('a', 'A', 4, 5, { acabamento: { forro: true } }), sala('b', 'B', 4, 5), sala('c', 'C', 4, 5, { acabamento: { forro: false } })]
    expect(achar(calcular(obra(), a, P({ forro: 0 })), 'Forro', 'Forro')!.bruto).toBeCloseTo(20 * 1.05, 6)
    expect(achar(calcular(obra(), a, P({ forro: 1 })), 'Forro', 'Forro')!.bruto).toBeCloseTo(40 * 1.05, 6)
  })
  it('sem revestimento: o ambiente sai de chapisco, emboço e pintura; cerâmica deriva área e sai da pintura', () => {
    const a = [sala('a', 'A', 4, 5, { acabamento: { revParede: 'nenhum' } }), sala('b', 'B', 4, 5, { acabamento: { revParede: 'ceramica', alturaCeramica: 1.5 } })]
    const l = resolverLevantamento(obra(), a, [])
    expect(l.revInterno).toBeCloseTo(18 * 3, 6) // só o ambiente B
    expect(l.ceramica).toBeCloseTo(18 * 1.5, 6)
    expect(l.pintInterna).toBeCloseTo(18 * 3 - 18 * 1.5, 6)
    const itens = calcular(obra(), a, P({ revFaces: 1 }))
    expect(achar(itens, 'Revestimentos', 'Revestimento cerâmico de parede')!.bruto).toBeCloseTo(27 * 1.1, 6)
  })
  it('cerâmica desconta portas (até a altura do revestimento) e avisa quando falta a altura', () => {
    const a = [sala('a', 'A', 4, 5, { acabamento: { revParede: 'ceramica', alturaCeramica: 1.5 }, aberturas: [ab('p', 'Porta', 0.8, 2.1, 1, 0)] })]
    expect(resolverLevantamento(obra(), a, []).ceramica).toBeCloseTo(18 * 1.5 - 0.8 * 1.5, 6)
    const b = [sala('a', 'A', 4, 5, { acabamento: { revParede: 'ceramica' } })]
    expect(resolverLevantamento(obra(), b, []).avisos.some((x) => x.includes('altura do revestimento cerâmico'))).toBe(true)
  })
})

describe('alterar um ambiente atualiza tudo que depende dele', () => {
  it('mudar o tamanho de uma sala muda piso, alvenaria, revestimento e pintura juntos', () => {
    const base = calcular(obra(), cenarioA(), paramsA())
    const maior = cenarioA().map((a) => (a.id === 's2' ? { ...a, comprimento: 8 } : a))
    const novo = calcular(obra(), maior, paramsA())
    for (const [etapa, mat] of [['Alvenaria', 'Bloco'], ['Contrapiso e piso', 'Piso (área)'], ['Revestimentos', 'Chapisco'], ['Pintura', 'Tinta']] as const)
      expect(achar(novo, etapa, mat)!.bruto).toBeGreaterThan(achar(base, etapa, mat)!.bruto)
  })
  it('retirar a divisa volta à parede contada duas vezes', () => {
    const com = calcular(obra(), cenarioA(), paramsA()), sem = calcular(obra(), cenarioA().map((a) => ({ ...a, divisas: undefined })), paramsA())
    expect(achar(sem, 'Alvenaria', 'Bloco')!.bruto).toBeGreaterThan(achar(com, 'Alvenaria', 'Bloco')!.bruto)
  })
})
