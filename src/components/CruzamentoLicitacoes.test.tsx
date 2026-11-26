// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CruzamentoLicitacoes from './CruzamentoLicitacoes'
import { limpar, salvar } from '../licitacoes/db'
import { carregarEquivalencias } from '../licitacoes/equivalencias'
import type { Material, Processo } from '../licitacoes/tipos'
import type { Movimento, TipoMov } from '../licitacoes/movimentos'

const proc: Processo = { id: 'p1', tipo: 'ata', numeroProcesso: '1', modalidade: 'Pregão', numeroInstrumento: '10/2026', ano: 2026, fornecedor: 'Forn', cnpj: '', dataAssinatura: '', vigenciaInicio: '2000-01-01', vigenciaFim: '2099-12-31', observacoes: '' }
const mat: Material = { id: 'm1', processoId: 'p1', lote: '', item: '1', codigo: '', nomePadronizado: 'Cimento CP II 50 kg', descricaoOriginal: 'Cimento Portland saco 50kg', especificacao: '', categoria: '', marca: '', unidadeFornecimento: 'saco', unidadeConsumo: 'saco', fator: null, precoUnitario: null, quantidadeRegistrada: 500, quantidadeSolicitada: 0, quantidadeEntregue: 0, quantidadeUtilizada: 0, quantidadeComprometida: 0, observacoes: '', fornecedor: '', aditivo: 0, quantidadeLicitada: null, disponivelPlanilha: null, valorPlanilha: null }
let n = 0
const mov = (tipo: TipoMov, quantidade: number, obra = ''): Movimento => ({ id: `mv${++n}`, materialId: 'm1', tipo, quantidade, unidade: 'saco', data: '2026-03-01', obra, documento: '', observacoes: '', justificativa: '', converteReserva: false, status: 'ativa', corrigeId: '', substituidoPor: '', criadoEm: '2026-03-01' })
const lista = [{ material: 'Cimento', unidade: 'saco', final: 400 }, { material: 'Tinta acrílica', unidade: 'lata', final: 6 }]

beforeEach(async () => { for (const s of ['processos', 'materiais', 'movimentos', 'meta'] as const) await limpar(s) })
afterEach(cleanup)
async function popular() {
  await salvar('processos', proc); await salvar('materiais', mat)
  for (const m of [mov('solicitacao', 300), mov('recebimento', 200), mov('consumo', 50, 'Casa B'), mov('reserva', 30, 'Casa A'), mov('reserva', 40, 'Casa B')]) await salvar('movimentos', m)
}

describe('saldo das licitações na lista de compras (tela)', () => {
  it('sem materiais cadastrados orienta a importar no módulo Licitações', async () => {
    render(<CruzamentoLicitacoes lista={lista} obraNome="Casa A" />)
    expect(await screen.findByText(/Nenhum material de licitação cadastrado/)).toBeTruthy()
  })
  it('liga com sugestão e fator informado, mostra de onde vem cada quantidade e persiste a ligação', async () => {
    await popular()
    render(<CruzamentoLicitacoes lista={lista} obraNome="Casa A" />)
    const sel = await screen.findByLabelText('Material licitado para Cimento')
    expect(screen.getByText('0 de 2 itens ligados')).toBeTruthy()
    expect(document.querySelector('optgroup[label="Sugestões (por palavras em comum)"]')?.textContent).toContain('Cimento CP II 50 kg') // sugerido, mas não escolhido
    expect(screen.getAllByText('Ligar').map((b) => (b.closest('button') as HTMLButtonElement).disabled)).toEqual([true, true]) // nada é ligado sozinho
    fireEvent.change(sel, { target: { value: 'm1' } })
    expect((screen.getByLabelText('Fator de conversão de Cimento') as HTMLInputElement).value).toBe('1') // mesma unidade: sugere 1, o usuário confirma
    fireEvent.click(screen.getAllByText('Ligar')[0])
    expect(await screen.findByText(/Estoque \(reservado 30 \+ livre 80\)/)).toBeTruthy()
    expect(screen.getByText('110')).toBeTruthy(); expect(screen.getByText('190')).toBeTruthy() // estoque e ata
    expect(screen.getByText(/Comprar fora:/).textContent).toContain('0')
    expect(screen.getByText('1 de 2 itens ligados')).toBeTruthy()
    expect(await carregarEquivalencias()).toEqual([expect.objectContaining({ item: 'Cimento|saco', materialId: 'm1', fator: 1 })])
    cleanup(); render(<CruzamentoLicitacoes lista={lista} obraNome="Casa A" />) // volta a abrir: a ligação continua
    expect(await screen.findByText(/Estoque \(reservado 30 \+ livre 80\)/)).toBeTruthy()
  })
  it('a reserva considerada é a da obra informada', async () => {
    await popular()
    render(<CruzamentoLicitacoes lista={lista} obraNome="Casa A" />)
    fireEvent.change(await screen.findByLabelText('Material licitado para Cimento'), { target: { value: 'm1' } }); fireEvent.click(screen.getAllByText('Ligar')[0])
    await screen.findByText(/reservado 30/)
    fireEvent.change(screen.getByLabelText('Nome da obra nas reservas'), { target: { value: 'Casa B' } })
    expect(await screen.findByText(/reservado 40 \+ livre 80/)).toBeTruthy()
  })
  it('unidade diferente exige o fator do usuário (não vem sugerido) e só liga com fator maior que zero', async () => {
    await popular()
    render(<CruzamentoLicitacoes lista={[{ material: 'Cimento', unidade: 'kg', final: 5000 }]} obraNome="Casa A" />)
    fireEvent.change(await screen.findByLabelText('Material licitado para Cimento'), { target: { value: 'm1' } })
    const fator = screen.getByLabelText('Fator de conversão de Cimento') as HTMLInputElement
    expect(fator.value).toBe(''); expect((screen.getByText('Ligar').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(fator, { target: { value: '0' } }); expect((screen.getByText('Ligar').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(fator, { target: { value: '50' } }) // 1 saco = 50 kg
    fireEvent.click(screen.getByText('Ligar'))
    expect(await screen.findByText(/reservado 1\.500 \+ livre 4\.000/)).toBeTruthy() // 30 × 50 e 80 × 50
  })
  it('desligar remove a ligação; "só ligados" filtra a lista', async () => {
    await popular()
    render(<CruzamentoLicitacoes lista={lista} obraNome="Casa A" />)
    fireEvent.change(await screen.findByLabelText('Material licitado para Cimento'), { target: { value: 'm1' } }); fireEvent.click(screen.getAllByText('Ligar')[0])
    await screen.findByText(/reservado 30/)
    fireEvent.click(screen.getByLabelText(/Mostrar só os itens ligados/)); expect(screen.queryByText(/Tinta acrílica/)).toBeNull()
    fireEvent.click(screen.getByText('Desligar'))
    await waitFor(() => expect(screen.getByText('0 de 2 itens ligados')).toBeTruthy())
    expect(await carregarEquivalencias()).toEqual([])
  })
  it('ligação a material que foi excluído aparece como inválida, sem calcular', async () => {
    await popular(); await salvar('meta', { id: 'equivalencias', itens: [{ id: 'e', item: 'Cimento|saco', materialId: 'sumiu', fator: 1 }] } as { id: string })
    render(<CruzamentoLicitacoes lista={lista} obraNome="Casa A" />)
    expect((await screen.findByRole('alert')).textContent).toContain('não existe mais')
  })
})
