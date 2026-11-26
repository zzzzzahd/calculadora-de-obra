import { describe, expect, it, vi } from 'vitest'
import type { Ambiente, Obra } from '../types'
import { calcular, consolidar, PARAMS_PADRAO, type Item, type ItemEletrico, type Params } from './engine'
import { descreverPontosEl, ITENS_EL_COMUNS, quantidadeItemEl, totaisEl } from './eletrica'
import { avisosDeFlags, aplicarFlags, flagsIniciais } from './assistente'
import { exportarConfig, importarConfig, sanear } from './config'
import { limpar } from './cadastro'
import { aplicarIA, linhasResumo, mesclar, montarLevantamento, proximaPergunta, responder, sessaoVazia, validarExtracao } from './descricao'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const sala: Ambiente = { id: 's', nome: 'Sala', comprimento: 4, largura: 5, unidade: 'm', pontosEl: { tug: 4, tue: 1, interruptor: 2, pontoLuz: 3 } }
const quarto: Ambiente = { id: 'q', nome: 'Quarto', comprimento: 3, largura: 4, unidade: 'm', pontosEl: { tug: 2, pontoLuz: 1 } }
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })
const it0 = (x: Partial<ItemEletrico> & { nome: string }): ItemEletrico => ({ id: x.nome, unidade: 'un', porPonto: {}, fixa: 0, perda: 0, ...x })
const EL = 'Instalações elétricas'
const acha = (itens: Item[], parte: string) => itens.find((i) => i.etapa === EL && i.material.includes(parte))

describe('pontos elétricos por ambiente', () => {
  it('soma os pontos dos ambientes aos contadores gerais (gerais entram como uso geral, interruptor e ponto de luz)', () => {
    const t = totaisEl([sala, quarto], { eltTomadas: 3, eltInterruptores: 0, eltPontosLuz: 1 })
    expect(t.tomadasAmb).toBe(7); expect(t.tomadas).toBe(10); expect(t.interruptores).toBe(2); expect(t.pontosLuz).toBe(5)
    expect(t.porTipo).toEqual({ tug: 9, tue: 1, interruptor: 2, pontoLuz: 5 })
    expect(t.porAmbiente).toEqual([{ id: 's', nome: 'Sala', total: 10 }, { id: 'q', nome: 'Quarto', total: 3 }])
  })
  it('ignora valores inválidos e descreve os pontos; limpar tira zeros', () => {
    const x = { id: 'x', nome: 'X', comprimento: 1, largura: 1, unidade: 'm' as const, pontosEl: { tug: -1, tue: NaN, interruptor: 2.9, pontoLuz: '3' as unknown as number } }
    expect(totaisEl([x], { eltTomadas: 0, eltInterruptores: 0, eltPontosLuz: 0 }).interruptores).toBe(2)
    expect(descreverPontosEl(sala)).toBe('tomada de uso geral 4; tomada de uso específico 1; interruptor 2; ponto de luz 3')
    expect(limpar({ ...sala, pontosEl: { tug: 0, tue: 2 } }).pontosEl).toEqual({ tue: 2 })
    expect(limpar({ ...sala, pontosEl: { tug: 0 } }).pontosEl).toBeUndefined()
  })
})

describe('motor: elétrica alimentada pelos ambientes', () => {
  it('os pontos dos ambientes dão exatamente o mesmo cálculo geral que os mesmos números nos Parâmetros', () => {
    const porAmbiente = calcular(obra, [sala, quarto], P({ eltTomadas: 3, eltPontosLuz: 1, eltDisjuntores: 4 }))
    const porParametro = calcular(obra, [{ ...sala, pontosEl: undefined }, { ...quarto, pontosEl: undefined }], P({ eltTomadas: 10, eltInterruptores: 2, eltPontosLuz: 5, eltDisjuntores: 4 }))
    const so = (l: Item[]) => l.filter((i) => i.etapa === EL).map((i) => [i.material, i.bruto, i.final])
    expect(so(porAmbiente)).toEqual(so(porParametro)); expect(so(porAmbiente).length).toBeGreaterThan(5)
    expect(acha(porAmbiente, 'Tomada')!.bruto).toBe(10); expect(acha(porAmbiente, 'Caixa 4×2')!.bruto).toBe(12); expect(acha(porAmbiente, 'Caixa octogonal')!.bruto).toBe(5)
  })
})

