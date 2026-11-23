/**
 * LEVANTAMENTO RESOLVIDO — lê o cadastro central de ambientes (lados compartilhados, pé-direito, aberturas,
 * acabamentos) e devolve as áreas e comprimentos que o motor usa. Funções puras, sem efeitos colaterais.
 *
 * Regras (levantamento preliminar; as dimensões dos ambientes são internas e a espessura da parede não entra):
 *  - Cada trecho de parede entra uma única vez na alvenaria; a parede entre dois ambientes não é contada duas vezes.
 *  - Faces internas: cada ambiente conta o seu perímetro × pé-direito (a divisa tem uma face em cada ambiente).
 *  - Faces externas: só os trechos externos.
 *  - Altura de um trecho compartilhado = maior pé-direito entre os dois ambientes.
 *  - Abertura sem lado informado é tratada como parede externa. Abertura em divisa desconta uma vez na alvenaria
 *    e uma vez na face de cada ambiente. Aberturas sem ambiente (lista geral) descontam do total.
 *  - Ações (construir, manter, substituir, demolir, recuperar, reaproveitar): só construir e substituir geram material novo;
 *    demolir e substituir geram demolição (entulho); recuperar e reaproveitar só são listados (sem compra de material novo).
 *    Parede compartilhada: vale a ação definida na divisa; sem ela, a dos ambientes (se divergirem, vale "construir" e há aviso).
 *  - Sem nenhum campo novo preenchido, o resultado é idêntico ao do v24.
 */
import { constroi, demole, type Abertura, type Acao, type Ambiente, type LadoIdx, type Obra } from '../types'
import { areaAmbiente, ladosMetros, perimetroAmbiente } from './geometry'
import { toMetros } from './units'

export interface TrechoParede {
  id: string
  ambienteA: string
  ambienteB?: string
  comprimento: number // m
  altura: number // m
  tipo: 'externa' | 'compartilhada'
  acao: Acao
}

export interface AberturaResolvida {
  ab: Abertura
  ambienteId?: string // ambiente em que foi cadastrada (ausente = lista geral)
  vizinhoId?: string // ambiente do outro lado, quando a abertura está em uma divisa
  area: number // m² (largura × altura × quantidade)
  acaoParede: Acao // ação da parede em que a abertura está (lista geral = construir)
}

export interface AmbienteResolvido {
  id: string; nome: string
  area: number; perimetro: number; altura: number // m², m, m
  faceInterna: number // perímetro × altura × pavimentos, antes das aberturas
  faceInternaLiquida: number
  portasLargura: number // soma das larguras de portas que abrem neste ambiente (rodapé)
  revInterno: number // área interna para chapisco e emboço
  pintura: number // área interna para pintura (sem a parte cerâmica)
  ceramica: number // área de revestimento cerâmico derivada do ambiente
  contrapiso: boolean; pecas: boolean; forro: boolean | null // null = segue o parâmetro geral
}

/** Quantidades por elemento para uma ação: m² (paredes, revestimento, piso, forro) e unidades (esquadrias). */
export interface AcaoTotais { paredes: number; revestimento: number; piso: number; forro: number; esquadrias: number }
const zerar = (): AcaoTotais => ({ paredes: 0, revestimento: 0, piso: 0, forro: 0, esquadrias: 0 })

export interface Levantamento {
  alturaObra: number; pavimentos: number
  ambientes: AmbienteResolvido[]
  trechos: TrechoParede[]
  aberturas: AberturaResolvida[]
  areaAberturas: number // cada abertura uma vez
  externaM: number; compartilhadaM: number // comprimentos de parede (1 pavimento)
  alvBruta: number // todas as paredes (× pavimentos), qualquer ação
  alvConstruirBruta: number; descAlvConstruir: number; alvLiquida: number // só as paredes a construir: bruta, aberturas nelas e líquida
  externaConstruirM: number; compartilhadaConstruirM: number
  demolir: AcaoTotais; recuperar: AcaoTotais; reaproveitar: AcaoTotais
  revInterno: number; pintInterna: number // faces internas líquidas (descontadas as aberturas)
  extBruta: number; extLiquida: number // faces externas
  area1: number; areaContrapiso: number; areaPecas: number
  perimRodape: number; portasRodapeM: number
  ceramica: number
  /** true = nenhum campo do cadastro central altera o cálculo (resultado igual ao v24). */
  simples: boolean
  avisos: string[]
}

