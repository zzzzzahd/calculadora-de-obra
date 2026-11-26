/**
 * Cruzamento da lista de compras do levantamento com os materiais das licitações (sem ligação automática).
 * O usuário liga cada item da lista a um material licitado e informa o fator de conversão; nada é ligado ou convertido sozinho.
 * O resultado é uma SUGESTÃO de onde cada quantidade pode vir (nenhuma reserva ou pedido é criado):
 *   necessidade → já reservado para a obra → estoque livre → pedido aguardando entrega → saldo da ata a solicitar → comprar fora.
 * Saldo de ata vencida, futura ou sem vigência nunca é usado como fonte.
 */
import type { Material, Processo, Situacao } from './tipos'
import { aplicarMovimentos, reservadoPorObra, type Movimento } from './movimentos'
import { saldos, situacao } from './regras'

export interface ItemLista { material: string; unidade: string; final: number }
/** `fator`: quantas unidades da LISTA correspondem a 1 unidade da licitação (ex.: 1 milheiro = 1000 un → fator 1000). */
export interface Equivalencia { id: string; item: string; materialId: string; fator: number }

export const chaveItem = (i: { material: string; unidade: string }) => `${i.material}|${i.unidade}`
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const mesmaUnidade = (a: string, b: string) => norm(a).trim() === norm(b).trim()

export interface LinhaCruzamento {
  chave: string; material: string; unidade: string; necessidade: number
  estado: 'sem-ligacao' | 'ligado' | 'invalido'
  motivo?: string
  equivalencia?: Equivalencia
  materialLicitado?: Material; processo?: Processo; situacaoProcesso?: Situacao
  // tudo abaixo em unidades da LISTA
  reservadoObra: number; disponivelLivre: number; aguardandoEntrega: number; saldoAta: number; saldoAtaUsavel: number
  deEstoque: number; deAguardando: number; deAta: number; aComprar: number
  avisos: string[]
}

const vazia = (i: ItemLista): LinhaCruzamento => ({ chave: chaveItem(i), material: i.material, unidade: i.unidade, necessidade: i.final, estado: 'sem-ligacao',
  reservadoObra: 0, disponivelLivre: 0, aguardandoEntrega: 0, saldoAta: 0, saldoAtaUsavel: 0, deEstoque: 0, deAguardando: 0, deAta: 0, aComprar: i.final, avisos: [] })

export function cruzar(lista: ItemLista[], equivalencias: Equivalencia[], materiais: Material[], processos: Processo[], movimentos: Movimento[], obra: string, hoje: string): LinhaCruzamento[] {
  const porItem = new Map(equivalencias.map((e) => [e.item, e]))
  const mat = new Map(materiais.map((m) => [m.id, m])), proc = new Map(processos.map((p) => [p.id, p]))
  return lista.map((i) => {
    const l = vazia(i), eq = porItem.get(l.chave)
    if (!eq) return l
    l.equivalencia = eq
    const m = mat.get(eq.materialId)
    if (!m) return { ...l, estado: 'invalido', motivo: 'O material licitado desta ligação não existe mais; refaça a ligação.' }
    if (!(Number.isFinite(eq.fator) && eq.fator > 0)) return { ...l, estado: 'invalido', motivo: 'Informe o fator de conversão (maior que zero).', materialLicitado: m }
    const p = proc.get(m.processoId), sit = situacao(p, hoje)
    const movs = movimentos.filter((x) => x.materialId === m.id)
    const efetivo = aplicarMovimentos(m, movs), s = saldos(efetivo), f = eq.fator
    l.estado = 'ligado'; l.materialLicitado = m; l.processo = p; l.situacaoProcesso = sit
    l.reservadoObra = Math.max(0, reservadoPorObra(movs, obra)) * f
    l.disponivelLivre = Math.max(0, s.disponivel) * f
    l.aguardandoEntrega = s.aguardandoEntrega * f
    l.saldoAta = Math.max(0, s.saldoASolicitar) * f
    const usavel = sit === 'vigente' || sit === 'a-vencer'
    l.saldoAtaUsavel = usavel ? l.saldoAta : 0
    if (!usavel && l.saldoAta > 0) l.avisos.push(`O instrumento está ${sit === 'vencida' ? 'vencido' : sit === 'futura' ? 'com vigência ainda não iniciada' : 'sem vigência informada'}: o saldo da ata não foi usado como fonte.`)
    if (m.unidadeFornecimento && !mesmaUnidade(m.unidadeFornecimento, i.unidade) && f === 1) l.avisos.push(`Unidades diferentes (lista: ${i.unidade}; licitação: ${m.unidadeFornecimento}) com fator 1: confirme a conversão.`)
    if (!obra.trim()) l.avisos.push('Sem o nome da obra não dá para considerar o que já foi reservado para ela.')
    // distribuição da necessidade, na ordem das fontes (sugestão; nenhuma reserva é criada)
    let falta = i.final
    l.deEstoque = Math.min(falta, l.reservadoObra + l.disponivelLivre); falta -= l.deEstoque
    l.deAguardando = Math.min(falta, l.aguardandoEntrega); falta -= l.deAguardando
    l.deAta = Math.min(falta, l.saldoAtaUsavel); falta -= l.deAta
    l.aComprar = falta
    return l
  })
}

/** Candidatas a ligação, por palavras em comum (só sugestão: a ligação é sempre uma ação do usuário). */
export function sugerirMateriais(item: { material: string }, materiais: Material[], max = 5): Material[] {
  const palavras = (t: string) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 2))
  const alvo = palavras(item.material)
  return materiais.map((m) => {
    const dele = palavras([m.nomePadronizado, m.descricaoOriginal, m.especificacao].join(' '))
    let c = 0; for (const w of alvo) if (dele.has(w)) c++
    return { m, c }
  }).filter((x) => x.c > 0).sort((a, b) => b.c - a.c || a.m.nomePadronizado.localeCompare(b.m.nomePadronizado)).slice(0, max).map((x) => x.m)
}

/** Equivalências válidas: texto de item, material, fator finito e positivo; no máximo uma ligação por item. */
export function sanearEquivalencias(v: unknown): Equivalencia[] {
  if (!Array.isArray(v)) return []
  const vistos = new Set<string>(), r: Equivalencia[] = []
  for (const e of v.slice(0, 5000)) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    if (typeof o.item !== 'string' || !o.item || typeof o.materialId !== 'string' || !o.materialId || vistos.has(o.item)) continue
    const fator = typeof o.fator === 'number' && Number.isFinite(o.fator) && o.fator > 0 && o.fator <= 1e9 ? o.fator : 0
    vistos.add(o.item); r.push({ id: typeof o.id === 'string' && o.id ? o.id : `${o.item}`, item: o.item.slice(0, 300), materialId: o.materialId, fator })
  }
  return r
}