describe('itens elétricos detalhados', () => {
  const th = totaisEl([sala, quarto], { eltTomadas: 3, eltInterruptores: 0, eltPontosLuz: 1 })
  const cabo = it0({ nome: 'Cabo 2,5 mm² (bitola do projeto)', unidade: 'm', porPonto: { tug: 8, tue: 12, interruptor: 5, pontoLuz: 5 }, perda: 10, substitui: 'cabo' })
  it('quantidade = Σ pontos × quantidade por ponto + fixa, com a conta por extenso', () => {
    const q = quantidadeItemEl({ ...cabo, fixa: 6 }, th)
    expect(q.qtd).toBe(9 * 8 + 1 * 12 + 2 * 5 + 5 * 5 + 6)
    expect(q.partes).toEqual(['tomada de uso geral 9 × 8', 'tomada de uso específico 1 × 12', 'interruptor 2 × 5', 'ponto de luz 5 × 5', 'fixa 6'])
    expect(quantidadeItemEl(it0({ nome: 'x' }), th).qtd).toBe(0)
    expect(quantidadeItemEl(it0({ nome: 'x', porPonto: { tug: -1 }, fixa: NaN }), th).qtd).toBe(0)
  })
  it('gera o item com unidade própria, perda e memória; "substitui" tira a linha geral (sem contar em dobro)', () => {
    const itens = calcular(obra, [sala, quarto], P({ eltTomadas: 3, eltPontosLuz: 1, itensEl: [cabo] }))
    const i = acha(itens, 'Cabo 2,5 mm²')!
    expect(i.unidade).toBe('m'); expect(i.bruto).toBeCloseTo((72 + 12 + 10 + 25) * 1.1, 10); expect(i.tipo).toBe('Estimativa por composição')
    expect(i.dimensoes).toBe('tomada de uso geral 9 × 8 + tomada de uso específico 1 × 12 + interruptor 2 × 5 + ponto de luz 5 × 5')
    expect(itens.filter((x) => x.etapa === EL && x.material.startsWith('Cabo'))).toHaveLength(1) // o geral saiu
    expect(acha(itens, 'Eletroduto (barras)')).toBeDefined() // só o cabo foi substituído
  })
  it('item sem "substitui" soma com as linhas gerais; item sem quantidade não tira a linha geral', () => {
    const a = calcular(obra, [sala], P({ itensEl: [it0({ nome: 'Espelho 4×2', porPonto: { tug: 1, interruptor: 1 } })] }))
    expect(acha(a, 'Espelho')!.bruto).toBe(4 * 1 + 2 * 1); expect(acha(a, 'Caixa 4×2')).toBeDefined()
    const b = calcular(obra, [sala], P({ itensEl: [it0({ nome: 'Caixa 4×2 própria', substitui: 'caixa42' })] }))
    expect(acha(b, 'Caixa 4×2')!.material).toBe('Caixa 4×2') // sem quantidade: a geral continua
  })
  it('cada linha geral pode ser substituída: eletroduto, cabo, caixa 4×2 e caixa octogonal', () => {
    const subs = (['eletroduto', 'caixa42', 'caixaOctogonal'] as const).map((k) => it0({ nome: `Próprio ${k}`, fixa: 1, substitui: k }))
    const itens = calcular(obra, [sala], P({ itensEl: subs }))
    for (const m of ['Eletroduto (barras)', 'Caixa 4×2', 'Caixa octogonal']) expect(acha(itens, m)?.material === m, m).toBeFalsy()
    expect(consolidar(itens).filter((x) => x.material.startsWith('Próprio'))).toHaveLength(3)
  })
  it('a lista de nomes sugeridos não traz bitola nem quantidade', () => {
    for (const n of ITENS_EL_COMUNS) expect(n).not.toMatch(/\d+\s*mm|\d+\s*A\b|\d+\s*m\b/i)
  })
})

