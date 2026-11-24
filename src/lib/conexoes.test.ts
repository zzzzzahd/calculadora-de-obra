import { describe, expect, it } from 'vitest'
import type { Ambiente, Obra } from '../types'
import { calcular, consolidar, PARAMS_PADRAO, type ConexaoHidro, type Item, type Params } from './engine'
import { CONEXOES_COMUNS, pontoDoSistema, quantidadeConexao, totaisHidro } from './hidraulica'
import { avisosDeFlags, aplicarFlags, flagsIniciais } from './assistente'
import { exportarConfig, importarConfig, sanear } from './config'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const banho: Ambiente = { id: 'b', nome: 'Banheiro', comprimento: 2, largura: 3, unidade: 'm', pontos: { vaso: 1, lavatorio: 1, chuveiro: 1, ralo: 1, registro: 2 } }
const cozinha: Ambiente = { id: 'c', nome: 'Cozinha', comprimento: 3, largura: 4, unidade: 'm', pontos: { pia: 1, torneira: 1 } }
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })
const con = (x: Partial<ConexaoHidro> & { nome: string }): ConexaoHidro => ({ id: x.nome, sistema: 'agua', porPonto: {}, porPontoGeral: 0, fixa: 0, perda: 0, ...x })
const HI = 'Instalações hidráulicas e sanitárias'
const acha = (itens: Item[], parte: string) => itens.find((i) => i.etapa === HI && i.material.includes(parte))

