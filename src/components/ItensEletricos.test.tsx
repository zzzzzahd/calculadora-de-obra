// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import ItensEletricos from './ItensEletricos'
import Levantamento from './Levantamento'
import Quantitativos from './Quantitativos'
import type { Ambiente } from '../types'
import type { ItemEletrico } from '../lib/engine'

afterEach(cleanup)
const sala: Ambiente = { id: 's', nome: 'Sala', comprimento: 4, largura: 5, unidade: 'm', pontosEl: { tug: 4, interruptor: 2, pontoLuz: 3 } }
const params = { eltTomadas: 0, eltInterruptores: 0, eltPontosLuz: 0 }
let ultimo: ItemEletrico[] = []
function Tela({ inicial = [] as ItemEletrico[] }) {
  const [c, setC] = useState(inicial); ultimo = c
  return <ItensEletricos itens={c} onChange={setC} ambientes={[sala]} params={params} />
}

describe('detalhamento de itens elétricos na tela', () => {
  it('começa vazio e explica que nada é assumido', () => {
    render(<Tela />)
    expect(screen.getByText(/Nenhum item detalhado/)).toBeTruthy()
    expect(screen.getByText(/não assume bitolas, circuitos nem quantidades da NBR 5410/)).toBeTruthy()
  })
  it('adiciona item comum zerado, preenche os coeficientes e mostra a quantidade com perda e a conta', () => {
    render(<Tela />)
    fireEvent.change(screen.getByLabelText('Adicionar item elétrico comum'), { target: { value: 'Cabo (bitola conforme projeto)' } })
    expect(ultimo[0]).toMatchObject({ nome: 'Cabo (bitola conforme projeto)', unidade: 'un', porPonto: {}, fixa: 0, perda: 0 })
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'm' } })
    fireEvent.change(screen.getByLabelText(/^Tomada de uso geral/), { target: { value: '8' } }) // 4 × 8 = 32
    fireEvent.change(screen.getByLabelText(/^Interruptor/), { target: { value: '5' } }) // 2 × 5 = 10
    fireEvent.change(screen.getByLabelText('Perda (%)'), { target: { value: '10' } })
    expect(screen.getByText(/46,2 m/)).toBeTruthy() // (32 + 10) × 1,10
    expect(screen.getByText(/Conta atual: tomada de uso geral 4 × 8 \+ interruptor 2 × 5/)).toBeTruthy()
  })
  it('escolher qual linha geral o item substitui, e excluir', () => {
    render(<Tela inicial={[{ id: 'a', nome: 'Eletroduto', unidade: 'barra', porPonto: { tug: 1 }, fixa: 0, perda: 0 }]} />)
    fireEvent.change(screen.getByLabelText('Substitui a linha geral'), { target: { value: 'eletroduto' } })
    expect(ultimo[0].substitui).toBe('eletroduto'); expect(screen.getByText(/substitui: Eletroduto \(barras\)/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Substitui a linha geral'), { target: { value: '' } }); expect(ultimo[0].substitui).toBeUndefined()
    fireEvent.click(screen.getByLabelText('Excluir item')); expect(ultimo).toEqual([])
  })
})

describe('pontos elétricos no levantamento e em Quantitativos', () => {
  const html = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '')
  const obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm' as const, pavimentos: 1, terreno: 'plano' as const, desnivel: false, movimentoTerra: 'nenhum' as const }
  it('Levantamento mostra os campos, o aviso da norma e o resumo', () => {
    const h = html(<Levantamento obra={obra} ambientes={[sala]} setObra={() => {}} setAmbientes={() => {}} />)
    for (const t of ['Pontos elétricos deste ambiente', 'Tomada de uso geral', 'Tomada de uso específico', 'Ponto de luz', 'o programa não os assume', 'Tomadas / interruptores / pontos de luz (ambientes)']) expect(h).toContain(t)
    expect(h).toContain('>4 / 2 / 3<')
  })
  it('a seção de itens aparece com elétrica ligada (inclusive pelos pontos do cadastro) e some em "Não", com aviso', () => {
    expect(html(<Quantitativos obra={obra} ambientes={[sala]} />)).toContain('Itens elétricos (detalhamento por tipo de ponto)')
    expect(html(<Quantitativos obra={obra} ambientes={[{ ...sala, pontosEl: undefined }]} />)).not.toContain('Itens elétricos (detalhamento')
    const nao = html(<Quantitativos obra={obra} ambientes={[sala]} ajustes={{ flags: { eletrica: false } }} />)
    expect(nao).not.toContain('Itens elétricos (detalhamento'); expect(nao).toContain('há pontos elétricos cadastrados nos ambientes')
  })
})
