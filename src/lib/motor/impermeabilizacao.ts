/** Etapa(s) do cálculo: Impermeabilização. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, f2 } from './contexto'

export function impermeabilizacao(c: Ctx): void {
  // IMPERMEABILIZAÇÃO (áreas informadas + topo e laterais do baldrame, quando ligado)
  const { p, add } = c
  const areaImp = p.imperArea + (p.imperBaldrame > 0 ? p.fundComp * (p.fundLarg + 2 * p.fundAlt) : 0)
  if (areaImp > 0 && p.imperKgM2 > 0) {
    const dI = `${f2(p.imperArea)} m² informados + ${f2(areaImp - p.imperArea)} m² de baldrame`
    add({ etapa: 'Impermeabilização', material: 'Área impermeabilizada', unidade: 'm²', tipo: 'Geométrico', formula: 'áreas informadas + comprimento × (largura + 2 × altura) do baldrame', dimensoes: dI, coef: '—', perda: 0, bruto: areaImp })
    add({ etapa: 'Impermeabilização', material: 'Impermeabilizante', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'área × consumo (já com as demãos)', dimensoes: dI, coef: `${p.imperKgM2} kg/m²`, perda: 0, bruto: areaImp * p.imperKgM2 })
  }
}
