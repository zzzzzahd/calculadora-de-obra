import type { Ambiente, Obra } from '../types'
import type { Params } from './engine'

/** Respostas do assistente: decidem o que é perguntado e o que entra no cálculo. */
export interface Flags {
  fundacao: boolean; estrutura: boolean; projetoAco: boolean; cobertura: boolean; calha: boolean; forro: boolean
  laje: boolean; imper: boolean; muro: boolean; calcada: boolean; escada: boolean; prelaje: boolean; fossa: boolean; piscina: boolean; drywall: boolean; metalica: boolean; madeira: boolean; revest: boolean; pintura: boolean; duasCores: boolean; eletrica: boolean; hidraulica: boolean; drenagem: boolean
}

const soma = (...n: number[]) => n.reduce((a, b) => a + b, 0)
const temPontosEl = (ambientes: Ambiente[]) => ambientes.some((a) => Object.values(a.pontosEl ?? {}).some((v) => typeof v === 'number' && v > 0))
const temPontos = (ambientes: Ambiente[]) => ambientes.some((a) => Object.values(a.pontos ?? {}).some((v) => typeof v === 'number' && v > 0))

/**
 * Dados do cadastro de ambientes que o cálculo usa mesmo com a resposta "Não" nas perguntas gerais: o que foi cadastrado de
 * forma explícita num ambiente vale. Devolve avisos para o usuário conferir (ou apagar o dado no ambiente).
 */
export function avisosDeFlags(ambientes: Ambiente[], f: Flags): string[] {
  const av: string[] = []
  if (!f.hidraulica && temPontos(ambientes)) av.push('Você respondeu "Não" para a instalação hidráulica, mas há pontos hidráulicos cadastrados nos ambientes: eles continuam sendo calculados. Para tirá-los, apague os pontos nos ambientes.')
  if (!f.eletrica && temPontosEl(ambientes)) av.push('Você respondeu "Não" para a instalação elétrica, mas há pontos elétricos cadastrados nos ambientes: eles continuam sendo calculados. Para tirá-los, apague os pontos nos ambientes.')
  if (!f.forro && ambientes.some((a) => a.acabamento?.forro === true)) av.push('Você respondeu "Não" para o forro, mas há ambientes marcados "Com forro": eles continuam sendo calculados.')
  if (!f.revest && ambientes.some((a) => a.acabamento?.revParede === 'ceramica')) av.push('Você respondeu "Não" para chapisco e emboço, mas há ambientes com revestimento cerâmico de parede: a cerâmica continua sendo calculada.')
  return av
}

/** Parte dos parâmetros já preenchidos (salvos no navegador) para não esconder o que o usuário já informou. */
export const flagsIniciais = (p: Params, ambientes: Ambiente[] = []): Flags => ({
  fundacao: p.fundComp > 0 || p.radierArea > 0 || p.sapN > 0 || p.estN > 0, estrutura: p.pilarN > 0 || p.vigaComp > 0, projetoAco: p.acoKgM3 > 0,
  laje: p.lajeArea > 0, imper: p.imperArea > 0, muro: p.muroComp > 0, calcada: p.calcArea > 0, escada: p.escLarg > 0 && p.escAlt > 0, prelaje: p.preLajeArea > 0, fossa: (p.fosCompr > 0 && p.fosLarg > 0) || p.sumDiam > 0, piscina: p.pisC > 0 && p.pisL > 0, drywall: p.dwComp > 0 || p.dwForroArea > 0, metalica: p.metComp > 0, madeira: p.madComp > 0, cobertura: p.roofC > 0 && p.roofL > 0, calha: p.calha > 0, forro: p.forro > 0, revest: true, pintura: true, duasCores: p.cor2Pct > 0,
  eletrica: soma(p.eltTomadas, p.eltInterruptores, p.eltPontosLuz, p.eltDisjuntores) > 0 || temPontosEl(ambientes),
  hidraulica: soma(p.hidPontosAgua, p.sanPontos, p.hidRegistros, p.caixasSifonadas, p.ralos, p.caixasInspecao, p.vasos, p.lavatorios, p.pias, p.chuveiros, p.reservatorios) > 0 || temPontos(ambientes),
  drenagem: soma(p.drenTuboM, p.drenCaixas, p.drenRalos, p.canaletaM) > 0,
})

