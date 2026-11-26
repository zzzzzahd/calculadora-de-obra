/**
 * ASSISTENTE EM TEXTO LIVRE — núcleo determinístico.
 *
 * A IA só EXTRAI fatos do que o usuário escreveu (validarExtracao). Tudo o resto é código testável:
 *  - mesclar: junta os fatos; valor diferente do já informado vira uma CONTRADIÇÃO pendente (nada é sobrescrito em silêncio);
 *  - verificar: contradições por regra (ex.: "sem elétrica" mas com pontos elétricos);
 *  - proximaPergunta: UMA pergunta por vez, na ordem, sem repetir (cada pergunta respondida ou pulada fica registrada);
 *  - responder: interpreta a resposta (números, sim/não, escolhas) sem IA; textos livres pedem a IA (precisaIA);
 *  - montarLevantamento: converte os fatos em obra, ambientes, parâmetros e opções do cálculo.
 * Nada é inventado: o que não foi dito fica em branco e aparece em "usouPadrao" (o que o programa assumiu ou deixou de calcular).
 */
import { ACOES, PONTOS_EL, PONTOS_HIDRO, TIPOS_AMBIENTE, PISOS as PISOS_LABEL, REVESTIMENTOS, type Abertura, type Acao, type Acoes, type Ambiente, type LadoIdx, type Obra, type PisoTipo, type PontoEl, type PontoHidro, type Pontos, type PontosEl, type RevParede, type TipoAmbiente } from '../types'
import { BLOCOS, PISOS as PISOS_PRESET, TELHAS } from './presets'
import { definirDivisa } from './cadastro'
import { PARAMS_PADRAO, type Params } from './engine'
import type { Flags } from './assistente'
import { uid } from './uid'

export type Valor = number | string | boolean
export interface AberturaDita { tipo: 'Porta' | 'Janela'; qtd?: number; largura?: number; altura?: number; ambiente?: string }
export interface Extracao { fatos: Record<string, Valor>; ambientes: string[]; aberturas: AberturaDita[]; divisas: [string, string][]; duvidas: string[] }
export interface Opcao { valor: string; rotulo: string }
export interface Contradicao { id: string; texto: string; opcoes: Opcao[]; chave?: string; novo?: Valor }
export interface Sessao {
  fatos: Record<string, Valor>; ambientes: string[]; aberturas: AberturaDita[]; divisas: [string, string][]
  respondidas: string[]; contradicoes: Contradicao[]; avisosMesclagem: string[]; duvidas: string[]
}
export const sessaoVazia = (): Sessao => ({ fatos: {}, ambientes: [], aberturas: [], divisas: [], respondidas: [], contradicoes: [], avisosMesclagem: [], duvidas: [] })

export const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const kAmb = (nome: string, campo: string) => `amb:${norm(nome)}:${campo}`
const m2 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

// ───────────────────────── glossário (explicações simples, sem valores normativos) ─────────────────────────
export const GLOSSARIO: Record<string, string> = {
  'pé-direito': 'Altura do piso até o teto (ou até o forro) de um ambiente.',
  contrapiso: 'Camada de argamassa ou concreto, feita sobre a laje ou o terreno, que deixa a base lisa e nivelada para receber o piso.',
  'tijolo ou bloco cerâmico': 'Peça furada de argila cozida usada para levantar paredes. As medidas variam por fabricante, por isso é preciso dizer o tamanho.',
  fibrocimento: 'Material das telhas e chapas onduladas de cimento reforçado com fibras sintéticas.',
  'parede compartilhada': 'Parede que separa dois ambientes. No cálculo ela conta uma única vez.',
  'ponto de luz': 'Local do teto ou da parede de onde sai o fio para uma lâmpada ou luminária.',
  tomada: 'Ponto na parede para ligar aparelhos na energia.',
  interruptor: 'Chave na parede que liga e desliga a luz.',
  disjuntor: 'Dispositivo do quadro de luz que desliga um circuito quando há sobrecarga ou curto.',
  verga: 'Pequena viga colocada sobre portas e janelas para sustentar a parede acima da abertura.',
  chapisco: 'Camada áspera de cimento e areia aplicada na parede para o revestimento seguinte aderir.',
  emboço: 'Camada de argamassa, depois do chapisco, que nivela a parede (também chamada de reboco).',
  beiral: 'Parte do telhado que avança além da parede. Por isso a área do telhado costuma ser maior que a área construída.',
  forro: 'Acabamento do teto, por baixo da laje ou do telhado.',
  pavimento: 'Cada andar da construção. Só térreo = 1 pavimento.',
  demolir: 'Derrubar um elemento existente; isso gera entulho e não compra material novo.',
  substituir: 'Demolir o que existe e construir de novo: gera entulho e também material novo.',
}
const TERMOS_CHAVE: [string, string[]][] = [
  ['pé-direito', ['pe-direito', 'pe direito']], ['contrapiso', ['contrapiso']], ['tijolo ou bloco cerâmico', ['tijolo', 'bloco ceramico']], ['fibrocimento', ['fibrocimento', 'brasilit', 'eternit']],
  ['parede compartilhada', ['parede compartilhada', 'parede em comum', 'dividem parede', 'divide parede']], ['ponto de luz', ['ponto de luz', 'pontos de luz']], ['tomada', ['tomada']], ['interruptor', ['interruptor']],
  ['disjuntor', ['disjuntor']], ['verga', ['verga']], ['chapisco', ['chapisco']], ['emboço', ['emboco', 'reboco']], ['beiral', ['beiral']], ['forro', ['forro']], ['pavimento', ['pavimento', 'andar', 'sobrado']],
  ['demolir', ['demolir', 'demolicao', 'derrubar']], ['substituir', ['substituir', 'trocar']],
]
/** Termos técnicos citados num texto, com a explicação (para o sistema explicar o que a pessoa escreveu). */
export function termosCitados(texto: string): { termo: string; explicacao: string }[] {
  const t = norm(texto)
  return TERMOS_CHAVE.filter(([, chaves]) => chaves.some((c) => t.includes(c))).map(([termo]) => ({ termo, explicacao: GLOSSARIO[termo] }))
}

// ───────────────────────── validação da resposta da IA ─────────────────────────
const num = (v: unknown, max = 1000): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : undefined)
const inteiro = (v: unknown, max: number): number | undefined => { const n = num(v, max); return n === undefined ? undefined : Math.round(n) }
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)
const txt = (v: unknown, n = 60): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)
const em = <T extends string>(v: unknown, lista: readonly T[]): T | undefined => (typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : undefined)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const TIPOS_OBRA = { residencial: 'Residencial', comercial: 'Comercial', galpao: 'Galpão', edicula: 'Edícula', muro: 'Muro', outro: 'Outro' } as const
const ACAO_LISTA = Object.keys(ACOES) as Acao[]
const TIPOS_AMB = Object.keys(TIPOS_AMBIENTE) as TipoAmbiente[]
const PONTOS_EL_TIPOS = Object.keys(PONTOS_EL) as PontoEl[]
const CHAVE_IA_EL: Record<PontoEl, string> = { tug: 'tomada_uso_geral', tue: 'tomada_uso_especifico', interruptor: 'interruptor', pontoLuz: 'ponto_luz' }
const PONTOS_TIPOS = Object.keys(PONTOS_HIDRO) as PontoHidro[]
const CHAVE_IA: Record<PontoHidro, string> = { vaso: 'vaso', lavatorio: 'lavatorio', chuveiro: 'chuveiro', pia: 'pia', tanque: 'tanque', maquinaLavar: 'maquina_lavar', torneira: 'torneira', ralo: 'ralo', caixaSifonada: 'caixa_sifonada', registro: 'registro' }
const TELHA_PRESET: Record<string, number> = { ceramica_romana: 0, ceramica_colonial: 1, concreto: 2, fibrocimento: 3, metalica: 4 }
const medidaBloco = (s: string) => s.replace(/\s+/g, '').replace(/[×x]/gi, 'x')
/** Índice do bloco em BLOCOS pelo material e/ou pela medida (cm); -1 quando não identifica um só. */
export function blocoPor(material?: string, medida?: string): number {
  const cand = BLOCOS.map((b, i) => ({ b, i })).filter(({ b }) => (!material || norm(b.nome).startsWith(material === 'ceramico' ? 'ceramico' : 'concreto')) && (!medida || medidaBloco(norm(b.nome)).includes(medida)))
  return cand.length === 1 ? cand[0].i : -1
}

