export const CATEGORIAS = ['Cimento', 'Areia', 'Brita', 'Tijolos e blocos', 'Aço e ferragens', 'Madeiras', 'Telhas e coberturas', 'Argamassas', 'Revestimentos', 'Pisos', 'Tintas', 'Materiais elétricos', 'Materiais hidráulicos', 'Materiais sanitários', 'Impermeabilizantes', 'Ferramentas', 'Outros materiais'] as const

/** Campos não identificados ficam pendentes: texto vazio, ou null nos números. Datas no formato AAAA-MM-DD. */
export interface Processo {
  id: string
  tipo: 'ata' | 'contrato' | 'processo'
  numeroProcesso: string
  modalidade: string // ex.: Pregão Eletrônico 12/2026
  numeroInstrumento: string // número da ata ou do contrato
  ano: number | null
  fornecedor: string
  cnpj: string
  dataAssinatura: string
  vigenciaInicio: string
  vigenciaFim: string
  observacoes: string
}

export interface Material {
  id: string
  processoId: string
  lote: string
  item: string
  codigo: string
  nomePadronizado: string
  descricaoOriginal: string // texto exato da licitação, nunca sobrescrito pelo nome padronizado
  especificacao: string
  categoria: string
  marca: string
  unidadeFornecimento: string
  unidadeConsumo: string
  fator: number | null // unidades de consumo por unidade de fornecimento; só vale se confirmado (usado no Sprint 4)
  precoUnitario: number | null
  quantidadeRegistrada: number | null
  // Controlados por movimentações (Sprint 3); começam em zero
  quantidadeSolicitada: number
  quantidadeEntregue: number
  quantidadeUtilizada: number
  quantidadeComprometida: number
  observacoes: string
  // Campos vindos da planilha da Prefeitura (podem faltar em cadastros antigos: tratar como vazio)
  fornecedor: string // fornecedor do item (se vazio, vale o do processo)
  aditivo: number
  quantidadeLicitada: number | null
  disponivelPlanilha: number | null // referência: saldo da ata ainda não solicitado, NÃO é estoque físico
  valorPlanilha: number | null
}

export type Situacao = 'vigente' | 'a-vencer' | 'vencida' | 'futura' | 'sem-vigencia'
