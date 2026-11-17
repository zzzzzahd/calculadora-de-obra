import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { aplicarMovimentos, cancelar, corrigir, movimentoVazio, reservadoPorObra, validarMovimento, type Movimento, type TipoMov } from './movimentos'
import { saldos } from './regras'
import { listar, limpar, salvarLote } from './db'
import type { Material } from './tipos'

// Cimento do Teste 2: 1.000 registradas, 600 recebidas, 100 utilizadas, 150 comprometidas
const cimento: Material = { id: 'c', processoId: 'p', lote: '', item: '', codigo: '1', nomePadronizado: 'Cimento', descricaoOriginal: 'CIMENTO', especificacao: '', categoria: 'Cimento', marca: '', unidadeFornecimento: 'saco', unidadeConsumo: '', fator: null,
  precoUnitario: 38, quantidadeRegistrada: 1000, quantidadeSolicitada: 700, quantidadeEntregue: 600, quantidadeUtilizada: 100, quantidadeComprometida: 150, observacoes: '', fornecedor: '', aditivo: 0, quantidadeLicitada: null, disponivelPlanilha: null, valorPlanilha: null }
const mv = (tipo: TipoMov, quantidade: number, o: Partial<Movimento> = {}): Movimento => ({ ...movimentoVazio('c', 'saco', tipo), quantidade, obra: 'Escola A', ...o })
const disp = (m: Material, movs: Movimento[]) => saldos(aplicarMovimentos(m, movs)).disponivel

describe('Teste 2 — posição base', () => {
  it('disponível físico 350 e a receber 400 (não é estoque)', () => {
    expect(saldos(cimento)).toMatchObject({ disponivel: 350, aReceber: 400, saldoASolicitar: 300, aguardandoEntrega: 100 })
  })
})

describe('Teste 5 — reservas', () => {
  it('reservar diminui o disponível e cancelar libera', () => {
    const r = mv('reserva', 100)
    expect(disp(cimento, [r])).toBe(250)
    expect(disp(cimento, [r, mv('cancelamento-reserva', 100)])).toBe(350)
    expect(reservadoPorObra([r], 'escola a')).toBe(100)
    expect(reservadoPorObra([r, mv('cancelamento-reserva', 40)], 'Escola A')).toBe(60)
  })
})

describe('Teste 6 — consumo sem duplicar', () => {
  it('converter reserva em consumo mantém o disponível; consumo direto o reduz', () => {
    const r = mv('reserva', 100)
    const c = mv('consumo', 100, { converteReserva: true })
    const e = aplicarMovimentos(cimento, [r, c])
    expect(e).toMatchObject({ quantidadeUtilizada: 200, quantidadeComprometida: 150 })
    expect(disp(cimento, [r, c])).toBe(250) // 350 − 100 do consumo (a reserva foi baixada, não somada de novo)
    expect(reservadoPorObra([r, c], 'Escola A')).toBe(0)
    expect(disp(cimento, [mv('consumo', 50)])).toBe(300)
  })
})

describe('recebimento, devolução, ajuste e solicitação', () => {
  it('efeitos nos saldos', () => {
    const e = aplicarMovimentos(cimento, [mv('recebimento', 100), mv('devolucao', 20), mv('ajuste-inventario', -10), mv('solicitacao', 50)])
    expect(e).toMatchObject({ quantidadeEntregue: 670, quantidadeSolicitada: 750 })
    expect(saldos(e).saldoASolicitar).toBe(250)
  })
  it('registros informativos não alteram saldos', () => {
    expect(aplicarMovimentos(cimento, [mv('cadastro-inicial', 1000), mv('atualizacao', 5)])).toEqual(cimento)
  })
})

describe('alertas e justificativa', () => {
  it('saldo negativo e reservas acima do disponível geram aviso; quantidade inválida é erro', () => {
    expect(validarMovimento(cimento, [], mv('reserva', 351)).avisos[0]).toMatch(/negativo/)
    expect(validarMovimento(cimento, [], mv('reserva', 350)).avisos).toEqual([])
    expect(validarMovimento(cimento, [], mv('consumo', 400)).avisos[0]).toMatch(/negativo/)
    expect(validarMovimento(cimento, [], mv('reserva', 0)).erros).toEqual(['Informe uma quantidade válida.'])
    expect(validarMovimento(cimento, [], mv('reserva', 5, { obra: '' })).erros).toEqual(['Informe a obra.'])
    expect(validarMovimento(cimento, [], mv('ajuste-inventario', -5)).erros).toEqual([])
  })
  it('solicitação acima do saldo da ata e recebimento acima do contratado', () => {
    expect(validarMovimento(cimento, [], mv('solicitacao', 301)).avisos[0]).toMatch(/saldo da ata/)
    expect(validarMovimento(cimento, [], mv('solicitacao', 300)).avisos).toEqual([])
    expect(validarMovimento(cimento, [], mv('recebimento', 401)).avisos.join(' ')).toMatch(/contratada/)
  })
})

describe('correção preserva o registro', () => {
  it('a corrigida deixa de contar, a nova passa a valer e a ligação fica registrada', () => {
    const errada = mv('recebimento', 50)
    const certa = mv('recebimento', 80)
    const [antiga, nova] = corrigir(errada, certa)
    expect(antiga).toMatchObject({ status: 'corrigida', substituidoPor: certa.id, quantidade: 50 })
    expect(nova.corrigeId).toBe(errada.id)
    expect(aplicarMovimentos(cimento, [antiga, nova]).quantidadeEntregue).toBe(680)
    expect(aplicarMovimentos(cimento, [cancelar(errada)]).quantidadeEntregue).toBe(600)
  })
})

describe('armazenamento das movimentações', () => {
  it('grava em lote e recupera', async () => {
    await limpar('movimentos')
    await salvarLote('movimentos', [mv('recebimento', 10), mv('reserva', 5)])
    expect(await listar('movimentos')).toHaveLength(2)
    await limpar('movimentos')
  })
})
