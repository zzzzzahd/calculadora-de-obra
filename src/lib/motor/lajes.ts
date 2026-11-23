/** Etapa(s) do cálculo: Laje pré-moldada, laje maciça, formas e escoramento. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function lajePre(c: Ctx): void {
  // LAJE PRÉ-MOLDADA — vigotas, enchimento, capeamento, tela e escoras (sem dimensionar a armadura nem o vão)
  const { p, add, conc } = c
  if (p.preLajeArea > 0 && p.preInter > 0 && p.preLajotaC > 0) {
    const Q = 'Laje pré-moldada', A = p.preLajeArea, d = `${A} m²; intereixo ${p.preInter} m`
    add({ etapa: Q, material: 'Vigota', unidade: 'm', tipo: 'Estimativa por composição', formula: 'área ÷ intereixo × (1 + perda)', dimensoes: d, coef: `intereixo ${p.preInter} m`, perda: p.perdaBloco, bruto: com(A / p.preInter, p.perdaBloco) })
    add({ etapa: Q, material: 'Lajota/EPS de enchimento', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área ÷ (intereixo × comprimento da peça) × (1 + perda)', dimensoes: `${d}; peça ${p.preLajotaC} m`, coef: `${f2(1 / (p.preInter * p.preLajotaC))} un/m²`, perda: p.perdaBloco, bruto: com(A / (p.preInter * p.preLajotaC), p.perdaBloco) })
    conc(Q, 'Concreto do capeamento', A * (p.preCapEsp / 100), `${A} m² × ${p.preCapEsp} cm`)
    if (p.preTela > 0) add({ etapa: Q, material: 'Tela soldada', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: `${A} m²`, coef: '—', perda: p.perdaConcreto, bruto: com(A, p.perdaConcreto) })
    add({ etapa: Q, material: 'Escora de laje', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área × escoras por m²', dimensoes: `${A} m²`, coef: `${p.escorasPorM2} un/m²`, perda: 0, bruto: A * p.escorasPorM2 })
  }
}

export function lajeFormas(c: Ctx): void {
  // LAJE (maciça), FORMAS E ESCORAMENTO — só com a área informada
  const { p, estado, add, conc, forma } = c
  if (p.lajeArea > 0) {
    conc('Laje', 'Concreto da laje', p.lajeArea * (p.lajeEsp / 100), `${p.lajeArea} m² × ${p.lajeEsp} cm`)
    forma('Laje', p.lajeArea, `fundo da laje ${p.lajeArea} m²`)
    add({ etapa: 'Laje', material: 'Escora de laje', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área × escoras por m²', dimensoes: `${p.lajeArea} m²`, coef: `${p.escorasPorM2} un/m²`, perda: 0, bruto: p.lajeArea * p.escorasPorM2 })
  }
  if (estado.formaTotal > 0 && p.reusoForma > 0) {
    const F = 'Formas e escoramento', dF = `${f2(estado.formaTotal)} m² de forma; ${p.reusoForma} reaproveitamento(s)`
    add({ etapa: F, material: 'Compensado resinado (chapa 1,22 × 2,44 m)', unidade: 'chapa', tipo: 'Estimativa por composição', formula: 'área de forma ÷ área da chapa ÷ reaproveitamentos × (1 + perda)', dimensoes: dF, coef: '2,977 m²/chapa', perda: p.perdaMadeira, bruto: com(estado.formaTotal / 2.9768 / p.reusoForma, p.perdaMadeira) })
    add({ etapa: F, material: 'Sarrafo de travamento', unidade: 'm', tipo: 'Estimativa por composição', formula: 'área de forma × m por m² ÷ reaproveitamentos × (1 + perda)', dimensoes: dF, coef: `${p.sarrafoMPorM2} m/m²`, perda: p.perdaMadeira, bruto: com((estado.formaTotal * p.sarrafoMPorM2) / p.reusoForma, p.perdaMadeira) })
  }
}
