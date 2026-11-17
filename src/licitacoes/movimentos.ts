import type { Material } from './tipos'
import { uid } from '../lib/uid'

export type TipoMov = 'cadastro-inicial' | 'atualizacao' | 'solicitacao' | 'recebimento' | 'devolucao' | 'reserva' | 'cancelamento-reserva' | 'consumo' | 'ajuste-inventario'
export const ROTULO_MOV: Record<TipoMov, string> = {
  'cadastro-inicial': 'Cadastro inicial', atualizacao: 'Atualização de quantidade', solicitacao: 'Solicitação ao fornecedor', recebimento: 'Recebimento',
  devolucao: 'Devolução ao fornecedor', reserva: 'Reserva para obra', 'cancelamento-reserva': 'Cancelamento de reserva', consumo: 'Consumo', 'ajuste-inventario': 'Ajuste de inventário',
}
/** Registros automáticos (importação/cadastro): não alteram saldos. */
export const INFORMATIVOS: TipoMov[] = ['cadastro-inicial', 'atualizacao']

export interface Movimento {
  id: string; materialId: string; tipo: TipoMov
  quantidade: number // sempre positiva, exceto no ajuste de inventário (pode ser negativo)
  unidade: string; data: string; obra: string; documento: string; observacoes: string
  justificativa: string // obrigatória quando a movimentação gera alerta (ex.: saldo negativo)
  converteReserva: boolean // consumo que transforma reserva da obra em consumo efetivo
  status: 'ativa' | 'corrigida' | 'cancelada'
  corrigeId: string; substituidoPor: string // elo entre a movimentação original e a corrigida
  criadoEm: string
}

type Efeito = Partial<Record<'entregue' | 'utilizada' | 'comprometida' | 'solicitada', number>>

export function efeito(m: Movimento): Efeito {
  const q = m.quantidade
  switch (m.tipo) {
    case 'solicitacao': return { solicitada: q }
    case 'recebimento': return { entregue: q }
    case 'devolucao': return { entregue: -q }
    case 'reserva': return { comprometida: q }
    case 'cancelamento-reserva': return { comprometida: -q }
    case 'consumo': return m.converteReserva ? { utilizada: q, comprometida: -q } : { utilizada: q }
    case 'ajuste-inventario': return { entregue: q }
    default: return {}
  }
}

/** Posição efetiva = posição base do cadastro/importação + movimentações ATIVAS. Corrigidas e canceladas não contam. */
export function aplicarMovimentos(m: Material, movs: Movimento[]): Material {
  const r = { ...m }
  for (const mv of movs) {
    if (mv.status !== 'ativa') continue
    const e = efeito(mv)
    r.quantidadeSolicitada += e.solicitada ?? 0; r.quantidadeEntregue += e.entregue ?? 0
    r.quantidadeUtilizada += e.utilizada ?? 0; r.quantidadeComprometida += e.comprometida ?? 0
  }
  return r
}

const mesmaObra = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Quantidade ainda reservada para a obra (reservas − cancelamentos − consumos que converteram reserva). */
export function reservadoPorObra(movs: Movimento[], obra: string): number {
  let r = 0
  for (const m of movs) {
    if (m.status !== 'ativa' || !mesmaObra(m.obra, obra)) continue
    if (m.tipo === 'reserva') r += m.quantidade
    else if (m.tipo === 'cancelamento-reserva') r -= m.quantidade
    else if (m.tipo === 'consumo' && m.converteReserva) r -= m.quantidade
  }
  return r
}

/** `erros` impedem salvar; `avisos` exigem justificativa escrita do usuário (nunca bloqueiam em silêncio). */
export function validarMovimento(base: Material, ativos: Movimento[], novo: Movimento): { erros: string[]; avisos: string[] } {
  const erros: string[] = [], avisos: string[] = []
  if (!Number.isFinite(novo.quantidade) || (novo.tipo === 'ajuste-inventario' ? novo.quantidade === 0 : novo.quantidade <= 0)) erros.push('Informe uma quantidade válida.')
  if (['reserva', 'cancelamento-reserva', 'consumo'].includes(novo.tipo) && !novo.obra.trim()) erros.push('Informe a obra.')
  if (erros.length) return { erros, avisos }
  const depois = aplicarMovimentos(base, [...ativos, novo])
  const ata = (base.quantidadeRegistrada ?? 0) + (base.aditivo ?? 0)
  const fis = depois.quantidadeEntregue - depois.quantidadeUtilizada - depois.quantidadeComprometida
  if (fis < 0) avisos.push(`O saldo físico disponível ficaria negativo (${fis.toLocaleString('pt-BR')}).`)
  if (depois.quantidadeComprometida < 0) avisos.push('A quantidade comprometida ficaria negativa.')
  if (depois.quantidadeEntregue < 0) avisos.push('A quantidade recebida ficaria negativa.')
  if (novo.tipo === 'solicitacao' && depois.quantidadeSolicitada > ata) avisos.push('A solicitação ultrapassa o saldo da ata (registrada + aditivo).')
  if (novo.tipo === 'recebimento' && depois.quantidadeEntregue > depois.quantidadeSolicitada && depois.quantidadeSolicitada > 0) avisos.push('O recebimento ultrapassa a quantidade solicitada.')
  if (novo.tipo === 'recebimento' && depois.quantidadeEntregue > ata) avisos.push('O recebimento ultrapassa a quantidade contratada.')
  if (novo.tipo === 'consumo' && novo.converteReserva && novo.quantidade > reservadoPorObra(ativos, novo.obra)) avisos.push('O consumo ultrapassa a quantidade reservada para esta obra.')
  return { erros, avisos }
}

export const corrigir = (antigo: Movimento, novo: Movimento): Movimento[] => [{ ...antigo, status: 'corrigida', substituidoPor: novo.id }, { ...novo, corrigeId: antigo.id }]
export const cancelar = (m: Movimento): Movimento => ({ ...m, status: 'cancelada' })

export const movimentoVazio = (materialId: string, unidade: string, tipo: TipoMov = 'recebimento'): Movimento => ({
  id: uid(), materialId, tipo, quantidade: 0, unidade, data: new Date().toISOString().slice(0, 10), obra: '', documento: '', observacoes: '',
  justificativa: '', converteReserva: false, status: 'ativa', corrigeId: '', substituidoPor: '', criadoEm: new Date().toISOString(),
})