describe('configuração dos itens elétricos', () => {
  it('exporta e importa sem perder nada', () => {
    const p = P({ itensEl: [it0({ id: 'a', nome: 'Cabo', unidade: 'm', porPonto: { tug: 8 }, fixa: 2, perda: 5, substitui: 'cabo' })] })
    expect(importarConfig(exportarConfig(p)).itensEl).toEqual(p.itensEl)
  })
  it('sanitiza: negativos, NaN, tipos desconhecidos, nome vazio, unidade vazia, "substitui" inválido, perda e limite de linhas', () => {
    const q = sanear({ itensEl: [
      { id: 'a', nome: ' Cabo ', unidade: '   ', porPonto: { tug: -3, tue: 2, inventado: 5, interruptor: 'x' }, fixa: NaN, perda: 900, substitui: 'tudo' },
      { nome: '' }, null, { nome: 'u'.repeat(200), unidade: 'barra-muito-longa-demais', substitui: 'eletroduto' },
    ] })
    expect(q.itensEl).toHaveLength(2)
    expect(q.itensEl[0]).toEqual({ id: 'a', nome: 'Cabo', unidade: 'un', porPonto: { tue: 2 }, fixa: 0, perda: 100 })
    expect(q.itensEl[1].nome).toHaveLength(80); expect(q.itensEl[1].unidade).toHaveLength(12); expect(q.itensEl[1].substitui).toBe('eletroduto')
    expect(sanear({ itensEl: Array.from({ length: 300 }, (_, i) => ({ nome: `i${i}` })) }).itensEl).toHaveLength(200)
    expect(sanear({}).itensEl).toEqual([])
  })
})

describe('Sim/Não do assistente x cadastro de pontos elétricos', () => {
  it('pontos no cadastro ligam a pergunta de elétrica; "Não" mantém o cadastro e a tela avisa', () => {
    expect(flagsIniciais(PARAMS_PADRAO, [sala]).eletrica).toBe(true); expect(flagsIniciais(PARAMS_PADRAO, [{ ...sala, pontosEl: undefined }]).eletrica).toBe(false)
    const f = { ...flagsIniciais(PARAMS_PADRAO, [sala]), eletrica: false }
    expect(avisosDeFlags([sala], f)[0]).toContain('pontos elétricos cadastrados')
    expect(calcular(obra, [sala], aplicarFlags(P(), f)).some((i) => i.etapa === EL && i.material === 'Tomada')).toBe(true)
  })
  it('"Não" zera só a quantidade fixa dos itens, não os coeficientes por tipo de ponto', () => {
    const p = P({ itensEl: [it0({ nome: 'x', porPonto: { tug: 2 }, fixa: 5 })] })
    expect(aplicarFlags(p, { ...flagsIniciais(p), eletrica: false }).itensEl[0]).toMatchObject({ porPonto: { tug: 2 }, fixa: 0 })
    expect(aplicarFlags(p, { ...flagsIniciais(p), eletrica: true }).itensEl).toEqual(p.itensEl)
  })
})

