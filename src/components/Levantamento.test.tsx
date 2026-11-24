import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import Levantamento from './Levantamento'
import type { Ambiente, Obra } from '../types'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const html = (a: Ambiente[]) => renderToString(<Levantamento obra={obra} ambientes={a} setObra={() => {}} setAmbientes={() => {}} />).replace(/<!-- -->/g, '')

describe('tela de levantamento com cadastro central', () => {
  const amb: Ambiente[] = [
    { id: 's1', nome: 'Sala 1', comprimento: 7, largura: 7, unidade: 'm', divisas: { 1: { com: 's2' } }, aberturas: [{ id: 'p', tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 1, lado: 1 }], origem: { fonte: 'planta', confianca: 0.8 } },
    { id: 's2', nome: 'Sala 2', comprimento: 7, largura: 7, unidade: 'm', divisas: { 3: { com: 's1' } } },
  ]
  it('mostra os campos do cadastro: tipo, pé-direito, lados, aberturas, acabamentos e origem', () => {
    const h = html(amb)
    for (const t of ['Tipo do ambiente', 'Pé-direito', 'Compartilhada com Sala 2', 'Portas e janelas deste ambiente', 'Acabamentos', 'Origem: lido da planta (confiança 80%)']) expect(h).toContain(t)
  })
  it('resumo mostra a parede compartilhada contada uma vez e a parede bruta sem dupla contagem', () => {
    const h = html(amb)
    expect(h).toContain('Parede compartilhada (contada uma vez)')
    expect(h).toContain('147,00')
  })
  it('sem divisas não aparece o bloco de parede compartilhada', () => {
    expect(html([{ id: 'a', nome: 'A', comprimento: 5, largura: 4, unidade: 'm' }])).not.toContain('Parede compartilhada')
  })
  it('avisos do cadastro aparecem no resumo', () => {
    const h = html([{ ...amb[0] }, { id: 's2', nome: 'Sala 2', comprimento: 7, largura: 7, unidade: 'm' }])
    expect(h).toContain('não informa o lado correspondente')
  })
})

describe('ações (construir, manter, demolir…) na tela', () => {
  const base: Ambiente[] = [
    { id: 'a', nome: 'A', comprimento: 7, largura: 7, unidade: 'm', acoes: { paredes: 'demolir', piso: 'manter' }, aberturas: [{ id: 'p', tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 1, acao: 'demolir' }] },
    { id: 'b', nome: 'B', comprimento: 7, largura: 7, unidade: 'm' },
  ]
  it('mostra o que será feito, as opções de ação e o resumo da demolição', () => {
    const h = html(base)
    for (const t of ['O que será feito neste ambiente', 'Demolir (gera entulho)', 'Manter (sem material)', 'Substituir (demolir e construir)', 'Recuperar (sem material novo)', 'Reaproveitar (sem compra)', 'Parede a demolir', 'Ação da abertura']) expect(h).toContain(t)
  })
  it('sem ações não aparece resumo de demolição', () => {
    expect(html([base[1]])).not.toContain('Parede a demolir')
  })
})

describe('pontos hidráulicos na tela', () => {
  const com: Ambiente[] = [{ id: 'b', nome: 'Banheiro', comprimento: 2, largura: 3, unidade: 'm', pontos: { vaso: 1, chuveiro: 1, ralo: 2 } }, { id: 'c', nome: 'Cozinha', comprimento: 3, largura: 4, unidade: 'm' }]
  it('mostra os campos por peça, a explicação e o resumo de pontos de água e esgoto', () => {
    const h = html(com)
    for (const t of ['Pontos hidráulicos deste ambiente', 'Vaso sanitário', 'Caixa sifonada', 'Torneira externa ou de jardim', 'Pontos de água / esgoto (ambientes)']) expect(h).toContain(t)
    expect(h).toContain('>2 / 3<') // água: vaso + chuveiro; esgoto: vaso + 2 ralos
    expect(h).toContain('Tubos e conexões são estimados por composições com os seus coeficientes')
  })
  it('sem pontos nos ambientes não aparece o resumo hidráulico', () => {
    expect(html([com[1]])).not.toContain('Pontos de água / esgoto (ambientes)')
  })
})