export function validarExtracao(texto: string): Extracao {
  const t = texto.replace(/```json|```/g, '')
  const i = t.indexOf('{'), f = t.lastIndexOf('}')
  if (i < 0 || f < i) throw new Error('A resposta da IA não trouxe dados válidos.')
  let j: Record<string, unknown>
  try { j = JSON.parse(t.slice(i, f + 1)) as Record<string, unknown> } catch { throw new Error('A resposta da IA não trouxe dados válidos.') }
  const fatos: Record<string, Valor> = {}
  const set = (k: string, v: Valor | undefined) => { if (v !== undefined) fatos[k] = v }

  const o = obj(j.obra)
  set('obra.pavimentos', inteiro(o.pavimentos, 30)); set('obra.altura', num(o.altura_parede_m, 20))
  const tipoObra = em(o.tipo, Object.keys(TIPOS_OBRA) as (keyof typeof TIPOS_OBRA)[]); if (tipoObra) set('obra.tipo', TIPOS_OBRA[tipoObra])
  set('obra.terreno', em(o.terreno, ['plano', 'inclinado'] as const)); set('geral.reforma', bool(o.reforma))

  const ambientes: string[] = [], divisas: [string, string][] = []
  arr(j.ambientes).forEach((x, n) => {
    const a = obj(x), nome = txt(a.nome) ?? `Ambiente ${n + 1}`
    if (ambientes.some((y) => norm(y) === norm(nome))) return
    ambientes.push(nome)
    set(kAmb(nome, 'tipo'), em(a.tipo, TIPOS_AMB)); set(kAmb(nome, 'comprimento'), num(a.comprimento_m, 200)); set(kAmb(nome, 'largura'), num(a.largura_m, 200))
    set(kAmb(nome, 'peDireito'), num(a.pe_direito_m, 20)); set(kAmb(nome, 'piso'), em(a.piso, ['ceramico', 'porcelanato', 'cimentado', 'nenhum'] as const))
    set(kAmb(nome, 'revParede'), em(a.revestimento_parede, ['emboco_pintura', 'ceramica', 'nenhum'] as const)); set(kAmb(nome, 'alturaCeramica'), num(a.altura_ceramica_m, 20))
    set(kAmb(nome, 'forro'), bool(a.forro))
    const pe = obj(a.pontos_eletricos)
    for (const t of PONTOS_EL_TIPOS) set(kAmb(nome, `pel.${t}`), inteiro(pe[CHAVE_IA_EL[t]], 100))
    const ph = obj(a.pontos_hidraulicos)
    for (const t of PONTOS_TIPOS) set(kAmb(nome, `ponto.${t}`), inteiro(ph[CHAVE_IA[t]], 50))
    const ac = obj(a.acoes)
    for (const e of ['paredes', 'revestimento', 'piso', 'forro']) set(kAmb(nome, `acao.${e}`), em(ac[e], ACAO_LISTA))
    for (const outro of arr(a.divide_parede_com)) { const n2 = txt(outro); if (n2 && norm(n2) !== norm(nome)) divisas.push([nome, n2]) }
  })

  const aberturas: AberturaDita[] = arr(j.aberturas).flatMap((x) => {
    const a = obj(x), tipo = a.tipo === 'porta' ? 'Porta' : a.tipo === 'janela' ? 'Janela' : null
    return tipo ? [{ tipo, qtd: inteiro(a.qtd, 200), largura: num(a.largura_m, 10), altura: num(a.altura_m, 10), ambiente: txt(a.ambiente) } as AberturaDita] : []
  })

  const m = obj(j.materiais)
  const material = em(m.bloco, ['ceramico', 'concreto'] as const)
  const medida = typeof m.bloco_medida_cm === 'string' && /^\d{1,2}\s*[x×]\s*\d{1,2}\s*[x×]\s*\d{1,2}$/i.test(m.bloco_medida_cm.trim()) ? medidaBloco(m.bloco_medida_cm.trim()) : undefined
  set('geral.blocoMaterial', material); set('geral.blocoMedida', medida)
  const bi = blocoPor(material, medida); if (bi >= 0 && (material || medida)) set('geral.blocoPreset', bi)
  const telha = typeof m.telha === 'string' ? TELHA_PRESET[m.telha] : undefined; set('geral.telhaPreset', telha)
  set('geral.pisoPeca', num(m.piso_peca_cm, 200))

  const c = obj(j.cobertura)
  set('geral.cobertura', bool(c.havera) ?? (telha !== undefined ? true : undefined)); set('geral.coberturaC', num(c.comprimento_m, 200)); set('geral.coberturaL', num(c.largura_m, 200))

  const ins = obj(j.instalacoes)
  set('geral.eletrica', bool(ins.eletrica)); set('geral.hidraulica', bool(ins.hidraulica))
  set('geral.eltTomadas', inteiro(ins.tomadas, 500)); set('geral.eltInterruptores', inteiro(ins.interruptores, 500))
  set('geral.eltPontosLuz', inteiro(ins.pontos_luz, 500)); set('geral.eltDisjuntores', inteiro(ins.disjuntores, 500))

  const ab = obj(j.acabamentos)
  set('geral.piso', bool(ab.piso_citado)); set('geral.revestimento', bool(ab.revestimento)); set('geral.pintura', bool(ab.pintura)); set('geral.forro', bool(ab.forro))

  const duvidas = arr(j.duvidas).map((d) => txt(d, 200)).filter((d): d is string => !!d).slice(0, 5)
  return { fatos, ambientes, aberturas, divisas, duvidas }
}

