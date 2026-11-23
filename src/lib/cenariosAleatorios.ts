/**
 * Cenários pseudoaleatórios (semente fixa) para testes de regressão do motor: combinam ambientes, obra e muitos
 * parâmetros ligados ao mesmo tempo, o que cobre todas as etapas. Só usa campos que já existiam no v24
 * (sem cadastro central), então a saída precisa ser idêntica à do v24.
 */
import type { Ambiente, Obra } from '../types'
import { PARAMS_PADRAO, type Params } from './engine'

export interface Cenario { obra: Obra; ambientes: Ambiente[]; params: Params }

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const EXCLUIDOS = new Set(['aberturas', 'composicoes'])
const CODIGOS = new Set(['fundTipo', 'escTipo', 'aditivoConc', 'aditivoArg', 'massaTipo', 'revFaces', 'faces'])

export function cenarioAleatorio(seed: number): Cenario {
  const r = mulberry32(seed)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: pick([2.6, 2.8, 3, 3.2]), unidadeAltura: 'm', pavimentos: pick([1, 1, 2, 3]), terreno: pick(['plano', 'inclinado'] as const), desnivel: r() < 0.3, movimentoTerra: pick(['nenhum', 'aterro', 'escavacao', 'ambos'] as const) }
  const n = 1 + Math.floor(r() * 4)
  const ambientes: Ambiente[] = Array.from({ length: n }, (_, i) => {
    const un = pick(['m', 'm', 'cm', 'mm'] as const), k = un === 'm' ? 1 : un === 'cm' ? 100 : 1000
    return { id: `a${i}`, nome: `Amb ${i + 1}`, comprimento: Math.round((2 + r() * 8) * 10) / 10 * k, largura: Math.round((2 + r() * 8) * 10) / 10 * k, unidade: un }
  })
  const params: Params = { ...PARAMS_PADRAO }
  const anyP = params as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(PARAMS_PADRAO)) {
    if (EXCLUIDOS.has(k) || typeof v !== 'number' || k.startsWith('demol') || k.startsWith('entulho')) continue
    if (r() < 0.45) continue // mantém o padrão
    if (CODIGOS.has(k)) { anyP[k] = Math.floor(r() * 4); continue }
    const f = pick([0, 0.5, 1, 1.5, 2, 3])
    anyP[k] = v === 0 ? Math.round((1 + r() * 9) * 100) / 100 * (f === 0 ? 0 : 1) : Math.round(v * f * 1000) / 1000
  }
  params.aberturas = Array.from({ length: Math.floor(r() * 4) }, (_, i) => ({ id: `ab${i}`, tipo: pick(['Porta', 'Janela'] as const), largura: pick([0.6, 0.8, 0.9, 1.2, 1.5]), altura: pick([1, 1.2, 2.1]), qtd: 1 + Math.floor(r() * 4) }))
  params.composicoes = Array.from({ length: Math.floor(r() * 3) }, (_, i) => ({ id: `c${i}`, nome: `Comp ${i}`, etapa: pick(['Acabamento', 'Outros']), unidade: 'un', base: pick(['area', 'parede', 'fixa'] as const), coef: Math.round((0.1 + r() * 3) * 100) / 100, perda: pick([0, 5, 10]) }))
  return { obra, ambientes, params }
}
