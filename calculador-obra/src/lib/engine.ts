/**
 * MOTOR DE CÁLCULO — todas as fórmulas do sistema ficam neste arquivo.
 * Nenhum coeficiente é fixo: tudo vem de `Params` (editável na tela).
 * Medidas em metros; áreas em m²; volumes em m³.
 */
import type { Ambiente, Obra } from '../types'
import { areaAmbiente, areaParedeBruta, perimetroAmbiente } from './geometry'
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
  massaTipo: number; massaPct: number; demaosMassa: number; rendMassa: number // massaTipo: 0 não, 1 PVA, 2 acrílica
  seladorPct: number; demaosSelador: number; rendSelador: number; latSeladorL: number
  cor2Pct: number; lixaM2: number; roloM2: number; pincelM2: number; fitaM: number
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
  // Piso: acessórios
  rodape: number; rodapeBarraM: number; perdaRodape: number; rejunteKgM2: number; espPorPeca: number; colanteKgM2: number; colanteSacoKg: number
  // Instalações: só contagem por pontos/quantidades informadas (sem dimensionar circuitos, bitolas ou diâmetros)
  eltTomadas: number; eltInterruptores: number; eltPontosLuz: number; eltDisjuntores: number
  eltMPorPonto: number; eltCaboMPorPonto: number; barraEletrodutoM: number; perdaInst: number
  hidPontosAgua: number; hidRegistros: number; sanPontos: number; caixasSifonadas: number; ralos: number; caixasInspecao: number
  vasos: number; lavatorios: number; pias: number; chuveiros: number; reservatorios: number
  hidMPorPonto: number; sanMPorPonto: number; conexPorPonto: number; barraTuboM: number
  drenTuboM: number; drenCaixas: number; drenRalos: number; canaletaM: number; drenBritaM3m: number
  // Calhas e rufos (dentro da cobertura)
  espigaoExtraM: number; calha: number; calhaBarraM: number; condutorN: number; condutorAltM: number; condutorBarraM: number; rufoM: number
  // Cobertura (só é calculada com comprimento e largura informados)
  roofC: number; roofL: number; aguas: number; inclinacao: number; beiral: number
  telhaRend: number; perdaTelha: number; espTerca: number; espCaibro: number; espRipa: number
  tesouras: number; barraM: number; perdaMadeira: number; cumeeiraM: number
  // Vergas, laje, formas, impermeabilização, transporte, cal e acessórios do telhado (0 = não calcula)
  vergas: number; vergaApoio: number; vergaL: number; vergaH: number
  lajeArea: number; lajeEsp: number; escorasPorM2: number; reusoForma: number; sarrafoMPorM2: number
  imperArea: number; imperBaldrame: number; imperKgM2: number
  transporte: number; caminhaoM3: number; calKgM3: number; calSacoKg: number; fixPorM2: number; mantaCob: number
  // Esquadrias, muro, calçada e escada (0 = não calcula)
  esquadrias: number
  muroComp: number; muroAlt: number; muroFundL: number; muroFundH: number; muroPilarEsp: number; muroPilarSec: number
  calcArea: number; calcEsp: number; calcLastroCm: number; calcTela: number
  escLarg: number; escAlt: number; escEspelho: number; escPiso: number; escEspLaje: number
  // Laje pré-moldada, fossa e sumidouro, piscina (0 = não calcula; medidas informadas, sem dimensionamento)
  preLajeArea: number; preInter: number; preLajotaC: number; preCapEsp: number; preTela: number
  fosCompr: number; fosLarg: number; fosProf: number; fosEsp: number; sumDiam: number; sumProf: number; sumEsp: number; sumBritaFundo: number
  pisC: number; pisL: number; pisProf: number; pisEsp: number; pisFolga: number
  // Etapa 3: tipo de fundação, drywall/gesso, telha metálica, estrutura metálica e de madeira (0 = não calcula)
  fundTipo: number // 0 baldrame/corrida, 1 radier, 2 sapatas isoladas, 3 estacas
  radierArea: number; radierEsp: number; fundPerim: number; radierTela: number
  sapN: number; sapL: number; sapB: number; sapH: number; estN: number; estDiam: number; estProf: number
  dwComp: number; dwAlt: number; dwFaces: number; dwEspMont: number; dwBarraM: number; perdaDw: number; dwChapaC: number; dwChapaL: number
  dwForroArea: number; dwParafM2: number; dwFitaMM2: number; dwMassaKgM2: number; dwPendM2: number; dwForroPerfilM2: number
  telhaMetalica: number; sobreMetal: number
  metComp: number; metKgM: number; metBarraM: number; perdaMet: number; metSupM: number; metDemaos: number; metRend: number; metSoldaKgKg: number
  madComp: number; madBarraM: number; madPregoKgM: number
  escTipo: number; escFolga: number // escada: 0 reta, 1 em L com patamar, 2 em U com patamar, 3 em L com leque
  // Biblioteca técnica: composições criadas pelo usuário
  composicoes: Composicao[]
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
  massaTipo: 1, massaPct: 100, demaosMassa: 2, rendMassa: 50,
  seladorPct: 100, demaosSelador: 1, rendSelador: 12, latSeladorL: 18,
  cor2Pct: 0, lixaM2: 15, roloM2: 100, pincelM2: 200, fitaM: 50,
  aterroH: 0, escavH: 0, perdaAterro: 20,
  fundComp: 0, fundLarg: 0, fundAlt: 0, pilarN: 0, pilarL: 0, pilarB: 0, vigaComp: 0, vigaL: 0, vigaH: 0,
  estCimentoKg: 350, estAreiaM3: 0.62, estBritaM3: 0.8, acoKgM3: 0,
  revFaces: 2, espChapCm: 0.5, chapCimentoKg: 500, chapAreiaM3: 1, espEmbCm: 2.5, embCimentoKg: 250, embAreiaM3: 1.1, perdaRev: 10, cerArea: 0,
  forro: 0, perdaForro: 5, espPerfil: 0.6, barraPerfilM: 3,
  rodape: 1, rodapeBarraM: 2.4, perdaRodape: 10, rejunteKgM2: 0.5, espPorPeca: 4, colanteKgM2: 4.5, colanteSacoKg: 20,
  eltTomadas: 0, eltInterruptores: 0, eltPontosLuz: 0, eltDisjuntores: 0, eltMPorPonto: 6, eltCaboMPorPonto: 12, barraEletrodutoM: 3, perdaInst: 10,
  hidPontosAgua: 0, hidRegistros: 0, sanPontos: 0, caixasSifonadas: 0, ralos: 0, caixasInspecao: 0,
  vasos: 0, lavatorios: 0, pias: 0, chuveiros: 0, reservatorios: 0, hidMPorPonto: 4, sanMPorPonto: 3, conexPorPonto: 3, barraTuboM: 6,
  drenTuboM: 0, drenCaixas: 0, drenRalos: 0, canaletaM: 0, drenBritaM3m: 0.04,
  espigaoExtraM: 0, calha: 0, calhaBarraM: 3, condutorN: 0, condutorAltM: 3, condutorBarraM: 3, rufoM: 0,
  roofC: 0, roofL: 0, aguas: 2, inclinacao: 30, beiral: 0.4,
  telhaRend: 16, perdaTelha: 5, espTerca: 1.5, espCaibro: 0.5, espRipa: 0.33,
  tesouras: 0, barraM: 3, perdaMadeira: 10, cumeeiraM: 0.4,
  vergas: 1, vergaApoio: 0.3, vergaL: 0.14, vergaH: 0.1,
  lajeArea: 0, lajeEsp: 10, escorasPorM2: 1.2, reusoForma: 3, sarrafoMPorM2: 1.5,
  imperArea: 0, imperBaldrame: 1, imperKgM2: 3,
  transporte: 0, caminhaoM3: 6, calKgM3: 0, calSacoKg: 20, fixPorM2: 2, mantaCob: 0,
  esquadrias: 1,
  muroComp: 0, muroAlt: 2, muroFundL: 0.3, muroFundH: 0.4, muroPilarEsp: 3, muroPilarSec: 0.14,
  calcArea: 0, calcEsp: 7, calcLastroCm: 5, calcTela: 0,
  escLarg: 0, escAlt: 0, escEspelho: 0.18, escPiso: 0.28, escEspLaje: 0.12,
  preLajeArea: 0, preInter: 0.42, preLajotaC: 0.3, preCapEsp: 4, preTela: 1,
  fosCompr: 0, fosLarg: 0, fosProf: 0, fosEsp: 0.14, sumDiam: 0, sumProf: 0, sumEsp: 0.14, sumBritaFundo: 0.5,
  pisC: 0, pisL: 0, pisProf: 1.4, pisEsp: 0.15, pisFolga: 0.5,
  fundTipo: 0, radierArea: 0, radierEsp: 0.15, fundPerim: 0, radierTela: 1,
  sapN: 0, sapL: 0, sapB: 0, sapH: 0.4, estN: 0, estDiam: 0.25, estProf: 0,
  dwComp: 0, dwAlt: 2.7, dwFaces: 2, dwEspMont: 0.6, dwBarraM: 3, perdaDw: 10, dwChapaC: 2.4, dwChapaL: 1.2,
  dwForroArea: 0, dwParafM2: 20, dwFitaMM2: 1.5, dwMassaKgM2: 0.5, dwPendM2: 1.2, dwForroPerfilM2: 2,
  telhaMetalica: 0, sobreMetal: 10,
  metComp: 0, metKgM: 0, metBarraM: 6, perdaMet: 5, metSupM: 0.5, metDemaos: 2, metRend: 8, metSoldaKgKg: 0.01,
  madComp: 0, madBarraM: 3, madPregoKgM: 0.02,
  escTipo: 0, escFolga: 0.1,
  composicoes: [],
  sacoKg: 50,
}

