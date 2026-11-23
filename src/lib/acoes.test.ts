import { describe, expect, it } from 'vitest'
import type { Abertura, Acao, Acoes, Ambiente, Obra } from '../types'
import { calcular, PARAMS_PADRAO, type Item, type Params } from './engine'
import { definirDivisa, descreverAcoes, limpar } from './cadastro'
import { resolverLevantamento } from './paredes'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })
const sala = (id: string, nome: string, extra: Partial<Ambiente> = {}): Ambiente => ({ id, nome, comprimento: 7, largura: 7, unidade: 'm', ...extra })
const ab = (id: string, tipo: 'Porta' | 'Janela', largura: number, altura: number, qtd: number, acao?: Acao, lado?: 0 | 1 | 2 | 3): Abertura => ({ id, tipo, largura, altura, qtd, acao, lado })
const acha = (itens: Item[], etapa: string, material: string) => itens.find((i) => i.etapa === etapa && i.material === material)
const calc = (a: Ambiente[], p: Partial<Params> = {}) => calcular(obra, a, P(p))
const AB = (acoes: Acoes, extra: Partial<Ambiente> = {}) => [sala('a', 'A'), sala('b', 'B', { acoes, ...extra })]

describe('ações: construir é o padrão', () => {
  it('"construir" explícito dá o mesmo resultado que sem ação', () => {
    const base = calc([sala('a', 'A'), sala('b', 'B')])
    const explicito = calc([sala('a', 'A', { acoes: { paredes: 'construir', piso: 'construir' } }), sala('b', 'B')])
    expect(explicito).toEqual(base)
    expect(base.some((i) => i.etapa === 'Demolição e entulho' || i.etapa === 'Recuperação e reaproveitamento')).toBe(false)
  })
})

describe('manter: não calcula material de construção', () => {
  it('paredes mantidas saem da alvenaria (só o outro ambiente é construído)', () => {
    const itens = calc(AB({ paredes: 'manter' }))
    expect(resolverLevantamento(obra, AB({ paredes: 'manter' }), []).alvLiquida).toBeCloseTo(84, 6)
    expect(acha(itens, 'Alvenaria', 'Bloco')!.bruto).toBeCloseTo((84 / (0.39 * 0.19)) * 1.05, 4)
    expect(itens.some((i) => i.etapa === 'Demolição e entulho')).toBe(false)
  })
  it('revestimento mantido: o ambiente sai de chapisco, emboço e pintura (faces internas e externas)', () => {
    const itens = calc(AB({ revestimento: 'manter' }), { revFaces: 2 })
    expect(acha(itens, 'Revestimentos', 'Chapisco')!.bruto).toBeCloseTo(84 + 84, 6) // só o ambiente A, interna + externa
    const todos = calc([sala('a', 'A'), sala('b', 'B')], { revFaces: 2 })
    expect(acha(todos, 'Revestimentos', 'Chapisco')!.bruto).toBeCloseTo(336, 6)
  })
  it('piso mantido: sem contrapiso, peças nem rodapé daquele ambiente', () => {
    const itens = calc(AB({ piso: 'manter' }))
    expect(acha(itens, 'Contrapiso e piso', 'Piso (área)')!.bruto).toBeCloseTo(49 * 1.1, 6)
    expect(acha(itens, 'Contrapiso e piso', 'Concreto do contrapiso')!.bruto).toBeCloseTo(49 * 0.05 * 1.05, 6)
  })
  it('esquadria mantida não entra na lista de compra nem nas vergas', () => {
    const a = [sala('a', 'A', { aberturas: [ab('p1', 'Porta', 0.8, 2.1, 1, 'manter')] }), sala('b', 'B', { aberturas: [ab('p2', 'Porta', 0.8, 2.1, 1)] })]
    const itens = calc(a)
    expect(acha(itens, 'Esquadrias', 'Porta 0,8 × 2,1 m')!.bruto).toBe(1)
  })
  it('abertura em parede mantida não desconta da parede construída', () => {
    const a = [sala('a', 'A', { acoes: { paredes: 'manter' }, aberturas: [ab('p', 'Porta', 0.8, 2.1, 1)] }), sala('b', 'B')]
    expect(resolverLevantamento(obra, a, []).alvLiquida).toBeCloseTo(84, 6)
  })
})

