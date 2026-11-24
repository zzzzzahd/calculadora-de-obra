export type Unidade = 'm' | 'cm' | 'mm'

/** O que será feito com cada elemento. Ausente = construir (comportamento do v24). */
export type Acao = 'construir' | 'manter' | 'substituir' | 'demolir' | 'recuperar' | 'reaproveitar'
export const ACOES: Record<Acao, string> = {
  construir: 'Construir (novo)', manter: 'Manter (sem material)', substituir: 'Substituir (demolir e construir)',
  demolir: 'Demolir (gera entulho)', recuperar: 'Recuperar (sem material novo)', reaproveitar: 'Reaproveitar (sem compra)',
}
/** Constrói material novo? Demole (gera entulho)? */
export const constroi = (a: Acao | undefined) => a === undefined || a === 'construir' || a === 'substituir'
export const demole = (a: Acao | undefined) => a === 'demolir' || a === 'substituir'

/** Porta ou janela. `lado` (opcional) só vale para aberturas cadastradas dentro de um ambiente. */
export interface Abertura { id: string; tipo: 'Porta' | 'Janela'; largura: number; altura: number; qtd: number; lado?: LadoIdx; acao?: Acao }

/** Lados do ambiente: 0 e 2 são os de comprimento; 1 e 3 são os de largura. */
export type LadoIdx = 0 | 1 | 2 | 3
export const LADOS: { idx: LadoIdx; rotulo: string; eixo: 'comprimento' | 'largura' }[] = [
  { idx: 0, rotulo: 'Lado 1 (comprimento)', eixo: 'comprimento' },
  { idx: 1, rotulo: 'Lado 2 (largura)', eixo: 'largura' },
  { idx: 2, rotulo: 'Lado 3 (comprimento)', eixo: 'comprimento' },
  { idx: 3, rotulo: 'Lado 4 (largura)', eixo: 'largura' },
]

/** Lado compartilhado com outro ambiente. `trecho` (em metros) é o comprimento compartilhado; ausente = o lado inteiro.
 *  `acao` define o que será feito com a parede compartilhada; ausente = a dos ambientes (e aviso se divergirem). */
export interface Divisa { com: string; trecho?: number; acao?: Acao }

export type TipoAmbiente = 'sala' | 'quarto' | 'cozinha' | 'banheiro' | 'area_servico' | 'garagem' | 'varanda' | 'circulacao' | 'outro'
export const TIPOS_AMBIENTE: Record<TipoAmbiente, string> = {
  sala: 'Sala', quarto: 'Quarto', cozinha: 'Cozinha', banheiro: 'Banheiro', area_servico: 'Área de serviço',
  garagem: 'Garagem', varanda: 'Varanda', circulacao: 'Circulação', outro: 'Outro',
}

/** Piso: ausente = padrão do levantamento (contrapiso + peças). */
export type PisoTipo = 'ceramico' | 'porcelanato' | 'cimentado' | 'nenhum'
export const PISOS: Record<PisoTipo, string> = {
  ceramico: 'Cerâmico (contrapiso + peças)', porcelanato: 'Porcelanato (contrapiso + peças)',
  cimentado: 'Cimentado (só contrapiso)', nenhum: 'Nenhum (sem contrapiso nem piso)',
}
/** Revestimento das paredes internas: ausente = chapisco, emboço e pintura. */
export type RevParede = 'emboco_pintura' | 'ceramica' | 'nenhum'
export const REVESTIMENTOS: Record<RevParede, string> = {
  emboco_pintura: 'Chapisco, emboço e pintura', ceramica: 'Cerâmica até uma altura (acima, pintura)', nenhum: 'Sem revestimento nem pintura',
}

export interface Acabamento {
  piso?: PisoTipo
  revParede?: RevParede
  /** Altura do revestimento cerâmico, na unidade do ambiente (só com revParede = 'ceramica'). */
  alturaCeramica?: number
  /** true/false força o forro neste ambiente; ausente segue o parâmetro geral de forro. */
  forro?: boolean
}

/** O que será feito em cada elemento do ambiente (ausente = construir). */
export interface Acoes { paredes?: Acao; revestimento?: Acao; piso?: Acao; forro?: Acao }

/** Pontos hidráulicos de um ambiente. Só a contagem informada pelo usuário; tubos, conexões e diâmetros não são dimensionados aqui. */
export type PontoHidro = 'vaso' | 'lavatorio' | 'chuveiro' | 'pia' | 'tanque' | 'maquinaLavar' | 'torneira' | 'ralo' | 'caixaSifonada' | 'registro'
/** `agua`/`esgoto`: o ponto conta como ponto de água fria / de esgoto. `item`: aparece na lista como peça (ex.: Vaso sanitário). */
export const PONTOS_HIDRO: Record<PontoHidro, { rotulo: string; agua: boolean; esgoto: boolean; item?: string }> = {
  vaso: { rotulo: 'Vaso sanitário', agua: true, esgoto: true, item: 'Vaso sanitário' },
  lavatorio: { rotulo: 'Lavatório', agua: true, esgoto: true, item: 'Lavatório' },
  chuveiro: { rotulo: 'Chuveiro', agua: true, esgoto: false, item: 'Chuveiro' },
  pia: { rotulo: 'Pia', agua: true, esgoto: true, item: 'Pia' },
  tanque: { rotulo: 'Tanque', agua: true, esgoto: true, item: 'Tanque' },
  maquinaLavar: { rotulo: 'Máquina de lavar (ponto)', agua: true, esgoto: true },
  torneira: { rotulo: 'Torneira externa ou de jardim', agua: true, esgoto: false, item: 'Torneira' },
  ralo: { rotulo: 'Ralo', agua: false, esgoto: true, item: 'Ralo' },
  caixaSifonada: { rotulo: 'Caixa sifonada', agua: false, esgoto: true, item: 'Caixa sifonada' },
  registro: { rotulo: 'Registro', agua: false, esgoto: false, item: 'Registro' },
}
export type Pontos = Partial<Record<PontoHidro, number>>

export interface OrigemDados { fonte: 'manual' | 'planta' | 'texto' | 'importado'; confianca?: number; observacao?: string }

export interface Ambiente {
  id: string
  nome: string
  comprimento: number // valor digitado, na unidade escolhida
  largura: number
  unidade: Unidade
  // Cadastro central (todos opcionais: ausente = comportamento do v24)
  tipo?: TipoAmbiente
  /** Pé-direito na unidade do ambiente; ausente = altura das paredes da obra. */
  peDireito?: number
  /** Lados compartilhados com outros ambientes; lado ausente = parede externa. */
  divisas?: Partial<Record<LadoIdx, Divisa>>
  aberturas?: Abertura[]
  acabamento?: Acabamento
  acoes?: Acoes
  pontos?: Pontos
  origem?: OrigemDados
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
