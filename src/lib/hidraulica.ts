/**
 * Pontos hidráulicos do levantamento: soma dos pontos cadastrados nos ambientes com os contadores gerais dos parâmetros
 * ("sem ambiente"). Só contagem; tubos, conexões e diâmetros vêm de composições com coeficientes informados pelo usuário.
 */
import { PONTOS_HIDRO, type Ambiente, type PontoHidro } from '../types'
import type { Params } from './params'
import type { ConexaoHidro } from './motor/tipos'

export interface TotaisHidro {
  agua: number; esgoto: number // total (ambientes + parâmetros gerais)
  aguaAmbientes: number; esgotoAmbientes: number // só os dos ambientes
  porTipo: Record<PontoHidro, number> // cadastrados nos ambientes
  porAmbiente: { id: string; nome: string; agua: number; esgoto: number }[]
}

const TIPOS = Object.keys(PONTOS_HIDRO) as PontoHidro[]
const qtd = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

export function totaisHidro(ambientes: Ambiente[], p: Pick<Params, 'hidPontosAgua' | 'sanPontos'>): TotaisHidro {
  const porTipo = Object.fromEntries(TIPOS.map((t) => [t, 0])) as Record<PontoHidro, number>
  let aguaAmbientes = 0, esgotoAmbientes = 0
  const porAmbiente = ambientes.map((a) => {
    let agua = 0, esgoto = 0
    for (const t of TIPOS) {
      const n = qtd(a.pontos?.[t]); if (!n) continue
      porTipo[t] += n
      if (PONTOS_HIDRO[t].agua) agua += n
      if (PONTOS_HIDRO[t].esgoto) esgoto += n
    }
    aguaAmbientes += agua; esgotoAmbientes += esgoto
    return { id: a.id, nome: a.nome, agua, esgoto }
  })
  return { agua: p.hidPontosAgua + aguaAmbientes, esgoto: p.sanPontos + esgotoAmbientes, aguaAmbientes, esgotoAmbientes, porTipo, porAmbiente }
}

/** Texto curto dos pontos de um ambiente (ex.: "vaso sanitário 1; chuveiro 1"); vazio se não há. */
export function descreverPontos(a: Ambiente): string {
  return TIPOS.flatMap((t) => { const n = qtd(a.pontos?.[t]); return n ? [`${PONTOS_HIDRO[t].rotulo.toLowerCase()} ${n}`] : [] }).join('; ')
}

/** O tipo de peça interessa a conexões deste sistema? (registro também interessa à água: união, adaptador etc.) */
export const pontoDoSistema = (t: PontoHidro, sistema: 'agua' | 'esgoto') => PONTOS_HIDRO[t][sistema] || (t === 'registro' && sistema === 'agua')
export const TIPOS_HIDRO = TIPOS

/** Quantidade de uma conexão detalhada (sem perda) e a conta por extenso, para a memória de cálculo. */
export function quantidadeConexao(c: ConexaoHidro, th: TotaisHidro, p: Pick<Params, 'hidPontosAgua' | 'sanPontos'>): { qtd: number; partes: string[] } {
  let qtd = 0; const partes: string[] = []
  for (const t of TIPOS) {
    const coef = qtd0(c.porPonto[t]), n = th.porTipo[t]
    if (!coef || !n || !pontoDoSistema(t, c.sistema)) continue
    qtd += n * coef; partes.push(`${PONTOS_HIDRO[t].rotulo.toLowerCase()} ${n} × ${coef}`)
  }
  const gerais = c.sistema === 'agua' ? p.hidPontosAgua : p.sanPontos, cg = qtd0(c.porPontoGeral)
  if (cg && gerais > 0) { qtd += gerais * cg; partes.push(`pontos gerais ${gerais} × ${cg}`) }
  const fixa = qtd0(c.fixa)
  if (fixa) { qtd += fixa; partes.push(`fixa ${fixa}`) }
  return { qtd, partes }
}
const qtd0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/**
 * Nomes de conexões comuns, só para facilitar a criação das linhas. Não trazem diâmetro, material nem quantidade:
 * tudo isso é definido por você (todos os coeficientes começam em zero).
 */
export const CONEXOES_COMUNS: Record<'agua' | 'esgoto', string[]> = {
  agua: ['Joelho 90°', 'Joelho 45°', 'Tê', 'Luva', 'União', 'Adaptador', 'Bucha de redução', 'Curva 90°', 'Tampão (cap)', 'Joelho 90° com bucha de latão', 'Tê com bucha de latão'],
  esgoto: ['Joelho 90°', 'Joelho 45°', 'Tê', 'Junção 45°', 'Luva', 'Curva 90°', 'Bucha de redução', 'Tampão (cap)', 'Luva de correr'],
}