// ───────────────────────── rótulos e formatação dos fatos ─────────────────────────
const ROTULO_GERAL: Record<string, string> = {
  'obra.pavimentos': 'o número de pavimentos', 'obra.altura': 'o pé-direito da obra', 'obra.tipo': 'o tipo da obra', 'obra.terreno': 'o tipo de terreno',
  'geral.reforma': 'ser uma reforma', 'geral.blocoMaterial': 'o material do bloco', 'geral.blocoMedida': 'a medida do bloco', 'geral.blocoPreset': 'o bloco',
  'geral.telhaPreset': 'o tipo de telha', 'geral.pisoPeca': 'o tamanho da peça de piso (cm)', 'geral.cobertura': 'haver telhado', 'geral.coberturaC': 'o comprimento do telhado',
  'geral.coberturaL': 'a largura do telhado', 'geral.eletrica': 'haver instalação elétrica', 'geral.hidraulica': 'haver instalação hidráulica', 'geral.eltTomadas': 'o número de tomadas',
  'geral.eltInterruptores': 'o número de interruptores', 'geral.eltPontosLuz': 'o número de pontos de luz', 'geral.eltDisjuntores': 'o número de disjuntores',
  'geral.piso': 'haver piso', 'geral.revestimento': 'haver chapisco e emboço', 'geral.pintura': 'haver pintura', 'geral.forro': 'haver forro',
}
const CAMPO_AMB: Record<string, string> = { comprimento: 'o comprimento', largura: 'a largura', peDireito: 'o pé-direito', tipo: 'o tipo', piso: 'o piso', revParede: 'o revestimento das paredes', alturaCeramica: 'a altura da cerâmica', forro: 'o forro' }
export function rotuloFato(chave: string, ambientes: string[] = []): string {
  if (ROTULO_GERAL[chave]) return ROTULO_GERAL[chave]
  const [, k, campo] = chave.split(':')
  const nome = ambientes.find((n) => norm(n) === k) ?? k
  const rot = campo.startsWith('acao.') ? `a ação sobre ${campo.slice(5)}` : campo.startsWith('pel.') ? `a quantidade de ${PONTOS_EL[campo.slice(4) as PontoEl]?.rotulo.toLowerCase() ?? campo}` : campo.startsWith('ponto.') ? `a quantidade de ${PONTOS_HIDRO[campo.slice(6) as PontoHidro]?.rotulo.toLowerCase() ?? campo}` : CAMPO_AMB[campo] ?? campo
  return `${rot} de ${nome}`
}
export function formatarValor(chave: string, v: Valor): string {
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'number') {
    if (chave === 'geral.blocoPreset') return BLOCOS[v]?.nome ?? String(v)
    if (chave === 'geral.telhaPreset') return TELHAS[v]?.nome ?? String(v)
    if (/pisoPeca/.test(chave)) return `${m2(v)} cm`
    if (/comprimento|largura|peDireito|alturaCeramica|altura|coberturaC|coberturaL/i.test(chave)) return `${m2(v)} m`
    return m2(v)
  }
  const campo = chave.split(':')[2] ?? ''
  if (campo === 'piso') return PISOS_LABEL[v as PisoTipo]?.split(' (')[0] ?? v
  if (campo === 'revParede') return REVESTIMENTOS[v as RevParede] ?? v
  if (campo === 'tipo') return TIPOS_AMBIENTE[v as TipoAmbiente] ?? v
  if (campo.startsWith('acao.')) return ACOES[v as Acao]?.split(' (')[0].toLowerCase() ?? v
  return v
}

// ───────────────────────── mesclar fatos e contradições ─────────────────────────
const igual = (a: Valor, b: Valor) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b)
const copia = (s: Sessao): Sessao => ({ ...s, fatos: { ...s.fatos }, ambientes: [...s.ambientes], aberturas: s.aberturas.map((a) => ({ ...a })), divisas: s.divisas.map((d) => [...d] as [string, string]), respondidas: [...s.respondidas], contradicoes: [...s.contradicoes], avisosMesclagem: [...s.avisosMesclagem], duvidas: [...s.duvidas] })
const nomeCanonico = (s: Sessao, nome?: string) => (nome ? s.ambientes.find((n) => norm(n) === norm(nome)) : undefined)

export function mesclar(s0: Sessao, e: Extracao): Sessao {
  const s = copia(s0)
  for (const nome of e.ambientes) if (!nomeCanonico(s, nome)) s.ambientes.push(nome)
  for (const [chave, valor] of Object.entries(e.fatos)) {
    const atual = s.fatos[chave]
    if (atual === undefined) { s.fatos[chave] = valor; continue }
    if (igual(atual, valor) || s.contradicoes.some((c) => c.chave === chave)) continue
    s.contradicoes.push({
      id: `valor:${chave}`, chave, novo: valor,
      texto: `Você disse antes ${formatarValor(chave, atual)} e agora ${formatarValor(chave, valor)} para ${rotuloFato(chave, s.ambientes)}. Qual vale?`,
      opcoes: [{ valor: 'anterior', rotulo: `Manter ${formatarValor(chave, atual)}` }, { valor: 'novo', rotulo: `Usar ${formatarValor(chave, valor)}` }],
    })
  }
  for (const [a, b] of e.divisas) {
    const ca = nomeCanonico(s, a), cb = nomeCanonico(s, b)
    if (!ca || !cb) { s.avisosMesclagem.push(`Parede compartilhada entre "${a}" e "${b}" ignorada: um dos ambientes não foi descrito.`); continue }
    if (!s.divisas.some(([x, y]) => (x === ca && y === cb) || (x === cb && y === ca))) s.divisas.push([ca, cb])
  }
  for (const ab of e.aberturas) {
    const amb = nomeCanonico(s, ab.ambiente)
    if (ab.ambiente && !amb) s.avisosMesclagem.push(`${ab.tipo} em "${ab.ambiente}": ambiente não descrito; ficou sem ambiente.`)
    const novo: AberturaDita = { ...ab, ambiente: amb }
    const mesmos = s.aberturas.filter((x) => x.tipo === novo.tipo && x.ambiente === novo.ambiente)
    const completo = novo.largura !== undefined && novo.altura !== undefined
    const igualDim = mesmos.find((x) => completo && x.largura === novo.largura && x.altura === novo.altura)
    if (igualDim) {
      if (novo.qtd !== undefined && igualDim.qtd !== undefined && novo.qtd !== igualDim.qtd) s.avisosMesclagem.push(`${novo.tipo} ${m2(novo.largura!)} × ${m2(novo.altura!)} m: quantidades diferentes (${igualDim.qtd} e ${novo.qtd}); mantida ${igualDim.qtd}.`)
      else if (igualDim.qtd === undefined) igualDim.qtd = novo.qtd
      continue
    }
    const vazio = mesmos.find((x) => x.largura === undefined && x.altura === undefined)
    if (vazio && completo) { vazio.largura = novo.largura; vazio.altura = novo.altura; vazio.qtd = vazio.qtd ?? novo.qtd; continue }
    if (!completo && mesmos.length) { const x = mesmos[0]; if (x.qtd === undefined) x.qtd = novo.qtd; continue }
    s.aberturas.push(novo)
  }
  for (const d of e.duvidas) if (!s.duvidas.includes(d)) s.duvidas.push(d)
  verificar(s)
  return s
}

