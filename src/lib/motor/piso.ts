/** Etapa(s) do cálculo: Contrapiso e piso (peças, rodapé, rejunte, argamassa colante). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function contrapiso(c: Ctx): void {
  // CONTRAPISO E PISO
  const { p, lev, add, sufArea } = c
  const volC = com(lev.areaContrapiso * (p.espContrapisoCm / 100), p.perdaConcreto)
  const dc = `área ${f2(lev.areaContrapiso)} m²${sufArea(lev.areaContrapiso)} × espessura ${p.espContrapisoCm} cm`
  if (volC > 0) {
    add({ etapa: 'Contrapiso e piso', material: 'Concreto do contrapiso', unidade: 'm³', tipo: 'Geométrico',
      formula: 'área × espessura × (1 + perda)', dimensoes: dc, coef: '—', perda: p.perdaConcreto, bruto: volC })
    add({ etapa: 'Contrapiso e piso', material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição',
      formula: 'volume × kg de cimento/m³ ÷ kg por saco', dimensoes: `concreto ${f2(volC)} m³`,
      coef: `${p.ctCimentoKg} kg/m³; saco ${p.sacoKg} kg`, perda: p.perdaConcreto, bruto: (volC * p.ctCimentoKg) / p.sacoKg })
    add({ etapa: 'Contrapiso e piso', material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'volume × m³ de areia/m³', dimensoes: `concreto ${f2(volC)} m³`, coef: `${p.ctAreiaM3} m³/m³`, perda: p.perdaConcreto, bruto: volC * p.ctAreiaM3 })
    add({ etapa: 'Contrapiso e piso', material: 'Brita', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'volume × m³ de brita/m³', dimensoes: `concreto ${f2(volC)} m³`, coef: `${p.ctBritaM3} m³/m³`, perda: p.perdaConcreto, bruto: volC * p.ctBritaM3 })
  }
  if (p.pisoC > 0 && p.pisoL > 0 && lev.areaPecas > 0) {
    const areaPiso = com(lev.areaPecas, p.perdaPiso)
    const dPeca = `área ${f2(lev.areaPecas)} m²${sufArea(lev.areaPecas)}`
    add({ etapa: 'Contrapiso e piso', material: 'Piso (área)', unidade: 'm²', tipo: 'Geométrico',
      formula: 'área × (1 + perda)', dimensoes: dPeca, coef: '—', perda: p.perdaPiso, bruto: areaPiso })
    add({ etapa: 'Contrapiso e piso', material: 'Piso (peças)', unidade: 'un', tipo: 'Geométrico',
      formula: 'área com perda ÷ (comprimento × largura da peça)', dimensoes: `área ${f2(areaPiso)} m²; peça ${p.pisoC}×${p.pisoL} m`,
      coef: `${f2(1 / (p.pisoC * p.pisoL))} un/m²`, perda: p.perdaPiso, bruto: areaPiso / (p.pisoC * p.pisoL) })
    const perim = lev.ambientes.reduce((t, a) => t + (a.pecas ? a.perimetro : 0), 0)
    const portasL = lev.portasRodapeM
    const pe = (material: string, unidade: string, formula: string, dimensoes: string, coef: string, perda: number, bruto: number) =>
      add({ etapa: 'Contrapiso e piso', material, unidade, tipo: 'Estimativa por composição', formula, dimensoes, coef, perda, bruto })
    if (p.rodape > 0 && p.rodapeBarraM > 0)
      pe('Rodapé (peças)', 'un', '(perímetro − largura das portas) ÷ peça × (1 + perda)', `perímetro ${f2(perim)} m − portas ${f2(portasL)} m`, `peça ${p.rodapeBarraM} m`, p.perdaRodape, com(lev.perimRodape / p.rodapeBarraM, p.perdaRodape))
    if (p.rejunteKgM2 > 0) pe('Rejunte', 'kg', 'área × consumo', dPeca, `${p.rejunteKgM2} kg/m²`, 0, lev.areaPecas * p.rejunteKgM2)
    if (p.espPorPeca > 0) pe('Espaçadores', 'un', 'peças × espaçadores por peça', `${f2(areaPiso / (p.pisoC * p.pisoL))} peças`, `${p.espPorPeca} un/peça`, 0, (areaPiso / (p.pisoC * p.pisoL)) * p.espPorPeca)
    if (p.colanteKgM2 > 0 && p.colanteSacoKg > 0) pe('Argamassa colante', 'saco', 'área × consumo ÷ kg por saco', dPeca, `${p.colanteKgM2} kg/m²; saco ${p.colanteSacoKg} kg`, 0, (lev.areaPecas * p.colanteKgM2) / p.colanteSacoKg)
  }
}