describe('demolir e substituir: demolição gera entulho', () => {
  const p = { demolEspParedeM: 0.14, entulhoEmpPct: 30 }
  it('demolição de alvenaria: área, volume de entulho com empolamento e viagens de caminhão', () => {
    const itens = calc(AB({ paredes: 'demolir' }), p)
    expect(acha(itens, 'Demolição e entulho', 'Demolição de alvenaria')!.bruto).toBeCloseTo(84, 6)
    expect(acha(itens, 'Demolição e entulho', 'Entulho de alvenaria')!.bruto).toBeCloseTo(84 * 0.14 * 1.3, 6)
    expect(acha(itens, 'Demolição e entulho', 'Remoção de entulho (viagens)')!.bruto).toBeCloseTo((84 * 0.14 * 1.3) / 6, 6)
    expect(acha(itens, 'Alvenaria', 'Bloco')!.bruto).toBeCloseTo((84 / (0.39 * 0.19)) * 1.05, 4) // só A é construído
  })
  it('sem a espessura informada: calcula a área e avisa, sem inventar o volume', () => {
    const itens = calc(AB({ paredes: 'demolir' }))
    const d = acha(itens, 'Demolição e entulho', 'Demolição de alvenaria')!
    expect(d.dimensoes).toContain('informe a espessura da parede')
    expect(itens.some((i) => i.material.startsWith('Entulho'))).toBe(false)
    expect(itens.some((i) => i.material.startsWith('Remoção de entulho'))).toBe(false)
  })
  it('abertura em parede demolida desconta da área demolida', () => {
    const a = AB({ paredes: 'demolir' }, { aberturas: [ab('j', 'Janela', 1, 1, 2)] })
    expect(acha(calc(a, p), 'Demolição e entulho', 'Demolição de alvenaria')!.bruto).toBeCloseTo(82, 6)
    expect(resolverLevantamento(obra, a, []).alvLiquida).toBeCloseTo(84, 6)
  })
  it('substituir: demole e constrói', () => {
    const itens = calc(AB({ paredes: 'substituir' }), p)
    expect(acha(itens, 'Demolição e entulho', 'Demolição de alvenaria')!.bruto).toBeCloseTo(84, 6)
    expect(acha(itens, 'Alvenaria', 'Bloco')!.bruto).toBeCloseTo((168 / (0.39 * 0.19)) * 1.05, 4)
  })
  it('piso demolido: entulho do piso e nenhum material de piso para o ambiente', () => {
    const itens = calc(AB({ piso: 'demolir' }), { demolEspPisoM: 0.08 })
    expect(acha(itens, 'Demolição e entulho', 'Demolição de piso e contrapiso')!.bruto).toBeCloseTo(49, 6)
    expect(acha(itens, 'Demolição e entulho', 'Entulho de piso e contrapiso')!.bruto).toBeCloseTo(49 * 0.08, 6)
    expect(acha(itens, 'Contrapiso e piso', 'Piso (área)')!.bruto).toBeCloseTo(49 * 1.1, 6)
  })
  it('revestimento demolido: área das faces internas líquidas; forro e esquadrias retirados', () => {
    const a = AB({ revestimento: 'demolir', forro: 'demolir' }, { aberturas: [ab('p', 'Porta', 0.8, 2.1, 1, 'demolir')] })
    const itens = calc(a, { forro: 1 })
    expect(acha(itens, 'Demolição e entulho', 'Demolição de revestimento de parede')!.bruto).toBeCloseTo(84 - 1.68, 6)
    expect(acha(itens, 'Demolição e entulho', 'Retirada de forro')!.bruto).toBeCloseTo(49, 6)
    expect(acha(itens, 'Demolição e entulho', 'Retirada de portas e janelas')!.bruto).toBe(1)
    expect(acha(itens, 'Forro', 'Forro')!.bruto).toBeCloseTo(49 * 1.05, 6) // só o ambiente A tem forro novo
    expect(itens.some((i) => i.etapa === 'Esquadrias' && i.material.startsWith('Porta'))).toBe(false)
  })
})

