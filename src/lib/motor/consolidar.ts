import { fim } from './contexto'
import type { Item } from './tipos'

/** Lista de compras: soma o bruto de materiais repetidos (mesmo nome e unidade) e só então arredonda. */
export function consolidar(itens: Item[]) {
  const m = new Map<string, { material: string; unidade: string; etapas: Set<string>; bruto: number }>()
  for (const i of itens) {
    const k = `${i.material}|${i.unidade}`
    const e = m.get(k) ?? { material: i.material, unidade: i.unidade, etapas: new Set<string>(), bruto: 0 }
    e.bruto += i.bruto; e.etapas.add(i.etapa); m.set(k, e)
  }
  return [...m.values()].map((e) => ({ ...e, etapas: [...e.etapas].join(', '), final: fim(e.bruto) }))
}