/** Contradições por regra (entre fatos que não se igualam, mas não podem valer juntos). Altera `s`. */
function verificar(s: Sessao): void {
  const f = s.fatos, ha = (id: string) => s.contradicoes.some((c) => c.id === id)
  const algum = (...ks: string[]) => ks.some((k) => f[k] !== undefined)
  const pelAmb = Object.keys(f).some((k) => k.includes(':pel.'))
  if (f['geral.eletrica'] === false && (pelAmb || algum('geral.eltTomadas', 'geral.eltInterruptores', 'geral.eltPontosLuz', 'geral.eltDisjuntores')) && !ha('regra:eletrica'))
    s.contradicoes.push({ id: 'regra:eletrica', texto: 'Você disse que não haverá instalação elétrica, mas informou quantidades de pontos elétricos. Qual vale?', opcoes: [{ valor: 'com', rotulo: 'Haverá instalação elétrica' }, { valor: 'sem', rotulo: 'Não haverá (ignorar os pontos)' }] })
  if (f['geral.cobertura'] === false && algum('geral.telhaPreset', 'geral.coberturaC', 'geral.coberturaL') && !ha('regra:cobertura'))
    s.contradicoes.push({ id: 'regra:cobertura', texto: 'Você disse que não haverá telhado, mas informou tipo de telha ou medidas do telhado. Qual vale?', opcoes: [{ valor: 'com', rotulo: 'Haverá telhado' }, { valor: 'sem', rotulo: 'Não haverá (ignorar telha e medidas)' }] })
  if (f['geral.forro'] === false && s.ambientes.some((n) => f[kAmb(n, 'forro')] === true) && !ha('regra:forro'))
    s.contradicoes.push({ id: 'regra:forro', texto: 'Você disse que não haverá forro, mas pediu forro em algum ambiente. Qual vale?', opcoes: [{ valor: 'com', rotulo: 'Haverá forro nos ambientes indicados' }, { valor: 'sem', rotulo: 'Não haverá forro' }] })
}

export function resolverContradicao(s0: Sessao, id: string, escolha: string): Sessao {
  const s = copia(s0), c = s.contradicoes.find((x) => x.id === id)
  if (!c) return s
  s.contradicoes = s.contradicoes.filter((x) => x.id !== id)
  if (c.chave !== undefined && escolha === 'novo' && c.novo !== undefined) s.fatos[c.chave] = c.novo
  if (id === 'regra:eletrica') { if (escolha === 'com') s.fatos['geral.eletrica'] = true; else { for (const k of ['Tomadas', 'Interruptores', 'PontosLuz', 'Disjuntores']) delete s.fatos[`geral.elt${k}`]; for (const k of Object.keys(s.fatos)) if (k.includes(':pel.')) delete s.fatos[k] } }
  if (id === 'regra:cobertura') { if (escolha === 'com') s.fatos['geral.cobertura'] = true; else for (const k of ['telhaPreset', 'coberturaC', 'coberturaL']) delete s.fatos[`geral.${k}`] }
  if (id === 'regra:forro') { if (escolha === 'com') s.fatos['geral.forro'] = true; else for (const n of s.ambientes) delete s.fatos[kAmb(n, 'forro')] }
  verificar(s)
  return s
}

/** Avisos que não bloqueiam: valores estranhos que merecem conferência (derivados dos fatos atuais). */
export function avisosDe(s: Sessao): string[] {
  const f = s.fatos, av = [...s.avisosMesclagem]
  const peObra = f['obra.altura'] as number | undefined
  let perimetro = 0
  for (const n of s.ambientes) {
    const c = f[kAmb(n, 'comprimento')] as number | undefined, l = f[kAmb(n, 'largura')] as number | undefined
    for (const [rot, v] of [['comprimento', c], ['largura', l]] as const) if (v !== undefined && (v < 1 || v > 30)) av.push(`${n}: ${rot} de ${m2(v)} m é incomum; confira.`)
    if (c !== undefined && l !== undefined) perimetro += 2 * (c + l)
    const pe = (f[kAmb(n, 'peDireito')] as number | undefined) ?? peObra
    if (pe !== undefined && (pe < 2 || pe > 6)) av.push(`${n}: pé-direito de ${m2(pe)} m é incomum; confira.`)
  }
  if (peObra !== undefined && (peObra < 2 || peObra > 6) && !s.ambientes.length) av.push(`Pé-direito de ${m2(peObra)} m é incomum; confira.`)
  let larguras = 0
  for (const a of s.aberturas) {
    if (a.largura !== undefined) larguras += a.largura * (a.qtd ?? 1)
    const pe = (a.ambiente ? (f[kAmb(a.ambiente, 'peDireito')] as number | undefined) : undefined) ?? peObra
    if (a.altura !== undefined && pe !== undefined && a.altura > pe) av.push(`${a.tipo} de ${m2(a.altura)} m de altura é maior que o pé-direito (${m2(pe)} m).`)
  }
  if (perimetro > 0 && larguras > perimetro) av.push('A soma das larguras das portas e janelas é maior que o perímetro dos ambientes; confira as quantidades.')
  return av
}

// ───────────────────────── perguntas (uma por vez, sem repetir) ─────────────────────────
export interface Pergunta {
  id: string
  tipo: 'contradicao' | 'texto' | 'numero' | 'numeros' | 'sim_nao' | 'escolha'
  texto: string
  explicacao?: string
  termos?: string[]
  opcoes?: Opcao[]
  /** Chaves de fatos preenchidas pela resposta, na ordem dos números. */
  campos?: string[]
  inteiro?: boolean; min?: number; max?: number
  numerica?: boolean // escolha cujo valor é número
  aceitaNumero?: boolean // escolha que também aceita um número digitado
  exemplo?: string
}

const optBloco = (f: Record<string, Valor>): Opcao[] => {
  const mat = f['geral.blocoMaterial'] as string | undefined, med = f['geral.blocoMedida'] as string | undefined
  const tudo = BLOCOS.map((b, i) => ({ b, i }))
  const doMat = (x: typeof tudo) => x.filter(({ b }) => !mat || norm(b.nome).startsWith(mat === 'ceramico' ? 'ceramico' : 'concreto'))
  const porMed = (x: typeof tudo) => x.filter(({ b }) => !med || medidaBloco(norm(b.nome)).includes(med))
  const lista = [porMed(doMat(tudo)), doMat(tudo), tudo].find((x) => x.length > 0)! // sem correspondência exata, mostra as opções do material (ou todas)
  return lista.map(({ b, i }) => ({ valor: String(i), rotulo: b.nome }))
}
const plural = (tipo: string, n?: number) => (tipo === 'Porta' ? (n === 1 ? 'porta' : 'portas') : n === 1 ? 'janela' : 'janelas')

