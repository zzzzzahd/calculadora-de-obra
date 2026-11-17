import type { Params } from './engine'

/** Opções de escolha: preenchem parâmetros que continuam editáveis. Valores usuais de exemplo; confira com o fabricante. */
export type Preset = Partial<Params> & { nome: string }

export const TELHAS: Preset[] = [
  { nome: 'Cerâmica romana/portuguesa', telhaRend: 16, inclinacao: 30, telhaMetalica: 0 },
  { nome: 'Cerâmica colonial (capa e canal)', telhaRend: 25, inclinacao: 30, telhaMetalica: 0 },
  { nome: 'Concreto', telhaRend: 10.5, inclinacao: 30, telhaMetalica: 0 },
  { nome: 'Fibrocimento 6 mm (chapa 1,10 × 2,44 m)', telhaRend: 0.42, inclinacao: 10, telhaMetalica: 0 },
  { nome: 'Metálica trapezoidal (por m²)', telhaMetalica: 1, inclinacao: 10 },
]
export const BLOCOS: Preset[] = [
  { nome: 'Cerâmico 9 × 19 × 19', blocoC: 0.19, blocoA: 0.19, vergaL: 0.09 },
  { nome: 'Cerâmico 14 × 19 × 39', blocoC: 0.39, blocoA: 0.19, vergaL: 0.14 },
  { nome: 'Concreto 14 × 19 × 39', blocoC: 0.39, blocoA: 0.19, vergaL: 0.14 },
  { nome: 'Concreto 19 × 19 × 39', blocoC: 0.39, blocoA: 0.19, vergaL: 0.19 },
]
export const PISOS: Preset[] = [
  { nome: '45 × 45 cm', pisoC: 0.45, pisoL: 0.45 },
  { nome: '60 × 60 cm', pisoC: 0.6, pisoL: 0.6 },
  { nome: '80 × 80 cm', pisoC: 0.8, pisoL: 0.8 },
  { nome: '90 × 90 cm', pisoC: 0.9, pisoL: 0.9 },
]
