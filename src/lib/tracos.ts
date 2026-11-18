import type { Params } from './engine'

/** Traços pré-definidos (em volume). Os consumos são ESTIMADOS a partir do traço e continuam editáveis nos parâmetros. */
export type Preset = Partial<Params> & { nome: string }
export interface GrupoTraco { chave: string; rotulo: string; lista: Preset[]; resumo: (p: Params) => string }

const RHO_CIMENTO = 1400 // kg/m³ (massa unitária usual)
const RHO_CAL = 600 // kg/m³
const concreto = (a: number, b: number) => { const v = 1.35 / (1 + a + b); return { cim: Math.round(v * RHO_CIMENTO), are: +(a * v).toFixed(3), bri: +(b * v).toFixed(3) } }
const argamassa = (c: number, a: number) => { const v = 1.3 / (1 + c + a); return { cim: Math.round(v * RHO_CIMENTO), cal: Math.round(c * v * RHO_CAL), are: +(a * v).toFixed(3) } }
const tr = (nome: string, a: number, b: number) => `${nome} (1:${a}:${b})`.replace(/\./g, ',')

const concEst = (a: number, b: number): Preset => { const c = concreto(a, b); return { nome: tr('Concreto', a, b), estCimentoKg: c.cim, estAreiaM3: c.are, estBritaM3: c.bri } }
const concCt = (a: number, b: number, rot = 'Concreto'): Preset => { const c = concreto(a, b); return { nome: tr(rot, a, b), ctCimentoKg: c.cim, ctAreiaM3: c.are, ctBritaM3: c.bri } }
const nomeArg = (rot: string, c: number, a: number) => (c === 0 ? `${rot} cimento e areia (1:${a})` : `${rot} (cimento:cal:areia 1:${c}:${a})`).replace(/\./g, ',')
const argAss = (rot: string, c: number, a: number): Preset => { const m = argamassa(c, a); return { nome: nomeArg(rot, c, a), argCimentoKg: m.cim, argAreiaM3: m.are, calKgM3: m.cal } }
const argChap = (rot: string, c: number, a: number): Preset => { const m = argamassa(c, a); return { nome: nomeArg(rot, c, a), chapCimentoKg: m.cim, chapAreiaM3: m.are, chapCalKgM3: m.cal } }
const argEmb = (rot: string, c: number, a: number): Preset => { const m = argamassa(c, a); return { nome: nomeArg(rot, c, a), embCimentoKg: m.cim, embAreiaM3: m.are, embCalKgM3: m.cal } }

export const TRACOS: GrupoTraco[] = [
  { chave: 'concEst', rotulo: 'Concreto estrutural (pilares, vigas, lajes, fundação)', lista: [concEst(2, 3), concEst(2.5, 3.5), concEst(2, 4), concEst(1.5, 3)],
    resumo: (p) => `cimento ${p.estCimentoKg} kg/m³ · areia ${p.estAreiaM3} m³ · brita ${p.estBritaM3} m³ (por m³ de concreto)` },
  { chave: 'concCt', rotulo: 'Contrapiso e calçada', lista: [concCt(3, 5), concCt(2, 4), concCt(4, 8, 'Concreto magro')],
    resumo: (p) => `cimento ${p.ctCimentoKg} kg/m³ · areia ${p.ctAreiaM3} m³ · brita ${p.ctBritaM3} m³ (por m³ de concreto)` },
  { chave: 'assent', rotulo: 'Argamassa de assentamento', lista: [argAss('Assentamento', 2, 8), argAss('Assentamento', 1, 6), argAss('Assentamento', 0, 3)],
    resumo: (p) => `cimento ${p.argCimentoKg} kg/m³ · cal ${p.calKgM3} kg/m³ · areia ${p.argAreiaM3} m³ (por m³ de argamassa)` },
  { chave: 'chap', rotulo: 'Chapisco', lista: [argChap('Chapisco', 0, 3), argChap('Chapisco forte', 0, 2)],
    resumo: (p) => `cimento ${p.chapCimentoKg} kg/m³ · cal ${p.chapCalKgM3} kg/m³ · areia ${p.chapAreiaM3} m³ (por m³ de argamassa)` },
  { chave: 'emb', rotulo: 'Emboço / reboco', lista: [argEmb('Reboco', 2, 8), argEmb('Reboco', 1, 6), { ...argEmb('Reboco forte', 1, 1), nome: 'Reboco forte (cimento:cal:areia 1:1:1) — exemplo informado' }],
    resumo: (p) => `cimento ${p.embCimentoKg} kg/m³ · cal ${p.embCalKgM3} kg/m³ · areia ${p.embAreiaM3} m³ (por m³ de argamassa)` },
]

/** Aditivos: % do peso do cimento (valores usuais; siga sempre a bula do fabricante). */
export const ADITIVOS = [
  { cod: 0, nome: 'Sem aditivo', pct: 0 },
  { cod: 1, nome: 'Plastificante / redutor de água', pct: 0.6 },
  { cod: 2, nome: 'Impermeabilizante (hidrófugo)', pct: 2 },
  { cod: 3, nome: 'Adesivo PVA / resina para argamassa', pct: 5 },
] as const
