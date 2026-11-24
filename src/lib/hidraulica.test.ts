import { describe, expect, it, vi } from 'vitest'
import type { Ambiente, Obra } from '../types'
import { calcular, PARAMS_PADRAO, type Item, type Params } from './engine'
import { descreverPontos, totaisHidro } from './hidraulica'
import { limpar } from './cadastro'
import { sanear } from './config'
import { aplicarIA, linhasResumo, mesclar, montarLevantamento, proximaPergunta, responder, sessaoVazia, validarExtracao } from './descricao'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })
const banho: Ambiente = { id: 'b', nome: 'Banheiro', comprimento: 2, largura: 3, unidade: 'm', pontos: { vaso: 1, lavatorio: 1, chuveiro: 1, ralo: 1 } }
const cozinha: Ambiente = { id: 'c', nome: 'Cozinha', comprimento: 3, largura: 4, unidade: 'm', pontos: { pia: 1, torneira: 1 } }
const acha = (itens: Item[], etapa: string, material: string) => itens.find((i) => i.etapa === etapa && i.material.startsWith(material))
const HI = 'Instalações hidráulicas e sanitárias'

describe('pontos hidráulicos por ambiente', () => {
  it('cada peça conta como ponto de água, de esgoto ou dos dois; os gerais somam aos dos ambientes', () => {
    const t = totaisHidro([banho, cozinha], { hidPontosAgua: 2, sanPontos: 1 })
    expect(t.aguaAmbientes).toBe(5) // vaso, lavatório, chuveiro, pia, torneira
    expect(t.esgotoAmbientes).toBe(4) // vaso, lavatório, ralo, pia
    expect(t.agua).toBe(7); expect(t.esgoto).toBe(5)
    expect(t.porAmbiente).toEqual([{ id: 'b', nome: 'Banheiro', agua: 3, esgoto: 3 }, { id: 'c', nome: 'Cozinha', agua: 2, esgoto: 1 }])
    expect(t.porTipo).toMatchObject({ vaso: 1, ralo: 1, pia: 1, torneira: 1, tanque: 0 })
  })
  it('ignora valores inválidos (negativo, zero, NaN, texto) e arredonda para baixo, sem inventar pontos', () => {
    const a = { id: 'x', nome: 'X', comprimento: 1, largura: 1, unidade: 'm' as const, pontos: { vaso: -2, pia: 0, ralo: NaN, tanque: 2.9, chuveiro: '3' as unknown as number } }
    const t = totaisHidro([a], { hidPontosAgua: 0, sanPontos: 0 })
    expect(t.agua).toBe(2); expect(t.esgoto).toBe(2); expect(t.porTipo.vaso).toBe(0)
  })
  it('descreve os pontos de um ambiente e limpar remove zeros', () => {
    expect(descreverPontos(banho)).toBe('vaso sanitário 1; lavatório 1; chuveiro 1; ralo 1')
    expect(descreverPontos({ ...banho, pontos: undefined })).toBe('')
    expect(limpar({ ...banho, pontos: { vaso: 0, pia: 2 } }).pontos).toEqual({ pia: 2 })
    expect(limpar({ ...banho, pontos: { vaso: 0 } }).pontos).toBeUndefined()
  })
})

describe('motor: hidráulica alimentada pelos ambientes', () => {
  const itens = calcular(obra, [banho, cozinha], P({ hidPontosAgua: 2, sanPontos: 1, vasos: 1 }))
  it('tubos e conexões usam os pontos totais (ambientes + gerais) com os coeficientes dos parâmetros', () => {
    expect(acha(itens, HI, 'Tubo de água fria')!.bruto).toBeCloseTo(((7 * 4) / 6) * 1.1, 10)
    expect(acha(itens, HI, 'Conexões de água fria')!.bruto).toBe(7 * 3)
    expect(acha(itens, HI, 'Tubo de esgoto')!.bruto).toBeCloseTo(((5 * 3) / 6) * 1.1, 10)
    expect(acha(itens, HI, 'Conexões de esgoto')!.bruto).toBe(5 * 3)
    expect(acha(itens, HI, 'Tubo de água fria')!.dimensoes).toBe('7 pontos (ambientes 5 + gerais 2) × 4 m')
  })
  it('peças: as dos ambientes somam às informadas nos parâmetros; tanque e torneira só vêm dos ambientes', () => {
    expect(acha(itens, HI, 'Vaso sanitário')!.bruto).toBe(2) // 1 geral + 1 do banheiro
    for (const m of ['Lavatório', 'Chuveiro', 'Ralo', 'Pia', 'Torneira']) expect(acha(itens, HI, m)!.bruto, m).toBe(1)
    expect(acha(itens, HI, 'Tanque')).toBeUndefined()
  })
  it('sem pontos nos ambientes o resultado é o de antes e o texto não menciona ambientes', () => {
    const so = calcular(obra, [{ ...banho, pontos: undefined }], P({ hidPontosAgua: 3, sanPontos: 2 }))
    expect(acha(so, HI, 'Tubo de água fria')!.dimensoes).toBe('3 pontos × 4 m')
    expect(acha(so, HI, 'Tubo de esgoto')!.bruto).toBeCloseTo(((2 * 3) / 6) * 1.1, 10)
  })
  it('coeficientes zerados não calculam tubo nem conexão (0 = não calcular), mas as peças continuam listadas', () => {
    const z = calcular(obra, [banho], P({ hidMPorPonto: 0, sanMPorPonto: 0, conexPorPonto: 0 }))
    expect(acha(z, HI, 'Tubo de água fria')).toBeUndefined(); expect(acha(z, HI, 'Conexões de esgoto')).toBeUndefined()
    expect(acha(z, HI, 'Vaso sanitário')!.bruto).toBe(1)
  })
})