const EPS = 1e-6
const lado = (a: Ambiente, i: LadoIdx) => { const l = ladosMetros(a); return i % 2 === 0 ? l.c : l.l }
const area = (b: Abertura) => b.largura * b.altura * b.qtd

/** Todas as aberturas do levantamento (dos ambientes e da lista geral), cada uma uma vez. */
export function todasAberturas(ambientes: Ambiente[], geral: Abertura[]): Abertura[] {
  return [...ambientes.flatMap((a) => a.aberturas ?? []), ...geral]
}

export const alturaDoAmbiente = (a: Ambiente, alturaObraM: number): number =>
  a.peDireito && a.peDireito > 0 ? toMetros(a.peDireito, a.unidade) : alturaObraM

export function resolverLevantamento(obra: Obra, ambientes: Ambiente[], geral: Abertura[]): Levantamento {
  const hObra = toMetros(obra.alturaParede, obra.unidadeAltura)
  const pav = obra.pavimentos
  const avisos: string[] = []
  const porId = new Map(ambientes.map((a) => [a.id, a]))
  const alt = (a: Ambiente) => alturaDoAmbiente(a, hObra)

  // 1) Trechos de parede: lados externos e lados compartilhados (contados uma vez)
  const consumido = new Set<string>()
  const vizinho = new Map<string, string>() // `${ambiente}:${lado}` -> ambiente do outro lado (só lados compartilhados)
  const trechos: TrechoParede[] = []
  const acaoLado = new Map<string, Acao>() // `${ambiente}:${lado}` -> ação da parede daquele lado
  const acaoParedes = (a: Ambiente): Acao => a.acoes?.paredes ?? 'construir'
  const externo = (a: Ambiente, i: LadoIdx, comp: number) => {
    if (!acaoLado.has(`${a.id}:${i}`)) acaoLado.set(`${a.id}:${i}`, acaoParedes(a))
    if (comp > EPS) trechos.push({ id: `${a.id}:${i}:ext`, ambienteA: a.id, comprimento: comp, altura: alt(a), tipo: 'externa', acao: acaoParedes(a) })
  }
  for (const a of ambientes) {
    for (const i of [0, 1, 2, 3] as LadoIdx[]) {
      const chave = `${a.id}:${i}`
      if (consumido.has(chave)) continue
      consumido.add(chave)
      const compLado = lado(a, i)
      const dv = a.divisas?.[i]
      const b = dv ? porId.get(dv.com) : undefined
      if (dv && (!b || b.id === a.id)) {
        avisos.push(`${a.nome}: o lado ${i + 1} aponta para ${b ? 'o próprio ambiente' : 'um ambiente que não existe mais'}; tratado como parede externa.`)
        externo(a, i, compLado); continue
      }
      if (!dv || !b) { externo(a, i, compLado); continue }
      const trechoA = dv.trecho && dv.trecho > 0 ? dv.trecho : compLado
      if (trechoA > compLado + EPS) avisos.push(`${a.nome}: o trecho compartilhado do lado ${i + 1} (${trechoA} m) é maior que o lado (${compLado} m); usado o lado inteiro.`)
      let comp = Math.min(trechoA, compLado)
      let acaoDiv: Acao | undefined = dv.acao
      // lado correspondente em b (que aponta de volta para a)
      const m = ([0, 1, 2, 3] as LadoIdx[]).find((k) => b.divisas?.[k]?.com === a.id && !consumido.has(`${b.id}:${k}`))
      if (m !== undefined) {
        consumido.add(`${b.id}:${m}`)
        const compB = lado(b, m), dvb = b.divisas![m]!
        const trechoB = Math.min(dvb.trecho && dvb.trecho > 0 ? dvb.trecho : compB, compB)
        if (Math.abs(trechoB - comp) > 0.01) avisos.push(`${a.nome} e ${b.nome}: trechos compartilhados diferentes (${comp} m e ${trechoB} m); usado o menor.`)
        comp = Math.min(comp, trechoB)
        acaoDiv = acaoDiv ?? dvb.acao
        vizinho.set(`${b.id}:${m}`, a.id)
        externo(b, m, compB - comp)
      } else {
        avisos.push(`${a.nome} informa divisa com ${b.nome}, mas ${b.nome} não informa o lado correspondente; confirme em ${b.nome} para não contar a parede em duplicidade.`)
      }
      vizinho.set(chave, b.id)
      if (Math.abs(alt(a) - alt(b)) > EPS) avisos.push(`${a.nome} e ${b.nome} têm pés-direitos diferentes; a parede compartilhada usa o maior (${Math.max(alt(a), alt(b)).toLocaleString('pt-BR')} m).`)
      if (!acaoDiv) {
        const x = acaoParedes(a), y = acaoParedes(b)
        acaoDiv = x === y ? x : (constroi(x) || constroi(y) ? 'construir' : demole(x) || demole(y) ? 'demolir' : x)
        if (x !== y) avisos.push(`${a.nome} (${x}) e ${b.nome} (${y}) têm ações diferentes para a parede compartilhada; usada: ${acaoDiv}. Defina a ação no lado compartilhado para confirmar.`)
      }
      acaoLado.set(chave, acaoDiv)
      if (m !== undefined) acaoLado.set(`${b.id}:${m}`, acaoDiv)
      trechos.push({ id: `${a.id}:${i}:div`, ambienteA: a.id, ambienteB: b.id, comprimento: comp, altura: Math.max(alt(a), alt(b)), tipo: 'compartilhada', acao: acaoDiv })
      externo(a, i, compLado - comp)
    }
  }

  // 2) Aberturas: do ambiente (com lado) e da lista geral
  const aberturas: AberturaResolvida[] = []
  for (const a of ambientes) for (const ab of a.aberturas ?? []) {
    const v = ab.lado !== undefined ? vizinho.get(`${a.id}:${ab.lado}`) : undefined
    if (ab.lado === undefined && a.divisas && Object.keys(a.divisas).length > 0) avisos.push(`${a.nome}: ${ab.tipo.toLowerCase()} ${ab.largura}×${ab.altura} m sem lado informado; considerada em parede externa.`)
    const acaoParede = (ab.lado !== undefined ? acaoLado.get(`${a.id}:${ab.lado}`) : undefined) ?? a.acoes?.paredes ?? 'construir'
    aberturas.push({ ab, ambienteId: a.id, vizinhoId: v, area: area(ab), acaoParede })
  }
  for (const ab of geral) aberturas.push({ ab, area: area(ab), acaoParede: 'construir' })

  // 3) Totais de parede
  const externaM = trechos.filter((t) => t.tipo === 'externa').reduce((s, t) => s + t.comprimento, 0)
  const compartilhadaM = trechos.filter((t) => t.tipo === 'compartilhada').reduce((s, t) => s + t.comprimento, 0)
  const alvBruta = trechos.reduce((s, t) => s + t.comprimento * t.altura, 0) * pav
  const areaAb = aberturas.reduce((s, x) => s + x.area, 0)
  // parede líquida (sem aberturas) das paredes cuja ação satisfaz o critério
  const paredeLiquida = (ok: (a: Acao) => boolean) =>
    Math.max(0, trechos.filter((t) => ok(t.acao)).reduce((s, t) => s + t.comprimento * t.altura, 0) * pav - aberturas.filter((x) => ok(x.acaoParede)).reduce((s, x) => s + x.area, 0))
  const novas = trechos.filter((t) => constroi(t.acao))
  const alvConstruirBruta = novas.reduce((s, t) => s + t.comprimento * t.altura, 0) * pav
  const descAlvConstruir = aberturas.filter((x) => constroi(x.acaoParede)).reduce((s, x) => s + x.area, 0)
  const alvLiquida = Math.max(0, alvConstruirBruta - descAlvConstruir)
  const externaConstruirM = novas.filter((t) => t.tipo === 'externa').reduce((s, t) => s + t.comprimento, 0)
  const compartilhadaConstruirM = novas.filter((t) => t.tipo === 'compartilhada').reduce((s, t) => s + t.comprimento, 0)
  // faces externas: só dos trechos externos de ambientes cujo revestimento será construído
  const donoConstroiRev = (id: string) => constroi(porId.get(id)?.acoes?.revestimento)
  const extBruta = trechos.filter((t) => t.tipo === 'externa' && donoConstroiRev(t.ambienteA)).reduce((s, t) => s + t.comprimento * t.altura, 0) * pav
  const descExt = aberturas.filter((x) => !x.vizinhoId && (!x.ambienteId || donoConstroiRev(x.ambienteId))).reduce((s, x) => s + x.area, 0) // externas e da lista geral
  const extLiquida = Math.max(0, extBruta - descExt)
  const geralArea = aberturas.filter((x) => !x.ambienteId).reduce((s, x) => s + x.area, 0)

  // 4) Por ambiente: faces internas, revestimento, pintura, cerâmica, piso e forro
  const amb: AmbienteResolvido[] = ambientes.map((a) => {
    const h = alt(a), per = perimetroAmbiente(a)
    const faceInterna = per * h * pav
    const doAmbiente = aberturas.filter((x) => x.ambienteId === a.id || x.vizinhoId === a.id)
    const desc = doAmbiente.reduce((s, x) => s + x.area, 0)
    const faceLiq = Math.max(0, faceInterna - desc)
    const portasLargura = doAmbiente.filter((x) => x.ab.tipo === 'Porta').reduce((s, x) => s + x.ab.largura * x.ab.qtd, 0)
    const rev = a.acabamento?.revParede ?? 'emboco_pintura'
    const novoRev = constroi(a.acoes?.revestimento)
    let ceramica = 0
    if (rev === 'ceramica' && novoRev) {
      const hc = Math.min(a.acabamento?.alturaCeramica ? toMetros(a.acabamento.alturaCeramica, a.unidade) : 0, h)
      if (!(hc > 0)) avisos.push(`${a.nome}: informe a altura do revestimento cerâmico.`)
      else {
        const portas = doAmbiente.filter((x) => x.ab.tipo === 'Porta').reduce((s, x) => s + x.ab.largura * Math.min(x.ab.altura, hc) * x.ab.qtd, 0)
        ceramica = Math.min(faceLiq, Math.max(0, per * hc * pav - portas)) // janelas não são descontadas (peitoril não informado)
      }
    }
    const piso = a.acabamento?.piso
    return {
      id: a.id, nome: a.nome, area: areaAmbiente(a), perimetro: per, altura: h, faceInterna, faceInternaLiquida: faceLiq, portasLargura,
      revInterno: rev === 'nenhum' || !novoRev ? 0 : faceLiq, pintura: rev === 'nenhum' || !novoRev ? 0 : Math.max(0, faceLiq - ceramica), ceramica,
      contrapiso: piso !== 'nenhum' && constroi(a.acoes?.piso), pecas: (piso === undefined || piso === 'ceramico' || piso === 'porcelanato') && constroi(a.acoes?.piso),
      forro: constroi(a.acoes?.forro) ? (a.acabamento?.forro ?? null) : false,
    }
  })
  const soma = (f: (x: AmbienteResolvido) => number) => amb.reduce((s, x) => s + f(x), 0)
  const area1 = soma((x) => x.area)
  const areaContrapiso = soma((x) => (x.contrapiso ? x.area : 0))
  const areaPecas = soma((x) => (x.pecas ? x.area : 0))
  const portasGeralM = geral.filter((b) => b.tipo === 'Porta').reduce((s, b) => s + b.largura * b.qtd, 0)
  const portasRodapeM = soma((x) => (x.pecas ? x.portasLargura : 0)) + portasGeralM
  const perimRodape = Math.max(0, soma((x) => (x.pecas ? x.perimetro : 0)) - portasRodapeM)

  const porAcao = (ok: (x: Acao | undefined) => boolean): AcaoTotais => {
    const t = zerar()
    t.paredes = paredeLiquida((x) => ok(x))
    for (const a of ambientes) {
      const r = amb.find((x) => x.id === a.id)!
      if (ok(a.acoes?.revestimento) && (a.acoes?.revestimento !== undefined)) t.revestimento += r.faceInternaLiquida
      if (ok(a.acoes?.piso) && a.acoes?.piso !== undefined) t.piso += r.area
      if (ok(a.acoes?.forro) && a.acoes?.forro !== undefined) t.forro += r.area
    }
    t.esquadrias = aberturas.filter((x) => x.ab.acao !== undefined && ok(x.ab.acao)).reduce((s, x) => s + x.ab.qtd, 0)
    return t
  }
  const demolir = porAcao(demole)
  const recuperar = porAcao((x) => x === 'recuperar')
  const reaproveitar = porAcao((x) => x === 'reaproveitar')

  const simples = trechos.every((t) => t.tipo === 'externa' && t.acao === 'construir')
    && aberturas.every((x) => x.ab.acao === undefined || x.ab.acao === 'construir')
    && ambientes.every((a) => (!a.acoes || Object.values(a.acoes).every((v) => v === undefined || v === 'construir')) && !Object.values(a.divisas ?? {}).some((d) => d?.acao && d.acao !== 'construir') && ![...(a.aberturas ?? [])].some((x) => x.acao && x.acao !== 'construir') && (!a.peDireito || Math.abs(alt(a) - hObra) < EPS)
      && !a.acabamento?.piso && (!a.acabamento?.revParede || a.acabamento.revParede === 'emboco_pintura') && a.acabamento?.forro === undefined)

  const res = {
    alturaObra: hObra, pavimentos: pav, ambientes: amb, trechos, aberturas, areaAberturas: areaAb, externaM, compartilhadaM,
    alvBruta, alvConstruirBruta, descAlvConstruir, alvLiquida, externaConstruirM, compartilhadaConstruirM, extBruta, extLiquida, demolir, recuperar, reaproveitar,
    revInterno: Math.max(0, soma((x) => x.revInterno) - geralArea), pintInterna: Math.max(0, soma((x) => x.pintura) - geralArea),
    area1, areaContrapiso, areaPecas, perimRodape, portasRodapeM, ceramica: soma((x) => x.ceramica), simples, avisos,
  }
  // Caminho legado (ambientes só com nome e medidas, aberturas só na lista geral): mesma conta do v24, na mesma ordem das somas,
  // para o resultado ser idêntico bit a bit (somar por trechos daria o mesmo valor, mas com ruído de ponto flutuante na última casa).
  if (simples && aberturas.every((x) => !x.ambienteId)) {
    const bruta = ambientes.reduce((t, a) => t + perimetroAmbiente(a) * alt(a), 0) * pav
    const liq = Math.max(0, bruta - areaAb)
    Object.assign(res, { alvBruta: bruta, alvConstruirBruta: bruta, extBruta: bruta, alvLiquida: liq, revInterno: liq, pintInterna: liq, extLiquida: liq })
  }
  return res
}
