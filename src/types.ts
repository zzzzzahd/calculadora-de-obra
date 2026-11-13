export type Unidade = 'm' | 'cm' | 'mm'

export interface Ambiente {
  id: string
  nome: string
  comprimento: number // valor digitado, na unidade escolhida
  largura: number
  unidade: Unidade
}

export interface Obra {
  nome: string
  tipo: string
  alturaParede: number
  unidadeAltura: Unidade
  pavimentos: number
  terreno: 'plano' | 'inclinado'
  desnivel: boolean
  movimentoTerra: 'nenhum' | 'aterro' | 'escavacao' | 'ambos'
}