describe('composições próprias com base nos pontos', () => {
  it('quantidade = pontos × coeficiente do usuário × (1 + perda); nada é assumido', () => {
    const itens = calcular(obra, [banho, cozinha], P({
      hidPontosAgua: 2, sanPontos: 1,
      composicoes: [
        { id: '1', nome: 'Joelho 90° (bitola do projeto)', etapa: HI, unidade: 'un', base: 'pontosAgua', coef: 2, perda: 5 },
        { id: '2', nome: 'Luva de esgoto', etapa: HI, unidade: 'un', base: 'pontosEsgoto', coef: 1.5, perda: 0 },
      ],
    }))
    const j = acha(itens, HI, 'Joelho')!, l = acha(itens, HI, 'Luva')!
    expect(j.bruto).toBeCloseTo(7 * 2 * 1.05, 10); expect(j.dimensoes).toBe('base 7'); expect(j.formula).toContain('pontos de água fria'); expect(j.tipo).toBe('Estimativa por composição')
    expect(l.bruto).toBeCloseTo(5 * 1.5, 10); expect(l.formula).toContain('pontos de esgoto')
  })
  it('sem pontos a composição não gera item; sem composições nada muda', () => {
    const itens = calcular(obra, [{ ...banho, pontos: undefined }], P({ composicoes: [{ id: '1', nome: 'Joelho', etapa: HI, unidade: 'un', base: 'pontosAgua', coef: 2, perda: 0 }] }))
    expect(acha(itens, HI, 'Joelho')).toBeUndefined()
  })
  it('as novas bases entram no backup e na restauração; base inválida volta para área', () => {
    const q = sanear({ composicoes: [{ id: 'a', nome: 'X', etapa: 'E', unidade: 'un', base: 'pontosAgua', coef: 1, perda: 0 }, { id: 'b', nome: 'Y', etapa: 'E', unidade: 'un', base: 'pontosEsgoto', coef: 1, perda: 0 }, { id: 'c', nome: 'Z', etapa: 'E', unidade: 'un', base: 'inventada', coef: 1, perda: 0 }] })
    expect(q.composicoes.map((c) => c.base)).toEqual(['pontosAgua', 'pontosEsgoto', 'area'])
  })
})

