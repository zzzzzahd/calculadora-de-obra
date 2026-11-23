/** Etapa(s) do cálculo: Preparação do terreno: limpeza, aterro, escavação e transporte de terra. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function terreno(c: Ctx): void {
  // PREPARAÇÃO DO TERRENO
  const { obra, p, area1, add } = c
  const T = 'Preparação do terreno'
  const mt = obra.movimentoTerra
  add({ etapa: T, material: 'Limpeza do terreno', unidade: 'm²', tipo: 'Geométrico', formula: 'área construída (1 pavimento)', dimensoes: `${f2(area1)} m²`, coef: '—', perda: 0, bruto: area1 })
  if ((mt === 'aterro' || mt === 'ambos') && p.aterroH > 0) {
    add({ etapa: T, material: 'Aterro', unidade: 'm³', tipo: 'Geométrico', formula: 'área × altura média × (1 + empolamento/compactação)', dimensoes: `${f2(area1)} m² × ${p.aterroH} m`, coef: '—', perda: p.perdaAterro, bruto: com(area1 * p.aterroH, p.perdaAterro) })
    add({ etapa: T, material: 'Compactação', unidade: 'm²', tipo: 'Geométrico', formula: 'área do aterro', dimensoes: `${f2(area1)} m²`, coef: '—', perda: 0, bruto: area1 })
  }
  if ((mt === 'escavacao' || mt === 'ambos') && p.escavH > 0)
    add({ etapa: T, material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: 'área × profundidade média', dimensoes: `${f2(area1)} m² × ${p.escavH} m`, coef: '—', perda: 0, bruto: area1 * p.escavH })

  if (p.transporte > 0 && p.caminhaoM3 > 0) {
    const emp = 1 + p.perdaAterro / 100
    const volA = (mt === 'aterro' || mt === 'ambos') && p.aterroH > 0 ? area1 * p.aterroH * emp : 0
    const volE = (mt === 'escavacao' || mt === 'ambos') && p.escavH > 0 ? area1 * p.escavH * emp : 0
    add({ etapa: T, material: 'Transporte de terra (viagens)', unidade: 'viagem', tipo: 'Estimativa por composição', formula: '(aterro + escavação, com empolamento) ÷ capacidade do caminhão',
      dimensoes: `aterro ${f2(volA)} m³ + escavação ${f2(volE)} m³`, coef: `caminhão ${p.caminhaoM3} m³`, perda: p.perdaAterro, bruto: (volA + volE) / p.caminhaoM3 })
  }
}
