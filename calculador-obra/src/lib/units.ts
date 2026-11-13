import type { Unidade } from '../types'

/** Fator de conversão de cada unidade para metros. */
export const FATOR_METROS: Record<Unidade, number> = { m: 1, cm: 0.01, mm: 0.001 }

export const toMetros = (valor: number, unidade: Unidade): number => valor * FATOR_METROS[unidade]
