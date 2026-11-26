/**
 * BACKUP E RESTAURAÇÃO. Arquivo JSON versionado com até três partes independentes:
 *  - configuracoes: parâmetros, composições, conexões hidráulicas e itens elétricos;
 *  - levantamento: dados da obra, ambientes e aberturas gerais;
 *  - licitacoes: processos, materiais, movimentações e ligações da lista de compras.
 * Ao restaurar, cada parte é validada e saneada campo a campo (nada do arquivo é executado nem usado como veio):
 * erros bloqueiam, avisos são mostrados na prévia. Funções puras; a gravação fica com quem chama.
 */
import { ACOES, LADOS, PISOS, PONTOS_EL, PONTOS_HIDRO, REVESTIMENTOS, TIPOS_AMBIENTE, type Abertura, type Acao, type Acoes, type Ambiente, type LadoIdx, type Obra, type Pontos, type PontosEl } from '../types'
import type { Params } from './params'
import { sanear } from './config'
import { uid } from './uid'
import type { Material, Processo } from '../licitacoes/tipos'
import { ROTULO_MOV, type Movimento, type TipoMov } from '../licitacoes/movimentos'
import { sanearEquivalencias, type Equivalencia } from '../licitacoes/cruzamento'

export const FORMATO_BACKUP = 1
export const APP_BACKUP = 'calculadora-obra'
export const LIMITE_TEXTO = 40_000_000

export interface Levantamento { obra: Obra; ambientes: Ambiente[]; aberturas: Abertura[] }
export interface Licitacoes { processos: Processo[]; materiais: Material[]; movimentos: Movimento[]; equivalencias: Equivalencia[] }
export interface BackupArquivo {
  app: typeof APP_BACKUP; formato: number; versaoApp: string; geradoEm: string
  configuracoes?: Params; levantamento?: Levantamento; licitacoes?: Licitacoes
}
export type Parte = 'configuracoes' | 'levantamento' | 'licitacoes'
export const PARTES: Parte[] = ['configuracoes', 'levantamento', 'licitacoes']

export interface Resumo { configuracoes?: { composicoes: number; conexoes: number; itensEletricos: number }; levantamento?: { ambientes: number; aberturas: number; nomeObra: string }; licitacoes?: { processos: number; materiais: number; movimentos: number; ligacoes: number } }
export interface Analise { ok: boolean; erros: string[]; avisos: string[]; resumo: Resumo; dados?: BackupArquivo; geradoEm?: string; versaoApp?: string }

/** Monta o arquivo com as partes escolhidas (as partes ausentes simplesmente não entram). */
export function montarBackup(versaoApp: string, partes: { configuracoes?: Params; levantamento?: Levantamento; licitacoes?: Licitacoes }, agora = new Date()): BackupArquivo {
  const b: BackupArquivo = { app: APP_BACKUP, formato: FORMATO_BACKUP, versaoApp, geradoEm: agora.toISOString() }
  if (partes.configuracoes) b.configuracoes = partes.configuracoes
  if (partes.levantamento) b.levantamento = partes.levantamento
  if (partes.licitacoes) b.licitacoes = partes.licitacoes
  return b
}

// ───────────────────────── ferramentas de saneamento ─────────────────────────
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown, max = 200, padrao = ''): string => (typeof v === 'string' ? v.slice(0, max) : padrao)
const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined)
const numOuNulo = (v: unknown, max = 1e12): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null)
const num0 = (v: unknown, max = 1e12): number => numOuNulo(v, max) ?? 0
const emLista = <T extends string>(v: unknown, lista: readonly T[]): T | undefined => (typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : undefined)
const inteiro = (v: unknown, min: number, max: number): number | undefined => { const n = num(v, min, max); return n === undefined ? undefined : Math.round(n) }
const unico = (id: string, vistos: Set<string>) => { const r = id && !vistos.has(id) ? id : uid(); vistos.add(r); return r }

