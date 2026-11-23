/** Etapa(s) do cálculo: Muro, calçada, escada e piscina (medidas informadas pelo usuário). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2, fim } from './contexto'

export function muro(c: Ctx): void {
  // MURO — blocos e argamassa (parâmetros da alvenaria), fundação corrida e pilaretes
  const { p, add, conc, forma } = c
  if (p.muroComp > 0 && p.muroAlt > 0) {
    const M = 'Muro', aM = p.muroComp * p.muroAlt, aB = p.blocoC * p.blocoA, dM = `${p.muroComp} m × ${p.muroAlt} m = ${f2(aM)} m²`
    if (aB > 0) {
      const v = com(aM * p.argM3m2, p.perdaArg)
      add({ etapa: M, material: 'Bloco', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área do muro ÷ (comprimento × altura do bloco) × (1 + perda)', dimensoes: `${dM}; bloco ${p.blocoC}×${p.blocoA} m`, coef: `${f2(1 / aB)} un/m²`, perda: p.perdaBloco, bruto: com(aM / aB, p.perdaBloco) })
      add({ etapa: M, material: 'Argamassa de assentamento', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'área × consumo × (1 + perda)', dimensoes: dM, coef: `${p.argM3m2} m³/m²`, perda: p.perdaArg, bruto: v })
      add({ etapa: M, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: 'argamassa × kg de cimento/m³ ÷ kg por saco', dimensoes: `argamassa ${f2(v)} m³`, coef: `${p.argCimentoKg} kg/m³`, perda: p.perdaArg, bruto: (v * p.argCimentoKg) / p.sacoKg })
      add({ etapa: M, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'argamassa × m³ de areia/m³', dimensoes: `argamassa ${f2(v)} m³`, coef: `${p.argAreiaM3} m³/m³`, perda: p.perdaArg, bruto: v * p.argAreiaM3 })
    }
    const nP = fim(p.muroComp / Math.max(p.muroPilarEsp, 0.1)) + 1
    conc(M, 'Concreto do muro (fundação e pilaretes)', p.muroComp * p.muroFundL * p.muroFundH + nP * p.muroPilarSec * p.muroPilarSec * p.muroAlt,
      `fundação ${p.muroComp}×${p.muroFundL}×${p.muroFundH} m + ${nP} pilaretes ${p.muroPilarSec}×${p.muroPilarSec}×${p.muroAlt} m`)
    forma(M, p.muroComp * p.muroFundH * 2 + nP * 4 * p.muroPilarSec * p.muroAlt, 'laterais da fundação + pilaretes')
  }
}

export function calcada(c: Ctx): void {
  // CALÇADA E ÁREAS EXTERNAS — concreto (traço do contrapiso), lastro de brita e tela opcional
  const { p, add } = c
  if (p.calcArea > 0) {
    const K = 'Calçada e áreas externas', v = com(p.calcArea * (p.calcEsp / 100), p.perdaConcreto), d = `${p.calcArea} m² × ${p.calcEsp} cm; concreto ${f2(v)} m³`
    add({ etapa: K, material: 'Concreto da calçada', unidade: 'm³', tipo: 'Geométrico', formula: 'área × espessura × (1 + perda)', dimensoes: `${p.calcArea} m² × ${p.calcEsp} cm`, coef: '—', perda: p.perdaConcreto, bruto: v })
    add({ etapa: K, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: 'concreto × kg de cimento/m³ ÷ kg por saco', dimensoes: d, coef: `${p.ctCimentoKg} kg/m³`, perda: p.perdaConcreto, bruto: (v * p.ctCimentoKg) / p.sacoKg })
    add({ etapa: K, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'concreto × m³ de areia/m³', dimensoes: d, coef: `${p.ctAreiaM3} m³/m³`, perda: p.perdaConcreto, bruto: v * p.ctAreiaM3 })
    add({ etapa: K, material: 'Brita', unidade: 'm³', tipo: 'Estimativa por composição', formula: 'concreto × m³ de brita/m³', dimensoes: d, coef: `${p.ctBritaM3} m³/m³`, perda: p.perdaConcreto, bruto: v * p.ctBritaM3 })
    add({ etapa: K, material: 'Brita de lastro', unidade: 'm³', tipo: 'Geométrico', formula: 'área × espessura do lastro × (1 + perda)', dimensoes: `${p.calcArea} m² × ${p.calcLastroCm} cm`, coef: '—', perda: p.perdaConcreto, bruto: com(p.calcArea * (p.calcLastroCm / 100), p.perdaConcreto) })
    if (p.calcTela > 0) add({ etapa: K, material: 'Tela soldada', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: `${p.calcArea} m²`, coef: '—', perda: p.perdaConcreto, bruto: com(p.calcArea, p.perdaConcreto) })
  }
}

export function escada(c: Ctx): void {
  // ESCADA DE CONCRETO — reta, em L ou em U (com patamar) e em L com leque (estimativa); lajes inclinadas + degraus
  const { p, add, conc, forma } = c
  if (p.escLarg > 0 && p.escAlt > 0 && p.escEspelho > 0 && p.escPiso > 0) {
    const nE = fim(p.escAlt / p.escEspelho), tipo = p.escTipo
    const n1 = fim(nE / 2)
    const lances = tipo === 1 || tipo === 2 ? [n1, nE - n1] : [nE]
    const patA = tipo === 1 ? p.escLarg * p.escLarg : tipo === 2 ? (2 * p.escLarg + p.escFolga) * p.escLarg : 0
    let vol = patA * p.escEspLaje, aForma = patA
    for (const n of lances) {
      const Li = Math.sqrt((n * p.escPiso) ** 2 + (n * p.escEspelho) ** 2)
      vol += p.escLarg * Li * p.escEspLaje + n * 0.5 * p.escPiso * p.escEspelho * p.escLarg
      aForma += p.escLarg * Li + n * p.escEspelho * p.escLarg
    }
    const nome = ['reta', 'em L com patamar', 'em U com patamar', 'em L com degraus em leque (estimativa pela escada reta)'][tipo] ?? 'reta'
    const d = `escada ${nome}; ${nE} degraus (${lances.join(' + ')}); largura ${p.escLarg} m; laje ${p.escEspLaje} m; patamar ${f2(patA)} m²`
    conc('Escada', 'Concreto da escada', vol, d)
    forma('Escada', aForma, 'fundo das lajes e do patamar + espelhos')
    add({ etapa: 'Escada', material: 'Degraus (quantidade)', unidade: 'un', tipo: 'Geométrico', formula: '⌈altura a vencer ÷ altura do espelho⌉', dimensoes: `${p.escAlt} m ÷ ${p.escEspelho} m`, coef: '—', perda: 0, bruto: nE })
    add({ etapa: 'Escada', material: 'Revestimento dos degraus', unidade: 'm²', tipo: 'Geométrico', formula: '(degraus × (piso + espelho) × largura + patamar) × (1 + perda)', dimensoes: `${nE} × (${p.escPiso} + ${p.escEspelho}) × ${p.escLarg} m + patamar ${f2(patA)} m²`, coef: '—', perda: p.perdaPiso, bruto: com(nE * (p.escPiso + p.escEspelho) * p.escLarg + patA, p.perdaPiso) })
  }
}

export function piscina(c: Ctx): void {
  // PISCINA (concreto, retangular) — materiais pelas medidas informadas; armadura (taxa de aço) e equipamentos conforme projeto
  const { p, add, conc, forma } = c
  if (p.pisC > 0 && p.pisL > 0 && p.pisProf > 0) {
    const P = 'Piscina', e = p.pisEsp, ce = p.pisC + 2 * e, le = p.pisL + 2 * e
    const aInt = 2 * (p.pisC + p.pisL) * p.pisProf + p.pisC * p.pisL
    const dp = `${p.pisC}×${p.pisL}×${p.pisProf} m, paredes e fundo ${e} m (volume de água ≈ ${f2(p.pisC * p.pisL * p.pisProf)} m³)`
    conc(P, 'Concreto da piscina (fundo e paredes)', ce * le * e + 2 * (ce + le) * p.pisProf * e, dp)
    forma(P, 2 * (p.pisC + p.pisL) * p.pisProf + 2 * (ce + le) * p.pisProf + ce * le, 'paredes internas e externas + fundo')
    add({ etapa: P, material: 'Impermeabilizante', unidade: 'kg', tipo: 'Estimativa por composição', formula: 'área interna × consumo', dimensoes: `área interna ${f2(aInt)} m²`, coef: `${p.imperKgM2} kg/m²`, perda: 0, bruto: aInt * p.imperKgM2 })
    add({ etapa: P, material: 'Revestimento da piscina', unidade: 'm²', tipo: 'Geométrico', formula: 'área interna × (1 + perda)', dimensoes: `área interna ${f2(aInt)} m²`, coef: '—', perda: p.perdaPiso, bruto: com(aInt, p.perdaPiso) })
    add({ etapa: P, material: 'Escavação', unidade: 'm³', tipo: 'Geométrico', formula: '(comp. + 2e + 2 folgas) × (larg. + 2e + 2 folgas) × (profundidade + e + 0,1)', dimensoes: dp, coef: `folga ${p.pisFolga} m`, perda: 0, bruto: (ce + 2 * p.pisFolga) * (le + 2 * p.pisFolga) * (p.pisProf + e + 0.1) })
    add({ etapa: P, material: 'Skimmer', unidade: 'un', tipo: 'Estimativa por composição', formula: '⌈espelho d’água ÷ 25 m²⌉', dimensoes: `${f2(p.pisC * p.pisL)} m²`, coef: '1 por 25 m²', perda: 0, bruto: fim((p.pisC * p.pisL) / 25) })
    add({ etapa: P, material: 'Dispositivo de retorno', unidade: 'un', tipo: 'Estimativa por composição', formula: '⌈espelho d’água ÷ 20 m²⌉', dimensoes: `${f2(p.pisC * p.pisL)} m²`, coef: '1 por 20 m²', perda: 0, bruto: fim((p.pisC * p.pisL) / 20) })
    add({ etapa: P, material: 'Conjunto filtro e motobomba (dimensionar pelo volume)', unidade: 'un', tipo: 'Estimativa por composição', formula: '1 conjunto; dimensionamento conforme projeto', dimensoes: dp, coef: '—', perda: 0, bruto: 1 })
  }
}
