/** Tipos do resultado do cálculo. */
export interface Composicao { id: string; nome: string; etapa: string; unidade: string; base: 'area' | 'parede' | 'fixa'; coef: number; perda: number }

export type TipoQuant = 'Geométrico' | 'Estimativa por composição'

export interface Item {
  etapa: string; material: string; unidade: string
  formula: string; dimensoes: string
  coef: string; perda: number
  bruto: number // resultado antes do arredondamento (já com perda)
  final: number // resultado final para compra
  tipo: TipoQuant
}