// ───────────────────────── levantamento ─────────────────────────
const ACOES_LISTA = Object.keys(ACOES) as Acao[]
const UNIDADES = ['m', 'cm', 'mm'] as const

function sanearAbertura(v: unknown, vistos: Set<string>, comLado: boolean): Abertura | null {
  const o = obj(v), tipo = emLista(o.tipo, ['Porta', 'Janela'] as const), largura = num(o.largura, 0.01, 50), altura = num(o.altura, 0.01, 50)
  if (!tipo || largura === undefined || altura === undefined) return null
  const a: Abertura = { id: unico(str(o.id, 60), vistos), tipo, largura, altura, qtd: inteiro(o.qtd, 1, 500) ?? 1 }
  const lado = comLado ? emLista(String(o.lado), ['0', '1', '2', '3']) : undefined
  if (lado !== undefined) a.lado = Number(lado) as LadoIdx
  const acao = emLista(o.acao, ACOES_LISTA); if (acao && acao !== 'construir') a.acao = acao
  return a
}

export function sanearLevantamento(v: unknown, avisos: string[]): Levantamento {
  const o = obj(v), ob = obj(o.obra)
  const obra: Obra = {
    nome: str(ob.nome, 200), tipo: str(ob.tipo, 40, 'Residencial') || 'Residencial', alturaParede: num(ob.alturaParede, 0.1, 100) ?? 2.8, unidadeAltura: emLista(ob.unidadeAltura, UNIDADES) ?? 'm',
    pavimentos: inteiro(ob.pavimentos, 1, 30) ?? 1, terreno: emLista(ob.terreno, ['plano', 'inclinado'] as const) ?? 'plano', desnivel: ob.desnivel === true,
    movimentoTerra: emLista(ob.movimentoTerra, ['nenhum', 'aterro', 'escavacao', 'ambos'] as const) ?? 'nenhum',
  }
  const ids = new Set<string>(), bruto = arr(o.ambientes).slice(0, 500), divisasBrutas = new Map<string, unknown>()
  const ambientes: Ambiente[] = bruto.flatMap((x): Ambiente[] => {
    const a = obj(x)
    const am: Ambiente = { id: unico(str(a.id, 60), ids), nome: str(a.nome, 80, 'Ambiente') || 'Ambiente', comprimento: num0(a.comprimento, 1e6), largura: num0(a.largura, 1e6), unidade: emLista(a.unidade, UNIDADES) ?? 'm' }
    const tipo = emLista(a.tipo, Object.keys(TIPOS_AMBIENTE) as (keyof typeof TIPOS_AMBIENTE)[]); if (tipo) am.tipo = tipo
    const pe = num(a.peDireito, 0.01, 1e6); if (pe !== undefined) am.peDireito = pe
    const ab = arr(a.aberturas).slice(0, 200).map((y) => sanearAbertura(y, new Set(), true)).filter((y): y is Abertura => !!y)
    if (ab.length) am.aberturas = ab
    const ac = obj(a.acabamento), acab: NonNullable<Ambiente['acabamento']> = {}
    const piso = emLista(ac.piso, Object.keys(PISOS) as (keyof typeof PISOS)[]); if (piso) acab.piso = piso
    const rev = emLista(ac.revParede, Object.keys(REVESTIMENTOS) as (keyof typeof REVESTIMENTOS)[]); if (rev) acab.revParede = rev
    const hc = num(ac.alturaCeramica, 0.01, 1e6); if (hc !== undefined) acab.alturaCeramica = hc
    if (typeof ac.forro === 'boolean') acab.forro = ac.forro
    if (Object.keys(acab).length) am.acabamento = acab
    const acs = obj(a.acoes), acoes: Acoes = {}
    for (const k of ['paredes', 'revestimento', 'piso', 'forro'] as const) { const z = emLista(acs[k], ACOES_LISTA); if (z && z !== 'construir') acoes[k] = z }
    if (Object.keys(acoes).length) am.acoes = acoes
    const pt: Pontos = {}; const po = obj(a.pontos)
    for (const t of Object.keys(PONTOS_HIDRO) as (keyof Pontos)[]) { const n = inteiro(po[t], 1, 99); if (n) pt[t] = n }
    if (Object.keys(pt).length) am.pontos = pt
    const pe2: PontosEl = {}; const pl = obj(a.pontosEl)
    for (const t of Object.keys(PONTOS_EL) as (keyof PontosEl)[]) { const n = inteiro(pl[t], 1, 99); if (n) pe2[t] = n }
    if (Object.keys(pe2).length) am.pontosEl = pe2
    const org = obj(a.origem), fonte = emLista(org.fonte, ['manual', 'planta', 'texto', 'importado'] as const)
    if (fonte) { am.origem = { fonte }; const c = num(org.confianca, 0, 1); if (c !== undefined) am.origem.confianca = c; const ob2 = str(org.observacao, 300); if (ob2) am.origem.observacao = ob2 }
    divisasBrutas.set(am.id, a.divisas)
    return [am]
  })
  // divisas: só entre ambientes que existem, nos 4 lados válidos
  const existe = new Set(ambientes.map((a) => a.id))
  for (const am of ambientes) {
    const bruto2 = obj(divisasBrutas.get(am.id))
    const dv: NonNullable<Ambiente['divisas']> = {}
    for (const l of LADOS) {
      const d = obj(bruto2[String(l.idx)]), com = str(d.com, 60)
      if (!com) continue
      if (!existe.has(com) || com === am.id) { avisos.push(`${am.nome}: divisa no lado ${l.idx + 1} aponta para um ambiente que não existe; ignorada.`); continue }
      const t = num(d.trecho, 0.01, 1000), z = emLista(d.acao, ACOES_LISTA)
      dv[l.idx] = { com, ...(t !== undefined ? { trecho: t } : {}), ...(z ? { acao: z } : {}) }
    }
    if (Object.keys(dv).length) am.divisas = dv
  }
  if (arr(o.ambientes).length > 500) avisos.push('Mais de 500 ambientes no arquivo: só os 500 primeiros foram lidos.')
  const aberturas = arr(o.aberturas).slice(0, 500).map((y) => sanearAbertura(y, new Set(), false)).filter((y): y is Abertura => !!y)
  return { obra, ambientes, aberturas }
}