export function proximaPergunta(s: Sessao): Pergunta | null {
  const f = s.fatos, R = (id: string) => s.respondidas.includes(id)
  if (s.contradicoes.length) { const c = s.contradicoes[0]; return { id: c.id, tipo: 'contradicao', texto: c.texto, opcoes: c.opcoes } }

  if (s.ambientes.length === 0 && !R('ambientes'))
    return { id: 'ambientes', tipo: 'texto', texto: 'Quais ambientes (cômodos) a obra terá?', exemplo: 'duas salas de 7 por 7 metros e um banheiro de 2 por 3' }

  for (const nome of s.ambientes) {
    const k = norm(nome), c = f[kAmb(nome, 'comprimento')], l = f[kAmb(nome, 'largura')]
    if (c === undefined && l === undefined && !R(`medidas:${k}`))
      return { id: `medidas:${k}`, tipo: 'numeros', texto: `Quais as medidas internas de "${nome}" (comprimento e largura)?`, explicacao: 'Meça de parede a parede, por dentro do cômodo.', campos: [kAmb(nome, 'comprimento'), kAmb(nome, 'largura')], min: 0.3, max: 200, exemplo: '7 por 5 (em metros) ou 700 x 500 cm' }
    if (c === undefined && l !== undefined && !R(`comprimento:${k}`))
      return { id: `comprimento:${k}`, tipo: 'numero', texto: `Qual o comprimento de "${nome}"?`, campos: [kAmb(nome, 'comprimento')], min: 0.3, max: 200, exemplo: '4,5 m' }
    if (l === undefined && c !== undefined && !R(`largura:${k}`))
      return { id: `largura:${k}`, tipo: 'numero', texto: `Qual a largura de "${nome}"?`, campos: [kAmb(nome, 'largura')], min: 0.3, max: 200, exemplo: '3 m' }
  }

  if (f['obra.pavimentos'] === undefined && !R('pavimentos'))
    return { id: 'pavimentos', tipo: 'numero', texto: 'A obra terá quantos pavimentos (andares)?', explicacao: GLOSSARIO.pavimento, termos: ['pavimento'], campos: ['obra.pavimentos'], inteiro: true, min: 1, max: 30, exemplo: '1' }

  if (f['obra.altura'] === undefined && s.ambientes.some((n) => f[kAmb(n, 'peDireito')] === undefined) && !R('peDireito'))
    return { id: 'peDireito', tipo: 'numero', texto: 'Qual o pé-direito (altura das paredes)?', explicacao: GLOSSARIO['pé-direito'], termos: ['pé-direito'], campos: ['obra.altura'], min: 1.5, max: 20, exemplo: '2,8 m' }

  if (s.ambientes.length >= 2 && s.divisas.length === 0 && !R('divisas')) {
    if (s.ambientes.length === 2) return { id: 'divisas', tipo: 'sim_nao', texto: `"${s.ambientes[0]}" e "${s.ambientes[1]}" dividem uma parede?`, explicacao: GLOSSARIO['parede compartilhada'], termos: ['parede compartilhada'] }
    return { id: 'divisas', tipo: 'texto', texto: 'Quais ambientes dividem parede entre si? Se nenhum, responda "nenhum".', explicacao: GLOSSARIO['parede compartilhada'], termos: ['parede compartilhada'], exemplo: 'Sala 1 com Sala 2' }
  }

  if (f['geral.reforma'] === true && !Object.keys(f).some((k) => k.includes(':acao.')) && !R('acoes'))
    return { id: 'acoes', tipo: 'texto', texto: 'Na reforma, o que será demolido, mantido, recuperado, reaproveitado ou substituído? (paredes, revestimento, piso, forro)', explicacao: `${GLOSSARIO.demolir} ${GLOSSARIO.substituir}`, termos: ['demolir', 'substituir'], exemplo: 'demolir as paredes da Sala 1 e manter o piso' }

  if (s.aberturas.length === 0 && !R('aberturas'))
    return { id: 'aberturas', tipo: 'texto', texto: 'Haverá portas e janelas? Diga quantas, as medidas (largura × altura) e em qual ambiente. Se não houver, responda "não".', exemplo: '2 portas de 0,80 x 2,10 e 4 janelas de 1,20 x 1,00' }
  for (const tipo of ['Porta', 'Janela'] as const) {
    const idx = s.aberturas.findIndex((a) => a.tipo === tipo && (a.qtd === undefined || a.largura === undefined || a.altura === undefined))
    if (idx >= 0 && !R(`ab:${tipo}:${idx}`)) {
      const a = s.aberturas[idx], falta: string[] = [], campos: string[] = []
      if (a.qtd === undefined) { falta.push('a quantidade'); campos.push('qtd') }
      if (a.largura === undefined || a.altura === undefined) { falta.push('as medidas (largura × altura)'); campos.push('largura', 'altura') }
      const onde = a.ambiente ? ` em "${a.ambiente}"` : ''
      return { id: `ab:${tipo}:${idx}`, tipo: 'numeros', texto: `Para ${plural(tipo)}${onde}, qual ${falta.join(' e ')}?`, campos, min: 0.1, max: 200, exemplo: campos.length === 3 ? '3 e 0,80 x 2,10' : campos[0] === 'qtd' ? '3' : '0,80 x 2,10', explicacao: 'Informe as medidas em metros (ou com cm).' }
    }
  }

  if (f['geral.blocoPreset'] === undefined && !R('bloco'))
    return { id: 'bloco', tipo: 'escolha', texto: f['geral.blocoMaterial'] ? `Qual o tamanho do bloco ${f['geral.blocoMaterial'] === 'ceramico' ? 'cerâmico' : 'de concreto'} (largura × altura × comprimento, em cm)?` : 'Qual bloco ou tijolo será usado nas paredes?', explicacao: GLOSSARIO['tijolo ou bloco cerâmico'], termos: ['tijolo ou bloco cerâmico'], campos: ['geral.blocoPreset'], numerica: true, opcoes: optBloco(f) }

  if (f['geral.piso'] === true && f['geral.pisoPeca'] === undefined && !R('pisoPeca'))
    return { id: 'pisoPeca', tipo: 'escolha', texto: 'Qual o tamanho da peça do piso (lado, em cm)?', campos: ['geral.pisoPeca'], numerica: true, aceitaNumero: true, opcoes: PISOS_PRESET.map((p) => ({ valor: String(Math.round((p.pisoC ?? 0) * 100)), rotulo: p.nome })) }

  if (f['geral.cobertura'] === undefined && !R('cobertura'))
    return { id: 'cobertura', tipo: 'sim_nao', texto: 'Haverá telhado (cobertura)?', explicacao: GLOSSARIO.beiral, termos: ['beiral'], campos: ['geral.cobertura'] }
  if (f['geral.cobertura'] === true) {
    if (f['geral.telhaPreset'] === undefined && !R('telha'))
      return { id: 'telha', tipo: 'escolha', texto: 'Qual o tipo de telha?', explicacao: GLOSSARIO.fibrocimento, termos: ['fibrocimento'], campos: ['geral.telhaPreset'], numerica: true, opcoes: TELHAS.map((t, i) => ({ valor: String(i), rotulo: t.nome })) }
    if ((f['geral.coberturaC'] === undefined || f['geral.coberturaL'] === undefined) && !R('coberturaMedidas'))
      return { id: 'coberturaMedidas', tipo: 'numeros', texto: 'Quais as dimensões do telhado (comprimento e largura)?', explicacao: GLOSSARIO.beiral, termos: ['beiral'], campos: ['geral.coberturaC', 'geral.coberturaL'], min: 0.5, max: 200, exemplo: '14 por 7 m' }
  }

  if (f['geral.eletrica'] === undefined && !R('eletrica'))
    return { id: 'eletrica', tipo: 'sim_nao', texto: 'Haverá instalação elétrica?', campos: ['geral.eletrica'] }
  if (f['geral.eletrica'] === true) {
    for (const [k, nome, termo] of [['Tomadas', 'tomadas', 'tomada'], ['Interruptores', 'interruptores', 'interruptor'], ['PontosLuz', 'pontos de luz', 'ponto de luz'], ['Disjuntores', 'disjuntores', 'disjuntor']] as const)
      if (f[`geral.elt${k}`] === undefined && !R(`elt:${k}`) && !(k !== 'Disjuntores' && Object.keys(f).some((x) => x.includes(':pel.'))))
        return { id: `elt:${k}`, tipo: 'numero', texto: `Quantos ${nome} haverá?`, explicacao: `${GLOSSARIO[termo]} Se não souber, responda "não sei": esse item não será calculado.`, termos: [termo], campos: [`geral.elt${k}`], inteiro: true, min: 0, max: 500, exemplo: '8' }
  }
  if (f['geral.hidraulica'] === undefined && !R('hidraulica'))
    return { id: 'hidraulica', tipo: 'sim_nao', texto: 'Haverá instalação hidráulica e sanitária?', explicacao: 'Em seguida pergunto os pontos de cada ambiente (vaso, chuveiro, pia...). Tubos e conexões são estimados por composições com os seus coeficientes.', campos: ['geral.hidraulica'] }

  if (f['geral.hidraulica'] === true && !Object.keys(f).some((k) => k.includes(':ponto.')) && !R('pontos'))
    return { id: 'pontos', tipo: 'texto', texto: 'Quais pontos hidráulicos haverá em cada ambiente? (vaso, lavatório, chuveiro, pia, tanque, ralo...) Se não souber, responda "não sei".', explicacao: 'Informe só o que existe e quantos. Tubos e conexões não são calculados por mim: você os estima depois com os seus coeficientes por ponto.', exemplo: 'banheiro com 1 vaso, 1 lavatório, 1 chuveiro e 1 ralo; cozinha com 1 pia' }
  if (f['geral.revestimento'] === undefined && !R('revestimento'))
    return { id: 'revestimento', tipo: 'sim_nao', texto: 'Haverá chapisco e emboço (reboco) nas paredes?', explicacao: `${GLOSSARIO.chapisco} ${GLOSSARIO.emboço}`, termos: ['chapisco', 'emboço'], campos: ['geral.revestimento'] }
  if (f['geral.pintura'] === undefined && !R('pintura'))
    return { id: 'pintura', tipo: 'sim_nao', texto: 'Haverá pintura?', campos: ['geral.pintura'] }
  if (f['geral.forro'] === undefined && !R('forro'))
    return { id: 'forro', tipo: 'sim_nao', texto: 'Haverá forro?', explicacao: GLOSSARIO.forro, termos: ['forro'], campos: ['geral.forro'] }
  return null
}

