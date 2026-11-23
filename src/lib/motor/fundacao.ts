/** Etapa(s) do cálculo: Fundação e estrutura de concreto (só com as dimensões informadas). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function fundacao(c: Ctx): void {
  // FUNDAÇÃO E ESTRUTURA — somente com as dimensões informadas; sem dados, nada é calculado
  const { p, h, add, conc, forma } = c
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
}