describe('quantidade de uma conexão detalhada', () => {
  const th = totaisHidro([banho, cozinha], { hidPontosAgua: 2, sanPontos: 1 })
  it('soma pontos de cada tipo × coeficiente, pontos gerais × coeficiente e a quantidade fixa', () => {
    const c = con({ nome: 'Joelho 90°', porPonto: { vaso: 2, lavatorio: 2, chuveiro: 1, pia: 2, torneira: 1 }, porPontoGeral: 1, fixa: 1 })
    const q = quantidadeConexao(c, th, { hidPontosAgua: 2, sanPontos: 1 })
    expect(q.qtd).toBe(11)
    expect(q.partes).toEqual(['vaso sanitário 1 × 2', 'lavatório 1 × 2', 'chuveiro 1 × 1', 'pia 1 × 2', 'torneira externa ou de jardim 1 × 1', 'pontos gerais 2 × 1', 'fixa 1'])
  })
  it('só conta tipos de peça que existem no sistema: chuveiro não tem esgoto; ralo não tem água; registro vale para a água', () => {
    expect(pontoDoSistema('chuveiro', 'esgoto')).toBe(false); expect(pontoDoSistema('ralo', 'agua')).toBe(false)
    expect(pontoDoSistema('registro', 'agua')).toBe(true); expect(pontoDoSistema('registro', 'esgoto')).toBe(false)
    expect(quantidadeConexao(con({ nome: 'x', sistema: 'esgoto', porPonto: { chuveiro: 5, ralo: 2 } }), th, { hidPontosAgua: 0, sanPontos: 0 }).qtd).toBe(2)
    expect(quantidadeConexao(con({ nome: 'x', sistema: 'agua', porPonto: { registro: 1, ralo: 9 } }), th, { hidPontosAgua: 0, sanPontos: 0 }).qtd).toBe(2)
  })
  it('sem coeficiente, sem ponto ou valores inválidos não há quantidade (nada é assumido)', () => {
    expect(quantidadeConexao(con({ nome: 'x' }), th, { hidPontosAgua: 2, sanPontos: 1 }).qtd).toBe(0)
    expect(quantidadeConexao(con({ nome: 'x', porPonto: { tanque: 3 } }), th, { hidPontosAgua: 0, sanPontos: 0 }).qtd).toBe(0) // não há tanque
    expect(quantidadeConexao(con({ nome: 'x', porPonto: { vaso: -2 }, porPontoGeral: NaN, fixa: -1 }), th, { hidPontosAgua: 2, sanPontos: 1 }).qtd).toBe(0)
  })
  it('a lista de nomes comuns não traz diâmetro nem quantidade', () => {
    for (const n of [...CONEXOES_COMUNS.agua, ...CONEXOES_COMUNS.esgoto]) expect(n).not.toMatch(/\d+\s*mm|\d+\/\d|polegada|"/i)
  })
})

describe('motor: conexões detalhadas', () => {
  const joelho = con({ nome: 'Joelho 90° 25 mm', porPonto: { vaso: 2, lavatorio: 2, chuveiro: 1, pia: 2, torneira: 1 }, porPontoGeral: 1, fixa: 1, perda: 10 })
  const itens = calcular(obra, [banho, cozinha], P({ hidPontosAgua: 2, sanPontos: 1, conexoes: [joelho] }))
  it('gera um item por conexão com a conta por extenso na memória de cálculo', () => {
    const i = acha(itens, 'Joelho 90° 25 mm')!
    expect(i.material).toBe('Conexão (água fria): Joelho 90° 25 mm'); expect(i.unidade).toBe('un'); expect(i.tipo).toBe('Estimativa por composição')
    expect(i.bruto).toBeCloseTo(11 * 1.1, 10); expect(i.final).toBe(13) // 12,1 → 13
    expect(i.dimensoes).toBe('vaso sanitário 1 × 2 + lavatório 1 × 2 + chuveiro 1 × 1 + pia 1 × 2 + torneira externa ou de jardim 1 × 1 + pontos gerais 2 × 1 + fixa 1')
    expect(i.perda).toBe(10)
  })
  it('com conexões detalhadas de água, o coeficiente único de água deixa de ser somado (sem contar em dobro); o de esgoto continua', () => {
    expect(acha(itens, 'Conexões de água fria')).toBeUndefined()
    expect(acha(itens, 'Conexões de esgoto')!.bruto).toBe(P().conexPorPonto * 5)
  })
  it('conexão sem quantidade não gera item nem tira o coeficiente único', () => {
    const z = calcular(obra, [banho], P({ conexoes: [con({ nome: 'Tê', porPonto: { tanque: 2 } })] })) // não há tanque
    expect(acha(z, 'Tê')).toBeUndefined(); expect(acha(z, 'Conexões de água fria')).toBeDefined()
  })
  it('esgoto: separado da água, com os pontos de esgoto', () => {
    const e = calcular(obra, [banho, cozinha], P({ sanPontos: 1, conexoes: [con({ nome: 'Junção', sistema: 'esgoto', porPonto: { vaso: 1, ralo: 2, chuveiro: 9 }, porPontoGeral: 3 })] }))
    expect(acha(e, 'Conexão (esgoto): Junção')!.bruto).toBe(1 + 2 + 3) // chuveiro ignorado
    expect(acha(e, 'Conexões de esgoto')).toBeUndefined(); expect(acha(e, 'Conexões de água fria')).toBeDefined()
  })
  it('a lista de compras soma linhas com o mesmo nome; sem conexões o resultado é o de antes', () => {
    const dois = calcular(obra, [banho], P({ conexoes: [con({ id: '1', nome: 'Luva', porPonto: { vaso: 1 } }), con({ id: '2', nome: 'Luva', porPonto: { lavatorio: 3 } })] }))
    expect(consolidar(dois).find((x) => x.material.includes('Luva'))!.final).toBe(4)
    expect(calcular(obra, [banho], P({ conexoes: [] }))).toEqual(calcular(obra, [banho], P()))
  })
})

describe('configuração: conexões no backup e na restauração', () => {
  it('exporta e importa sem perder nada', () => {
    const p = P({ conexoes: [con({ id: 'a', nome: 'Joelho', porPonto: { vaso: 2 }, porPontoGeral: 1, fixa: 3, perda: 5 })] })
    expect(importarConfig(exportarConfig(p)).conexoes).toEqual(p.conexoes)
  })
  it('sanitiza dados inválidos: valores negativos ou NaN, tipos desconhecidos, nome vazio, sistema e perda fora do limite', () => {
    const q = sanear({ conexoes: [
      { id: 'a', nome: '  Joelho  ', sistema: 'gas', porPonto: { vaso: -3, pia: 2, inventado: 5, ralo: 'x' }, porPontoGeral: NaN, fixa: -1, perda: 500 },
      { nome: '   ' }, null, 'x', { nome: 'n'.repeat(200), sistema: 'esgoto' },
    ] })
    expect(q.conexoes).toHaveLength(2)
    expect(q.conexoes[0]).toEqual({ id: 'a', nome: 'Joelho', sistema: 'agua', porPonto: { pia: 2 }, porPontoGeral: 0, fixa: 0, perda: 100 })
    expect(q.conexoes[1].nome).toHaveLength(80); expect(q.conexoes[1].sistema).toBe('esgoto')
  })
  it('limita a 200 linhas e aceita configuração antiga sem conexões', () => {
    expect(sanear({ conexoes: Array.from({ length: 300 }, (_, i) => ({ nome: `c${i}` })) }).conexoes).toHaveLength(200)
    expect(sanear({ composicoes: [] }).conexoes).toEqual([]); expect(sanear(null).conexoes).toEqual([])
  })
})

describe('Sim/Não do assistente x cadastro de ambientes', () => {
  it('o cadastro com pontos liga a pergunta de hidráulica ao abrir', () => {
    expect(flagsIniciais(PARAMS_PADRAO, [banho]).hidraulica).toBe(true)
    expect(flagsIniciais(PARAMS_PADRAO, [{ ...banho, pontos: undefined }]).hidraulica).toBe(false)
    expect(flagsIniciais(PARAMS_PADRAO).hidraulica).toBe(false)
  })
  it('responder "Não" com dados cadastrados: o cálculo mantém o cadastro e a tela avisa', () => {
    const f = { ...flagsIniciais(PARAMS_PADRAO, [banho]), hidraulica: false, forro: false, revest: false }
    const av = avisosDeFlags([banho, { ...cozinha, acabamento: { forro: true, revParede: 'ceramica' as const, alturaCeramica: 1.5 } }], f)
    expect(av).toHaveLength(3); expect(av[0]).toContain('pontos hidráulicos cadastrados'); expect(av[1]).toContain('forro'); expect(av[2]).toContain('cerâmico')
    expect(avisosDeFlags([banho], { ...f, hidraulica: true })).toEqual([])
    const itens = calcular(obra, [banho], aplicarFlags(P(), f))
    expect(acha(itens, 'Vaso sanitário')!.bruto).toBe(1) // o ponto cadastrado continua valendo
  })
  it('"Não" zera os coeficientes que não dependem do cadastro (pontos gerais e quantidade fixa), não os por tipo de peça', () => {
    const p = P({ conexoes: [con({ nome: 'Luva', porPonto: { vaso: 2 }, porPontoGeral: 4, fixa: 5 })] })
    const q = aplicarFlags(p, { ...flagsIniciais(p), hidraulica: false })
    expect(q.conexoes[0]).toMatchObject({ porPonto: { vaso: 2 }, porPontoGeral: 0, fixa: 0 })
    expect(aplicarFlags(p, { ...flagsIniciais(p), hidraulica: true }).conexoes).toEqual(p.conexoes)
  })
})

describe('exportação das conexões', () => {
  it('Excel traz as conexões detalhadas na lista de compras e na memória de cálculo', async () => {
    const { gerarXlsx } = await import('./exportExcel')
    const ExcelJS = (await import('exceljs')).default
    const amb = [banho, cozinha]
    const itens = calcular(obra, amb, P({ conexoes: [con({ nome: 'Joelho 90° 25 mm', porPonto: { vaso: 2, lavatorio: 2 } })] }))
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await gerarXlsx(obra, amb, itens, true))
    const textos: string[] = []; wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => textos.push(String(c.value)))))
    expect(textos).toEqual(expect.arrayContaining(['Conexão (água fria): Joelho 90° 25 mm', 'vaso sanitário 1 × 2 + lavatório 1 × 2']))
  })
})
