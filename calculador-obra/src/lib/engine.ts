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
  // Terreno (0 = não informado: o item não é calculado)
  aterroH: number; escavH: number; perdaAterro: number
  // Fundação e estrutura: só com dimensões informadas pelo usuário (nada é presumido)
  fundComp: number; fundLarg: number; fundAlt: number
  pilarN: number; pilarL: number; pilarB: number; vigaComp: number; vigaL: number; vigaH: number
  estCimentoKg: number; estAreiaM3: number; estBritaM3: number; acoKgM3: number
  // Revestimentos e forro
  revFaces: number; espChapCm: number; chapCimentoKg: number; chapAreiaM3: number
  espEmbCm: number; embCimentoKg: number; embAreiaM3: number; perdaRev: number; cerArea: number
  forro: number; perdaForro: number; espPerfil: number; barraPerfilM: number
  // Cobertura (só é calculada com comprimento e largura informados)
  roofC: number; roofL: number; aguas: number; inclinacao: number; beiral: number
  telhaRend: number; perdaTelha: number; espTerca: number; espCaibro: number; espRipa: number
  tesouras: number; barraM: number; perdaMadeira: number; cumeeiraM: number
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
  aterroH: 0, escavH: 0, perdaAterro: 20,
  fundComp: 0, fundLarg: 0, fundAlt: 0, pilarN: 0, pilarL: 0, pilarB: 0, vigaComp: 0, vigaL: 0, vigaH: 0,
  estCimentoKg: 350, estAreiaM3: 0.62, estBritaM3: 0.8, acoKgM3: 0,
  revFaces: 2, espChapCm: 0.5, chapCimentoKg: 500, chapAreiaM3: 1, espEmbCm: 2.5, embCimentoKg: 250, embAreiaM3: 1.1, perdaRev: 10, cerArea: 0,
  forro: 0, perdaForro: 5, espPerfil: 0.6, barraPerfilM: 3,
  roofC: 0, roofL: 0, aguas: 2, inclinacao: 30, beiral: 0.4,
  telhaRend: 16, perdaTelha: 5, espTerca: 1.5, espCaibro: 0.5, espRipa: 0.33,
  tesouras: 0, barraM: 3, perdaMadeira: 10, cumeeiraM: 0.4,
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

  // PREPARAÇÃO DO TERRENO
  const T = 'Preparação do terreno'
  const mt = obra.movimentoTerra
  add({ etapa: T, material: 'Limpeza do terreno', unidade: 'm²', tipo: 'Geométrico', formula: 'área construída (1 pavimento)', dimensoes: `${f2(area1)} m²`, coef: '—', perda: 0, bruto: area1 })
  if ((mt === 'aterro' || mt === 'ambos') && p.aterroH > 0) {
    add({ etapa: T, material: 'Aterro', unidade: 'm³', tipo: 'Geométrico', formula: 'área × altura média × (1 + empolamento/compactação)', dimensoes: `${f2(area1)} m² × ${p.aterroH} m`, coef: '—', perda: p.perdaAterro, bruto: com(area1 * p.aterroH, p.perdaAterro) })
    add({ etapa: T, material: 'Compactação', unidade: 'm²', tipo: 'Geométrico', formula: 'área do aterro', dimensoes: `${f2(area1)} m²`, coef: '—', perda: 0, bruto: area1 })
  }
  if ((mt === 'escavacao' || mt === 'ambos') && p.escavH > 0)
    add({ etapa: T, material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: 'área × profundidade média', dimensoes: `${f2(area1)} m² × ${p.escavH} m`, coef: '—', perda: 0, bruto: area1 * p.escavH })

  // FUNDAÇÃO E ESTRUTURA — somente com as dimensões informadas; sem dados, nada é calculado
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
  const forma = (etapa: string, a: number, dim: string) => a > 0 && add({ etapa, material: 'Forma (área de contato)', unidade: 'm²', tipo: 'Geométrico', formula: 'área das faces concretadas', dimensoes: dim, coef: '—', perda: 0, bruto: a })
  const volF = p.fundComp * p.fundLarg * p.fundAlt
  conc('Fundação', 'Concreto da fundação', volF, `${p.fundComp} × ${p.fundLarg} × ${p.fundAlt} m`)
  forma('Fundação', p.fundComp * p.fundAlt * 2, `laterais: ${p.fundComp} m × ${p.fundAlt} m × 2`)
  const volP = p.pilarN * p.pilarL * p.pilarB * h, volV = p.vigaComp * p.vigaL * p.vigaH
  conc('Estrutura', 'Concreto estrutural', volP + volV, `${p.pilarN} pilar(es) ${p.pilarL}×${p.pilarB}×${f2(h)} m + vigas ${p.vigaComp} m ${p.vigaL}×${p.vigaH} m`)
  forma('Estrutura', p.pilarN * 2 * (p.pilarL + p.pilarB) * h + p.vigaComp * (2 * p.vigaH + p.vigaL), 'pilares: perímetro × altura; vigas: (2 × altura + largura) × comprimento')

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

  // REVESTIMENTOS E FORRO
  if (liq > 0) {
    const R = 'Revestimentos', aR = liq * p.revFaces, dR = `área líquida ${f2(liq)} m² × ${p.revFaces} face(s) = ${f2(aR)} m²`
    const arg = (nome: string, esp: number, cim: number, are: number) => {
      const v = com((aR * esp) / 100, p.perdaRev)
      add({ etapa: R, material: nome, unidade: 'm²', tipo: 'Geométrico', formula: 'área líquida × faces', dimensoes: dR, coef: '—', perda: 0, bruto: aR })
      add({ etapa: R, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: `área × espessura ${esp} cm × (1 + perda) × kg/m³ ÷ kg/saco (${nome})`, dimensoes: `${dR}; argamassa ${f2(v)} m³`, coef: `${cim} kg/m³`, perda: p.perdaRev, bruto: (v * cim) / p.sacoKg })
      add({ etapa: R, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: `argamassa (${nome}) × m³ de areia/m³`, dimensoes: `argamassa ${f2(v)} m³`, coef: `${are} m³/m³`, perda: p.perdaRev, bruto: v * are })
    }
    arg('Chapisco', p.espChapCm, p.chapCimentoKg, p.chapAreiaM3)
    arg('Emboço/reboco', p.espEmbCm, p.embCimentoKg, p.embAreiaM3)
  }
  if (p.cerArea > 0)
    add({ etapa: 'Revestimentos', material: 'Revestimento cerâmico de parede', unidade: 'm²', tipo: 'Geométrico', formula: 'área informada × (1 + perda)', dimensoes: `${f2(p.cerArea)} m²`, coef: '—', perda: p.perdaRev, bruto: com(p.cerArea, p.perdaRev) })
  if (p.forro > 0 && area1 > 0) {
    add({ etapa: 'Forro', material: 'Forro', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: `${f2(area1)} m²`, coef: '—', perda: p.perdaForro, bruto: com(area1, p.perdaForro) })
    if (p.espPerfil > 0 && p.barraPerfilM > 0)
      add({ etapa: 'Forro', material: 'Perfil de sustentação (barras)', unidade: 'barra', tipo: 'Estimativa por composição', formula: '(área ÷ espaçamento) ÷ barra × (1 + perda)', dimensoes: `${f2(area1)} m²; espaçamento ${p.espPerfil} m`, coef: `barra ${p.barraPerfilM} m`, perda: p.perdaForro, bruto: com(area1 / p.espPerfil / p.barraPerfilM, p.perdaForro) })
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

  // COBERTURA E MADEIRAMENTO — usa a área INCLINADA (projeção × √(1+i²)), nunca só a área horizontal
  if (p.roofC > 0 && p.roofL > 0 && p.espTerca > 0 && p.espCaibro > 0 && p.espRipa > 0 && p.barraM > 0) {
    const n = p.aguas === 2 ? 2 : 1
    const fator = Math.sqrt(1 + (p.inclinacao / 100) ** 2)
    const C = p.roofC + 2 * p.beiral // comprimento (paralelo à cumeeira)
    const W = p.roofL + 2 * p.beiral // largura em projeção (sentido do caimento)
    const inc = (W / n) * fator // comprimento inclinado de cada água
    const area = C * W * fator
    const dm = `${n} água(s); ${f2(C)} × ${f2(W)} m (c/ beiral ${p.beiral} m); inclinação ${p.inclinacao}% (fator ${f2(fator)}); água inclinada ${f2(inc)} m`
    const E = 'Cobertura e madeiramento'
    add({ etapa: E, material: 'Telha', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área inclinada × rendimento × (1 + perda)',
      dimensoes: `${dm}; área inclinada ${f2(area)} m²`, coef: `${p.telhaRend} un/m²`, perda: p.perdaTelha, bruto: com(area * p.telhaRend, p.perdaTelha) })
    const madeira = (material: string, qtd: number, cada: number, formula: string, esp: number) =>
      add({ etapa: E, material, unidade: 'barra', tipo: 'Geométrico', formula: `${formula}; metros ÷ barra comercial × (1 + perda)`,
        dimensoes: `${dm}; ${qtd} peça(s) de ${f2(cada)} m = ${f2(qtd * cada)} m; espaçamento ${esp} m`, coef: `barra ${p.barraM} m`, perda: p.perdaMadeira,
        bruto: com((qtd * cada) / p.barraM, p.perdaMadeira) })
    madeira('Terça (barras)', (Math.ceil(inc / p.espTerca) + 1) * n, C, 'peças/água = ⌈inclinado ÷ espaçamento⌉ + 1', p.espTerca)
    madeira('Caibro (barras)', (Math.ceil(C / p.espCaibro) + 1) * n, inc, 'peças/água = ⌈comprimento ÷ espaçamento⌉ + 1', p.espCaibro)
    madeira('Ripa (barras)', (Math.ceil(inc / p.espRipa) + 1) * n, C, 'peças/água = ⌈inclinado ÷ espaçamento⌉ + 1', p.espRipa)
    if (n === 2 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Cumeeira', unidade: 'un', tipo: 'Geométrico', formula: 'comprimento ÷ peça × (1 + perda)',
        dimensoes: `${f2(C)} m; peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(C / p.cumeeiraM, p.perdaTelha) })
    if (p.tesouras > 0)
      add({ etapa: E, material: 'Tesoura (quantidade informada)', unidade: 'un', tipo: 'Geométrico', formula: 'quantidade informada pelo usuário; dimensionamento exige profissional',
        dimensoes: '—', coef: '—', perda: 0, bruto: p.tesouras })
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