describe('assistente de texto livre: pontos hidráulicos', () => {
  const IA = JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 2.8 }, ambientes: [
    { nome: 'Banheiro', comprimento_m: 2, largura_m: 3, pontos_hidraulicos: { vaso: 1, lavatorio: 1, chuveiro: 1, ralo: null } },
    { nome: 'Cozinha', comprimento_m: 3, largura_m: 4, pontos_hidraulicos: { pia: 1, tanque: -2, ralo: 0, torneira: 'x', registro: 99 } },
  ], instalacoes: { hidraulica: true } })
  it('lê só o que foi dito e descarta valores inválidos', () => {
    const e = validarExtracao(IA)
    expect(e.fatos['amb:banheiro:ponto.vaso']).toBe(1); expect(e.fatos['amb:banheiro:ponto.ralo']).toBeUndefined()
    expect(e.fatos['amb:cozinha:ponto.pia']).toBe(1)
    for (const k of ['tanque', 'ralo', 'torneira', 'registro']) expect(e.fatos[`amb:cozinha:ponto.${k}`], k).toBeUndefined()
  })
  it('monta os pontos nos ambientes, resume e calcula a hidráulica de ponta a ponta', () => {
    const s = aplicarIA(sessaoVazia(), validarExtracao(IA), null).sessao
    const l = montarLevantamento(s)
    expect(l.ambientes.map((a) => a.pontos)).toEqual([{ vaso: 1, lavatorio: 1, chuveiro: 1 }, { pia: 1 }])
    expect(linhasResumo(s).join('\n')).toContain('Pontos hidráulicos: Banheiro: vaso sanitário 1, lavatório 1, chuveiro 1; Cozinha: pia 1')
    expect(l.usouPadrao.join(' ')).toContain('tubos e conexões são só estimativa por composição')
    expect(l.usouPadrao.join(' ')).not.toContain('sem pontos por ambiente')
    const itens = calcular({ ...obra, ...l.obra }, l.ambientes, P(l.params))
    expect(acha(itens, HI, 'Tubo de água fria')!.dimensoes).toBe('4 pontos (ambientes 4 + gerais 0) × 4 m')
  })
  it('hidráulica sem pontos: pergunta uma vez (e só depois de confirmar a hidráulica); "nenhum" encerra', () => {
    let s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 2.8 }, ambientes: [{ nome: 'Banheiro', comprimento_m: 2, largura_m: 3 }], instalacoes: { hidraulica: true } })))
    const ids: string[] = []
    for (let i = 0; i < 30; i++) { const p = proximaPergunta(s); if (!p) break; ids.push(p.id); if (p.id === 'pontos') { s = responder(s, p, 'não').sessao; continue } s = responder(s, p, p.tipo === 'texto' ? 'não' : p.tipo === 'sim_nao' ? 'não' : 'não sei').sessao }
    expect(ids.filter((x) => x === 'pontos')).toHaveLength(1)
    expect(montarLevantamento(s).usouPadrao.join(' ')).toContain('Hidráulica: marcada, mas sem pontos por ambiente')
  })
  it('sem hidráulica (ou "não") não pergunta pontos', () => {
    const s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 2.8 }, ambientes: [{ nome: 'Sala', comprimento_m: 4, largura_m: 4 }], instalacoes: { hidraulica: false } })))
    for (let i = 0; i < 30; i++) { const p = proximaPergunta(s); if (!p) break; expect(p.id).not.toBe('pontos'); s.respondidas.push(p.id) }
  })
  it('contradição: pontos diferentes para a mesma peça viram pergunta de conflito', () => {
    const s0 = aplicarIA(sessaoVazia(), validarExtracao(IA), null).sessao
    const s = mesclar(s0, validarExtracao(JSON.stringify({ ambientes: [{ nome: 'Banheiro', pontos_hidraulicos: { vaso: 2 } }] })))
    const p = proximaPergunta(s)!
    expect(p.tipo).toBe('contradicao'); expect(p.texto).toContain('vaso sanitário')
  })
  it('o prompt enviado à IA manda contar só peças citadas e nunca assumir peças', async () => {
    const { POST } = await import('../../api/assistente-obra')
    process.env.ANTHROPIC_API_KEY = 'k'
    const f = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), { status: 200 })); vi.stubGlobal('fetch', f)
    await POST(new Request('http://app/x', { method: 'POST', headers: { host: 'app', 'x-forwarded-for': '10.9.9.9' }, body: JSON.stringify({ mensagem: 'banheiro com vaso' }) }))
    const prompt = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).messages[0].content as string
    expect(prompt).toContain('pontos_hidraulicos'); expect(prompt).toContain('Nunca assuma que um banheiro ou uma cozinha tem determinada peça')
    delete process.env.ANTHROPIC_API_KEY; vi.unstubAllGlobals()
  })
})

describe('exportação com pontos hidráulicos', () => {
  it('Excel inclui a coluna e o texto dos pontos de cada ambiente', async () => {
    const { gerarXlsx } = await import('./exportExcel')
    const ExcelJS = (await import('exceljs')).default
    const itens = calcular(obra, [banho, cozinha], P())
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await gerarXlsx(obra, [banho, cozinha], itens, true))
    const textos: string[] = []; wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => textos.push(String(c.value)))))
    expect(textos).toEqual(expect.arrayContaining(['Pontos hidráulicos', 'vaso sanitário 1; lavatório 1; chuveiro 1; ralo 1', 'pia 1; torneira externa ou de jardim 1']))
  })
  it('PDF gera com pontos nos ambientes', async () => {
    const { gerarPdf } = await import('./exportPdf')
    const buf = gerarPdf(obra, [banho, cozinha], calcular(obra, [banho, cozinha], P()))
    expect(new TextDecoder().decode(new Uint8Array(buf).slice(0, 5))).toBe('%PDF-')
  })
})