// ───────────────────────── interpretar respostas (sem IA quando possível) ─────────────────────────
export interface Resultado { sessao: Sessao; erro?: string; precisaIA?: boolean }
export const ehNaoSei = (t: string) => /^(nao sei|n sei|sei la|nao tenho|nao tenho certeza|pular|depois|ainda nao|desconheco|sem informacao)\b/.test(norm(t))
export function simNao(t: string): boolean | undefined {
  const n = norm(t).replace(/[.!]+$/, '')
  if (/^(nao|n|nenhum|nenhuma|sem|negativo|dispenso|nada)\b/.test(n)) return false
  if (/^(sim|s|claro|isso|vai|havera|tem|quero|com|ok|certo|positivo|pode|haver|vamos)\b/.test(n)) return true
  return undefined
}
const DIV: Record<string, number> = { mm: 1000, cm: 100, m: 1 } // divisão (não multiplicação) evita 280 × 0,01 = 2,8000000000000003
/** Números do texto (vírgula decimal). `unidade` aplica m/cm/mm a todos que não tenham unidade própria, usando a última unidade citada. */
export function numerosDe(t: string, comUnidade = true): number[] {
  const toks = [...norm(t).matchAll(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/g)].map((x) => ({ v: parseFloat(x[1].replace(',', '.')), u: x[2] }))
  const ultima = [...toks].reverse().find((x) => x.u)?.u
  return toks.map((x) => (comUnidade ? x.v / DIV[x.u ?? ultima ?? 'm'] : x.v))
}
const marcar = (s: Sessao, id: string): Sessao => (s.respondidas.includes(id) ? s : { ...s, respondidas: [...s.respondidas, id] })
const fmtFaixa = (p: Pergunta) => (p.min !== undefined && p.max !== undefined ? ` (entre ${m2(p.min)} e ${m2(p.max)})` : '')

export function responder(s0: Sessao, p: Pergunta, texto: string): Resultado {
  const entrada = texto.trim()
  if (!entrada) return { sessao: s0, erro: 'Escreva uma resposta, ou diga "não sei".' }

  if (p.tipo === 'contradicao') {
    if (ehNaoSei(entrada)) return { sessao: resolverContradicao(s0, p.id, p.opcoes?.[0].valor ?? 'anterior') }
    const o = escolher(p.opcoes ?? [], entrada)
    return o ? { sessao: resolverContradicao(s0, p.id, o.valor) } : { sessao: s0, erro: 'Escolha uma das opções (digite o número ou o texto).' }
  }
  if (ehNaoSei(entrada)) return { sessao: marcar(s0, p.id) }

  const s = copia(s0)
  const fim = (): Resultado => { verificar(s); return { sessao: marcar(s, p.id) } }

  if (p.id === 'divisas' && p.tipo === 'sim_nao') {
    const r = simNao(entrada)
    if (r === undefined) return { sessao: s0, erro: 'Responda sim ou não (ou "não sei").' }
    if (r) s.divisas.push([s.ambientes[0], s.ambientes[1]])
    return fim()
  }
  if (p.tipo === 'texto') {
    const r = simNao(entrada)
    if (r === false && p.id !== 'ambientes') return fim() // "nenhum", "não": nada a extrair
    return { sessao: s0, precisaIA: true }
  }
  if (p.tipo === 'sim_nao') {
    const r = simNao(entrada)
    if (r === undefined) return { sessao: s0, erro: 'Responda sim ou não (ou "não sei").' }
    s.fatos[p.campos![0]] = r
    return fim()
  }
  if (p.tipo === 'escolha') {
    const o = escolher(p.opcoes ?? [], entrada)
    if (o) { s.fatos[p.campos![0]] = p.numerica ? Number(o.valor) : o.valor; return fim() }
    const n = p.aceitaNumero ? numerosDe(entrada, false) : []
    if (n.length === 1 && n[0] > 0 && n[0] <= 200) { s.fatos[p.campos![0]] = n[0]; return fim() }
    return { sessao: s0, erro: 'Escolha uma das opções (digite o número ou o nome)' + (p.aceitaNumero ? ', ou digite o tamanho em cm.' : '.') }
  }

  // numéricas
  const ab = p.id.startsWith('ab:') ? p.campos! : null
  const campos = p.campos!
  const nums = ab ? numerosDe(entrada, false) : numerosDe(entrada, !p.inteiro)
  if (nums.length !== campos.length) return { sessao: s0, erro: `Preciso de ${campos.length === 1 ? 'um número' : `${campos.length} números`}${p.exemplo ? ` (exemplo: ${p.exemplo})` : ''}.` }
  if (ab) {
    const idx = p.id.split(':')[2], a = s.aberturas[Number(idx)]
    const div = /\bcm\b/.test(norm(entrada)) ? 100 : /\bmm\b/.test(norm(entrada)) ? 1000 : 1
    let k = 0
    for (const c of campos) {
      const v = nums[k++]
      if (c === 'qtd') { if (!Number.isInteger(v) || v < 1 || v > 200) return { sessao: s0, erro: 'A quantidade deve ser um número inteiro de 1 a 200.' }; a.qtd = v }
      else { const m = v / div; if (!(m >= (p.min ?? 0) && m <= 10)) return { sessao: s0, erro: 'Medida fora do esperado (informe largura e altura, em metros ou cm).' }; (a as unknown as Record<string, number>)[c] = m }
    }
    return fim()
  }
  for (let i = 0; i < campos.length; i++) {
    const v = nums[i]
    if (p.inteiro && !Number.isInteger(v)) return { sessao: s0, erro: 'Informe um número inteiro.' }
    if ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max)) return { sessao: s0, erro: `Valor fora do esperado${fmtFaixa(p)}. Confira a unidade (m, cm ou mm).` }
    s.fatos[campos[i]] = v
  }
  return fim()
}

