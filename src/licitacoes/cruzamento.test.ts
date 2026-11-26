import { describe, expect, it } from 'vitest'
import type { Material, Processo } from './tipos'
import type { Movimento, TipoMov } from './movimentos'
import { chaveItem, cruzar, sanearEquivalencias, sugerirMateriais, type Equivalencia } from './cruzamento'

const proc = (o: Partial<Processo> = {}): Processo => ({ id: 'p1', tipo: 'ata', numeroProcesso: '1', modalidade: 'Pregão', numeroInstrumento: '10/2026', ano: 2026, fornecedor: 'Forn', cnpj: '', dataAssinatura: '', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', observacoes: '', ...o })
const mat = (o: Partial<Material> = {}): Material => ({ id: 'm1', processoId: 'p1', lote: '', item: '1', codigo: '', nomePadronizado: 'Cimento CP II 50 kg', descricaoOriginal: 'Cimento Portland CP II saco 50kg', especificacao: '', categoria: '', marca: '', unidadeFornecimento: 'saco', unidadeConsumo: 'saco', fator: null, precoUnitario: null, quantidadeRegistrada: 500, quantidadeSolicitada: 0, quantidadeEntregue: 0, quantidadeUtilizada: 0, quantidadeComprometida: 0, observacoes: '', fornecedor: '', aditivo: 0, quantidadeLicitada: null, disponivelPlanilha: null, valorPlanilha: null, ...o })
let n = 0
const mov = (tipo: TipoMov, quantidade: number, obra = '', extra: Partial<Movimento> = {}): Movimento => ({ id: `mv${++n}`, materialId: 'm1', tipo, quantidade, unidade: 'saco', data: '2026-03-01', obra, documento: '', observacoes: '', justificativa: '', converteReserva: false, status: 'ativa', corrigeId: '', substituidoPor: '', criadoEm: '2026-03-01', ...extra })
const eq = (o: Partial<Equivalencia> = {}): Equivalencia => ({ id: 'e1', item: chaveItem({ material: 'Cimento', unidade: 'saco' }), materialId: 'm1', fator: 1, ...o })
const HOJE = '2026-06-01'
// Estado do cimento: ata de 500; solicitado 300; recebido 200; consumido 50; reservado 30 para a Casa A e 40 para outra obra
const movs = [mov('solicitacao', 300), mov('recebimento', 200), mov('consumo', 50, 'Casa B'), mov('reserva', 30, 'Casa A'), mov('reserva', 40, 'Casa B')]
const lista = (final: number) => [{ material: 'Cimento', unidade: 'saco', final }]
const um = (final: number, e: Equivalencia[] = [eq()], p = proc(), m = mat(), mv = movs, obra = 'Casa A') => cruzar(lista(final), e, [m], [p], mv, obra, HOJE)[0]

describe('cruzamento da lista de compras com as licitações', () => {
  it('item sem ligação: nada é ligado sozinho, tudo a providenciar', () => {
    const l = um(100, [])
    expect(l.estado).toBe('sem-ligacao'); expect(l.aComprar).toBe(100); expect(l.materialLicitado).toBeUndefined()
  })
  it('posição do estoque: reservado para a obra, livre, aguardando entrega e saldo da ata', () => {
    const l = um(100)
    expect(l.estado).toBe('ligado')
    expect(l.reservadoObra).toBe(30)      // reserva da Casa A
    expect(l.disponivelLivre).toBe(80)    // 200 recebidos − 50 consumidos − 70 comprometidos (30 + 40)
    expect(l.aguardandoEntrega).toBe(100) // 300 solicitados − 200 recebidos
    expect(l.saldoAta).toBe(200)          // 500 − 300 solicitados
  })
  it('a necessidade é coberta na ordem: estoque (reservado + livre), pedido em andamento, ata, e só então comprar fora', () => {
    let l = um(100); expect([l.deEstoque, l.deAguardando, l.deAta, l.aComprar]).toEqual([100, 0, 0, 0])
    l = um(400); expect([l.deEstoque, l.deAguardando, l.deAta, l.aComprar]).toEqual([110, 100, 190, 0])
    l = um(500); expect([l.deEstoque, l.deAguardando, l.deAta, l.aComprar]).toEqual([110, 100, 200, 90])
    expect(l.deEstoque + l.deAguardando + l.deAta + l.aComprar).toBe(500)
  })
  it('ata vencida, futura ou sem vigência não é fonte e avisa; "a vencer" ainda vale', () => {
    let l = um(400, [eq()], proc({ vigenciaFim: '2026-05-01' }))
    expect(l.situacaoProcesso).toBe('vencida'); expect(l.deAta).toBe(0); expect(l.aComprar).toBe(190); expect(l.avisos.join(' ')).toContain('vencido')
    l = um(400, [eq()], proc({ vigenciaInicio: '2026-09-01' })); expect(l.deAta).toBe(0); expect(l.avisos.join(' ')).toContain('ainda não iniciada')
    l = um(400, [eq()], proc({ vigenciaInicio: '', vigenciaFim: '' })); expect(l.deAta).toBe(0); expect(l.avisos.join(' ')).toContain('sem vigência')
    l = um(400, [eq()], proc({ vigenciaFim: '2026-06-20' })); expect(l.situacaoProcesso).toBe('a-vencer'); expect(l.deAta).toBe(190)
  })
  it('a reserva só conta para a obra informada (e avisa quando o nome da obra está vazio)', () => {
    expect(um(100, [eq()], proc(), mat(), movs, 'Casa B').reservadoObra).toBe(40)
    expect(um(100, [eq()], proc(), mat(), movs, 'Outra').reservadoObra).toBe(0)
    expect(um(100, [eq()], proc(), mat(), movs, '').avisos.join(' ')).toContain('nome da obra')
  })
  it('fator de conversão do usuário: 1 milheiro = 1000 un', () => {
    const m = mat({ unidadeFornecimento: 'milheiro', quantidadeRegistrada: 10 })
    const l = cruzar([{ material: 'Tijolo', unidade: 'un', final: 5000 }], [eq({ item: chaveItem({ material: 'Tijolo', unidade: 'un' }), fator: 1000 })], [m], [proc()],
      [mov('solicitacao', 6), mov('recebimento', 4), mov('reserva', 1, 'Casa A')], 'Casa A', HOJE)[0]
    expect(l.reservadoObra).toBe(1000); expect(l.disponivelLivre).toBe(3000); expect(l.aguardandoEntrega).toBe(2000); expect(l.saldoAta).toBe(4000)
    expect([l.deEstoque, l.deAguardando, l.deAta, l.aComprar]).toEqual([4000, 1000, 0, 0])
  })
  it('unidades diferentes com fator 1 geram aviso para o usuário confirmar', () => {
    const l = cruzar([{ material: 'Areia', unidade: 'm³', final: 3 }], [eq({ item: chaveItem({ material: 'Areia', unidade: 'm³' }), fator: 1 })], [mat({ unidadeFornecimento: 'saco' })], [proc()], movs, 'Casa A', HOJE)[0]
    expect(l.avisos.join(' ')).toContain('Unidades diferentes')
  })
  it('ligação inválida: material excluído ou fator ausente; não calcula', () => {
    const sem = cruzar(lista(10), [eq({ materialId: 'inexistente' })], [mat()], [proc()], movs, 'Casa A', HOJE)[0]
    expect(sem.estado).toBe('invalido'); expect(sem.motivo).toContain('não existe mais')
    for (const f of [0, -1, NaN]) { const l = um(10, [eq({ fator: f })]); expect(l.estado, String(f)).toBe('invalido'); expect(l.motivo).toContain('fator') }
  })
  it('movimentos cancelados ou corrigidos não entram', () => {
    const l = um(100, [eq()], proc(), mat(), [...movs, mov('consumo', 999, 'X', { status: 'cancelada' })])
    expect(l.disponivelLivre).toBe(80)
  })
  it('saldos negativos nunca viram quantidade a mais (limitados a zero)', () => {
    const l = um(10, [eq()], proc(), mat(), [mov('consumo', 50, 'X')]) // consumo sem recebimento
    expect(l.disponivelLivre).toBe(0); expect(l.reservadoObra).toBe(0); expect(l.aComprar).toBeGreaterThanOrEqual(0)
  })
})

describe('sugestões e validação das ligações', () => {
  const ms = [mat({ id: 'a', nomePadronizado: 'Cimento CP II 50 kg' }), mat({ id: 'b', nomePadronizado: 'Areia média lavada', descricaoOriginal: 'Areia média', especificacao: '' }), mat({ id: 'c', nomePadronizado: 'Tinta acrílica', descricaoOriginal: 'Tinta acrílica fosca', especificacao: '' })]
  it('sugere por palavras em comum, ignorando acentos e maiúsculas, e nunca sem nenhuma palavra em comum', () => {
    expect(sugerirMateriais({ material: 'CIMENTO Portland' }, ms).map((m) => m.id)).toEqual(['a'])
    expect(sugerirMateriais({ material: 'Areia media' }, ms).map((m) => m.id)).toEqual(['b'])
    expect(sugerirMateriais({ material: 'Tijolo' }, ms)).toEqual([])
  })
  it('sanear: descarta lixo, repetidos e fator inválido (vira 0, aparece como ligação inválida)', () => {
    const r = sanearEquivalencias([{ id: 'x', item: 'a|un', materialId: 'm', fator: 2 }, { item: 'a|un', materialId: 'z', fator: 3 }, null, 'x', { item: '', materialId: 'm' }, { item: 'b|un', materialId: 'm', fator: -5 }, { item: 'c|un', materialId: 'm', fator: 1e12 }])
    expect(r).toEqual([{ id: 'x', item: 'a|un', materialId: 'm', fator: 2 }, { id: 'b|un', item: 'b|un', materialId: 'm', fator: 0 }, { id: 'c|un', item: 'c|un', materialId: 'm', fator: 0 }])
    expect(sanearEquivalencias('x')).toEqual([]); expect(sanearEquivalencias(undefined)).toEqual([])
  })
})
