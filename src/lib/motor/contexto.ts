/**
 * Contexto compartilhado das etapas do cálculo: valores derivados do levantamento (cadastro central), o acumulador de itens
 * e os ajudantes usados por várias etapas (concreto, formas, texto de área). Cada etapa recebe o contexto e só acrescenta itens.
 */
import { constroi, type Abertura, type Ambiente, type Obra } from '../../types'
import { resolverLevantamento, todasAberturas, type Levantamento } from '../paredes'
import type { Params } from '../params'
import { toMetros } from '../units'
import type { Item } from './tipos'

/** Arredonda para cima, com tolerância de ponto flutuante (ex.: 3,0000000001 vira 3, não 4). */
export const fim = (n: number) => Math.ceil(n - 1e-9)
/** Aplica a perda (%) a uma quantidade. */
export const com = (v: number, perdaPct: number) => v * (1 + perdaPct / 100)
export const f2 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/** Estado acumulado durante o cálculo (cimento por escopo para os aditivos, área de forma para o escoramento). */
export interface Estado { cimConcKg: number; cimArgKg: number; formaTotal: number }

export interface Ctx {
  obra: Obra; ambientes: Ambiente[]; p: Params
  h: number // altura das paredes da obra (m)
  lev: Levantamento // levantamento resolvido: paredes, faces, aberturas, pisos, ações
  area1: number // área construída de 1 pavimento (m²)
  brutaParede: number; aberturas: number; liq: number // alvenaria a construir: bruta, aberturas e líquida (m²)
  abertTodas: Abertura[] // aberturas que serão compradas (construir ou substituir)
  itens: Item[]; estado: Estado
  add: (i: Omit<Item, 'final'>) => void
  conc: (etapa: string, nome: string, vol: number, dim: string) => void
  forma: (etapa: string, a: number, dim: string) => void
  sufArea: (a: number) => string
}

export function criarContexto(obra: Obra, ambientes: Ambiente[], p: Params): Ctx {
  const h = toMetros(obra.alturaParede, obra.unidadeAltura)
  // Cadastro central: tudo que depende de paredes, aberturas, pé-direito e acabamentos vem deste levantamento resolvido
  const lev = resolverLevantamento(obra, ambientes, p.aberturas)
  const area1 = lev.area1
  const brutaParede = lev.alvConstruirBruta // paredes a construir (todas, se não houver ações no cadastro)
  const aberturas = lev.descAlvConstruir
  const liq = lev.alvLiquida
  const abertTodas = todasAberturas(ambientes, p.aberturas).filter((a) => constroi(a.acao)) // só o que será comprado (construir ou substituir)
  const itens: Item[] = []
  const estado: Estado = { cimConcKg: 0, cimArgKg: 0, formaTotal: 0 }
  const add = (i: Omit<Item, 'final'>) => {
    if (!(i.bruto > 0)) return
    if (i.material === 'Cimento' && i.unidade === 'saco') { const kg = i.bruto * p.sacoKg; if (i.etapa === 'Revestimentos' || /argamassa/.test(i.formula)) estado.cimArgKg += kg; else estado.cimConcKg += kg }
    itens.push({ ...i, final: fim(i.bruto) })
  }
  // Ajudantes de concreto e formas, usados por fundação, muro, escada, lajes, fossa e piscina
  const conc = (etapa: string, nome: string, vol: number, dim: string) => {
    if (vol <= 0) return
    const v = com(vol, p.perdaConcreto), d = `${dim}; concreto com perda ${f2(v)} m³`
    add({ etapa, material: nome, unidade: 'm³', tipo: 'Geométrico', formula: 'volume das peças × (1 + perda)', dimensoes: dim, coef: '—', perda: p.perdaConcreto, bruto: v })
    const c = (material: string, unidade: string, bruto: number, coef: string) =>
      add({ etapa, material, unidade, tipo: 'Estimativa por composição', formula: `volume de concreto × ${coef}`, dimensoes: d, coef, perda: p.perdaConcreto, bruto })
    c('Cimento', 'saco', (v * p.estCimentoKg) / p.sacoKg, `${p.estCimentoKg} kg/m³ ÷ ${p.sacoKg} kg/saco`)
    c('Areia', 'm³', v * p.estAreiaM3, `${p.estAreiaM3} m³/m³`)
    c('Brita', 'm³', v * p.estBritaM3, `${p.estBritaM3} m³/m³`)
    if (p.acoKgM3 > 0)
      add({ etapa, material: 'Aço (taxa informada do projeto)', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'volume líquido × taxa de aço informada', dimensoes: `${f2(vol)} m³`, coef: `${p.acoKgM3} kg/m³`, perda: 0, bruto: vol * p.acoKgM3 })
  }
  const forma = (etapa: string, a: number, dim: string) => { if (a > 0) { estado.formaTotal += a; add({ etapa, material: 'Forma (área de contato)', unidade: 'm²', tipo: 'Geométrico', formula: 'área das faces concretadas', dimensoes: dim, coef: '—', perda: 0, bruto: a }) } }
  const sufArea = (a: number) => (Math.abs(a - area1) < 1e-9 ? '' : ` (de ${f2(area1)} m² construídos)`)
  return { obra, ambientes, p, h, lev, area1, brutaParede, aberturas, liq, abertTodas, itens, estado, add, conc, forma, sufArea }
}
