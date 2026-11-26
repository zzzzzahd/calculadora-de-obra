import { listar, substituirTudo } from './db'
import { carregarEquivalencias } from './equivalencias'
import type { Licitacoes } from '../lib/backup'
import type { Material, Processo } from './tipos'
import type { Movimento } from './movimentos'

/** Lê tudo das licitações (para o backup). */
export async function lerLicitacoes(): Promise<Licitacoes> {
  const [processos, materiais, movimentos, equivalencias] = await Promise.all([listar<Processo>('processos'), listar<Material>('materiais'), listar<Movimento>('movimentos'), carregarEquivalencias()])
  return { processos, materiais, movimentos, equivalencias }
}

/** Substitui as licitações atuais pelas do backup (já validadas), de forma atômica. As ligações antigas da lista de compras são trocadas junto. */
export const restaurarLicitacoes = (l: Licitacoes) =>
  substituirTudo({ processos: l.processos, materiais: l.materiais, movimentos: l.movimentos, meta: [{ id: 'equivalencias', itens: l.equivalencias } as { id: string }] })