const compacto = (t: string) => norm(t).replace(/[×x]/g, 'x').replace(/\s/g, '')
function escolher(opcoes: Opcao[], t: string): Opcao | undefined {
  const n = norm(t)
  const idx = /^\d+$/.test(n) ? Number(n) - 1 : -1
  if (idx >= 0 && idx < opcoes.length) return opcoes[idx]
  const exata = opcoes.filter((o) => compacto(o.rotulo) === compacto(n))
  if (exata.length === 1) return exata[0]
  const cont = compacto(n).length >= 3 ? opcoes.filter((o) => compacto(o.rotulo).includes(compacto(n))) : []
  return cont.length === 1 ? cont[0] : undefined
}

/** Aplica o resultado da IA a uma pergunta de texto livre. Se a IA não identificou nada, a pergunta continua aberta. */
export function aplicarIA(s: Sessao, e: Extracao, perguntaId: string | null): { sessao: Sessao; entendeu: boolean } {
  const antes = JSON.stringify([s.fatos, s.ambientes, s.aberturas, s.divisas])
  const n = mesclar(s, e)
  const entendeu = JSON.stringify([n.fatos, n.ambientes, n.aberturas, n.divisas]) !== antes || n.contradicoes.length > s.contradicoes.length
  return { sessao: perguntaId && entendeu ? marcar(n, perguntaId) : n, entendeu }
}

// ───────────────────────── resumo e montagem do levantamento ─────────────────────────
export function linhasResumo(s: Sessao): string[] {
  const f = s.fatos, L: string[] = []
  const v = (k: string) => (f[k] === undefined ? undefined : formatarValor(k, f[k]))
  if (s.ambientes.length) L.push('Ambientes: ' + s.ambientes.map((n) => {
    const c = f[kAmb(n, 'comprimento')] as number | undefined, l = f[kAmb(n, 'largura')] as number | undefined
    return `${n}${c !== undefined && l !== undefined ? ` (${m2(c)} × ${m2(l)} m)` : c !== undefined || l !== undefined ? ' (medida incompleta)' : ''}`
  }).join(', '))
  if (v('obra.pavimentos')) L.push(`Pavimentos: ${v('obra.pavimentos')}`)
  if (v('obra.altura')) L.push(`Pé-direito: ${v('obra.altura')}`)
  if (v('obra.tipo')) L.push(`Tipo da obra: ${v('obra.tipo')}`)
  if (f['geral.reforma'] === true) L.push('Reforma')
  if (s.divisas.length) L.push('Paredes compartilhadas: ' + s.divisas.map(([a, b]) => `${a} com ${b}`).join('; '))
  for (const tipo of ['Porta', 'Janela'] as const) {
    const g = s.aberturas.filter((a) => a.tipo === tipo)
    if (g.length) L.push(`${tipo === 'Porta' ? 'Portas' : 'Janelas'}: ` + g.map((a) => `${a.qtd ?? '?'} ${a.largura !== undefined && a.altura !== undefined ? `de ${m2(a.largura)} × ${m2(a.altura)} m` : 'sem medidas'}${a.ambiente ? ` (${a.ambiente})` : ''}`).join('; '))
  }
  if (v('geral.blocoPreset')) L.push(`Bloco: ${v('geral.blocoPreset')}`); else if (f['geral.blocoMaterial']) L.push(`Bloco: ${f['geral.blocoMaterial'] === 'ceramico' ? 'cerâmico' : 'de concreto'}, tamanho a definir`)
  if (f['geral.piso'] === true) L.push(`Contrapiso e piso${v('geral.pisoPeca') ? `, peça de ${v('geral.pisoPeca')}` : ''}`)
  if (f['geral.cobertura'] === true) L.push(`Telhado: ${v('geral.telhaPreset') ?? 'tipo a definir'}${v('geral.coberturaC') && v('geral.coberturaL') ? `, ${v('geral.coberturaC')} × ${v('geral.coberturaL')}` : ''}`)
  if (f['geral.cobertura'] === false) L.push('Sem telhado')
  if (f['geral.eletrica'] === true) L.push('Instalação elétrica' + (['Tomadas', 'Interruptores', 'PontosLuz', 'Disjuntores'].some((k) => f[`geral.elt${k}`] !== undefined) ? ': ' + [['Tomadas', 'tomadas'], ['Interruptores', 'interruptores'], ['PontosLuz', 'pontos de luz'], ['Disjuntores', 'disjuntores']].filter(([k]) => f[`geral.elt${k}`] !== undefined).map(([k, n]) => `${f[`geral.elt${k}`]} ${n}`).join(', ') : ''))
  const pel = s.ambientes.flatMap((n) => { const t = PONTOS_EL_TIPOS.filter((k) => typeof f[kAmb(n, `pel.${k}`)] === 'number').map((k) => `${PONTOS_EL[k].rotulo.toLowerCase()} ${f[kAmb(n, `pel.${k}`)]}`); return t.length ? [`${n}: ${t.join(', ')}`] : [] })
  if (pel.length) L.push('Pontos elétricos: ' + pel.join('; '))
  if (f['geral.eletrica'] === false) L.push('Sem instalação elétrica')
  const pts = s.ambientes.flatMap((n) => { const t = PONTOS_TIPOS.filter((k) => typeof f[kAmb(n, `ponto.${k}`)] === 'number').map((k) => `${PONTOS_HIDRO[k].rotulo.toLowerCase()} ${f[kAmb(n, `ponto.${k}`)]}`); return t.length ? [`${n}: ${t.join(', ')}`] : [] })
  if (pts.length) L.push('Pontos hidráulicos: ' + pts.join('; '))
  if (f['geral.hidraulica'] !== undefined) L.push(f['geral.hidraulica'] ? 'Instalação hidráulica e sanitária' : 'Sem instalação hidráulica')
  for (const [k, rot] of [['revestimento', 'chapisco e emboço'], ['pintura', 'pintura'], ['forro', 'forro']] as const) if (f[`geral.${k}`] !== undefined) L.push(`${f[`geral.${k}`] ? 'Com' : 'Sem'} ${rot}`)
  const acoes = Object.keys(f).filter((k) => k.includes(':acao.')).map((k) => `${rotuloFato(k, s.ambientes)}: ${formatarValor(k, f[k])}`)
  if (acoes.length) L.push('Ações: ' + acoes.join('; '))
  return L
}

export interface LevantamentoTexto {
  obra: Partial<Obra>; ambientes: Ambiente[]; aberturasGerais: Abertura[]
  params: Partial<Params>; flags: Partial<Flags>
  /** O que o programa assumiu ou deixou de calcular por falta de informação. */
  usouPadrao: string[]
}
const semNome = <T extends { nome: string }>(p: T): Omit<T, 'nome'> => { const { nome: _n, ...r } = p; return r }

