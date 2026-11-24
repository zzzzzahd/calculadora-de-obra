/**
 * Parâmetros do cálculo (editáveis na tela). Nenhum coeficiente é fixo no motor: tudo vem daqui.
 * Valor 0 normalmente significa "não calcular" esse item.
 */
import type { Abertura } from '../types'
import type { Composicao, ConexaoHidro } from './motor/tipos'

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
  // Demolição: espessuras do que será demolido (0 = não calcula o volume de entulho) e empolamento do entulho (%)
  demolEspParedeM: number; demolEspRevM: number; demolEspPisoM: number; entulhoEmpPct: number
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
  // Traços e aditivos (aditivo: 0 nenhum, 1 plastificante, 2 impermeabilizante, 3 adesivo PVA; % do peso do cimento)
  chapCalKgM3: number; embCalKgM3: number; aditivoConc: number; aditivoConcPct: number; aditivoArg: number; aditivoArgPct: number
  // Biblioteca técnica: composições criadas pelo usuário
  composicoes: Composicao[]
  /** Conexões hidráulicas detalhadas (vazio = usa só o coeficiente único "conexões por ponto"). */
  conexoes: ConexaoHidro[]
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
  demolEspParedeM: 0, demolEspRevM: 0, demolEspPisoM: 0, entulhoEmpPct: 0,
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
  chapCalKgM3: 0, embCalKgM3: 0, aditivoConc: 0, aditivoConcPct: 0, aditivoArg: 0, aditivoArgPct: 0,
  composicoes: [],
  conexoes: [],
  sacoKg: 50,
}
