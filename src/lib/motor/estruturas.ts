/** Etapa(s) do cálculo: Gesso e drywall, estrutura metálica e estrutura de madeira. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2, fim } from './contexto'

export function gesso(c: Ctx): void {
  // GESSO E DRYWALL — paredes (chapas, montantes, guias) e forro (chapas, perfis, pendurais); medidas informadas
  const { p, add } = c
  const chapaA = p.dwChapaC * p.dwChapaL, D = 'Gesso e drywall'
  const dwAc = (area: number, d: string) => {
    add({ etapa: D, material: 'Parafuso para drywall', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área de chapa × parafusos por m² × (1 + perda)', dimensoes: d, coef: `${p.dwParafM2} un/m²`, perda: p.perdaDw, bruto: com(area * p.dwParafM2, p.perdaDw) })
    add({ etapa: D, material: 'Fita para junta', unidade: 'm', tipo: 'Estimativa por composição', formula: 'área de chapa × m de fita por m² × (1 + perda)', dimensoes: d, coef: `${p.dwFitaMM2} m/m²`, perda: p.perdaDw, bruto: com(area * p.dwFitaMM2, p.perdaDw) })
    add({ etapa: D, material: 'Massa para junta', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'área de chapa × consumo', dimensoes: d, coef: `${p.dwMassaKgM2} kg/m²`, perda: 0, bruto: area * p.dwMassaKgM2 })
  }
  if (chapaA > 0 && p.dwBarraM > 0) {
    if (p.dwComp > 0 && p.dwAlt > 0) {
      const face = p.dwComp * p.dwAlt * p.dwFaces, nM = fim(p.dwComp / Math.max(p.dwEspMont, 0.1)) + 1, d = `parede ${p.dwComp} m × ${p.dwAlt} m; ${p.dwFaces} face(s) = ${f2(face)} m²`
      add({ etapa: D, material: 'Chapa de drywall', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área das faces ÷ área da chapa × (1 + perda)', dimensoes: `${d}; chapa ${p.dwChapaC}×${p.dwChapaL} m`, coef: `${f2(1 / chapaA)} un/m²`, perda: p.perdaDw, bruto: com(face / chapaA, p.perdaDw) })
      add({ etapa: D, material: 'Montante (barras)', unidade: 'barra', tipo: 'Geométrico', formula: '(⌈comprimento ÷ espaçamento⌉ + 1) × altura ÷ barra × (1 + perda)', dimensoes: `${nM} montantes de ${p.dwAlt} m; espaçamento ${p.dwEspMont} m`, coef: `barra ${p.dwBarraM} m`, perda: p.perdaDw, bruto: com((nM * p.dwAlt) / p.dwBarraM, p.perdaDw) })
      add({ etapa: D, material: 'Guia (barras)', unidade: 'barra', tipo: 'Geométrico', formula: '2 × comprimento (piso e teto) ÷ barra × (1 + perda)', dimensoes: `${p.dwComp} m × 2`, coef: `barra ${p.dwBarraM} m`, perda: p.perdaDw, bruto: com((2 * p.dwComp) / p.dwBarraM, p.perdaDw) })
      dwAc(face, d)
    }
    if (p.dwForroArea > 0) {
      const A = p.dwForroArea, d = `forro ${A} m²`
      add({ etapa: D, material: 'Chapa de drywall', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área do forro ÷ área da chapa × (1 + perda)', dimensoes: `${d}; chapa ${p.dwChapaC}×${p.dwChapaL} m`, coef: `${f2(1 / chapaA)} un/m²`, perda: p.perdaDw, bruto: com(A / chapaA, p.perdaDw) })
      add({ etapa: D, material: 'Perfil de forro (barras)', unidade: 'barra', tipo: 'Estimativa por composição', formula: 'área × m de perfil por m² ÷ barra × (1 + perda)', dimensoes: d, coef: `${p.dwForroPerfilM2} m/m²; barra ${p.dwBarraM} m`, perda: p.perdaDw, bruto: com((A * p.dwForroPerfilM2) / p.dwBarraM, p.perdaDw) })
      add({ etapa: D, material: 'Pendural', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área × penduras por m²', dimensoes: d, coef: `${p.dwPendM2} un/m²`, perda: 0, bruto: A * p.dwPendM2 })
      dwAc(A, d)
    }
  }
}

export function estruturaMetalica(c: Ctx): void {
  // ESTRUTURA METÁLICA — perfis informados (bitolas e dimensionamento: projeto estrutural)
  const { p, add } = c
  if (p.metComp > 0 && p.metBarraM > 0) {
    const X = 'Estrutura metálica', kg = p.metComp * p.metKgM, d = `${p.metComp} m de perfis; ${p.metKgM} kg/m (conforme projeto)`
    add({ etapa: X, material: 'Perfil metálico (bitola conforme projeto)', unidade: 'barra', tipo: 'Geométrico', formula: 'comprimento total ÷ barra × (1 + perda)', dimensoes: d, coef: `barra ${p.metBarraM} m`, perda: p.perdaMet, bruto: com(p.metComp / p.metBarraM, p.perdaMet) })
    add({ etapa: X, material: 'Peso do aço estrutural', unidade: 'kg', tipo: 'Geométrico', formula: 'comprimento × kg/m', dimensoes: d, coef: `${p.metKgM} kg/m`, perda: 0, bruto: kg })
    add({ etapa: X, material: 'Eletrodo de solda', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'peso do aço × consumo', dimensoes: `${f2(kg)} kg de aço`, coef: `${p.metSoldaKgKg} kg/kg`, perda: 0, bruto: kg * p.metSoldaKgKg })
    if (p.metRend > 0 && p.latL > 0)
      add({ etapa: X, material: 'Tinta de fundo anticorrosiva', unidade: 'lata', tipo: 'Estimativa por composição', formula: 'comprimento × m² por metro × demãos ÷ rendimento ÷ litros da lata', dimensoes: `${f2(p.metComp * p.metSupM)} m² de superfície; ${p.metDemaos} demão(s)`, coef: `${p.metRend} m²/L/demão; lata ${p.latL} L`, perda: 0, bruto: (p.metComp * p.metSupM * p.metDemaos) / p.metRend / p.latL })
  }
}

export function estruturaMadeira(c: Ctx): void {
  // ESTRUTURA DE MADEIRA (além do telhado) — metros informados (bitolas e dimensionamento: projeto)
  const { p, add } = c
  if (p.madComp > 0 && p.madBarraM > 0) {
    const d = `${p.madComp} m de peças (bitola conforme projeto)`
    add({ etapa: 'Estrutura de madeira', material: 'Madeira estrutural (bitola conforme projeto)', unidade: 'barra', tipo: 'Geométrico', formula: 'comprimento total ÷ barra × (1 + perda)', dimensoes: d, coef: `barra ${p.madBarraM} m`, perda: p.perdaMadeira, bruto: com(p.madComp / p.madBarraM, p.perdaMadeira) })
    add({ etapa: 'Estrutura de madeira', material: 'Prego/parafuso para madeira', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'comprimento × consumo', dimensoes: d, coef: `${p.madPregoKgM} kg/m`, perda: 0, bruto: p.madComp * p.madPregoKgM })
  }
}
