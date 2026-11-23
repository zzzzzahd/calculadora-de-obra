/**
 * Golden masters do v24: a saída completa de calcular() para entradas "legadas" (sem os campos novos do
 * cadastro de ambientes) precisa permanecer idêntica, item a item, texto da memória de cálculo incluído.
 * Para regenerar de propósito: GERAR_GOLDEN=1 npx vitest run src/lib/golden.test.ts (só com aprovação; o arquivo é a referência do v24).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { Ambiente, Obra } from '../types'
import { calcular, consolidar, PARAMS_PADRAO, type Item, type Params } from './engine'
import { cenarioAleatorio } from './cenariosAleatorios'

const arquivo = fileURLToPath(new URL('./__golden__/v24.json', import.meta.url))
const obra = (o: Partial<Obra> = {}): Obra => ({ nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum', ...o })
const amb = (id: string, nome: string, c: number, l: number, unidade: 'm' | 'cm' | 'mm' = 'm'): Ambiente => ({ id, nome, comprimento: c, largura: l, unidade })
const ab = (id: string, tipo: 'Porta' | 'Janela', largura: number, altura: number, qtd: number) => ({ id, tipo, largura, altura, qtd })
const P = (x: Partial<Params> = {}): Params => ({ ...PARAMS_PADRAO, ...x })

const cenarios: Record<string, { obra: Obra; ambientes: Ambiente[]; params: Params }> = {
  salaSimples: { obra: obra(), ambientes: [amb('a', 'Sala', 5, 7)], params: P() },
  duasSalas7x7SemAberturas: { obra: obra({ alturaParede: 3 }), ambientes: [amb('a', 'Sala 1', 7, 7), amb('b', 'Sala 2', 7, 7)], params: P() },
  duasSalas7x7Completo: {
    obra: obra({ alturaParede: 3 }), ambientes: [amb('a', 'Sala 1', 7, 7), amb('b', 'Sala 2', 7, 7)],
    params: P({ aberturas: [ab('p1', 'Porta', 0.8, 2.1, 2), ab('j1', 'Janela', 1.2, 1, 4)], roofC: 14, roofL: 7, tesouras: 3, forro: 1, eltTomadas: 8, eltInterruptores: 3, eltPontosLuz: 4, eltDisjuntores: 4, cerArea: 12 }),
  },
  paramsVariados: {
    obra: obra({ pavimentos: 2, alturaParede: 2.7 }), ambientes: [amb('a', 'Quarto', 350, 400, 'cm'), amb('b', 'Banheiro', 2.2, 1.8), amb('c', 'Cozinha', 3000, 3500, 'mm')],
    params: P({ aberturas: [ab('p', 'Porta', 0.9, 2.1, 3), ab('j', 'Janela', 1.5, 1.1, 2)], faces: 2, revFaces: 1, cor2Pct: 30, massaTipo: 2, forro: 1, cerArea: 8, rodape: 1, vergas: 1, esquadrias: 1,
      calKgM3: 100, chapCalKgM3: 80, aditivoConc: 1, aditivoConcPct: 1, aditivoArg: 3, aditivoArgPct: 2,
      composicoes: [{ id: 'c1', nome: 'Verniz', etapa: 'Acabamento', unidade: 'L', base: 'parede', coef: 0.1, perda: 5 }, { id: 'c2', nome: 'Manta', etapa: 'Acabamento', unidade: 'm²', base: 'area', coef: 1, perda: 10 }, { id: 'c3', nome: 'Kit', etapa: 'Outros', unidade: 'un', base: 'fixa', coef: 2, perda: 0 }] }),
  },
  terrenoEstrutura: {
    obra: obra({ movimentoTerra: 'ambos' }), ambientes: [amb('a', 'Casa', 8, 6)],
    params: P({ aterroH: 0.4, escavH: 0.3, transporte: 1, fundComp: 28, fundLarg: 0.3, fundAlt: 0.5, pilarN: 8, pilarL: 0.14, pilarB: 0.3, vigaComp: 28, vigaL: 0.14, vigaH: 0.3, acoKgM3: 90,
      lajeArea: 48, preLajeArea: 20, muroComp: 12, calcArea: 15, escLarg: 1, escAlt: 2.8, fosCompr: 2, fosLarg: 1, fosProf: 1.5, sumDiam: 1.5, sumProf: 3, pisC: 4, pisL: 2, imperArea: 6, dwComp: 5, dwForroArea: 10, telhaMetalica: 1, metComp: 12, metKgM: 3, madComp: 20 }),
  },
}

const gerar = () => Object.fromEntries(Object.entries(cenarios).map(([k, c]) => {
  const itens = calcular(c.obra, c.ambientes, c.params)
  return [k, { itens, consolidado: consolidar(itens) }]
}))

describe('golden masters do v24 (regressão do motor)', () => {
  if (process.env.GERAR_GOLDEN === '1') {
    it('gera o arquivo golden', () => { writeFileSync(arquivo, JSON.stringify(gerar(), null, 1)); expect(existsSync(arquivo)).toBe(true) })
  } else {
    it('o arquivo golden do v24 existe', () => { expect(existsSync(arquivo)).toBe(true) })
    type Golden = ReturnType<typeof gerar>
    const esperado = (existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {}) as Golden
    const atual = JSON.parse(JSON.stringify(gerar())) as Golden
    for (const k of Object.keys(cenarios)) it(`cenário ${k} idêntico ao v24`, () => { expect(atual[k]).toEqual(esperado[k]) })
  }
})

/** Assinatura exata (sha256) dos itens: etapa, material, unidade, fórmula, dimensões, coeficiente, perda, bruto, final e tipo. */
const assinatura = (itens: Item[]) =>
  createHash('sha256').update(JSON.stringify(itens.map((i) => [i.etapa, i.material, i.unidade, i.formula, i.dimensoes, i.coef, i.perda, i.bruto, i.final, i.tipo]))).digest('hex')
const arquivoAleatorio = fileURLToPath(new URL('./__golden__/v24-aleatorio.json', import.meta.url))

describe('120 cenários pseudoaleatórios idênticos ao v24, bit a bit (todas as etapas)', () => {
  const ref = (existsSync(arquivoAleatorio) ? JSON.parse(readFileSync(arquivoAleatorio, 'utf8')) : {}) as Record<string, { itens: number; sha256: string }>
  it('o arquivo de referência do v24 existe e tem 120 cenários', () => { expect(Object.keys(ref)).toHaveLength(120) })
  it('todos os cenários batem (itens e assinatura)', () => {
    const erros: string[] = []
    for (let seed = 1; seed <= 120; seed++) {
      const c = cenarioAleatorio(seed), itens = calcular(c.obra, c.ambientes, c.params)
      if (itens.length !== ref[seed]?.itens || assinatura(itens) !== ref[seed]?.sha256) erros.push(`cenário ${seed}`)
    }
    expect(erros).toEqual([])
  })
  it('cobrem as etapas do motor (pelo menos 25 etapas diferentes)', () => {
    const etapas = new Set<string>()
    for (let seed = 1; seed <= 120; seed++) { const c = cenarioAleatorio(seed); calcular(c.obra, c.ambientes, c.params).forEach((i) => etapas.add(i.etapa)) }
    expect(etapas.size).toBeGreaterThanOrEqual(25)
  })
})
