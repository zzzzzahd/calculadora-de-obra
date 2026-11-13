import type { Ambiente } from '../types'
import { toMetros } from './units'

/** Todas as funções retornam metros / metros² / metros³. */
export const ladosMetros = (a: Ambiente) => ({
  c: toMetros(a.comprimento, a.unidade),
  l: toMetros(a.largura, a.unidade),
})

/** Área = comprimento × largura */
export const areaAmbiente = (a: Ambiente): number => {
  const { c, l } = ladosMetros(a)
  return c * l
}

/** Perímetro = 2 × (comprimento + largura) */
export const perimetroAmbiente = (a: Ambiente): number => {
  const { c, l } = ladosMetros(a)
  return 2 * (c + l)
}

/** Área bruta de parede (sem descontar aberturas) = perímetro × altura */
export const areaParedeBruta = (a: Ambiente, alturaM: number): number => perimetroAmbiente(a) * alturaM