export function montarLevantamento(s: Sessao): LevantamentoTexto {
  const f = s.fatos, usouPadrao: string[] = []
  const obra: Partial<Obra> = {}
  if (typeof f['obra.pavimentos'] === 'number') obra.pavimentos = f['obra.pavimentos']; else usouPadrao.push('Pavimentos: não informado; considerado 1.')
  if (typeof f['obra.altura'] === 'number') { obra.alturaParede = f['obra.altura']; obra.unidadeAltura = 'm' } else usouPadrao.push('Pé-direito: não informado; ficou a altura padrão da obra (2,8 m), confira.')
  if (typeof f['obra.tipo'] === 'string') obra.tipo = f['obra.tipo']
  if (f['obra.terreno'] === 'plano' || f['obra.terreno'] === 'inclinado') obra.terreno = f['obra.terreno']

  const ids = new Map<string, string>()
  let ambientes: Ambiente[] = s.ambientes.map((nome) => {
    const g = (c: string) => f[kAmb(nome, c)]
    const c = g('comprimento'), l = g('largura'), id = uid()
    ids.set(norm(nome), id)
    if (typeof c !== 'number' || typeof l !== 'number') usouPadrao.push(`${nome}: sem medidas completas; não entra no cálculo até você preencher.`)
    const acoes: Acoes = {}
    for (const e of ['paredes', 'revestimento', 'piso', 'forro'] as const) { const a = g(`acao.${e}`); if (typeof a === 'string' && a !== 'construir') acoes[e] = a as Acao }
    const acab: Ambiente['acabamento'] = {}
    if (typeof g('piso') === 'string') acab.piso = g('piso') as PisoTipo
    if (typeof g('revParede') === 'string') acab.revParede = g('revParede') as RevParede
    if (typeof g('alturaCeramica') === 'number') acab.alturaCeramica = g('alturaCeramica') as number
    if (typeof g('forro') === 'boolean') acab.forro = g('forro') as boolean
    const am: Ambiente = { id, nome, comprimento: typeof c === 'number' ? c : 0, largura: typeof l === 'number' ? l : 0, unidade: 'm', origem: { fonte: 'texto', observacao: 'descrito em texto livre' } }
    if (typeof g('tipo') === 'string') am.tipo = g('tipo') as TipoAmbiente
    const pontos: Pontos = {}
    for (const t of PONTOS_TIPOS) { const v = g(`ponto.${t}`); if (typeof v === 'number' && v > 0) pontos[t] = v }
    if (Object.keys(pontos).length) am.pontos = pontos
    const pontosEl: PontosEl = {}
    for (const t of PONTOS_EL_TIPOS) { const v = g(`pel.${t}`); if (typeof v === 'number' && v > 0) pontosEl[t] = v }
    if (Object.keys(pontosEl).length) am.pontosEl = pontosEl
    if (typeof g('peDireito') === 'number') am.peDireito = g('peDireito') as number
    if (Object.keys(acab).length) am.acabamento = acab
    if (Object.keys(acoes).length) am.acoes = acoes
    return am
  })

  const aberturasGerais: Abertura[] = []
  for (const a of s.aberturas) {
    if (a.qtd === undefined || a.largura === undefined || a.altura === undefined) { usouPadrao.push(`${a.tipo === 'Porta' ? 'Portas' : 'Janelas'}${a.ambiente ? ` de ${a.ambiente}` : ''} sem quantidade ou medidas: não entram no cálculo.`); continue }
    const ab: Abertura = { id: uid(), tipo: a.tipo, largura: a.largura, altura: a.altura, qtd: a.qtd }
    const id = a.ambiente ? ids.get(norm(a.ambiente)) : undefined
    if (id) ambientes = ambientes.map((x) => (x.id === id ? { ...x, aberturas: [...(x.aberturas ?? []), ab] } : x))
    else aberturasGerais.push(ab)
  }

  let lados = 0
  const usados = new Map<string, number>()
  for (const [a, b] of s.divisas) {
    const ia = ids.get(norm(a)), ib = ids.get(norm(b))
    if (!ia || !ib) continue
    const n = usados.get(ia) ?? 0
    const lado = ([1, 3, 0, 2] as LadoIdx[])[n]
    if (lado === undefined) continue
    usados.set(ia, n + 1)
    ambientes = definirDivisa(ambientes, ia, lado, ib)
    lados++
  }
  if (lados) usouPadrao.push('Paredes compartilhadas: o lado de cada ambiente foi assumido (lado 2 e o oposto); confira em "Detalhes do ambiente".')

  const params: Partial<Params> = {}, flags: Partial<Flags> = {}
  const pre = (p: object | undefined) => (p ? semNome(p as { nome: string }) : {})
  if (typeof f['geral.blocoPreset'] === 'number') Object.assign(params, pre(BLOCOS[f['geral.blocoPreset']])); else usouPadrao.push(`Bloco: tamanho não informado; ficou o padrão do programa (${PARAMS_PADRAO.blocoC * 100} × ${PARAMS_PADRAO.blocoA * 100} cm de face).`)
  if (typeof f['geral.pisoPeca'] === 'number') { params.pisoC = f['geral.pisoPeca'] / 100; params.pisoL = f['geral.pisoPeca'] / 100 } else if (f['geral.piso'] === true) usouPadrao.push('Piso: tamanho da peça não informado; ficou o padrão do programa (60 × 60 cm).')
  const cob = f['geral.cobertura']
  if (typeof cob === 'boolean') flags.cobertura = cob
  if (cob === true) {
    if (typeof f['geral.telhaPreset'] === 'number') Object.assign(params, pre(TELHAS[f['geral.telhaPreset']]))
    if (typeof f['geral.coberturaC'] === 'number' && typeof f['geral.coberturaL'] === 'number') { params.roofC = f['geral.coberturaC']; params.roofL = f['geral.coberturaL'] } else usouPadrao.push('Telhado: dimensões não informadas; a cobertura não foi calculada.')
  }
  if (typeof f['geral.eletrica'] === 'boolean') flags.eletrica = f['geral.eletrica']
  if (f['geral.eletrica'] === true) {
    for (const [k, p] of [['Tomadas', 'eltTomadas'], ['Interruptores', 'eltInterruptores'], ['PontosLuz', 'eltPontosLuz'], ['Disjuntores', 'eltDisjuntores']] as const) {
      const v = f[`geral.elt${k}`]
      const dosAmbientes = s.ambientes.some((n) => (k === 'Tomadas' ? ['tug', 'tue'] : k === 'Interruptores' ? ['interruptor'] : k === 'PontosLuz' ? ['pontoLuz'] : []).some((t) => typeof f[kAmb(n, `pel.${t}`)] === 'number'))
      if (typeof v === 'number') params[p] = v; else if (!dosAmbientes) usouPadrao.push(`Elétrica: quantidade de ${k === 'PontosLuz' ? 'pontos de luz' : k.toLowerCase()} não informada; esse item não foi calculado.`)
    }
  }
  if (typeof f['geral.hidraulica'] === 'boolean') flags.hidraulica = f['geral.hidraulica']
  if (f['geral.hidraulica'] === true) {
    if (!s.ambientes.some((n) => PONTOS_TIPOS.some((t) => typeof f[kAmb(n, `ponto.${t}`)] === 'number'))) usouPadrao.push('Hidráulica: marcada, mas sem pontos por ambiente; informe-os em "Detalhes do ambiente" (ou nos Parâmetros) para a hidráulica ser calculada.')
    usouPadrao.push('Hidráulica: tubos e conexões são só estimativa por composição; informe os seus coeficientes por ponto em Parâmetros → composições próprias.')
  }
  if (typeof f['geral.revestimento'] === 'boolean') flags.revest = f['geral.revestimento']
  if (typeof f['geral.pintura'] === 'boolean') flags.pintura = f['geral.pintura']
  if (typeof f['geral.forro'] === 'boolean') flags.forro = f['geral.forro']
  else if (s.ambientes.some((n) => f[kAmb(n, 'forro')] === true)) flags.forro = true
  return { obra, ambientes, aberturasGerais, params, flags, usouPadrao }
}
