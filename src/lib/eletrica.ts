/**
 * Pontos elétricos do levantamento: soma dos pontos cadastrados nos ambientes com os contadores gerais dos Parâmetros
 * (tomadas = uso geral, interruptores, pontos de luz). Só contagem; condutores, eletrodutos e quadros vêm de itens com
 * coeficientes informados pelo usuário. Nada da NBR 5410 (mínimos de pontos, circuitos, bitolas) é assumido.
 */
import { PONTOS_EL, type Ambiente, type PontoEl } from '../types'
import type { Params } from './params'
import type { ItemEletrico } from './motor/tipos'

export const TIPOS_EL = Object.keys(PONTOS_EL) as PontoEl[]
const qtd = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const coef = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

export interface TotaisEl {
  tomadas: number; interruptores: number; pontosLuz: number // total (ambientes + Parâmetros)
  tomadasAmb: number; interruptoresAmb: number; pontosLuzAmb: number // só dos ambientes
  porTipo: Record<PontoEl, number> // ambientes + gerais (gerais entram como uso geral, interruptor e ponto de luz)
  porAmbiente: { id: string; nome: string; total: number }[]
}

export function totaisEl(ambientes: Ambiente[], p: Pick<Params, 'eltTomadas' | 'eltInterruptores' | 'eltPontosLuz'>): TotaisEl {
  const amb = { tug: 0, tue: 0, interruptor: 0, pontoLuz: 0 } as Record<PontoEl, number>
  const porAmbiente = ambientes.map((a) => {
    let total = 0
    for (const t of TIPOS_EL) { const n = qtd(a.pontosEl?.[t]); amb[t] += n; total += n }
    return { id: a.id, nome: a.nome, total }
  })
  const tomadasAmb = amb.tug + amb.tue
  return {
    tomadas: p.eltTomadas + tomadasAmb, interruptores: p.eltInterruptores + amb.interruptor, pontosLuz: p.eltPontosLuz + amb.pontoLuz,
    tomadasAmb, interruptoresAmb: amb.interruptor, pontosLuzAmb: amb.pontoLuz,
    porTipo: { tug: p.eltTomadas + amb.tug, tue: amb.tue, interruptor: p.eltInterruptores + amb.interruptor, pontoLuz: p.eltPontosLuz + amb.pontoLuz },
    porAmbiente,
  }
}

/** Texto curto dos pontos elétricos de um ambiente (ex.: "tomada de uso geral 4; interruptor 1"); vazio se não há. */
export function descreverPontosEl(a: Ambiente): string {
  return TIPOS_EL.flatMap((t) => { const n = qtd(a.pontosEl?.[t]); return n ? [`${PONTOS_EL[t].rotulo.toLowerCase()} ${n}`] : [] }).join('; ')
}

/** Quantidade de um item elétrico detalhado (sem perda) e a conta por extenso. */
export function quantidadeItemEl(it: ItemEletrico, th: TotaisEl): { qtd: number; partes: string[] } {
  let q = 0; const partes: string[] = []
  for (const t of TIPOS_EL) {
    const c = coef(it.porPonto[t]), n = th.porTipo[t]
    if (!c || !n) continue
    q += n * c; partes.push(`${PONTOS_EL[t].rotulo.toLowerCase()} ${n} × ${c}`)
  }
  const f = coef(it.fixa)
  if (f) { q += f; partes.push(`fixa ${f}`) }
  return { qtd: q, partes }
}

export const SUBSTITUI: Record<NonNullable<ItemEletrico['substitui']>, string> = {
  eletroduto: 'Eletroduto (barras)', cabo: 'Cabo (bitola conforme projeto)', caixa42: 'Caixa 4×2', caixaOctogonal: 'Caixa octogonal',
}

/** Nomes de itens comuns, só para facilitar a criação das linhas: sem bitola, material nem quantidade (tudo começa em zero). */
export const ITENS_EL_COMUNS = ['Eletroduto', 'Cabo (bitola conforme projeto)', 'Caixa 4×2', 'Caixa octogonal', 'Espelho 4×2', 'Módulo de tomada', 'Módulo de interruptor', 'Luva de eletroduto', 'Curva de eletroduto', 'Fita isolante']