/** Parâmetros efetivos: o que foi respondido "não" não entra no cálculo. */
export function aplicarFlags(p: Params, f: Flags): Params {
  const q = { ...p }
  if (!f.fundacao) { q.fundComp = 0; q.radierArea = 0; q.sapN = 0; q.estN = 0 }
  if (!f.drywall) { q.dwComp = 0; q.dwForroArea = 0 }
  if (!f.metalica) q.metComp = 0
  if (!f.madeira) q.madComp = 0
  if (!f.estrutura) { q.pilarN = 0; q.vigaComp = 0 }
  if (!f.projetoAco || (!f.fundacao && !f.estrutura)) q.acoKgM3 = 0
  if (!f.cobertura) { q.roofC = 0; q.roofL = 0 }
  q.calha = f.cobertura && f.calha ? 1 : 0
  if (!(f.cobertura && f.calha)) { q.condutorN = 0; q.rufoM = 0 }
  q.forro = f.forro ? 1 : 0
  if (!f.laje) q.lajeArea = 0
  if (!f.muro) q.muroComp = 0
  if (!f.prelaje) q.preLajeArea = 0
  if (!f.fossa) { q.fosCompr = 0; q.sumDiam = 0 }
  if (!f.piscina) { q.pisC = 0; q.pisL = 0 }
  if (!f.calcada) q.calcArea = 0
  if (!f.escada) { q.escLarg = 0; q.escAlt = 0 }
  if (!f.imper) { q.imperArea = 0; q.imperBaldrame = 0 }
  if (!f.revest) { q.revFaces = 0; q.cerArea = 0 }
  if (!f.pintura) q.faces = 0
  if (!f.duasCores) q.cor2Pct = 0
  if (!f.eletrica) { q.eltTomadas = 0; q.eltInterruptores = 0; q.eltPontosLuz = 0; q.eltDisjuntores = 0; q.itensEl = q.itensEl.map((x) => ({ ...x, fixa: 0 })) } // a quantidade fixa não depende do cadastro
  if (!f.hidraulica) q.conexoes = q.conexoes.map((c) => ({ ...c, fixa: 0, porPontoGeral: 0 })) // coeficientes sem ligação com o cadastro de ambientes
  if (!f.hidraulica) Object.assign(q, { hidPontosAgua: 0, sanPontos: 0, hidRegistros: 0, caixasSifonadas: 0, ralos: 0, caixasInspecao: 0, vasos: 0, lavatorios: 0, pias: 0, chuveiros: 0, reservatorios: 0 })
  if (!f.drenagem) Object.assign(q, { drenTuboM: 0, drenCaixas: 0, drenRalos: 0, canaletaM: 0 })
  return q
}

export const PERGUNTAS: { k: keyof Flags; texto: string; quando?: (f: Flags) => boolean }[] = [
  { k: 'fundacao', texto: 'Há fundação com dimensões conhecidas (baldrame, sapata, radier)?' },
  { k: 'estrutura', texto: 'A construção terá pilares e vigas?' },
  { k: 'projetoAco', texto: 'Existe projeto de armadura (taxa de aço)?', quando: (f) => f.fundacao || f.estrutura },
  { k: 'cobertura', texto: 'Haverá telhado?' },
  { k: 'calha', texto: 'Haverá calhas, condutores ou rufos?', quando: (f) => f.cobertura },
  { k: 'laje', texto: 'Haverá laje maciça?' },
  { k: 'imper', texto: 'Haverá impermeabilização (banheiros, baldrame, laje)?' },
  { k: 'muro', texto: 'Haverá muro de fechamento?' },
  { k: 'calcada', texto: 'Haverá calçada ou área externa concretada?' },
  { k: 'escada', texto: 'Haverá escada de concreto?' },
  { k: 'drywall', texto: 'Haverá paredes ou forro de drywall/gesso?' },
  { k: 'metalica', texto: 'Haverá estrutura metálica?' },
  { k: 'madeira', texto: 'Haverá estrutura de madeira (além do telhado)?' },
  { k: 'prelaje', texto: 'Haverá laje pré-moldada (vigotas e lajotas)?' },
  { k: 'fossa', texto: 'Haverá fossa séptica e sumidouro?' },
  { k: 'piscina', texto: 'Haverá piscina?' },
  { k: 'revest', texto: 'Haverá chapisco e emboço/reboco?' },
  { k: 'forro', texto: 'Haverá forro?' },
  { k: 'pintura', texto: 'Haverá pintura?' },
  { k: 'duasCores', texto: 'Usará duas cores de tinta?', quando: (f) => f.pintura },
  { k: 'eletrica', texto: 'Haverá instalações elétricas?' },
  { k: 'hidraulica', texto: 'Haverá instalações hidráulicas e sanitárias?' },
  { k: 'drenagem', texto: 'Haverá drenagem?' },
]