// ───────────────────────── licitações ─────────────────────────
const TIPOS_MOV = Object.keys(ROTULO_MOV) as TipoMov[]
const LIM = { processos: 5000, materiais: 50000, movimentos: 200000 }

export function sanearLicitacoes(v: unknown, avisos: string[], erros: string[]): Licitacoes {
  const o = obj(v)
  for (const k of ['processos', 'materiais', 'movimentos'] as const) if (arr(o[k]).length > LIM[k]) erros.push(`Licitações: mais de ${LIM[k].toLocaleString('pt-BR')} ${k} no arquivo (limite de segurança).`)
  const vistosP = new Set<string>(), processos: Processo[] = []
  for (const x of arr(o.processos).slice(0, LIM.processos)) {
    const p = obj(x), id = str(p.id, 80); if (!id || vistosP.has(id)) { if (id) avisos.push(`Processo repetido ignorado (${id}).`); continue }
    vistosP.add(id)
    processos.push({ id, tipo: emLista(p.tipo, ['ata', 'contrato', 'processo'] as const) ?? 'processo', numeroProcesso: str(p.numeroProcesso, 100), modalidade: str(p.modalidade, 200), numeroInstrumento: str(p.numeroInstrumento, 100), ano: inteiro(p.ano, 1900, 2200) ?? null, fornecedor: str(p.fornecedor, 300), cnpj: str(p.cnpj, 30), dataAssinatura: str(p.dataAssinatura, 10), vigenciaInicio: str(p.vigenciaInicio, 10), vigenciaFim: str(p.vigenciaFim, 10), observacoes: str(p.observacoes, 2000) })
  }
  const vistosM = new Set<string>(), materiais: Material[] = []
  for (const x of arr(o.materiais).slice(0, LIM.materiais)) {
    const m = obj(x), id = str(m.id, 80); if (!id || vistosM.has(id)) { if (id) avisos.push(`Material repetido ignorado (${id}).`); continue }
    vistosM.add(id)
    materiais.push({ id, processoId: str(m.processoId, 80), lote: str(m.lote, 100), item: str(m.item, 100), codigo: str(m.codigo, 100), nomePadronizado: str(m.nomePadronizado, 300), descricaoOriginal: str(m.descricaoOriginal, 2000), especificacao: str(m.especificacao, 2000), categoria: str(m.categoria, 100), marca: str(m.marca, 100),
      unidadeFornecimento: str(m.unidadeFornecimento, 40), unidadeConsumo: str(m.unidadeConsumo, 40), fator: numOuNulo(m.fator), precoUnitario: numOuNulo(m.precoUnitario), quantidadeRegistrada: numOuNulo(m.quantidadeRegistrada),
      quantidadeSolicitada: num0(m.quantidadeSolicitada), quantidadeEntregue: num0(m.quantidadeEntregue), quantidadeUtilizada: num0(m.quantidadeUtilizada), quantidadeComprometida: num0(m.quantidadeComprometida), observacoes: str(m.observacoes, 2000),
      fornecedor: str(m.fornecedor, 300), aditivo: num0(m.aditivo), quantidadeLicitada: numOuNulo(m.quantidadeLicitada), disponivelPlanilha: numOuNulo(m.disponivelPlanilha), valorPlanilha: numOuNulo(m.valorPlanilha) })
  }
  const vistosV = new Set<string>(), movimentos: Movimento[] = []
  let invalidos = 0
  for (const x of arr(o.movimentos).slice(0, LIM.movimentos)) {
    const g = obj(x), id = str(g.id, 80), tipo = emLista(g.tipo, TIPOS_MOV)
    const q = typeof g.quantidade === 'number' && Number.isFinite(g.quantidade) && Math.abs(g.quantidade) <= 1e12 ? g.quantidade : undefined
    if (!id || vistosV.has(id) || !tipo || q === undefined || (q < 0 && tipo !== 'ajuste-inventario')) { invalidos++; continue }
    vistosV.add(id)
    movimentos.push({ id, materialId: str(g.materialId, 80), tipo, quantidade: q, unidade: str(g.unidade, 40), data: str(g.data, 10), obra: str(g.obra, 200), documento: str(g.documento, 200), observacoes: str(g.observacoes, 2000), justificativa: str(g.justificativa, 2000),
      converteReserva: g.converteReserva === true, status: emLista(g.status, ['ativa', 'corrigida', 'cancelada'] as const) ?? 'ativa', corrigeId: str(g.corrigeId, 80), substituidoPor: str(g.substituidoPor, 80), criadoEm: str(g.criadoEm, 40) })
  }
  if (invalidos) avisos.push(`${invalidos} movimentação(ões) inválida(s) (sem tipo, quantidade ou identificador, ou repetidas) foram ignoradas.`)
  const orfaosM = materiais.filter((m) => !vistosP.has(m.processoId)).length
  const orfaosV = movimentos.filter((m) => !vistosM.has(m.materialId)).length
  if (orfaosM) avisos.push(`${orfaosM} material(is) apontam para um processo que não está no arquivo (mantidos).`)
  if (orfaosV) avisos.push(`${orfaosV} movimentação(ões) apontam para um material que não está no arquivo (mantidas).`)
  const equivalencias = sanearEquivalencias(o.equivalencias)
  const semMat = equivalencias.filter((e) => !vistosM.has(e.materialId)).length
  if (semMat) avisos.push(`${semMat} ligação(ões) da lista de compras apontam para um material que não está no arquivo (mantidas; aparecem como inválidas).`)
  return { processos, materiais, movimentos, equivalencias }
}

