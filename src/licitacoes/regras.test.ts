import { describe, expect, it } from 'vitest'
import { filtrar, FILTROS_VAZIOS, indicadores, saldos, situacao } from './regras'
import type { Material, Processo } from './tipos'

const proc = (o: Partial<Processo> = {}): Processo => ({ id: 'p1', tipo: 'ata', numeroProcesso: '10', modalidade: '', numeroInstrumento: '1', ano: 2026, fornecedor: 'Forn A', cnpj: '', dataAssinatura: '', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', observacoes: '', ...o })
const mat = (o: Partial<Material> = {}): Material => ({ id: 'm1', processoId: 'p1', lote: '', item: '', codigo: '', nomePadronizado: 'Cimento CP II-Z-32 50 kg', descricaoOriginal: 'CIMENTO PORTLAND COMPOSTO CP II-Z-32, SACO COM 50 KG.', especificacao: '', categoria: 'Cimento', marca: '', unidadeFornecimento: 'saco', unidadeConsumo: '', fator: null, precoUnitario: 38, quantidadeRegistrada: 1000, quantidadeSolicitada: 0, quantidadeEntregue: 0, quantidadeUtilizada: 0, quantidadeComprometida: 0, observacoes: '', fornecedor: '', aditivo: 0, quantidadeLicitada: null, disponivelPlanilha: null, valorPlanilha: null, ...o })

describe('saldos (Teste 2 do documento)', () => {
  it('1.000 registrados, 600 entregues, 100 usados, 150 comprometidos', () => {
    const s = saldos(mat({ quantidadeEntregue: 600, quantidadeUtilizada: 100, quantidadeComprometida: 150 }))
    expect(s.disponivel).toBe(350)
    expect(s.aReceber).toBe(400) // não entra no estoque físico
  })
  it('quantidade pendente conta como zero e entrega acima do registrado não gera negativo', () => {
    expect(saldos(mat({ quantidadeRegistrada: null })).aReceber).toBe(0)
    expect(saldos(mat({ quantidadeEntregue: 1200 })).aReceber).toBe(0)
  })
})

describe('situação da vigência', () => {
  it('vigente, a vencer, vencida, futura e sem vigência', () => {
    expect(situacao(proc(), '2026-06-01')).toBe('vigente')
    expect(situacao(proc(), '2026-11-14')).toBe('a-vencer')
    expect(situacao(proc(), '2027-01-02')).toBe('vencida')
    expect(situacao(proc({ vigenciaInicio: '2027-02-01', vigenciaFim: '2027-12-31' }), '2026-11-14')).toBe('futura')
    expect(situacao(proc({ vigenciaFim: '' }), '2026-11-14')).toBe('sem-vigencia')
    expect(situacao(undefined, '2026-11-14')).toBe('sem-vigencia')
  })
})

describe('indicadores e filtros', () => {
  const ms = [mat({ id: 'a', quantidadeEntregue: 600, quantidadeUtilizada: 100, quantidadeComprometida: 150 }), mat({ id: 'b', nomePadronizado: 'Areia média', descricaoOriginal: 'AREIA MEDIA LAVADA', categoria: 'Areia', quantidadeEntregue: 10, quantidadeUtilizada: 9 }), mat({ id: 'c', nomePadronizado: 'Brita 1', descricaoOriginal: 'BRITA N 1', categoria: 'Brita' })]
  it('conta saldo, entrega pendente, vencimento e saldo baixo', () => {
    expect(indicadores([proc()], ms, '2026-11-14')).toMatchObject({ totalMateriais: 3, totalProcessos: 1, comSaldo: 2, semSaldo: 1, entregaPendente: 3, vencendo: 3, saldoBaixo: 1 })
  })
  it('busca sem acento, categoria e disponibilidade', () => {
    const p = [proc()]
    expect(filtrar(ms, p, { ...FILTROS_VAZIOS, busca: 'MEDIA' }, '2026-11-14').map((m) => m.id)).toEqual(['b'])
    expect(filtrar(ms, p, { ...FILTROS_VAZIOS, categoria: 'Brita' }, '2026-11-14').map((m) => m.id)).toEqual(['c'])
    expect(filtrar(ms, p, { ...FILTROS_VAZIOS, disponibilidade: 'sem-saldo' }, '2026-11-14').map((m) => m.id)).toEqual(['c'])
    expect(filtrar(ms, p, { ...FILTROS_VAZIOS, busca: 'cp ii-z' }, '2026-11-14').map((m) => m.id)).toEqual(['a'])
  })
})
