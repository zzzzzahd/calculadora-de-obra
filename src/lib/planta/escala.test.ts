import { describe, expect, it } from 'vitest'
import { conferir, criarEscala, dimensoesCaixaM, distanciaM, distanciaPx, normalizar } from './escala'
import { detectarCotas, dicasDeCotas } from './cotas'
import { caixaValida, validarLeitura } from '../leitor'

const pg = { largura: 1000, altura: 500 } // imagem 2:1 — x e y têm escalas diferentes em pixels

describe('calibração de escala', () => {
  // dois pontos a 500 px na horizontal (x 0,1 → 0,6) que valem 5 m: 0,01 m por pixel
  const e = criarEscala({ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }, 5, pg)
  it('calcula metros por pixel pela distância real informada', () => { expect(e.metrosPorPx).toBeCloseTo(0.01, 10) })
  it('mede distâncias em metros respeitando o formato da imagem (x e y em pixels diferentes)', () => {
    expect(distanciaM(e, { x: 0, y: 0 }, { x: 0.3, y: 0 })).toBeCloseTo(3, 10) // 300 px
    expect(distanciaM(e, { x: 0, y: 0 }, { x: 0, y: 0.4 })).toBeCloseTo(2, 10) // 200 px (altura 500)
    expect(distanciaM(e, { x: 0, y: 0 }, { x: 0.3, y: 0.4 })).toBeCloseTo(Math.hypot(3, 2), 10)
    expect(distanciaPx({ x: 0, y: 0 }, { x: 1, y: 1 }, pg)).toBeCloseTo(Math.hypot(1000, 500), 10)
  })
  it('dimensões de uma caixa em metros: maior lado é o comprimento', () => {
    expect(dimensoesCaixaM(e, { x: 0.1, y: 0.1, w: 0.5, h: 0.2 })).toEqual({ comprimento: expect.closeTo(5, 10), largura: expect.closeTo(1, 10) })
    expect(dimensoesCaixaM(e, { x: 0, y: 0, w: 0.2, h: 0.8 })).toEqual({ comprimento: expect.closeTo(4, 10), largura: expect.closeTo(2, 10) }) // caixa "em pé"
  })
  it('recusa calibração inválida: pontos fora, muito próximos, distância zero ou negativa, imagem sem tamanho', () => {
    expect(() => criarEscala({ x: -0.1, y: 0 }, { x: 0.5, y: 0 }, 5, pg)).toThrow('dentro da planta')
    expect(() => criarEscala({ x: 0.1, y: 0.1 }, { x: 0.101, y: 0.1 }, 5, pg)).toThrow('muito próximos')
    for (const m of [0, -3, NaN, Infinity, 5000]) expect(() => criarEscala({ x: 0.1, y: 0.1 }, { x: 0.6, y: 0.1 }, m, pg)).toThrow('distância real')
    expect(() => criarEscala({ x: 0.1, y: 0.1 }, { x: 0.6, y: 0.1 }, 5, { largura: 0, altura: 10 })).toThrow('Tamanho')
  })
  it('conferência: medida lida x medida da caixa, com tolerância; divergência é alerta, não correção', () => {
    const caixa = { x: 0.1, y: 0.1, w: 0.5, h: 0.2 } // 5 m × 1 m pela escala
    expect(conferir(e, { comprimento: 5.1, largura: 1.05 }, caixa).status).toBe('ok')
    expect(conferir(e, { comprimento: 1, largura: 5 }, caixa).status).toBe('ok') // orientação trocada
    const dv = conferir(e, { comprimento: 7, largura: 1 }, caixa)
    expect(dv.status).toBe('divergente'); expect(dv.difComprimento).toBeCloseTo((5 - 7) / 7, 10)
    expect(conferir(e, { comprimento: 0, largura: 3 }, caixa).status).toBe('sem_medida')
    expect(conferir(e, { comprimento: 6, largura: 1 }, caixa, 0.25).status).toBe('ok') // tolerância configurável
  })
  it('normaliza cliques em pixels para 0 a 1 e limita ao tamanho exibido', () => {
    expect(normalizar({ x: 250, y: 100 }, { largura: 500, altura: 400 })).toEqual({ x: 0.5, y: 0.25 })
    expect(normalizar({ x: -10, y: 900 }, { largura: 500, altura: 400 })).toEqual({ x: 0, y: 1 })
  })
})

