/**
 * MOTOR DE CÁLCULO — todas as fórmulas do sistema ficam neste arquivo.
 * Nenhum coeficiente é fixo: tudo vem de `Params` (editável na tela).
 * Medidas em metros; áreas em m²; volumes em m³.
 */
import type { Ambiente, Obra } from '../types'
import { areaAmbiente, areaParedeBruta } from './geometry'
import { toMetros } from './units'

export interface Abertura { id: string; tipo: 'Porta' | 'Janela'; largura: number; altura: number; qtd: number }

export interface Params {
  aberturas: Abertura[]
  // Alvenaria
  blocoC: number; blocoA: number; perdaBloco: number
  argM3m2: number; argCimentoKg: number; argAreiaM3: number; perdaArg: number
  // Contrapiso e piso
  espContrapisoCm: number; ctCimentoKg: number; ctAreiaM3: number; ctBritaM3: number; perdaConcreto: number
  pisoC: number; pisoL: number; perdaPiso: number
  // Pintura
  faces: number; demaos: number; rendTinta: number; latL: number
  // Compra
  sacoKg: number
}

export const PARAMS_PADRAO: Params = {
  aberturas: [],
  blocoC: 0.39, blocoA: 0.19, perdaBloco: 5,
  argM3m2: 0.012, argCimentoKg: 250, argAreiaM3: 1.1, perdaArg: 10,
  espContrapisoCm: 5, ctCimentoKg: 300, ctAreiaM3: 0.65, ctBritaM3: 0.85, perdaConcreto: 5,
  pisoC: 0.6, pisoL: 0.6, perdaPiso: 10,
  faces: 1, demaos: 2, rendTinta: 10, latL: 18,
  sacoKg: 50,
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

const fim = (n: number) => Math.ceil(n - 1e-9)
const com = (v: number, perdaPct: number) => v * (1 + perdaPct / 100)
const f2 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function areaAberturas(p: Params): number {
  return p.aberturas.reduce((s, a) => s + a.largura * a.altura * a.qtd, 0)
}

export function calcular(obra: Obra, ambientes: Ambiente[], p: Params): Item[] {
  const h = toMetros(obra.alturaParede, obra.unidadeAltura)
  const area1 = ambientes.reduce((s, a) => s + areaAmbiente(a), 0)
  const brutaParede = ambientes.reduce((s, a) => s + areaParedeBruta(a, h), 0) * obra.pavimentos
  const aberturas = areaAberturas(p)
  const liq = Math.max(0, brutaParede - aberturas)
  const itens: Item[] = []
  const add = (i: Omit<Item, 'final'>) => itens.push({ ...i, final: fim(i.bruto) })
  if (area1 <= 0) return itens

  // ALVENARIA
  const dimLiq = `parede bruta ${f2(brutaParede)} m² − aberturas ${f2(aberturas)} m² = ${f2(liq)} m²`
  const areaBloco = p.blocoC * p.blocoA
  if (liq > 0 && areaBloco > 0) {
    add({ etapa: 'Alvenaria', material: 'Bloco', unidade: 'un', tipo: 'Estimativa por composição',
      formula: 'área líquida ÷ (comprimento × altura do bloco) × (1 + perda)',
      dimensoes: `${dimLiq}; bloco ${p.blocoC}×${p.blocoA} m`, coef: `${f2(1 / areaBloco)} un/m²`, perda: p.perdaBloco,
      bruto: com(liq / areaBloco, p.perdaBloco) })
    const vol = com(liq * p.argM3m2, p.perdaArg)
    const d = `${dimLiq}; consumo ${p.argM3m2} m³/m²`
    add({ etapa: 'Alvenaria', material: 'Argamassa de assentamento', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'área líquida × consumo × (1 + perda)', dimensoes: d, coef: `${p.argM3m2} m³/m²`, perda: p.perdaArg, bruto: vol })
    add({ etapa: 'Alvenaria', material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição',
      formula: 'volume de argamassa × kg de cimento/m³ ÷ kg por saco', dimensoes: `argamassa ${f2(vol)} m³`,
      coef: `${p.argCimentoKg} kg/m³; saco ${p.sacoKg} kg`, perda: p.perdaArg, bruto: (vol * p.argCimentoKg) / p.sacoKg })
    add({ etapa: 'Alvenaria', material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'volume de argamassa × m³ de areia/m³', dimensoes: `argamassa ${f2(vol)} m³`,
      coef: `${p.argAreiaM3} m³/m³`, perda: p.perdaArg, bruto: vol * p.argAreiaM3 })
  }

  // CONTRAPISO E PISO
  const volC = com(area1 * (p.espContrapisoCm / 100), p.perdaConcreto)
  const dc = `área ${f2(area1)} m² × espessura ${p.espContrapisoCm} cm`
  if (volC > 0) {
    add({ etapa: 'Contrapiso e piso', material: 'Concreto do contrapiso', unidade: 'm³', tipo: 'Geométrico',
      formula: 'área × espessura × (1 + perda)', dimensoes: dc, coef: '—', perda: p.perdaConcreto, bruto: volC })
    add({ etapa: 'Contrapiso e piso', material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição',
      formula: 'volume × kg de cimento/m³ ÷ kg por saco', dimensoes: `concreto ${f2(volC)} m³`,
      coef: `${p.ctCimentoKg} kg/m³; saco ${p.sacoKg} kg`, perda: p.perdaConcreto, bruto: (volC * p.ctCimentoKg) / p.sacoKg })
    add({ etapa: 'Contrapiso e piso', material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'volume × m³ de areia/m³', dimensoes: `concreto ${f2(volC)} m³`, coef: `${p.ctAreiaM3} m³/m³`, perda: p.perdaConcreto, bruto: volC * p.ctAreiaM3 })
    add({ etapa: 'Contrapiso e piso', material: 'Brita', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'volume × m³ de brita/m³', dimensoes: `concreto ${f2(volC)} m³`, coef: `${p.ctBritaM3} m³/m³`, perda: p.perdaConcreto, bruto: volC * p.ctBritaM3 })
  }
  if (p.pisoC > 0 && p.pisoL > 0) {
    const areaPiso = com(area1, p.perdaPiso)
    add({ etapa: 'Contrapiso e piso', material: 'Piso (área)', unidade: 'm²', tipo: 'Geométrico',
      formula: 'área × (1 + perda)', dimensoes: `área ${f2(area1)} m²`, coef: '—', perda: p.perdaPiso, bruto: areaPiso })
    add({ etapa: 'Contrapiso e piso', material: 'Piso (peças)', unidade: 'un', tipo: 'Geométrico',
      formula: 'área com perda ÷ (comprimento × largura da peça)', dimensoes: `área ${f2(areaPiso)} m²; peça ${p.pisoC}×${p.pisoL} m`,
      coef: `${f2(1 / (p.pisoC * p.pisoL))} un/m²`, perda: p.perdaPiso, bruto: areaPiso / (p.pisoC * p.pisoL) })
  }

  // PINTURA
  if (liq > 0 && p.rendTinta > 0 && p.latL > 0) {
    const areaP = liq * p.faces
    const litros = (areaP * p.demaos) / p.rendTinta
    add({ etapa: 'Pintura', material: 'Tinta', unidade: 'lata', tipo: 'Estimativa por composição',
      formula: 'área líquida × faces × demãos ÷ rendimento ÷ litros da lata',
      dimensoes: `${f2(liq)} m² × ${p.faces} face(s) × ${p.demaos} demão(s); ${f2(litros)} L`,
      coef: `${p.rendTinta} m²/L/demão; lata ${p.latL} L`, perda: 0, bruto: litros / p.latL })
  }
  return itens
}

/** Lista de compras: soma o bruto de materiais repetidos (mesmo nome e unidade) e só então arredonda. */
export function consolidar(itens: Item[]) {
  const m = new Map<string, { material: string; unidade: string; etapas: Set<string>; bruto: number }>()
  for (const i of itens) {
    const k = `${i.material}|${i.unidade}`
    const e = m.get(k) ?? { material: i.material, unidade: i.unidade, etapas: new Set<string>(), bruto: 0 }
    e.bruto += i.bruto; e.etapas.add(i.etapa); m.set(k, e)
  }
  return [...m.values()].map((e) => ({ ...e, etapas: [...e.etapas].join(', '), final: fim(e.bruto) }))
}
