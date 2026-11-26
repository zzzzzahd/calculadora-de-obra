import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ambiente, Obra } from '../types'
import { analisarBackup, FORMATO_BACKUP, montarBackup, sanearLevantamento, type BackupArquivo, type Licitacoes } from './backup'
import { PARAMS_PADRAO, type Params } from './engine'
import { calcular } from './engine'
import { limpar, listar, salvar } from '../licitacoes/db'
import { lerLicitacoes, restaurarLicitacoes } from '../licitacoes/backupDb'
import { carregarEquivalencias, salvarEquivalencias } from '../licitacoes/equivalencias'
import type { Material, Processo } from '../licitacoes/tipos'
import type { Movimento } from '../licitacoes/movimentos'

const obra: Obra = { nome: 'Casa A', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm', pavimentos: 2, terreno: 'inclinado', desnivel: true, movimentoTerra: 'ambos' }
// ambiente "cheio": todos os campos do cadastro central
const s1: Ambiente = { id: 's1', nome: 'Sala 1', comprimento: 7, largura: 7, unidade: 'm', tipo: 'sala', peDireito: 3.2,
  divisas: { 1: { com: 's2', trecho: 5, acao: 'manter' } }, aberturas: [{ id: 'a1', tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 2, lado: 1, acao: 'demolir' }],
  acabamento: { piso: 'porcelanato', revParede: 'ceramica', alturaCeramica: 1.5, forro: true }, acoes: { paredes: 'demolir', piso: 'manter' },
  pontos: { vaso: 1, pia: 2 }, pontosEl: { tug: 4, pontoLuz: 3 }, origem: { fonte: 'planta', confianca: 0.8, observacao: 'medida de cota' } }
const s2: Ambiente = { id: 's2', nome: 'Sala 2', comprimento: 350, largura: 400, unidade: 'cm', divisas: { 3: { com: 's1', trecho: 5 } } }
const lev = { obra, ambientes: [s1, s2], aberturas: [{ id: 'g1', tipo: 'Janela' as const, largura: 1.2, altura: 1, qtd: 3 }] }
const params: Params = { ...PARAMS_PADRAO, eltTomadas: 9, hidPontosAgua: 3,
  composicoes: [{ id: 'c1', nome: 'Verniz', etapa: 'Acabamento', unidade: 'L', base: 'pontosAgua', coef: 0.2, perda: 5 }],
  conexoes: [{ id: 'k1', nome: 'Joelho 90° 25 mm', sistema: 'agua', porPonto: { vaso: 2 }, porPontoGeral: 1, fixa: 3, perda: 10 }],
  itensEl: [{ id: 'e1', nome: 'Cabo 2,5', unidade: 'm', porPonto: { tug: 8 }, fixa: 2, perda: 5, substitui: 'cabo' }] }
const proc: Processo = { id: 'p1', tipo: 'ata', numeroProcesso: '1', modalidade: 'Pregão', numeroInstrumento: '10/2026', ano: 2026, fornecedor: 'Forn', cnpj: '', dataAssinatura: '', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', observacoes: 'obs' }
const mat: Material = { id: 'm1', processoId: 'p1', lote: '', item: '1', codigo: 'C1', nomePadronizado: 'Cimento', descricaoOriginal: 'Cimento Portland', especificacao: '', categoria: 'cimento', marca: '', unidadeFornecimento: 'saco', unidadeConsumo: 'saco', fator: null, precoUnitario: 35.5, quantidadeRegistrada: 500, quantidadeSolicitada: 0, quantidadeEntregue: 0, quantidadeUtilizada: 0, quantidadeComprometida: 0, observacoes: '', fornecedor: '', aditivo: 10, quantidadeLicitada: 510, disponivelPlanilha: 200, valorPlanilha: 17000 }
const mov = (id: string, tipo: Movimento['tipo'], quantidade: number): Movimento => ({ id, materialId: 'm1', tipo, quantidade, unidade: 'saco', data: '2026-03-01', obra: 'Casa A', documento: '', observacoes: '', justificativa: '', converteReserva: false, status: 'ativa', corrigeId: '', substituidoPor: '', criadoEm: '2026-03-01' })
const lic: Licitacoes = { processos: [proc], materiais: [mat], movimentos: [mov('v1', 'solicitacao', 300), mov('v2', 'recebimento', 200)], equivalencias: [{ id: 'q1', item: 'Cimento|saco', materialId: 'm1', fator: 1 }] }
const tudo = () => montarBackup('v33', { configuracoes: params, levantamento: lev, licitacoes: lic }, new Date('2026-11-25T12:00:00Z'))
const ler = (b: unknown) => analisarBackup(JSON.stringify(b))

describe('montar e restaurar: ida e volta sem perder nada', () => {
  it('o arquivo identifica o app, o formato, a versão e a data', () => {
    const b = tudo()
    expect(b).toMatchObject({ app: 'calculadora-obra', formato: FORMATO_BACKUP, versaoApp: 'v33', geradoEm: '2026-11-25T12:00:00.000Z' })
    expect(Object.keys(montarBackup('v33', { levantamento: lev }))).not.toContain('licitacoes')
  })
  it('as três partes voltam idênticas depois de gravar em texto e analisar', () => {
    const a = ler(tudo())
    expect(a.ok).toBe(true); expect(a.erros).toEqual([]); expect(a.avisos).toEqual([])
    expect(a.dados!.levantamento).toEqual(lev)
    expect(a.dados!.licitacoes).toEqual(lic)
    expect(a.dados!.configuracoes).toEqual(params)
    expect(a.resumo).toEqual({ configuracoes: { composicoes: 1, conexoes: 1, itensEletricos: 1 }, levantamento: { ambientes: 2, aberturas: 2, nomeObra: 'Casa A' }, licitacoes: { processos: 1, materiais: 1, movimentos: 2, ligacoes: 1 } })
  })
  it('o levantamento restaurado dá exatamente o mesmo cálculo', () => {
    const a = ler(tudo()).dados!, antes = calcular(obra, lev.ambientes, { ...params, aberturas: lev.aberturas })
    const depois = calcular(a.levantamento!.obra, a.levantamento!.ambientes, { ...a.configuracoes!, aberturas: a.levantamento!.aberturas })
    expect(depois).toEqual(antes); expect(antes.length).toBeGreaterThan(20)
  })
  it('restaura só as partes que o arquivo tem', () => {
    const a = ler(montarBackup('v33', { licitacoes: lic }))
    expect(a.ok).toBe(true); expect(a.dados!.configuracoes).toBeUndefined(); expect(a.dados!.levantamento).toBeUndefined(); expect(Object.keys(a.resumo)).toEqual(['licitacoes'])
  })
})

describe('validação do arquivo: erros bloqueiam', () => {
  it('não é JSON, não é deste app, sem formato, formato mais novo, vazio e grande demais', () => {
    expect(analisarBackup('isto não é json').erros[0]).toContain('JSON válido')
    expect(ler({ app: 'outro', formato: 1 }).erros[0]).toContain('não é um backup da Calculadora')
    expect(analisarBackup('[1,2]').ok).toBe(false); expect(analisarBackup('null').ok).toBe(false)
    expect(ler({ app: 'calculadora-obra' }).erros[0]).toContain('versão do formato')
    expect(ler({ app: 'calculadora-obra', formato: 1.5 }).ok).toBe(false)
    expect(ler({ app: 'calculadora-obra', formato: 99 }).erros[0]).toContain('formato mais novo')
    expect(ler({ app: 'calculadora-obra', formato: 1 }).erros[0]).toContain('nenhuma parte')
    expect(analisarBackup('x'.repeat(40_000_001)).erros[0]).toContain('grande demais')
  })
  it('parte malformada é erro e nada é devolvido para restaurar', () => {
    const a = ler({ app: 'calculadora-obra', formato: 1, levantamento: 'oi', licitacoes: [1] })
    expect(a.ok).toBe(false); expect(a.dados).toBeUndefined(); expect(a.erros).toEqual(['A parte "levantamento" está malformada.', 'A parte "licitações" está malformada.'])
  })
  it('limite de segurança de quantidade em licitações', () => {
    const muitos = Array.from({ length: 5001 }, (_, i) => ({ id: `p${i}` }))
    expect(ler({ app: 'calculadora-obra', formato: 1, licitacoes: { processos: muitos } }).erros.join(' ')).toContain('mais de 5.000 processos')
  })
})

describe('saneamento: o arquivo nunca é usado como veio', () => {
  it('seções desconhecidas e campos inesperados são ignorados; __proto__ não contamina nada', () => {
    const texto = '{"app":"calculadora-obra","formato":1,"__proto__":{"admin":true},"extra":1,"levantamento":{"obra":{"nome":"X","__proto__":{"polluted":1}},"ambientes":[{"nome":"A","comprimento":2,"largura":3,"constructor":{"prototype":{"x":1}},"inventado":true}]}}'
    const a = analisarBackup(texto)
    expect(a.ok).toBe(true); expect(a.avisos.join(' ')).toContain('extra')
    expect(({} as Record<string, unknown>).admin).toBeUndefined(); expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.keys(a.dados!.levantamento!.ambientes[0]).sort()).toEqual(['comprimento', 'id', 'largura', 'nome', 'unidade'])
  })
  it('levantamento: valores inválidos viram padrões ou são descartados; nada de texto onde era número', () => {
    const avisos: string[] = []
    const l = sanearLevantamento({ obra: { nome: 'n'.repeat(500), alturaParede: -1, pavimentos: 99, unidadeAltura: 'km', terreno: 'lava', movimentoTerra: 'x' },
      ambientes: [{ id: 'a', nome: '', comprimento: '7', largura: -3, unidade: 'ft', tipo: 'castelo', peDireito: 0, acabamento: { piso: 'ouro', forro: 'sim' }, acoes: { paredes: 'explodir', piso: 'construir' }, pontos: { vaso: 0, pia: 2.7, nada: 3 }, pontosEl: { tug: 500 }, aberturas: [{ tipo: 'Portão', largura: 1, altura: 1 }, { tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 0 }] },
        { id: 'a', nome: 'Repetido', comprimento: 1, largura: 1 }], aberturas: [{ tipo: 'Janela', largura: 0, altura: 1 }] }, avisos)
    expect(l.obra).toEqual({ nome: 'n'.repeat(200), tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' })
    expect(l.ambientes[0]).toMatchObject({ id: 'a', nome: 'Ambiente', comprimento: 0, largura: 0, unidade: 'm', pontos: { pia: 3 } })
    expect(l.ambientes[0].aberturas).toEqual([{ id: expect.any(String), tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 1 }])
    for (const k of ['tipo', 'peDireito', 'acabamento', 'acoes', 'pontosEl']) expect(l.ambientes[0], k).not.toHaveProperty(k)
    expect(l.ambientes[1].id).not.toBe('a') // id repetido ganha outro
    expect(l.aberturas).toEqual([])
  })
  it('divisa para ambiente que não existe ou para si mesmo é ignorada, com aviso', () => {
    const avisos: string[] = []
    const l = sanearLevantamento({ ambientes: [{ id: 'a', nome: 'A', divisas: { 0: { com: 'zzz' }, 1: { com: 'a' }, 2: { com: 'b', trecho: -2 }, 9: { com: 'b' } } }, { id: 'b', nome: 'B' }] }, avisos)
    expect(l.ambientes[0].divisas).toEqual({ 2: { com: 'b' } }); expect(avisos).toHaveLength(2)
  })
  it('licitações: tipos, números e textos saneados; repetidos, inválidos e órfãos avisados', () => {
    const a = ler({ app: 'calculadora-obra', formato: 1, licitacoes: {
      processos: [{ id: 'p1', tipo: 'qualquer', ano: '2026', fornecedor: 'F'.repeat(1000) }, { id: 'p1' }, { nome: 'sem id' }],
      materiais: [{ id: 'm1', processoId: 'p1', nomePadronizado: 'Cimento', quantidadeRegistrada: -5, precoUnitario: '9', aditivo: 'x', quantidadeSolicitada: 12 }, { id: 'm2', processoId: 'sumiu' }, { id: 'm1' }],
      movimentos: [{ id: 'v1', materialId: 'm1', tipo: 'recebimento', quantidade: 10 }, { id: 'v2', materialId: 'm1', tipo: 'invento', quantidade: 1 }, { id: 'v3', materialId: 'm1', tipo: 'consumo', quantidade: -4 }, { id: 'v4', materialId: 'm1', tipo: 'ajuste-inventario', quantidade: -4 }, { id: 'v5', materialId: 'fantasma', tipo: 'reserva', quantidade: 1 }, { id: 'v1', materialId: 'm1', tipo: 'consumo', quantidade: 1 }],
      equivalencias: [{ item: 'a|un', materialId: 'nao-existe', fator: 2 }] } })
    expect(a.ok).toBe(true)
    const l = a.dados!.licitacoes!
    expect(l.processos).toHaveLength(1); expect(l.processos[0]).toMatchObject({ id: 'p1', tipo: 'processo', ano: null }); expect(l.processos[0].fornecedor).toHaveLength(300)
    expect(l.materiais.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(l.materiais[0]).toMatchObject({ quantidadeRegistrada: null, precoUnitario: null, aditivo: 0, quantidadeSolicitada: 12, fator: null })
    expect(l.movimentos.map((m) => m.id)).toEqual(['v1', 'v4', 'v5']) // tipo inventado, quantidade negativa fora do ajuste e id repetido saíram
    const av = a.avisos.join(' | ')
    expect(av).toContain('Processo repetido'); expect(av).toContain('Material repetido'); expect(av).toContain('3 movimentação(ões) inválida(s)')
    expect(av).toContain('1 material(is) apontam para um processo que não está no arquivo'); expect(av).toContain('1 movimentação(ões) apontam para um material'); expect(av).toContain('1 ligação(ões) da lista de compras')
  })
})

describe('restaurar as licitações no banco: tudo ou nada', () => {
  beforeEach(async () => { for (const s of ['processos', 'materiais', 'movimentos', 'meta'] as const) await limpar(s) })
  it('lê tudo, substitui tudo (inclusive as ligações) e o que existia antes some', async () => {
    await salvar('processos', { ...proc, id: 'velho' }); await salvar('materiais', { ...mat, id: 'velho' }); await salvarEquivalencias([{ id: 'x', item: 'Velho|un', materialId: 'velho', fator: 3 }])
    expect((await lerLicitacoes()).materiais.map((m) => m.id)).toEqual(['velho'])
    await restaurarLicitacoes(lic)
    expect(await lerLicitacoes()).toEqual(lic)
    expect((await carregarEquivalencias()).map((e) => e.item)).toEqual(['Cimento|saco'])
  })
  it('falha no meio não altera nada (transação atômica)', async () => {
    await salvar('processos', proc); await salvar('materiais', mat); await salvar('movimentos', mov('v1', 'solicitacao', 300))
    const ruim = { ...lic, movimentos: [{ ...mov('novo', 'recebimento', 5), quebrado: () => 1 } as unknown as Movimento] } // função não pode ser gravada no IndexedDB
    await expect(restaurarLicitacoes(ruim)).rejects.toBeTruthy()
    const depois = await lerLicitacoes()
    expect(depois.processos).toHaveLength(1); expect(depois.materiais).toHaveLength(1); expect(depois.movimentos.map((m) => m.id)).toEqual(['v1'])
  })
  it('restaurar licitações vazias limpa tudo e zera as ligações', async () => {
    await salvar('processos', proc); await salvarEquivalencias(lic.equivalencias)
    await restaurarLicitacoes({ processos: [], materiais: [], movimentos: [], equivalencias: [] })
    expect(await lerLicitacoes()).toEqual({ processos: [], materiais: [], movimentos: [], equivalencias: [] })
    expect((await listar('meta')).length).toBe(1) // só o registro das ligações (vazio); marcadores internos não são apagados
  })
})
