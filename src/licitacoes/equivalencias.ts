import { listar, salvar } from './db'
import { sanearEquivalencias, type Equivalencia } from './cruzamento'

const ID = 'equivalencias'
/** As ligações ficam na tabela `meta` do banco local; assim entram no backup das licitações. */
export async function carregarEquivalencias(): Promise<Equivalencia[]> {
  const meta = await listar<{ id: string; itens?: unknown }>('meta')
  return sanearEquivalencias(meta.find((m) => m.id === ID)?.itens)
}
export const salvarEquivalencias = (itens: Equivalencia[]) => salvar('meta', { id: ID, itens } as { id: string })