export interface Composicao { id: string; nome: string; etapa: string; unidade: string; base: 'area' | 'parede' | 'fixa'; coef: number; perda: number }

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
  const add = (i: Omit<Item, 'final'>) => { if (i.bruto > 0) itens.push({ ...i, final: fim(i.bruto) }) }
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

  if (p.transporte > 0 && p.caminhaoM3 > 0) {
    const emp = 1 + p.perdaAterro / 100
    const volA = (mt === 'aterro' || mt === 'ambos') && p.aterroH > 0 ? area1 * p.aterroH * emp : 0
    const volE = (mt === 'escavacao' || mt === 'ambos') && p.escavH > 0 ? area1 * p.escavH * emp : 0
    add({ etapa: T, material: 'Transporte de terra (viagens)', unidade: 'viagem', tipo: 'Estimativa por composição', formula: '(aterro + escavação, com empolamento) ÷ capacidade do caminhão',
      dimensoes: `aterro ${f2(volA)} m³ + escavação ${f2(volE)} m³`, coef: `caminhão ${p.caminhaoM3} m³`, perda: p.perdaAterro, bruto: (volA + volE) / p.caminhaoM3 })
  }

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
  let formaTotal = 0
  const forma = (etapa: string, a: number, dim: string) => { if (a > 0) { formaTotal += a; add({ etapa, material: 'Forma (área de contato)', unidade: 'm²', tipo: 'Geométrico', formula: 'área das faces concretadas', dimensoes: dim, coef: '—', perda: 0, bruto: a }) } }
  const corr = p.fundTipo === 0 // baldrame / sapata corrida
  const volF = corr ? p.fundComp * p.fundLarg * p.fundAlt : 0
  conc('Fundação', 'Concreto da fundação', volF, `${p.fundComp} × ${p.fundLarg} × ${p.fundAlt} m`)
  forma('Fundação', corr ? p.fundComp * p.fundAlt * 2 : 0, `laterais: ${p.fundComp} m × ${p.fundAlt} m × 2`)
  if (p.fundTipo === 1 && p.radierArea > 0) { // radier: concreto, formas de borda, tela e lona
    const d = `${p.radierArea} m² × ${p.radierEsp} m`
    conc('Fundação', 'Concreto do radier', p.radierArea * p.radierEsp, d)
    forma('Fundação', p.fundPerim * p.radierEsp, `bordas: ${p.fundPerim} m × ${p.radierEsp} m`)
    add({ etapa: 'Fundação', material: 'Lona plástica', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: d, coef: '—', perda: p.perdaConcreto, bruto: com(p.radierArea, p.perdaConcreto) })
    if (p.radierTela > 0) add({ etapa: 'Fundação', material: 'Tela soldada', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda); bitola conforme projeto', dimensoes: d, coef: '—', perda: p.perdaConcreto, bruto: com(p.radierArea, p.perdaConcreto) })
  }
  if (p.fundTipo === 2 && p.sapN > 0 && p.sapL > 0 && p.sapB > 0 && p.sapH > 0) { // sapatas isoladas
    const d = `${p.sapN} sapata(s) ${p.sapL}×${p.sapB}×${p.sapH} m`
    conc('Fundação', 'Concreto das sapatas', p.sapN * p.sapL * p.sapB * p.sapH, d)
    forma('Fundação', p.sapN * 2 * (p.sapL + p.sapB) * p.sapH, 'laterais das sapatas')
    add({ etapa: 'Fundação', material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: 'sapatas × (comp. + 0,4) × (larg. + 0,4) × (altura + 0,1)', dimensoes: d, coef: 'folga 0,2 m por lado', perda: 0, bruto: p.sapN * (p.sapL + 0.4) * (p.sapB + 0.4) * (p.sapH + 0.1) })
  }
  if (p.fundTipo === 3 && p.estN > 0 && p.estDiam > 0 && p.estProf > 0) { // estacas
    const d = `${p.estN} estaca(s) Ø${p.estDiam} m × ${p.estProf} m`
    conc('Fundação', 'Concreto das estacas', p.estN * Math.PI * (p.estDiam / 2) ** 2 * p.estProf, d)
    add({ etapa: 'Fundação', material: 'Perfuração de estaca', unidade: 'm', tipo: 'Geométrico', formula: 'estacas × profundidade', dimensoes: d, coef: '—', perda: 0, bruto: p.estN * p.estProf })
  }
  const volP = p.pilarN * p.pilarL * p.pilarB * h, volV = p.vigaComp * p.vigaL * p.vigaH
  conc('Estrutura', 'Concreto estrutural', volP + volV, `${p.pilarN} pilar(es) ${p.pilarL}×${p.pilarB}×${f2(h)} m + vigas ${p.vigaComp} m ${p.vigaL}×${p.vigaH} m`)
  forma('Estrutura', p.pilarN * 2 * (p.pilarL + p.pilarB) * h + p.vigaComp * (2 * p.vigaH + p.vigaL), 'pilares: perímetro × altura; vigas: (2 × altura + largura) × comprimento')

  // MURO — blocos e argamassa (parâmetros da alvenaria), fundação corrida e pilaretes
  if (p.muroComp > 0 && p.muroAlt > 0) {
    const M = 'Muro', aM = p.muroComp * p.muroAlt, aB = p.blocoC * p.blocoA, dM = `${p.muroComp} m × ${p.muroAlt} m = ${f2(aM)} m²`
    if (aB > 0) {
      const v = com(aM * p.argM3m2, p.perdaArg)
      add({ etapa: M, material: 'Bloco', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área do muro ÷ (comprimento × altura do bloco) × (1 + perda)', dimensoes: `${dM}; bloco ${p.blocoC}×${p.blocoA} m`, coef: `${f2(1 / aB)} un/m²`, perda: p.perdaBloco, bruto: com(aM / aB, p.perdaBloco) })
      add({ etapa: M, material: 'Argamassa de assentamento', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'área × consumo × (1 + perda)', dimensoes: dM, coef: `${p.argM3m2} m³/m²`, perda: p.perdaArg, bruto: v })
      add({ etapa: M, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: 'argamassa × kg de cimento/m³ ÷ kg por saco', dimensoes: `argamassa ${f2(v)} m³`, coef: `${p.argCimentoKg} kg/m³`, perda: p.perdaArg, bruto: (v * p.argCimentoKg) / p.sacoKg })
      add({ etapa: M, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'argamassa × m³ de areia/m³', dimensoes: `argamassa ${f2(v)} m³`, coef: `${p.argAreiaM3} m³/m³`, perda: p.perdaArg, bruto: v * p.argAreiaM3 })
    }
    const nP = fim(p.muroComp / Math.max(p.muroPilarEsp, 0.1)) + 1
    conc(M, 'Concreto do muro (fundação e pilaretes)', p.muroComp * p.muroFundL * p.muroFundH + nP * p.muroPilarSec * p.muroPilarSec * p.muroAlt,
      `fundação ${p.muroComp}×${p.muroFundL}×${p.muroFundH} m + ${nP} pilaretes ${p.muroPilarSec}×${p.muroPilarSec}×${p.muroAlt} m`)
    forma(M, p.muroComp * p.muroFundH * 2 + nP * 4 * p.muroPilarSec * p.muroAlt, 'laterais da fundação + pilaretes')
  }

  // CALÇADA E ÁREAS EXTERNAS — concreto (traço do contrapiso), lastro de brita e tela opcional
  if (p.calcArea > 0) {
    const K = 'Calçada e áreas externas', v = com(p.calcArea * (p.calcEsp / 100), p.perdaConcreto), d = `${p.calcArea} m² × ${p.calcEsp} cm; concreto ${f2(v)} m³`
    add({ etapa: K, material: 'Concreto da calçada', unidade: 'm³', tipo: 'Geométrico', formula: 'área × espessura × (1 + perda)', dimensoes: `${p.calcArea} m² × ${p.calcEsp} cm`, coef: '—', perda: p.perdaConcreto, bruto: v })
    add({ etapa: K, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: 'concreto × kg de cimento/m³ ÷ kg por saco', dimensoes: d, coef: `${p.ctCimentoKg} kg/m³`, perda: p.perdaConcreto, bruto: (v * p.ctCimentoKg) / p.sacoKg })
    add({ etapa: K, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'concreto × m³ de areia/m³', dimensoes: d, coef: `${p.ctAreiaM3} m³/m³`, perda: p.perdaConcreto, bruto: v * p.ctAreiaM3 })
    add({ etapa: K, material: 'Brita', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'concreto × m³ de brita/m³', dimensoes: d, coef: `${p.ctBritaM3} m³/m³`, perda: p.perdaConcreto, bruto: v * p.ctBritaM3 })
    add({ etapa: K, material: 'Brita de lastro', unidade: 'm³', tipo: 'Geométrico', formula: 'área × espessura do lastro × (1 + perda)', dimensoes: `${p.calcArea} m² × ${p.calcLastroCm} cm`, coef: '—', perda: p.perdaConcreto, bruto: com(p.calcArea * (p.calcLastroCm / 100), p.perdaConcreto) })
    if (p.calcTela > 0) add({ etapa: K, material: 'Tela soldada', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: `${p.calcArea} m²`, coef: '—', perda: p.perdaConcreto, bruto: com(p.calcArea, p.perdaConcreto) })
  }

  // ESCADA DE CONCRETO — reta, em L ou em U (com patamar) e em L com leque (estimativa); lajes inclinadas + degraus
  if (p.escLarg > 0 && p.escAlt > 0 && p.escEspelho > 0 && p.escPiso > 0) {
    const nE = fim(p.escAlt / p.escEspelho), tipo = p.escTipo
    const n1 = fim(nE / 2)
    const lances = tipo === 1 || tipo === 2 ? [n1, nE - n1] : [nE]
    const patA = tipo === 1 ? p.escLarg * p.escLarg : tipo === 2 ? (2 * p.escLarg + p.escFolga) * p.escLarg : 0
    let vol = patA * p.escEspLaje, aForma = patA
    for (const n of lances) {
      const Li = Math.sqrt((n * p.escPiso) ** 2 + (n * p.escEspelho) ** 2)
      vol += p.escLarg * Li * p.escEspLaje + n * 0.5 * p.escPiso * p.escEspelho * p.escLarg
      aForma += p.escLarg * Li + n * p.escEspelho * p.escLarg
    }
    const nome = ['reta', 'em L com patamar', 'em U com patamar', 'em L com degraus em leque (estimativa pela escada reta)'][tipo] ?? 'reta'
    const d = `escada ${nome}; ${nE} degraus (${lances.join(' + ')}); largura ${p.escLarg} m; laje ${p.escEspLaje} m; patamar ${f2(patA)} m²`
    conc('Escada', 'Concreto da escada', vol, d)
    forma('Escada', aForma, 'fundo das lajes e do patamar + espelhos')
    add({ etapa: 'Escada', material: 'Degraus (quantidade)', unidade: 'un', tipo: 'Geométrico', formula: '⌈altura a vencer ÷ altura do espelho⌉', dimensoes: `${p.escAlt} m ÷ ${p.escEspelho} m`, coef: '—', perda: 0, bruto: nE })
    add({ etapa: 'Escada', material: 'Revestimento dos degraus', unidade: 'm²', tipo: 'Geométrico', formula: '(degraus × (piso + espelho) × largura + patamar) × (1 + perda)', dimensoes: `${nE} × (${p.escPiso} + ${p.escEspelho}) × ${p.escLarg} m + patamar ${f2(patA)} m²`, coef: '—', perda: p.perdaPiso, bruto: com(nE * (p.escPiso + p.escEspelho) * p.escLarg + patA, p.perdaPiso) })
  }

  // BLOCOS + ARGAMASSA DE ASSENTAMENTO para fossa, sumidouro etc. (parâmetros da alvenaria)
  const alvBlocos = (etapa: string, aP: number, dim: string) => {
    const aB = p.blocoC * p.blocoA
    if (aP <= 0 || aB <= 0) return
    const v = com(aP * p.argM3m2, p.perdaArg)
    add({ etapa, material: 'Bloco', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área de parede ÷ (comprimento × altura do bloco) × (1 + perda)', dimensoes: `${dim}; bloco ${p.blocoC}×${p.blocoA} m`, coef: `${f2(1 / aB)} un/m²`, perda: p.perdaBloco, bruto: com(aP / aB, p.perdaBloco) })
    add({ etapa, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: 'argamassa de assentamento × kg de cimento/m³ ÷ kg por saco', dimensoes: `${dim}; argamassa ${f2(v)} m³`, coef: `${p.argCimentoKg} kg/m³`, perda: p.perdaArg, bruto: (v * p.argCimentoKg) / p.sacoKg })
    add({ etapa, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'argamassa de assentamento × m³ de areia/m³', dimensoes: `${dim}; argamassa ${f2(v)} m³`, coef: `${p.argAreiaM3} m³/m³`, perda: p.perdaArg, bruto: v * p.argAreiaM3 })
  }

  // LAJE PRÉ-MOLDADA — vigotas, enchimento, capeamento, tela e escoras (sem dimensionar a armadura nem o vão)
  if (p.preLajeArea > 0 && p.preInter > 0 && p.preLajotaC > 0) {
    const Q = 'Laje pré-moldada', A = p.preLajeArea, d = `${A} m²; intereixo ${p.preInter} m`
    add({ etapa: Q, material: 'Vigota', unidade: 'm', tipo: 'Estimativa por composição', formula: 'área ÷ intereixo × (1 + perda)', dimensoes: d, coef: `intereixo ${p.preInter} m`, perda: p.perdaBloco, bruto: com(A / p.preInter, p.perdaBloco) })
    add({ etapa: Q, material: 'Lajota/EPS de enchimento', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área ÷ (intereixo × comprimento da peça) × (1 + perda)', dimensoes: `${d}; peça ${p.preLajotaC} m`, coef: `${f2(1 / (p.preInter * p.preLajotaC))} un/m²`, perda: p.perdaBloco, bruto: com(A / (p.preInter * p.preLajotaC), p.perdaBloco) })
    conc(Q, 'Concreto do capeamento', A * (p.preCapEsp / 100), `${A} m² × ${p.preCapEsp} cm`)
    if (p.preTela > 0) add({ etapa: Q, material: 'Tela soldada', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: `${A} m²`, coef: '—', perda: p.perdaConcreto, bruto: com(A, p.perdaConcreto) })
    add({ etapa: Q, material: 'Escora de laje', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área × escoras por m²', dimensoes: `${A} m²`, coef: `${p.escorasPorM2} un/m²`, perda: 0, bruto: A * p.escorasPorM2 })
  }

  // FOSSA SÉPTICA E SUMIDOURO — materiais a partir das medidas informadas (volume útil e dimensões: projeto/NBR 7229 e 13969)
  if ((p.fosCompr > 0 && p.fosLarg > 0 && p.fosProf > 0) || (p.sumDiam > 0 && p.sumProf > 0)) {
    const S = 'Fossa séptica e sumidouro'
    if (p.fosCompr > 0 && p.fosLarg > 0 && p.fosProf > 0) {
      const e = p.fosEsp, ce = p.fosCompr + 2 * e, le = p.fosLarg + 2 * e, df = `fossa ${p.fosCompr}×${p.fosLarg}×${p.fosProf} m, parede ${e} m`
      alvBlocos(S, 2 * (ce + le) * p.fosProf, df)
      conc(S, 'Concreto da fossa (fundo e tampa)', ce * le * (0.1 + 0.08), `fundo 10 cm + tampa 8 cm sobre ${f2(ce)}×${f2(le)} m`)
      add({ etapa: S, material: 'Revestimento interno impermeável (fossa)', unidade: 'm²', tipo: 'Geométrico', formula: 'paredes internas + fundo', dimensoes: df, coef: '—', perda: 0, bruto: 2 * (p.fosCompr + p.fosLarg) * p.fosProf + p.fosCompr * p.fosLarg })
      add({ etapa: S, material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: '(comprimento + 0,6) × (largura + 0,6) × (profundidade + 0,3)', dimensoes: df, coef: 'folga 0,3 m por lado', perda: 0, bruto: (ce + 0.6) * (le + 0.6) * (p.fosProf + 0.3) })
    }
    if (p.sumDiam > 0 && p.sumProf > 0) {
      const e = p.sumEsp, De = p.sumDiam + 2 * e, Ae = Math.PI * (De / 2) ** 2, ds = `sumidouro Ø${p.sumDiam} m × ${p.sumProf} m, parede ${e} m`
      alvBlocos(S, Math.PI * De * p.sumProf, ds)
      add({ etapa: S, material: 'Brita', unidade: 'm³', tipo: 'Geométrico', formula: 'área externa do poço × camada de brita no fundo', dimensoes: `${f2(Ae)} m² × ${p.sumBritaFundo} m`, coef: '—', perda: 0, bruto: Ae * p.sumBritaFundo })
      conc(S, 'Concreto da tampa do sumidouro', Ae * 0.08, `tampa 8 cm sobre Ø${f2(De)} m`)
      add({ etapa: S, material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: 'π × (raio externo + 0,3)² × (profundidade + brita)', dimensoes: ds, coef: 'folga 0,3 m', perda: 0, bruto: Math.PI * (De / 2 + 0.3) ** 2 * (p.sumProf + p.sumBritaFundo) })
    }
  }

  // PISCINA (concreto, retangular) — materiais pelas medidas informadas; armadura (taxa de aço) e equipamentos conforme projeto
  if (p.pisC > 0 && p.pisL > 0 && p.pisProf > 0) {
    const P = 'Piscina', e = p.pisEsp, ce = p.pisC + 2 * e, le = p.pisL + 2 * e
    const aInt = 2 * (p.pisC + p.pisL) * p.pisProf + p.pisC * p.pisL
    const dp = `${p.pisC}×${p.pisL}×${p.pisProf} m, paredes e fundo ${e} m (volume de água ≈ ${f2(p.pisC * p.pisL * p.pisProf)} m³)`
    conc(P, 'Concreto da piscina (fundo e paredes)', ce * le * e + 2 * (ce + le) * p.pisProf * e, dp)
    forma(P, 2 * (p.pisC + p.pisL) * p.pisProf + 2 * (ce + le) * p.pisProf + ce * le, 'paredes internas e externas + fundo')
    add({ etapa: P, material: 'Impermeabilizante', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'área interna × consumo', dimensoes: `área interna ${f2(aInt)} m²`, coef: `${p.imperKgM2} kg/m²`, perda: 0, bruto: aInt * p.imperKgM2 })
    add({ etapa: P, material: 'Revestimento da piscina', unidade: 'm²', tipo: 'Geométrico', formula: 'área interna × (1 + perda)', dimensoes: `área interna ${f2(aInt)} m²`, coef: '—', perda: p.perdaPiso, bruto: com(aInt, p.perdaPiso) })
    add({ etapa: P, material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: '(comp. + 2e + 2 folgas) × (larg. + 2e + 2 folgas) × (profundidade + e + 0,1)', dimensoes: dp, coef: `folga ${p.pisFolga} m`, perda: 0, bruto: (ce + 2 * p.pisFolga) * (le + 2 * p.pisFolga) * (p.pisProf + e + 0.1) })
    add({ etapa: P, material: 'Skimmer', unidade: 'un', tipo: 'Estimativa por composição', formula: '⌈espelho d’água ÷ 25 m²⌉', dimensoes: `${f2(p.pisC * p.pisL)} m²`, coef: '1 por 25 m²', perda: 0, bruto: fim((p.pisC * p.pisL) / 25) })
    add({ etapa: P, material: 'Dispositivo de retorno', unidade: 'un', tipo: 'Estimativa por composição', formula: '⌈espelho d’água ÷ 20 m²⌉', dimensoes: `${f2(p.pisC * p.pisL)} m²`, coef: '1 por 20 m²', perda: 0, bruto: fim((p.pisC * p.pisL) / 20) })
    add({ etapa: P, material: 'Conjunto filtro e motobomba (dimensionar pelo volume)', unidade: 'un', tipo: 'Estimativa por composição', formula: '1 conjunto; dimensionamento conforme projeto', dimensoes: dp, coef: '—', perda: 0, bruto: 1 })
  }

  // LAJE (maciça), FORMAS E ESCORAMENTO — só com a área informada
  if (p.lajeArea > 0) {
    conc('Laje', 'Concreto da laje', p.lajeArea * (p.lajeEsp / 100), `${p.lajeArea} m² × ${p.lajeEsp} cm`)
    forma('Laje', p.lajeArea, `fundo da laje ${p.lajeArea} m²`)
    add({ etapa: 'Laje', material: 'Escora de laje', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área × escoras por m²', dimensoes: `${p.lajeArea} m²`, coef: `${p.escorasPorM2} un/m²`, perda: 0, bruto: p.lajeArea * p.escorasPorM2 })
  }
  if (formaTotal > 0 && p.reusoForma > 0) {
    const F = 'Formas e escoramento', dF = `${f2(formaTotal)} m² de forma; ${p.reusoForma} reaproveitamento(s)`
    add({ etapa: F, material: 'Compensado resinado (chapa 1,22 × 2,44 m)', unidade: 'chapa', tipo: 'Estimativa por composição', formula: 'área de forma ÷ área da chapa ÷ reaproveitamentos × (1 + perda)', dimensoes: dF, coef: '2,977 m²/chapa', perda: p.perdaMadeira, bruto: com(formaTotal / 2.9768 / p.reusoForma, p.perdaMadeira) })
    add({ etapa: F, material: 'Sarrafo de travamento', unidade: 'm', tipo: 'Estimativa por composição', formula: 'área de forma × m por m² ÷ reaproveitamentos × (1 + perda)', dimensoes: dF, coef: `${p.sarrafoMPorM2} m/m²`, perda: p.perdaMadeira, bruto: com((formaTotal * p.sarrafoMPorM2) / p.reusoForma, p.perdaMadeira) })
  }

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
    add({ etapa: 'Alvenaria', material: 'Cal hidratada', unidade: 'saco', tipo: 'Estimativa por composição',
      formula: 'volume de argamassa × kg de cal/m³ ÷ kg por saco', dimensoes: `argamassa ${f2(vol)} m³`,
      coef: `${p.calKgM3} kg/m³; saco ${p.calSacoKg} kg`, perda: p.perdaArg, bruto: p.calSacoKg > 0 ? (vol * p.calKgM3) / p.calSacoKg : 0 })
  }

  // VERGAS E CONTRAVERGAS — verga em portas e janelas; contraverga só em janelas; apoio de cada lado
  if (p.vergas > 0 && p.aberturas.length > 0) {
    const comp = p.aberturas.reduce((t, a) => t + (a.largura + 2 * p.vergaApoio) * a.qtd * (a.tipo === 'Janela' ? 2 : 1), 0)
    conc('Alvenaria', 'Concreto de vergas e contravergas', comp * p.vergaL * p.vergaH, `${f2(comp)} m de peças × ${p.vergaL} × ${p.vergaH} m (apoio ${p.vergaApoio} m por lado)`)
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
    const perim = ambientes.reduce((t, a) => t + perimetroAmbiente(a), 0)
    const portasL = p.aberturas.filter((a) => a.tipo === 'Porta').reduce((t, a) => t + a.largura * a.qtd, 0)
    const pe = (material: string, unidade: string, formula: string, dimensoes: string, coef: string, perda: number, bruto: number) =>
      add({ etapa: 'Contrapiso e piso', material, unidade, tipo: 'Estimativa por composição', formula, dimensoes, coef, perda, bruto })
    if (p.rodape > 0 && p.rodapeBarraM > 0)
      pe('Rodapé (peças)', 'un', '(perímetro − largura das portas) ÷ peça × (1 + perda)', `perímetro ${f2(perim)} m − portas ${f2(portasL)} m`, `peça ${p.rodapeBarraM} m`, p.perdaRodape, com(Math.max(0, perim - portasL) / p.rodapeBarraM, p.perdaRodape))
    if (p.rejunteKgM2 > 0) pe('Rejunte', 'kg', 'área × consumo', `área ${f2(area1)} m²`, `${p.rejunteKgM2} kg/m²`, 0, area1 * p.rejunteKgM2)
    if (p.espPorPeca > 0) pe('Espaçadores', 'un', 'peças × espaçadores por peça', `${f2(areaPiso / (p.pisoC * p.pisoL))} peças`, `${p.espPorPeca} un/peça`, 0, (areaPiso / (p.pisoC * p.pisoL)) * p.espPorPeca)
    if (p.colanteKgM2 > 0 && p.colanteSacoKg > 0) pe('Argamassa colante', 'saco', 'área × consumo ÷ kg por saco', `área ${f2(area1)} m²`, `${p.colanteKgM2} kg/m²; saco ${p.colanteSacoKg} kg`, 0, (area1 * p.colanteKgM2) / p.colanteSacoKg)
  }

  // GESSO E DRYWALL — paredes (chapas, montantes, guias) e forro (chapas, perfis, pendurais); medidas informadas
  const chapaA = p.dwChapaC * p.dwChapaL, D = 'Gesso e drywall'
  const dwAc = (area: number, d: string) => {
    add({ etapa: D, material: 'Parafuso para drywall', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área de chapa × parafusos por m² × (1 + perda)', dimensoes: d, coef: `${p.dwParafM2} un/m²`, perda: p.perdaDw, bruto: com(area * p.dwParafM2, p.perdaDw) })
    add({ etapa: D, material: 'Fita para junta', unidade: 'm', tipo: 'Estimativa por composição', formula: 'área de chapa × m de fita por m² × (1 + perda)', dimensoes: d, coef: `${p.dwFitaMM2} m/m²`, perda: p.perdaDw, bruto: com(area * p.dwFitaMM2, p.perdaDw) })
    add({ etapa: D, material: 'Massa para junta', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'área de chapa × consumo', dimensoes: d, coef: `${p.dwMassaKgM2} kg/m²`, perda: 0, bruto: area * p.dwMassaKgM2 })
  }
  if (chapaA > 0 && p.dwBarraM > 0) {
    if (p.dwComp > 0 && p.dwAlt > 0) {
      const face = p.dwComp * p.dwAlt * p.dwFaces, nM = fim(p.dwComp / Math.max(p.dwEspMont, 0.1)) + 1, d = `parede ${p.dwComp} m × ${p.dwAlt} m; ${p.dwFaces} face(s) = ${f2(face)} m²`
      add({ etapa: D, material: 'Chapa de drywall', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área das faces ÷ área da chapa × (1 + perda)', dimensoes: `${d}; chapa ${p.dwChapaC}×${p.dwChapaL} m`, coef: `${f2(1 / chapaA)} un/m²`, perda: p.perdaDw, bruto: com(face / chapaA, p.perdaDw) })
      add({ etapa: D, material: 'Montante (barras)', unidade: 'barra', tipo: 'Geométrico', formula: '(⌈comprimento ÷ espaçamento⌉ + 1) × altura ÷ barra × (1 + perda)', dimensoes: `${nM} montantes de ${p.dwAlt} m; espaçamento ${p.dwEspMont} m`, coef: `barra ${p.dwBarraM} m`, perda: p.perdaDw, bruto: com((nM * p.dwAlt) / p.dwBarraM, p.perdaDw) })
      add({ etapa: D, material: 'Guia (barras)', unidade: 'barra', tipo: 'Geométrico', formula: '2 × comprimento (piso e teto) ÷ barra × (1 + perda)', dimensoes: `${p.dwComp} m × 2`, coef: `barra ${p.dwBarraM} m`, perda: p.perdaDw, bruto: com((2 * p.dwComp) / p.dwBarraM, p.perdaDw) })
      dwAc(face, d)
    }
    if (p.dwForroArea > 0) {
      const A = p.dwForroArea, d = `forro ${A} m²`
      add({ etapa: D, material: 'Chapa de drywall', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área do forro ÷ área da chapa × (1 + perda)', dimensoes: `${d}; chapa ${p.dwChapaC}×${p.dwChapaL} m`, coef: `${f2(1 / chapaA)} un/m²`, perda: p.perdaDw, bruto: com(A / chapaA, p.perdaDw) })
      add({ etapa: D, material: 'Perfil de forro (barras)', unidade: 'barra', tipo: 'Estimativa por composição', formula: 'área × m de perfil por m² ÷ barra × (1 + perda)', dimensoes: d, coef: `${p.dwForroPerfilM2} m/m²; barra ${p.dwBarraM} m`, perda: p.perdaDw, bruto: com((A * p.dwForroPerfilM2) / p.dwBarraM, p.perdaDw) })
      add({ etapa: D, material: 'Pendural', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área × penduras por m²', dimensoes: d, coef: `${p.dwPendM2} un/m²`, perda: 0, bruto: A * p.dwPendM2 })
      dwAc(A, d)
    }
  }

  // ESTRUTURA METÁLICA — perfis informados (bitolas e dimensionamento: projeto estrutural)
  if (p.metComp > 0 && p.metBarraM > 0) {
    const X = 'Estrutura metálica', kg = p.metComp * p.metKgM, d = `${p.metComp} m de perfis; ${p.metKgM} kg/m (conforme projeto)`
    add({ etapa: X, material: 'Perfil metálico (bitola conforme projeto)', unidade: 'barra', tipo: 'Geométrico', formula: 'comprimento total ÷ barra × (1 + perda)', dimensoes: d, coef: `barra ${p.metBarraM} m`, perda: p.perdaMet, bruto: com(p.metComp / p.metBarraM, p.perdaMet) })
    add({ etapa: X, material: 'Peso do aço estrutural', unidade: 'kg', tipo: 'Geométrico', formula: 'comprimento × kg/m', dimensoes: d, coef: `${p.metKgM} kg/m`, perda: 0, bruto: kg })
    add({ etapa: X, material: 'Eletrodo de solda', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'peso do aço × consumo', dimensoes: `${f2(kg)} kg de aço`, coef: `${p.metSoldaKgKg} kg/kg`, perda: 0, bruto: kg * p.metSoldaKgKg })
    if (p.metRend > 0 && p.latL > 0)
      add({ etapa: X, material: 'Tinta de fundo anticorrosiva', unidade: 'lata', tipo: 'Estimativa por composição', formula: 'comprimento × m² por metro × demãos ÷ rendimento ÷ litros da lata', dimensoes: `${f2(p.metComp * p.metSupM)} m² de superfície; ${p.metDemaos} demão(s)`, coef: `${p.metRend} m²/L/demão; lata ${p.latL} L`, perda: 0, bruto: (p.metComp * p.metSupM * p.metDemaos) / p.metRend / p.latL })
  }

  // ESTRUTURA DE MADEIRA (além do telhado) — metros informados (bitolas e dimensionamento: projeto)
  if (p.madComp > 0 && p.madBarraM > 0) {
    const d = `${p.madComp} m de peças (bitola conforme projeto)`
    add({ etapa: 'Estrutura de madeira', material: 'Madeira estrutural (bitola conforme projeto)', unidade: 'barra', tipo: 'Geométrico', formula: 'comprimento total ÷ barra × (1 + perda)', dimensoes: d, coef: `barra ${p.madBarraM} m`, perda: p.perdaMadeira, bruto: com(p.madComp / p.madBarraM, p.perdaMadeira) })
    add({ etapa: 'Estrutura de madeira', material: 'Prego/parafuso para madeira', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'comprimento × consumo', dimensoes: d, coef: `${p.madPregoKgM} kg/m`, perda: 0, bruto: p.madComp * p.madPregoKgM })
  }

  // ESQUADRIAS — portas e janelas cadastradas, agrupadas por medida
  if (p.esquadrias > 0) {
    const grupos = new Map<string, number>()
    for (const a of p.aberturas) { const k = `${a.tipo} ${f2(a.largura)} × ${f2(a.altura)} m`; grupos.set(k, (grupos.get(k) ?? 0) + a.qtd) }
    for (const [material, q] of grupos) add({ etapa: 'Esquadrias', material, unidade: 'un', tipo: 'Geométrico', formula: 'quantidade cadastrada', dimensoes: `${q} un`, coef: '—', perda: 0, bruto: q })
    const portas = p.aberturas.filter((a) => a.tipo === 'Porta').reduce((t, a) => t + a.qtd, 0)
    add({ etapa: 'Esquadrias', material: 'Fechadura e dobradiças (jogo)', unidade: 'un', tipo: 'Estimativa por composição', formula: '1 jogo por porta', dimensoes: `${portas} porta(s)`, coef: '1 jogo/porta', perda: 0, bruto: portas })
  }

  // IMPERMEABILIZAÇÃO (áreas informadas + topo e laterais do baldrame, quando ligado)
  const areaImp = p.imperArea + (p.imperBaldrame > 0 ? p.fundComp * (p.fundLarg + 2 * p.fundAlt) : 0)
  if (areaImp > 0 && p.imperKgM2 > 0) {
    const dI = `${f2(p.imperArea)} m² informados + ${f2(areaImp - p.imperArea)} m² de baldrame`
    add({ etapa: 'Impermeabilização', material: 'Área impermeabilizada', unidade: 'm²', tipo: 'Geométrico', formula: 'áreas informadas + comprimento × (largura + 2 × altura) do baldrame', dimensoes: dI, coef: '—', perda: 0, bruto: areaImp })
    add({ etapa: 'Impermeabilização', material: 'Impermeabilizante', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'área × consumo (já com as demãos)', dimensoes: dI, coef: `${p.imperKgM2} kg/m²`, perda: 0, bruto: areaImp * p.imperKgM2 })
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

  // PINTURA — massa, selador, lixa, tinta (1 ou 2 cores) e acessórios
  if (liq > 0 && p.faces > 0 && p.rendTinta > 0 && p.latL > 0) {
    const P = 'Pintura', areaP = liq * p.faces
    const dimP = `área líquida ${f2(liq)} m² × ${p.faces} face(s) = ${f2(areaP)} m²`
    const ac = (material: string, unidade: string, formula: string, dimensoes: string, coef: string, bruto: number) =>
      add({ etapa: P, material, unidade, tipo: 'Estimativa por composição', formula, dimensoes, coef, perda: 0, bruto })
    const areaMassa = p.massaTipo > 0 ? areaP * (p.massaPct / 100) : 0
    if (areaMassa > 0 && p.rendMassa > 0)
      ac(p.massaTipo === 2 ? 'Massa acrílica' : 'Massa corrida PVA', 'lata', 'área com massa × demãos ÷ rendimento por lata', `${dimP}; ${p.massaPct}% com massa = ${f2(areaMassa)} m²; ${p.demaosMassa} demão(s)`, `${p.rendMassa} m²/lata/demão`, (areaMassa * p.demaosMassa) / p.rendMassa)
    const areaSel = areaP * (p.seladorPct / 100)
    if (areaSel > 0 && p.rendSelador > 0 && p.latSeladorL > 0)
      ac('Selador', 'lata', 'área × demãos ÷ rendimento ÷ litros da lata', `${dimP}; ${p.seladorPct}% com selador; ${p.demaosSelador} demão(s)`, `${p.rendSelador} m²/L/demão; lata ${p.latSeladorL} L`, (areaSel * p.demaosSelador) / p.rendSelador / p.latSeladorL)
    const cor2 = Math.min(100, Math.max(0, p.cor2Pct)) / 100
    const tinta = (nome: string, area: number) => area > 0 &&
      ac(nome, 'lata', 'área × demãos ÷ rendimento ÷ litros da lata', `${dimP}; área desta cor ${f2(area)} m²; ${p.demaos} demão(s)`, `${p.rendTinta} m²/L/demão; lata ${p.latL} L`, (area * p.demaos) / p.rendTinta / p.latL)
    if (cor2 === 0) tinta('Tinta', areaP)
    else { tinta('Tinta (cor 1)', areaP * (1 - cor2)); tinta('Tinta (cor 2)', areaP * cor2) }
    const cores = cor2 > 0 && cor2 < 1 ? 2 : 1
    if (p.lixaM2 > 0)
      ac('Lixa', 'folha', '(área × demãos de massa + área a pintar) ÷ área por folha', `${dimP}`, `${p.lixaM2} m²/folha`, (areaMassa * p.demaosMassa + areaP) / p.lixaM2)
    if (p.roloM2 > 0)
      ac('Rolo de pintura', 'un', 'maior entre nº de cores e (área × demãos ÷ m² por rolo)', dimP, `${p.roloM2} m²/rolo`, Math.max(cores, (areaP * p.demaos) / p.roloM2))
    if (p.pincelM2 > 0)
      ac('Pincel', 'un', 'maior entre nº de cores e (área ÷ m² por pincel)', dimP, `${p.pincelM2} m²/pincel`, Math.max(cores, areaP / p.pincelM2))
    const perimAb = p.aberturas.reduce((t, a) => t + 2 * (a.largura + a.altura) * a.qtd, 0)
    if (perimAb > 0 && p.fitaM > 0)
      ac('Fita crepe', 'rolo', 'perímetro das aberturas ÷ metros por rolo', `perímetro ${f2(perimAb)} m`, `${p.fitaM} m/rolo`, perimAb / p.fitaM)
  }

  // INSTALAÇÕES — contagem por quantidades informadas; circuitos, bitolas e diâmetros exigem projeto e profissional habilitado
  const dv = (a: number, b: number) => (b > 0 ? a / b : 0)
  const cont = (etapa: string, material: string, unidade: string, formula: string, dimensoes: string, coef: string, perda: number, bruto: number) => {
    if (bruto > 0) add({ etapa, material, unidade, tipo: 'Estimativa por composição', formula, dimensoes, coef, perda, bruto })
  }
  const inf = (etapa: string, material: string, qtd: number) => cont(etapa, material, 'un', 'quantidade informada', `${qtd} un`, '—', 0, qtd)
  const EL = 'Instalações elétricas', pts = p.eltTomadas + p.eltInterruptores + p.eltPontosLuz
  inf(EL, 'Tomada', p.eltTomadas); inf(EL, 'Interruptor', p.eltInterruptores); inf(EL, 'Ponto de iluminação', p.eltPontosLuz)
  cont(EL, 'Caixa 4×2', 'un', 'tomadas + interruptores', `${p.eltTomadas} + ${p.eltInterruptores}`, '—', 0, p.eltTomadas + p.eltInterruptores)
  cont(EL, 'Caixa octogonal', 'un', 'pontos de iluminação', `${p.eltPontosLuz}`, '—', 0, p.eltPontosLuz)
  inf(EL, 'Disjuntor (tipo e corrente conforme projeto)', p.eltDisjuntores)
  cont(EL, 'Quadro de distribuição', 'un', '1 quando há disjuntores', `${p.eltDisjuntores} disjuntor(es)`, '—', 0, p.eltDisjuntores > 0 ? 1 : 0)
  cont(EL, 'Eletroduto (barras)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${pts} pontos × ${p.eltMPorPonto} m`, `barra ${p.barraEletrodutoM} m`, p.perdaInst, com(dv(pts * p.eltMPorPonto, p.barraEletrodutoM), p.perdaInst))
  cont(EL, 'Cabo (bitola conforme projeto)', 'm', 'pontos × m de cabo por ponto × (1 + perda)', `${pts} pontos × ${p.eltCaboMPorPonto} m`, `${p.eltCaboMPorPonto} m/ponto`, p.perdaInst, com(pts * p.eltCaboMPorPonto, p.perdaInst))
  const HI = 'Instalações hidráulicas e sanitárias'
  cont(HI, 'Tubo de água fria (diâmetro conforme projeto)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${p.hidPontosAgua} pontos × ${p.hidMPorPonto} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.hidPontosAgua * p.hidMPorPonto, p.barraTuboM), p.perdaInst))
  cont(HI, 'Conexões de água fria', 'un', 'pontos × conexões por ponto', `${p.hidPontosAgua} pontos`, `${p.conexPorPonto} un/ponto`, 0, p.hidPontosAgua * p.conexPorPonto)
  cont(HI, 'Tubo de esgoto (diâmetro conforme projeto)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${p.sanPontos} pontos × ${p.sanMPorPonto} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.sanPontos * p.sanMPorPonto, p.barraTuboM), p.perdaInst))
  cont(HI, 'Conexões de esgoto', 'un', 'pontos × conexões por ponto', `${p.sanPontos} pontos`, `${p.conexPorPonto} un/ponto`, 0, p.sanPontos * p.conexPorPonto)
  for (const [m, q] of [['Registro', p.hidRegistros], ['Caixa sifonada', p.caixasSifonadas], ['Ralo', p.ralos], ['Caixa de inspeção', p.caixasInspecao], ['Vaso sanitário', p.vasos], ['Lavatório', p.lavatorios], ['Pia', p.pias], ['Chuveiro', p.chuveiros], ['Reservatório', p.reservatorios]] as [string, number][]) inf(HI, m, q)
  const DR = 'Drenagem'
  cont(DR, 'Tubo de drenagem (barras)', 'barra', 'metros ÷ barra × (1 + perda)', `${p.drenTuboM} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.drenTuboM, p.barraTuboM), p.perdaInst))
  inf(DR, 'Caixa de drenagem', p.drenCaixas); inf(DR, 'Ralo de drenagem', p.drenRalos)
  cont(DR, 'Canaleta', 'm', 'metros informados × (1 + perda)', `${p.canaletaM} m`, '—', p.perdaInst, com(p.canaletaM, p.perdaInst))
  cont(DR, 'Brita de envelopamento', 'm³', 'metros de tubo × m³/m', `${p.drenTuboM} m`, `${p.drenBritaM3m} m³/m`, 0, p.drenTuboM * p.drenBritaM3m)

  // COBERTURA E MADEIRAMENTO — usa a área INCLINADA (projeção × √(1+i²)), nunca só a área horizontal
  if (p.roofC > 0 && p.roofL > 0 && p.espTerca > 0 && p.espCaibro > 0 && p.espRipa > 0 && p.barraM > 0) {
    const quatro = p.aguas === 4 // 4 águas: áreas iguais de mesma inclinação; madeira estimada por área ÷ espaçamento
    const n = quatro ? 4 : p.aguas === 2 ? 2 : 1
    const fator = Math.sqrt(1 + (p.inclinacao / 100) ** 2)
    const C = p.roofC + 2 * p.beiral // comprimento (paralelo à cumeeira)
    const W = p.roofL + 2 * p.beiral // largura em projeção (sentido do caimento)
    const inc = (W / (n === 1 ? 1 : 2)) * fator // comprimento inclinado de cada água
    const area = C * W * fator
    const calhaL = quatro ? 2 * (C + W) : C * (n === 2 ? 2 : 1) // metros de beiral com calha
    const dm = `${n} água(s); ${f2(C)} × ${f2(W)} m (c/ beiral ${p.beiral} m); inclinação ${p.inclinacao}% (fator ${f2(fator)}); água inclinada ${f2(inc)} m`
    const E = 'Cobertura e madeiramento'
    add({ etapa: E, material: 'Telha', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área inclinada × rendimento × (1 + perda)',
      dimensoes: `${dm}; área inclinada ${f2(area)} m²`, coef: `${p.telhaRend} un/m²`, perda: p.perdaTelha, bruto: p.telhaMetalica > 0 ? 0 : com(area * p.telhaRend, p.perdaTelha) })
    if (p.telhaMetalica > 0)
      add({ etapa: E, material: 'Telha metálica trapezoidal', unidade: 'm²', tipo: 'Estimativa por composição', formula: 'área inclinada × (1 + sobreposição) × (1 + perda)', dimensoes: `${dm}; área inclinada ${f2(area)} m²`, coef: `sobreposição ${p.sobreMetal}%`, perda: p.perdaTelha, bruto: com(com(area, p.sobreMetal), p.perdaTelha) })
    add({ etapa: E, material: 'Fixação do telhado (parafusos/ganchos)', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área inclinada × fixações por m² × (1 + perda)', dimensoes: `área inclinada ${f2(area)} m²`, coef: `${p.fixPorM2} un/m²`, perda: p.perdaTelha, bruto: com(area * p.fixPorM2, p.perdaTelha) })
    if (p.mantaCob > 0)
      add({ etapa: E, material: 'Manta de subcobertura', unidade: 'm²', tipo: 'Geométrico', formula: 'área inclinada × (1 + perda)', dimensoes: `área inclinada ${f2(area)} m²`, coef: '—', perda: p.perdaTelha, bruto: com(area, p.perdaTelha) })
    const madeira = (material: string, qtd: number, cada: number, formula: string, esp: number) =>
      add({ etapa: E, material, unidade: 'barra', tipo: 'Geométrico', formula: `${formula}; metros ÷ barra comercial × (1 + perda)`,
        dimensoes: `${dm}; ${qtd} peça(s) de ${f2(cada)} m = ${f2(qtd * cada)} m; espaçamento ${esp} m`, coef: `barra ${p.barraM} m`, perda: p.perdaMadeira,
        bruto: com((qtd * cada) / p.barraM, p.perdaMadeira) })
    if (quatro) {
      const ma = (material: string, esp: number) => add({ etapa: E, material, unidade: 'barra', tipo: 'Geométrico',
        formula: 'metros ≈ área inclinada ÷ espaçamento (estimativa para 4 águas); metros ÷ barra comercial × (1 + perda)',
        dimensoes: `${dm}; área inclinada ${f2(area)} m² ÷ ${esp} m = ${f2(area / esp)} m`, coef: `barra ${p.barraM} m`, perda: p.perdaMadeira, bruto: com(area / esp / p.barraM, p.perdaMadeira) })
      ma('Terça (barras)', p.espTerca); ma('Caibro (barras)', p.espCaibro); ma('Ripa (barras)', p.espRipa)
    } else {
      madeira('Terça (barras)', (fim(inc / p.espTerca) + 1) * n, C, 'peças/água = ⌈inclinado ÷ espaçamento⌉ + 1', p.espTerca)
      madeira('Caibro (barras)', (fim(C / p.espCaibro) + 1) * n, inc, 'peças/água = ⌈comprimento ÷ espaçamento⌉ + 1', p.espCaibro)
      madeira('Ripa (barras)', (fim(inc / p.espRipa) + 1) * n, C, 'peças/água = ⌈inclinado ÷ espaçamento⌉ + 1', p.espRipa)
    }
    if (n === 2 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Cumeeira', unidade: 'un', tipo: 'Geométrico', formula: 'comprimento ÷ peça × (1 + perda)',
        dimensoes: `${f2(C)} m; peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(C / p.cumeeiraM, p.perdaTelha) })
    const rg = quatro ? Math.abs(C - W) : 0 // cumeeira do telhado de 4 águas
    const espTot = (quatro ? 4 * (Math.min(C, W) / 2) * Math.sqrt(2 + (p.inclinacao / 100) ** 2) : 0) + p.espigaoExtraM // espigões
    if (rg > 0 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Cumeeira', unidade: 'un', tipo: 'Geométrico', formula: '(maior lado − menor lado) ÷ peça × (1 + perda)', dimensoes: `${f2(rg)} m; peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(rg / p.cumeeiraM, p.perdaTelha) })
    if (espTot > 0 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Espigão', unidade: 'un', tipo: 'Geométrico', formula: 'comprimento dos espigões ÷ peça × (1 + perda); 4 águas: 4 × (menor lado ÷ 2) × √(2 + i²)', dimensoes: `${f2(espTot)} m (inclui ${p.espigaoExtraM} m informados); peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(espTot / p.cumeeiraM, p.perdaTelha) })
    if (p.tesouras > 0)
      add({ etapa: E, material: 'Tesoura (quantidade informada)', unidade: 'un', tipo: 'Geométrico', formula: 'quantidade informada pelo usuário; dimensionamento exige profissional',
        dimensoes: '—', coef: '—', perda: 0, bruto: p.tesouras })
    if (p.calha > 0 && p.calhaBarraM > 0)
      add({ etapa: E, material: 'Calha (barras)', unidade: 'barra', tipo: 'Geométrico', formula: 'metros de beiral com calha ÷ barra × (1 + perda)', dimensoes: `${f2(calhaL)} m de beiral`, coef: `barra ${p.calhaBarraM} m`, perda: p.perdaTelha, bruto: com(calhaL / p.calhaBarraM, p.perdaTelha) })
    if (p.condutorN > 0 && p.condutorBarraM > 0)
      add({ etapa: E, material: 'Condutor (barras)', unidade: 'barra', tipo: 'Geométrico', formula: 'condutores × altura ÷ barra', dimensoes: `${p.condutorN} × ${p.condutorAltM} m`, coef: `barra ${p.condutorBarraM} m`, perda: 0, bruto: (p.condutorN * p.condutorAltM) / p.condutorBarraM })
    if (p.rufoM > 0)
      add({ etapa: E, material: 'Rufo', unidade: 'm', tipo: 'Geométrico', formula: 'metros informados × (1 + perda)', dimensoes: `${p.rufoM} m`, coef: '—', perda: p.perdaTelha, bruto: com(p.rufoM, p.perdaTelha) })
  }

  // COMPOSIÇÕES PRÓPRIAS (biblioteca técnica): quantidade = base × coeficiente × (1 + perda)
  const bases = { area: [area1, 'área construída (m²)'], parede: [liq, 'área líquida de parede (m²)'], fixa: [1, 'quantidade fixa'] } as const
  for (const c of p.composicoes) {
    const [b, rotulo] = bases[c.base]
    add({ etapa: c.etapa || 'Outros', material: c.nome, unidade: c.unidade, tipo: 'Estimativa por composição', formula: `${rotulo} × coeficiente × (1 + perda)`,
      dimensoes: `base ${f2(b)}`, coef: `${c.coef} ${c.unidade} por unidade da base`, perda: c.perda, bruto: com(b * c.coef, c.perda) })
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
