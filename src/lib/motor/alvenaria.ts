/** Etapa(s) do cálculo: Alvenaria, vergas e contravergas. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function alvenaria(c: Ctx): void {
  // ALVENARIA
  const { p, lev, brutaParede, aberturas, liq, add } = c
  const dimLiq = lev.compartilhadaConstruirM > 0
    ? `parede bruta ${f2(brutaParede)} m² (${f2(lev.externaConstruirM + lev.compartilhadaConstruirM)} m de parede: ${f2(lev.externaConstruirM)} m externa + ${f2(lev.compartilhadaConstruirM)} m compartilhada, contada uma vez) − aberturas ${f2(aberturas)} m² = ${f2(liq)} m²`
    : `parede bruta ${f2(brutaParede)} m² − aberturas ${f2(aberturas)} m² = ${f2(liq)} m²`
  const areaBloco = p.blocoC * p.blocoA
  if (liq > 0 && areaBloco > 0) {
    add({ etapa: 'Alvenaria', material: 'Bloco', unidade: 'un', tipo: 'Estimativa por composição',
      formula: 'área líquida ÷ (comprimento × altura do bloco) × (1 + perda)',
      dimensoes: `${dimLiq}; bloco ${p.blocoC}×${p.blocoA} m`, coef: `${f2(1 / areaBloco)} un/m²`, perda: p.perdaBloco,
      bruto: com(liq / areaBloco, p.perdaBloco) })
    const vol = com(liq * p.argM3m2, p.perdaArg)
    const d = `${dimLiq}; consumo ${p.argM3m2} m³/m²`
    add({ etapa: 'Alvenaria', material: 'Argamassa de assentamento', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'área líquida × consumo × (1 + perda)', dimensoes: d, coef: `${p.argM3m2} m³/m²`, perda: p.perdaArg, bruto: vol })
    add({ etapa: 'Alvenaria', material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição',
      formula: 'volume de argamassa × kg de cimento/m³ ÷ kg por saco', dimensoes: `argamassa ${f2(vol)} m³`,
      coef: `${p.argCimentoKg} kg/m³; saco ${p.sacoKg} kg`, perda: p.perdaArg, bruto: (vol * p.argCimentoKg) / p.sacoKg })
    add({ etapa: 'Alvenaria', material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição',
      formula: 'volume de argamassa × m³ de areia/m³', dimensoes: `argamassa ${f2(vol)} m³`,
      coef: `${p.argAreiaM3} m³/m³`, perda: p.perdaArg, bruto: vol * p.argAreiaM3 })
    add({ etapa: 'Alvenaria', material: 'Cal hidratada', unidade: 'saco', tipo: 'Estimativa por composição',
      formula: 'volume de argamassa × kg de cal/m³ ÷ kg por saco', dimensoes: `argamassa ${f2(vol)} m³`,
      coef: `${p.calKgM3} kg/m³; saco ${p.calSacoKg} kg`, perda: p.perdaArg, bruto: p.calSacoKg > 0 ? (vol * p.calKgM3) / p.calSacoKg : 0 })
  }
}

export function vergas(c: Ctx): void {
  // VERGAS E CONTRAVERGAS — verga em portas e janelas; contraverga só em janelas; apoio de cada lado
  const { p, abertTodas, conc } = c
  if (p.vergas > 0 && abertTodas.length > 0) {
    const comp = abertTodas.reduce((t, a) => t + (a.largura + 2 * p.vergaApoio) * a.qtd * (a.tipo === 'Janela' ? 2 : 1), 0)
    conc('Alvenaria', 'Concreto de vergas e contravergas', comp * p.vergaL * p.vergaH, `${f2(comp)} m de peças × ${p.vergaL} × ${p.vergaH} m (apoio ${p.vergaApoio} m por lado)`)
  }
}
