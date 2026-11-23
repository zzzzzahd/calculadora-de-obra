/** Etapa(s) do cálculo: Cobertura e madeiramento (usa a área inclinada). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2, fim } from './contexto'

export function cobertura(c: Ctx): void {
  // COBERTURA E MADEIRAMENTO — usa a área INCLINADA (projeção × √(1+i²)), nunca só a área horizontal
  const { p, add } = c
  if (p.roofC > 0 && p.roofL > 0 && p.espTerca > 0 && p.espCaibro > 0 && p.espRipa > 0 && p.barraM > 0) {
    const quatro = p.aguas === 4 // 4 águas: áreas iguais de mesma inclinação; madeira estimada por área ÷ espaçamento
    const n = quatro ? 4 : p.aguas === 2 ? 2 : 1
    const fator = Math.sqrt(1 + (p.inclinacao / 100) ** 2)
    const C = p.roofC + 2 * p.beiral // comprimento (paralelo à cumeeira)
    const W = p.roofL + 2 * p.beiral // largura em projeção (sentido do caimento)
    const inc = (W / (n === 1 ? 1 : 2)) * fator // comprimento inclinado de cada água
    const area = C * W * fator
    const calhaL = quatro ? 2 * (C + W) : C * (n === 2 ? 2 : 1) // metros de beiral com calha
    const dm = `${n} água(s); ${f2(C)} × ${f2(W)} m (c/ beiral ${p.beiral} m); inclinação ${p.inclinacao}% (fator ${f2(fator)}); água inclinada ${f2(inc)} m`
    const E = 'Cobertura e madeiramento'
    add({ etapa: E, material: 'Telha', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área inclinada × rendimento × (1 + perda)',
      dimensoes: `${dm}; área inclinada ${f2(area)} m²`, coef: `${p.telhaRend} un/m²`, perda: p.perdaTelha, bruto: p.telhaMetalica > 0 ? 0 : com(area * p.telhaRend, p.perdaTelha) })
    if (p.telhaMetalica > 0)
      add({ etapa: E, material: 'Telha metálica trapezoidal', unidade: 'm²', tipo: 'Estimativa por composição', formula: 'área inclinada × (1 + sobreposição) × (1 + perda)', dimensoes: `${dm}; área inclinada ${f2(area)} m²`, coef: `sobreposição ${p.sobreMetal}%`, perda: p.perdaTelha, bruto: com(com(area, p.sobreMetal), p.perdaTelha) })
    add({ etapa: E, material: 'Fixação do telhado (parafusos/ganchos)', unidade: 'un', tipo: 'Estimativa por composição', formula: 'área inclinada × fixações por m² × (1 + perda)', dimensoes: `área inclinada ${f2(area)} m²`, coef: `${p.fixPorM2} un/m²`, perda: p.perdaTelha, bruto: com(area * p.fixPorM2, p.perdaTelha) })
    if (p.mantaCob > 0)
      add({ etapa: E, material: 'Manta de subcobertura', unidade: 'm²', tipo: 'Geométrico', formula: 'área inclinada × (1 + perda)', dimensoes: `área inclinada ${f2(area)} m²`, coef: '—', perda: p.perdaTelha, bruto: com(area, p.perdaTelha) })
    const madeira = (material: string, qtd: number, cada: number, formula: string, esp: number) =>
      add({ etapa: E, material, unidade: 'barra', tipo: 'Geométrico', formula: `${formula}; metros ÷ barra comercial × (1 + perda)`,
        dimensoes: `${dm}; ${qtd} peça(s) de ${f2(cada)} m = ${f2(qtd * cada)} m; espaçamento ${esp} m`, coef: `barra ${p.barraM} m`, perda: p.perdaMadeira,
        bruto: com((qtd * cada) / p.barraM, p.perdaMadeira) })
    if (quatro) {
      const ma = (material: string, esp: number) => add({ etapa: E, material, unidade: 'barra', tipo: 'Geométrico',
        formula: 'metros ≈ área inclinada ÷ espaçamento (estimativa para 4 águas); metros ÷ barra comercial × (1 + perda)',
        dimensoes: `${dm}; área inclinada ${f2(area)} m² ÷ ${esp} m = ${f2(area / esp)} m`, coef: `barra ${p.barraM} m`, perda: p.perdaMadeira, bruto: com(area / esp / p.barraM, p.perdaMadeira) })
      ma('Terça (barras)', p.espTerca); ma('Caibro (barras)', p.espCaibro); ma('Ripa (barras)', p.espRipa)
    } else {
      madeira('Terça (barras)', (fim(inc / p.espTerca) + 1) * n, C, 'peças/água = ⌈inclinado ÷ espaçamento⌉ + 1', p.espTerca)
      madeira('Caibro (barras)', (fim(C / p.espCaibro) + 1) * n, inc, 'peças/água = ⌈comprimento ÷ espaçamento⌉ + 1', p.espCaibro)
      madeira('Ripa (barras)', (fim(inc / p.espRipa) + 1) * n, C, 'peças/água = ⌈inclinado ÷ espaçamento⌉ + 1', p.espRipa)
    }
    if (n === 2 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Cumeeira', unidade: 'un', tipo: 'Geométrico', formula: 'comprimento ÷ peça × (1 + perda)',
        dimensoes: `${f2(C)} m; peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(C / p.cumeeiraM, p.perdaTelha) })
    const rg = quatro ? Math.abs(C - W) : 0 // cumeeira do telhado de 4 águas
    const espTot = (quatro ? 4 * (Math.min(C, W) / 2) * Math.sqrt(2 + (p.inclinacao / 100) ** 2) : 0) + p.espigaoExtraM // espigões
    if (rg > 0 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Cumeeira', unidade: 'un', tipo: 'Geométrico', formula: '(maior lado − menor lado) ÷ peça × (1 + perda)', dimensoes: `${f2(rg)} m; peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(rg / p.cumeeiraM, p.perdaTelha) })
    if (espTot > 0 && p.cumeeiraM > 0)
      add({ etapa: E, material: 'Espigão', unidade: 'un', tipo: 'Geométrico', formula: 'comprimento dos espigões ÷ peça × (1 + perda); 4 águas: 4 × (menor lado ÷ 2) × √(2 + i²)', dimensoes: `${f2(espTot)} m (inclui ${p.espigaoExtraM} m informados); peça ${p.cumeeiraM} m`, coef: `${p.cumeeiraM} m/un`, perda: p.perdaTelha, bruto: com(espTot / p.cumeeiraM, p.perdaTelha) })
    if (p.tesouras > 0)
      add({ etapa: E, material: 'Tesoura (quantidade informada)', unidade: 'un', tipo: 'Geométrico', formula: 'quantidade informada pelo usuário; dimensionamento exige profissional',
        dimensoes: '—', coef: '—', perda: 0, bruto: p.tesouras })
    if (p.calha > 0 && p.calhaBarraM > 0)
      add({ etapa: E, material: 'Calha (barras)', unidade: 'barra', tipo: 'Geométrico', formula: 'metros de beiral com calha ÷ barra × (1 + perda)', dimensoes: `${f2(calhaL)} m de beiral`, coef: `barra ${p.calhaBarraM} m`, perda: p.perdaTelha, bruto: com(calhaL / p.calhaBarraM, p.perdaTelha) })
    if (p.condutorN > 0 && p.condutorBarraM > 0)
      add({ etapa: E, material: 'Condutor (barras)', unidade: 'barra', tipo: 'Geométrico', formula: 'condutores × altura ÷ barra', dimensoes: `${p.condutorN} × ${p.condutorAltM} m`, coef: `barra ${p.condutorBarraM} m`, perda: 0, bruto: (p.condutorN * p.condutorAltM) / p.condutorBarraM })
    if (p.rufoM > 0)
      add({ etapa: E, material: 'Rufo', unidade: 'm', tipo: 'Geométrico', formula: 'metros informados × (1 + perda)', dimensoes: `${p.rufoM} m`, coef: '—', perda: p.perdaTelha, bruto: com(p.rufoM, p.perdaTelha) })
  }
}