describe('recuperar e reaproveitar: listados, sem material novo', () => {
  it('lista as quantidades e não calcula material para o elemento', () => {
    const itens = calc(AB({ paredes: 'recuperar', piso: 'reaproveitar' }))
    expect(acha(itens, 'Recuperação e reaproveitamento', 'Recuperar: paredes')!.bruto).toBeCloseTo(84, 6)
    expect(acha(itens, 'Recuperação e reaproveitamento', 'Reaproveitar: piso')!.bruto).toBeCloseTo(49, 6)
    expect(acha(itens, 'Alvenaria', 'Bloco')!.bruto).toBeCloseTo((84 / (0.39 * 0.19)) * 1.05, 4)
    expect(acha(itens, 'Contrapiso e piso', 'Piso (área)')!.bruto).toBeCloseTo(49 * 1.1, 6)
    expect(itens.some((i) => i.etapa === 'Demolição e entulho')).toBe(false)
  })
})

describe('parede compartilhada entre ambientes com ações diferentes', () => {
  const base = (): Ambiente[] => definirDivisa([sala('a', 'A', { acoes: { paredes: 'manter' } }), sala('b', 'B')], 'a', 1, 'b')
  it('divergência: vale "construir" e há aviso para confirmar', () => {
    const l = resolverLevantamento(obra, base(), [])
    expect(l.alvLiquida).toBeCloseTo(21 * 3 + 7 * 3, 6) // 3 lados externos de B + a divisa; A mantido
    expect(l.avisos.some((x) => x.includes('ações diferentes'))).toBe(true)
  })
  it('ação definida na divisa vale para a parede compartilhada e some o aviso', () => {
    const a = definirDivisa(base(), 'a', 1, 'b', undefined, 'manter')
    const l = resolverLevantamento(obra, a, [])
    expect(l.alvLiquida).toBeCloseTo(21 * 3, 6)
    expect(l.avisos.some((x) => x.includes('ações diferentes'))).toBe(false)
    expect(a[1].divisas![3]!.acao).toBe('manter') // o outro lado fica igual
  })
  it('divisa demolida (ambientes unidos): área demolida contada uma vez', () => {
    const a = definirDivisa([sala('a', 'A'), sala('b', 'B')], 'a', 1, 'b', undefined, 'demolir')
    const l = resolverLevantamento(obra, a, [])
    expect(l.demolir.paredes).toBeCloseTo(21, 6)
    expect(l.alvLiquida).toBeCloseTo(42 * 3, 6)
  })
})

describe('cadastro: ações no ambiente', () => {
  it('limpar remove ações "construir" e vazias', () => {
    expect(limpar(sala('x', 'X', { acoes: { paredes: 'construir', piso: undefined } })).acoes).toBeUndefined()
    expect(limpar(sala('x', 'X', { acoes: { paredes: 'manter', piso: 'construir' } })).acoes).toEqual({ paredes: 'manter' })
  })
  it('descreve as ações diferentes de construir', () => {
    expect(descreverAcoes(sala('x', 'X', { acoes: { paredes: 'manter', piso: 'demolir' } }))).toBe('paredes: manter; piso: demolir')
    expect(descreverAcoes(sala('x', 'X'))).toBe('')
  })
})

describe('configuração e exportação com demolição', () => {
  it('as espessuras de demolição entram na configuração salva e importada', async () => {
    const { sanear } = await import('./config')
    const q = sanear({ demolEspParedeM: 0.14, entulhoEmpPct: 30, demolEspPisoM: -1 })
    expect(q.demolEspParedeM).toBe(0.14)
    expect(q.entulhoEmpPct).toBe(30)
    expect(PARAMS_PADRAO.demolEspParedeM).toBe(0) // padrão: não calcula o volume (não inventa espessura)
  })
  it('Excel inclui a etapa de demolição e a coluna "O que será feito"', async () => {
    const { gerarXlsx } = await import('./exportExcel')
    const ExcelJS = (await import('exceljs')).default
    const amb = AB({ paredes: 'demolir', piso: 'manter' })
    const itens = calc(amb, { demolEspParedeM: 0.14 })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await gerarXlsx(obra, amb, itens, true))
    const textos: string[] = []
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => textos.push(String(c.value)))))
    expect(textos).toEqual(expect.arrayContaining(['O que será feito', 'paredes: demolir; piso: manter', 'Demolição de alvenaria', 'Entulho de alvenaria']))
  })
})