// ───────────────────────── análise do arquivo ─────────────────────────
/** Lê e valida o texto de um backup. Nada é gravado: devolve o que seria restaurado, avisos e erros. */
export function analisarBackup(texto: string): Analise {
  const erros: string[] = [], avisos: string[] = []
  if (texto.length > LIMITE_TEXTO) return { ok: false, erros: ['Arquivo grande demais para um backup desta ferramenta.'], avisos, resumo: {} }
  let j: unknown
  try { j = JSON.parse(texto) } catch { return { ok: false, erros: ['O arquivo não é um JSON válido.'], avisos, resumo: {} } }
  const o = obj(j)
  if (o.app !== APP_BACKUP) return { ok: false, erros: ['Este arquivo não é um backup da Calculadora de Obras.'], avisos, resumo: {} }
  if (typeof o.formato !== 'number' || !Number.isInteger(o.formato) || o.formato < 1) return { ok: false, erros: ['O arquivo não informa a versão do formato do backup.'], avisos, resumo: {} }
  if (o.formato > FORMATO_BACKUP) return { ok: false, erros: [`Backup de um formato mais novo (${o.formato}) que este programa entende (${FORMATO_BACKUP}). Atualize o programa antes de restaurar.`], avisos, resumo: {} }
  const conhecidas = new Set<string>(['app', 'formato', 'versaoApp', 'geradoEm', ...PARTES])
  const extras = Object.keys(o).filter((k) => !conhecidas.has(k))
  if (extras.length) avisos.push(`Seções desconhecidas ignoradas: ${extras.slice(0, 5).join(', ')}.`)

  const dados: BackupArquivo = { app: APP_BACKUP, formato: o.formato, versaoApp: str(o.versaoApp, 20), geradoEm: str(o.geradoEm, 40) }
  const resumo: Resumo = {}
  if (o.configuracoes !== undefined) {
    if (!o.configuracoes || typeof o.configuracoes !== 'object' || Array.isArray(o.configuracoes)) erros.push('A parte "configurações" está malformada.')
    else { const c = sanear(o.configuracoes); dados.configuracoes = c; resumo.configuracoes = { composicoes: c.composicoes.length, conexoes: c.conexoes.length, itensEletricos: c.itensEl.length } }
  }
  if (o.levantamento !== undefined) {
    if (!o.levantamento || typeof o.levantamento !== 'object' || Array.isArray(o.levantamento)) erros.push('A parte "levantamento" está malformada.')
    else { const l = sanearLevantamento(o.levantamento, avisos); dados.levantamento = l; resumo.levantamento = { ambientes: l.ambientes.length, aberturas: l.aberturas.length + l.ambientes.reduce((s, a) => s + (a.aberturas?.length ?? 0), 0), nomeObra: l.obra.nome } }
  }
  if (o.licitacoes !== undefined) {
    if (!o.licitacoes || typeof o.licitacoes !== 'object' || Array.isArray(o.licitacoes)) erros.push('A parte "licitações" está malformada.')
    else { const l = sanearLicitacoes(o.licitacoes, avisos, erros); dados.licitacoes = l; resumo.licitacoes = { processos: l.processos.length, materiais: l.materiais.length, movimentos: l.movimentos.length, ligacoes: l.equivalencias.length } }
  }
  if (!erros.length && !PARTES.some((p) => dados[p] !== undefined)) erros.push('O backup não tem nenhuma parte para restaurar.')
  return { ok: erros.length === 0, erros, avisos, resumo, dados: erros.length ? undefined : dados, geradoEm: dados.geradoEm, versaoApp: dados.versaoApp }
}