describe('cotas detectadas no texto do PDF', () => {
  const t = (texto: string) => ({ texto, caixa: { x: 0.2, y: 0.3, w: 0.05, h: 0.02 } })
  it('converte unidade explícita; decimal vira metros (média); inteiro fica ambíguo e sem valor', () => {
    const c = detectarCotas([t('4,20 m'), t('350 cm'), t('2800 mm'), t('3,50'), t('420')])
    expect(c.map((x) => [x.texto, x.valorM, x.confianca])).toEqual([['4,20 m', 4.2, 'alta'], ['350 cm', 3.5, 'alta'], ['2800 mm', 2.8, 'alta'], ['3,50', 3.5, 'media'], ['420', null, 'ambigua']])
  })
  it('ignora escala, datas, títulos, nomes de ambiente, números fora da faixa e frases longas', () => {
    expect(detectarCotas([t('1:50'), t('10/05/2026'), t('Planta baixa'), t('SALA'), t('Sala 2'), t('0,05'), t('99,5'), t('12'), t('Este é um texto de observação 3,50')])).toEqual([])
  })
  it('gera dicas curtas para a IA com a posição central e sem ultrapassar o limite', () => {
    const cotas = detectarCotas(Array.from({ length: 100 }, () => t('3,50')))
    const d = dicasDeCotas(cotas, 60)
    expect(d).toHaveLength(60); expect(d[0]).toBe('"3,50" em x=0.23, y=0.31 (3.5 m)')
    expect(dicasDeCotas(detectarCotas([t('420')]))[0]).toContain('unidade incerta')
  })
})

describe('leitura v2: caixas e cotas validadas', () => {
  it('aceita caixas normalizadas, limita excessos e descarta caixa inválida sem inventar', () => {
    expect(caixaValida({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })
    expect(caixaValida({ x: 0.8, y: 0.8, w: 0.5, h: 0.5 })).toEqual({ x: 0.8, y: 0.8, w: expect.closeTo(0.2, 10), h: expect.closeTo(0.2, 10) })
    expect(caixaValida({ x: -1, y: 5, w: 0.2, h: 0.2 })).toBeUndefined() // vira x=0, y=1: sem espaço para a altura
    expect(caixaValida({ x: -1, y: 0.5, w: 0.2, h: 0.2 })).toEqual({ x: 0, y: 0.5, w: 0.2, h: 0.2 }) // coordenada negativa limitada a 0
    for (const ruim of [null, 'x', {}, { x: 'a', y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 0, h: 0.5 }, { x: 0, y: 0, w: 0.5, h: 0.001 }, { x: NaN, y: 0, w: 1, h: 1 }]) expect(caixaValida(ruim)).toBeUndefined()
  })
  it('validarLeitura devolve caixa por ambiente e as cotas lidas', () => {
    const l = validarLeitura(JSON.stringify({
      ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4, origem: 'cota', confianca: 0.9, caixa: { x: 0.1, y: 0.1, w: 0.4, h: 0.3 } }, { nome: 'Quarto', comprimento_m: 3, largura_m: 3, caixa: { x: 'a' } }],
      cotas: [{ texto: '5,00', valor_m: 5, caixa: { x: 0.2, y: 0.05, w: 0.05, h: 0.02 } }, { texto: '  ', valor_m: 1 }, { texto: '3,00', valor_m: null }],
    }))
    expect(l.ambientes[0].caixa).toEqual({ x: 0.1, y: 0.1, w: 0.4, h: 0.3 })
    expect('caixa' in l.ambientes[1]).toBe(false)
    expect(l.cotas).toEqual([{ texto: '5,00', valorM: 5, caixa: { x: 0.2, y: 0.05, w: 0.05, h: 0.02 } }, { texto: '3,00', valorM: null }])
  })
  it('resposta antiga (sem caixa nem cotas) continua válida', () => {
    const l = validarLeitura(JSON.stringify({ ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4 }] }))
    expect(l.cotas).toEqual([]); expect(l.ambientes[0].caixa).toBeUndefined()
  })
})
