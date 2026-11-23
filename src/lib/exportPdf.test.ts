import { expect, it } from 'vitest'
import { gerarPdf } from './exportPdf'
import { calcular, PARAMS_PADRAO } from './engine'
import type { Obra } from '../types'

const obra: Obra = { nome: 'Teste', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
it('gera um PDF válido', () => {
  const amb = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' as const }]
  const buf = gerarPdf(obra, amb, calcular(obra, amb, PARAMS_PADRAO), { 'Bloco|un': 2 })
  expect(new TextDecoder().decode(new Uint8Array(buf).slice(0, 5))).toBe('%PDF-')
})

it('gera PDF com ambientes de paredes compartilhadas', () => {
  const amb = [
    { id: 'a', nome: 'Sala 1', comprimento: 7, largura: 7, unidade: 'm' as const, divisas: { 1: { com: 'b' } } },
    { id: 'b', nome: 'Sala 2', comprimento: 7, largura: 7, unidade: 'm' as const, divisas: { 3: { com: 'a' } } },
  ]
  const buf = gerarPdf(obra, amb, calcular(obra, amb, PARAMS_PADRAO))
  expect(new TextDecoder().decode(new Uint8Array(buf).slice(0, 5))).toBe('%PDF-')
})