export function grupoVisivel(titulo: string, f: Flags, obra: Obra): boolean {
  if (titulo.startsWith('Terreno')) return obra.movimentoTerra !== 'nenhum'
  if (titulo.startsWith('Fundação')) return f.fundacao
  if (titulo.startsWith('Gesso')) return f.drywall
  if (titulo.startsWith('Estrutura metálica')) return f.metalica
  if (titulo.startsWith('Estrutura de madeira')) return f.madeira
  if (titulo.startsWith('Estrutura')) return f.fundacao || f.estrutura
  if (titulo.startsWith('Laje pré')) return f.prelaje
  if (titulo.startsWith('Fossa')) return f.fossa
  if (titulo.startsWith('Piscina')) return f.piscina
  if (titulo.startsWith('Laje')) return f.laje
  if (titulo.startsWith('Impermeabilização')) return f.imper
  if (titulo.startsWith('Muro')) return f.muro
  if (titulo.startsWith('Calçada')) return f.calcada
  if (titulo.startsWith('Escada')) return f.escada
  if (titulo.startsWith('Formas')) return f.fundacao || f.estrutura || f.laje || f.muro || f.escada || f.piscina
  if (titulo.startsWith('Revestimentos')) return f.revest || f.forro
  if (titulo.startsWith('Instalações elétricas')) return f.eletrica
  if (titulo.startsWith('Hidráulica')) return f.hidraulica
  if (titulo.startsWith('Drenagem')) return f.drenagem
  if (titulo === 'Pintura') return f.pintura
  return true
}

const REV = ['revFaces', 'espChapCm', 'chapCimentoKg', 'chapAreiaM3', 'espEmbCm', 'embCimentoKg', 'embAreiaM3', 'perdaRev', 'cerArea']
const FORRO = ['perdaForro', 'espPerfil', 'barraPerfilM']
const CALHA = ['calhaBarraM', 'condutorN', 'condutorAltM', 'condutorBarraM', 'rufoM']
const ESTR = ['pilarN', 'pilarL', 'pilarB', 'vigaComp', 'vigaL', 'vigaH']

export function campoVisivel(k: string, f: Flags, p: Params): boolean {
  if (k === 'forro' || k === 'calha') return false // controlados pelas perguntas
  if (k === 'escTipo') return false
  if (k === 'escFolga') return p.escTipo === 2
  if (k === 'fundTipo') return false // escolhido na pergunta "Tipo de fundação"
  if (['fundComp', 'fundLarg', 'fundAlt'].includes(k)) return p.fundTipo === 0
  if (['radierArea', 'radierEsp', 'fundPerim', 'radierTela'].includes(k)) return p.fundTipo === 1
  if (['sapN', 'sapL', 'sapB', 'sapH'].includes(k)) return p.fundTipo === 2
  if (['estN', 'estDiam', 'estProf'].includes(k)) return p.fundTipo === 3
  if (k === 'sobreMetal') return p.telhaMetalica > 0
  if (k === 'acoKgM3') return f.projetoAco
  if (k === 'cor2Pct') return f.duasCores
  if (k === 'cumeeiraM') return p.aguas === 2 || p.aguas === 4 || p.espigaoExtraM > 0
  if (CALHA.includes(k)) return f.calha
  if (FORRO.includes(k)) return f.forro
  if (REV.includes(k)) return f.revest
  if (ESTR.includes(k)) return f.estrutura
  return true
}