describe('assistente de texto livre: pontos elétricos', () => {
  const IA = JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 2.8 }, instalacoes: { eletrica: true }, ambientes: [
    { nome: 'Sala', comprimento_m: 4, largura_m: 5, pontos_eletricos: { tomada_uso_geral: 4, tomada_uso_especifico: null, interruptor: 1, ponto_luz: 2 } },
    { nome: 'Quarto', comprimento_m: 3, largura_m: 4, pontos_eletricos: { tomada_uso_geral: -1, interruptor: 'x', ponto_luz: 0, tomada_uso_especifico: 1 } },
  ] })
  it('lê só o que foi dito e descarta valores inválidos', () => {
    const e = validarExtracao(IA)
    expect(e.fatos['amb:sala:pel.tug']).toBe(4); expect(e.fatos['amb:sala:pel.interruptor']).toBe(1); expect(e.fatos['amb:sala:pel.tue']).toBeUndefined()
    expect(e.fatos['amb:quarto:pel.tue']).toBe(1)
    for (const k of ['tug', 'interruptor', 'pontoLuz']) expect(e.fatos[`amb:quarto:pel.${k}`], k).toBeUndefined()
  })
  it('monta pontos nos ambientes, resume e calcula de ponta a ponta', () => {
    const s = aplicarIA(sessaoVazia(), validarExtracao(IA), null).sessao
    const l = montarLevantamento(s)
    expect(l.ambientes.map((a) => a.pontosEl)).toEqual([{ tug: 4, interruptor: 1, pontoLuz: 2 }, { tue: 1 }])
    expect(linhasResumo(s).join('\n')).toContain('Pontos elétricos: Sala: tomada de uso geral 4, interruptor 1, ponto de luz 2; Quarto: tomada de uso específico 1')
    expect(l.usouPadrao.join(' ')).not.toContain('tomadas não informada'); expect(l.usouPadrao.join(' ')).toContain('quantidade de disjuntores não informada')
    const itens = calcular({ ...obra, ...l.obra }, l.ambientes, P(l.params))
    expect(acha(itens, 'Tomada')!.bruto).toBe(5); expect(acha(itens, 'Ponto de iluminação')!.bruto).toBe(2)
  })
  it('com pontos por ambiente não pergunta de novo tomadas, interruptores e pontos de luz, mas ainda pergunta os disjuntores', () => {
    let s = aplicarIA(sessaoVazia(), validarExtracao(IA), null).sessao
    const ids: string[] = []
    for (let i = 0; i < 40; i++) { const p = proximaPergunta(s); if (!p) break; ids.push(p.id); s = responder(s, p, p.tipo === 'texto' || p.tipo === 'sim_nao' ? 'não' : 'não sei').sessao }
    expect(ids.some((x) => x === 'elt:Tomadas' || x === 'elt:Interruptores' || x === 'elt:PontosLuz')).toBe(false)
    expect(ids).toContain('elt:Disjuntores')
  })
  it('sem pontos por ambiente continua perguntando os totais; "sem elétrica" com pontos vira pergunta de conflito', () => {
    let s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 2.8 }, ambientes: [{ nome: 'Sala', comprimento_m: 4, largura_m: 5 }], instalacoes: { eletrica: true } })))
    const ids: string[] = []
    for (let i = 0; i < 40; i++) { const p = proximaPergunta(s); if (!p) break; ids.push(p.id); s = responder(s, p, p.tipo === 'texto' || p.tipo === 'sim_nao' ? 'não' : 'não sei').sessao }
    expect(ids).toEqual(expect.arrayContaining(['elt:Tomadas', 'elt:Interruptores', 'elt:PontosLuz', 'elt:Disjuntores']))
    const c = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ instalacoes: { eletrica: false }, ambientes: [{ nome: 'Sala', pontos_eletricos: { tomada_uso_geral: 3 } }] })))
    expect(proximaPergunta(c)!.id).toBe('regra:eletrica')
  })
  it('o prompt manda não completar quantidades por norma ou costume', async () => {
    const { POST } = await import('../../api/assistente-obra')
    process.env.ANTHROPIC_API_KEY = 'k'
    const f = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), { status: 200 })); vi.stubGlobal('fetch', f)
    await POST(new Request('http://app/x', { method: 'POST', headers: { host: 'app', 'x-forwarded-for': '10.8.8.8' }, body: JSON.stringify({ mensagem: 'sala com 4 tomadas' }) }))
    const prompt = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).messages[0].content as string
    expect(prompt).toContain('pontos_eletricos'); expect(prompt).toContain('Nunca complete com quantidades que a norma ou o costume exigiriam')
    delete process.env.ANTHROPIC_API_KEY; vi.unstubAllGlobals()
  })
})

describe('exportação com pontos elétricos', () => {
  it('Excel traz a coluna e o texto; o item detalhado aparece na lista e na memória', async () => {
    const { gerarXlsx } = await import('./exportExcel')
    const ExcelJS = (await import('exceljs')).default
    const itens = calcular(obra, [sala, quarto], P({ itensEl: [it0({ nome: 'Cabo 2,5 mm² (bitola do projeto)', unidade: 'm', porPonto: { tug: 8 }, substitui: 'cabo' })] }))
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await gerarXlsx(obra, [sala, quarto], itens, true))
    const textos: string[] = []; wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => textos.push(String(c.value)))))
    expect(textos).toEqual(expect.arrayContaining(['Pontos elétricos', 'tomada de uso geral 4; tomada de uso específico 1; interruptor 2; ponto de luz 3', 'Cabo 2,5 mm² (bitola do projeto)', 'tomada de uso geral 6 × 8']))
  })
})
