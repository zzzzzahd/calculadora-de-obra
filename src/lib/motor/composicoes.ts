/** Etapa(s) do cálculo: Composições próprias da biblioteca técnica. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'
import { totaisHidro } from '../hidraulica'

export function composicoes(c: Ctx): void {
  // COMPOSIÇÕES PRÓPRIAS (biblioteca técnica): quantidade = base × coeficiente × (1 + perda)
  const { p, area1, liq, add, ambientes } = c
  const th = totaisHidro(ambientes, p)
  const bases = { area: [area1, 'área construída (m²)'], parede: [liq, 'área líquida de parede (m²)'], fixa: [1, 'quantidade fixa'], pontosAgua: [th.agua, 'pontos de água fria'], pontosEsgoto: [th.esgoto, 'pontos de esgoto'] } as const
  for (const c of p.composicoes) {
    const [b, rotulo] = bases[c.base]
    add({ etapa: c.etapa || 'Outros', material: c.nome, unidade: c.unidade, tipo: 'Estimativa por composição', formula: `${rotulo} × coeficiente × (1 + perda)`,
      dimensoes: `base ${f2(b)}`, coef: `${c.coef} ${c.unidade} por unidade da base`, perda: c.perda, bruto: com(b * c.coef, c.perda) })
  }
}
