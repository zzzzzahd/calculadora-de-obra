/** Etapa(s) do cálculo: Fossa séptica e sumidouro. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function fossa(c: Ctx): void {
  // FOSSA SÉPTICA E SUMIDOURO — materiais a partir das medidas informadas (volume útil e dimensões: projeto/NBR 7229 e 13969)
  const { p, add, conc } = c
  // BLOCOS + ARGAMASSA DE ASSENTAMENTO para fossa, sumidouro etc. (parâmetros da alvenaria)
  const alvBlocos = (etapa: string, aP: number, dim: string) => {
    const aB = p.blocoC * p.blocoA
    if (aP <= 0 || aB <= 0) return
    const v = com(aP * p.argM3m2, p.perdaArg)
    add({ etapa, material: 'Bloco', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área de parede ÷ (comprimento × altura do bloco) × (1 + perda)', dimensoes: `${dim}; bloco ${p.blocoC}×${p.blocoA} m`, coef: `${f2(1 / aB)} un/m²`, perda: p.perdaBloco, bruto: com(aP / aB, p.perdaBloco) })
    add({ etapa, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: 'argamassa de assentamento × kg de cimento/m³ ÷ kg por saco', dimensoes: `${dim}; argamassa ${f2(v)} m³`, coef: `${p.argCimentoKg} kg/m³`, perda: p.perdaArg, bruto: (v * p.argCimentoKg) / p.sacoKg })
    add({ etapa, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'argamassa de assentamento × m³ de areia/m³', dimensoes: `${dim}; argamassa ${f2(v)} m³`, coef: `${p.argAreiaM3} m³/m³`, perda: p.perdaArg, bruto: v * p.argAreiaM3 })
  }

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
}
