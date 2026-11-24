/** Tipos do resultado do cálculo. */
export interface Composicao { id: string; nome: string; etapa: string; unidade: string; base: 'area' | 'parede' | 'fixa' | 'pontosAgua' | 'pontosEsgoto'; coef: number; perda: number }

/**
 * Conexão hidráulica detalhada, definida pelo usuário (nome, tipo e diâmetro ficam no texto do nome; nada é assumido).
 * Quantidade = Σ (pontos de cada tipo nos ambientes × conexões por ponto) + pontos gerais × coeficiente + quantidade fixa, × (1 + perda).
 */
export interface ConexaoHidro {
  id: string; nome: string; sistema: 'agua' | 'esgoto'
  porPonto: Partial<Record<import('../../types').PontoHidro, number>> // conexões por ponto de cada tipo de peça
  porPontoGeral: number // conexões por ponto geral (contadores gerais dos Parâmetros, sem ambiente)
  fixa: number; perda: number
}

export type TipoQuant = 'Geométrico' | 'Estimativa por composição'

export interface Item {
  etapa: string; material: string; unidade: string
  formula: string; dimensoes: string
  coef: string; perda: number
  bruto: number // resultado antes do arredondamento (já com perda)
  final: number // resultado final para compra
  tipo: TipoQuant
}
