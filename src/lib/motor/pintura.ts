/** Etapa(s) do cálculo: Pintura: massa, selador, lixa, tinta e acessórios. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, f2 } from './contexto'

export function pintura(c: Ctx): void {
  // PINTURA — massa, selador, lixa, tinta (1 ou 2 cores) e acessórios
  const { p, lev, liq, add } = c
  const pInt = Math.min(p.faces, 1), pExt = Math.max(0, p.faces - 1)
  const areaP = lev.pintInterna * pInt + lev.extLiquida * pExt
  if (areaP > 0 && p.faces > 0 && p.rendTinta > 0 && p.latL > 0) {
    const P = 'Pintura'
    const dimP = lev.simples && lev.compartilhadaM === 0
      ? `área líquida ${f2(liq)} m² × ${p.faces} face(s) = ${f2(areaP)} m²`
      : `faces internas ${f2(lev.pintInterna)} m² + faces externas ${f2(lev.extLiquida)} m² (faces: ${p.faces}) = ${f2(areaP)} m²`
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
    const perimAb = lev.aberturas.reduce((t, x) => t + 2 * (x.ab.largura + x.ab.altura) * x.ab.qtd * (x.vizinhoId ? 2 : 1), 0) // abertura em divisa é pintada nos dois ambientes
    if (perimAb > 0 && p.fitaM > 0)
      ac('Fita crepe', 'rolo', 'perímetro das aberturas ÷ metros por rolo', `perímetro ${f2(perimAb)} m`, `${p.fitaM} m/rolo`, perimAb / p.fitaM)
  }
}
