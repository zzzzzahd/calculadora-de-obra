/**
 * MOTOR DE CÁLCULO — fachada. As fórmulas ficam em módulos por etapa, em `./motor/`; `calcular` só monta o contexto e
 * chama as etapas na ordem. Nenhum coeficiente é fixo: tudo vem de `Params` (editável na tela).
 * Medidas em metros; áreas em m²; volumes em m³.
 *
 *  - `params.ts`: `Params` e `PARAMS_PADRAO`.
 *  - `motor/contexto.ts`: contexto compartilhado (levantamento resolvido, acumulador de itens, ajudantes de concreto e forma).
 *  - `motor/<etapa>.ts`: uma função por etapa, que acrescenta itens ao contexto.
 *  - `motor/consolidar.ts`: lista de compras.
 */
import type { Abertura, Ambiente, Obra } from '../types'
import type { Params } from './params'
import { criarContexto } from './motor/contexto'
import { terreno } from './motor/terreno'
import { fundacao } from './motor/fundacao'
import { muro, calcada, escada, piscina } from './motor/externos'
import { lajePre, lajeFormas } from './motor/lajes'
import { fossa } from './motor/fossa'
import { alvenaria, vergas } from './motor/alvenaria'
import { contrapiso } from './motor/piso'
import { gesso, estruturaMetalica, estruturaMadeira } from './motor/estruturas'
import { esquadrias } from './motor/esquadrias'
import { impermeabilizacao } from './motor/impermeabilizacao'
import { revestimentos } from './motor/revestimentos'
import { pintura } from './motor/pintura'
import { instalacoes } from './motor/instalacoes'
import { cobertura } from './motor/cobertura'
import { aditivos } from './motor/aditivos'
import { composicoes } from './motor/composicoes'
import { demolicao } from './motor/demolicao'
import type { Item } from './motor/tipos'

export type { Abertura }
export { PARAMS_PADRAO, type Params } from './params'
export type { Composicao, ConexaoHidro, Item, TipoQuant } from './motor/tipos'
export { consolidar } from './motor/consolidar'

export function areaAberturas(p: Params): number {
  return p.aberturas.reduce((s, a) => s + a.largura * a.altura * a.qtd, 0)
}

/** Etapas na ordem em que aparecem nos resultados. */
export function calcular(obra: Obra, ambientes: Ambiente[], p: Params): Item[] {
  const c = criarContexto(obra, ambientes, p)
  if (c.area1 <= 0) return c.itens
  terreno(c)
  fundacao(c)
  muro(c)
  calcada(c)
  escada(c)
  lajePre(c)
  fossa(c)
  piscina(c)
  lajeFormas(c)
  alvenaria(c)
  vergas(c)
  contrapiso(c)
  gesso(c)
  estruturaMetalica(c)
  estruturaMadeira(c)
  esquadrias(c)
  impermeabilizacao(c)
  revestimentos(c)
  pintura(c)
  instalacoes(c)
  cobertura(c)
  aditivos(c)
  composicoes(c)
  demolicao(c)
  return c.itens
}
