// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import ConexoesHidro from './ConexoesHidro'
import Quantitativos from './Quantitativos'
import type { Ambiente } from '../types'
import type { ConexaoHidro } from '../lib/engine'

afterEach(cleanup)
const banho: Ambiente = { id: 'b', nome: 'Banheiro', comprimento: 2, largura: 3, unidade: 'm', pontos: { vaso: 2, lavatorio: 1, chuveiro: 1, ralo: 1 } }
const params = { hidPontosAgua: 0, sanPontos: 0 }
let ultimo: ConexaoHidro[] = []
function Tela({ inicial = [] as ConexaoHidro[] }) {
  const [c, setC] = useState(inicial)
  ultimo = c
  return <ConexoesHidro conexoes={c} onChange={setC} ambientes={[banho]} params={params} />
}

describe('detalhamento de conexões hidráulicas na tela', () => {
  it('começa vazio, explica que nada é assumido e que o coeficiente único é o que vale sem detalhes', () => {
    render(<Tela />)
    expect(screen.getByText(/Nenhuma conexão detalhada/)).toBeTruthy()
    expect(screen.getByText(/não assume tipos, diâmetros nem quantidades de conexões/)).toBeTruthy()
    expect(screen.getByText(/para não contar em dobro/)).toBeTruthy()
  })
  it('adiciona conexão comum (sem diâmetro, tudo zerado) para água e para esgoto', () => {
    render(<Tela />)
    fireEvent.change(screen.getByLabelText('Adicionar conexão comum'), { target: { value: 'Joelho 90°' } })
    expect(ultimo).toHaveLength(1)
    expect(ultimo[0]).toMatchObject({ nome: 'Joelho 90° (diâmetro conforme projeto)', sistema: 'agua', porPonto: {}, porPontoGeral: 0, fixa: 0, perda: 0 })
    fireEvent.change(screen.getByLabelText('Sistema da nova conexão'), { target: { value: 'esgoto' } })
    fireEvent.change(screen.getByLabelText('Adicionar conexão comum'), { target: { value: 'Junção 45°' } })
    expect(ultimo[1]).toMatchObject({ nome: 'Junção 45° (diâmetro conforme projeto)', sistema: 'esgoto' })
    expect(screen.getAllByText(/sem quantidade \(preencha os coeficientes\)/)).toHaveLength(2)
  })
  it('preencher os coeficientes calcula a quantidade com perda e mostra a conta', () => {
    render(<Tela />)
    fireEvent.click(screen.getByText('Em branco'))
    fireEvent.change(screen.getByLabelText('Nome da conexão'), { target: { value: 'Joelho 90° 25 mm' } })
    fireEvent.change(screen.getByLabelText(/^Vaso sanitário/), { target: { value: '2' } }) // 2 vasos × 2 = 4
    fireEvent.change(screen.getByLabelText(/^Lavatório/), { target: { value: '1' } }) // 1 × 1
    fireEvent.change(screen.getByLabelText('Perda (%)'), { target: { value: '10' } })
    expect(ultimo[0].porPonto).toEqual({ vaso: 2, lavatorio: 1 })
    expect(screen.getByText(/5,5 un/)).toBeTruthy() // (4 + 1) × 1,10
    expect(screen.getByText(/Conta atual: vaso sanitário 2 × 2 \+ lavatório 1 × 1/)).toBeTruthy()
  })
  it('mostra só os tipos de peça do sistema: água sem ralo; esgoto sem chuveiro', () => {
    render(<Tela inicial={[{ id: 'a', nome: 'A', sistema: 'agua', porPonto: {}, porPontoGeral: 0, fixa: 0, perda: 0 }, { id: 'e', nome: 'E', sistema: 'esgoto', porPonto: {}, porPontoGeral: 0, fixa: 0, perda: 0 }]} />)
    expect(document.getElementById('a-chuveiro')).not.toBeNull(); expect(document.getElementById('a-ralo')).toBeNull(); expect(document.getElementById('a-registro')).not.toBeNull()
    expect(document.getElementById('e-ralo')).not.toBeNull(); expect(document.getElementById('e-chuveiro')).toBeNull(); expect(document.getElementById('e-registro')).toBeNull()
  })
  it('trocar o sistema e excluir a conexão', () => {
    render(<Tela inicial={[{ id: 'a', nome: 'A', sistema: 'agua', porPonto: { vaso: 1 }, porPontoGeral: 0, fixa: 0, perda: 0 }]} />)
    fireEvent.change(screen.getByLabelText('Sistema'), { target: { value: 'esgoto' } }); expect(ultimo[0].sistema).toBe('esgoto')
    fireEvent.click(screen.getByLabelText('Excluir conexão')); expect(ultimo).toEqual([])
  })
})

describe('Quantitativos: seção de conexões e aviso de Sim/Não', () => {
  const obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm' as const, pavimentos: 1, terreno: 'plano' as const, desnivel: false, movimentoTerra: 'nenhum' as const }
  const html = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '')
  it('a seção aparece quando há hidráulica (inclusive pelos pontos do cadastro) e some quando a resposta é Não', () => {
    expect(html(<Quantitativos obra={obra} ambientes={[banho]} />)).toContain('Conexões hidráulicas (detalhamento por tipo de ponto)')
    expect(html(<Quantitativos obra={obra} ambientes={[{ ...banho, pontos: undefined }]} />)).not.toContain('Conexões hidráulicas (detalhamento')
    const nao = html(<Quantitativos obra={obra} ambientes={[banho]} ajustes={{ flags: { hidraulica: false } }} />)
    expect(nao).not.toContain('Conexões hidráulicas (detalhamento'); expect(nao).toContain('há pontos hidráulicos cadastrados nos ambientes')
  })
})
