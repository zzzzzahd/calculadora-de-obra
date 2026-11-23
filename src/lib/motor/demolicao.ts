/** Etapa(s) do cálculo: Demolição, entulho, recuperação e reaproveitamento (ações do cadastro). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, f2 } from './contexto'
import type { AcaoTotais } from '../paredes'

export function demolicao(c: Ctx): void {
  // Demolição, recuperação e reaproveitamento (cadastro central: ações dos elementos)
  const { p, lev, add } = c
  const DEM = 'Demolição e entulho', R2 = 'Recuperação e reaproveitamento'
  const emp = 1 + p.entulhoEmpPct / 100
  let entulhoM3 = 0
  const demol = (material: string, area: number, esp: number, rotuloEsp: string) => {
    if (area <= 0) return
    add({ etapa: DEM, material, unidade: 'm²', tipo: 'Geométrico', formula: 'área demolida (descontadas as aberturas)', dimensoes: `${f2(area)} m²${esp > 0 ? '' : `; informe ${rotuloEsp} em Parâmetros → Demolição e entulho para calcular o volume`}`, coef: '—', perda: 0, bruto: area })
    if (esp > 0) {
      const v = area * esp * emp; entulhoM3 += v
      add({ etapa: DEM, material: `Entulho de ${material.replace('Demolição de ', '')}`, unidade: 'm³', tipo: 'Geométrico', formula: 'área × espessura × (1 + empolamento)',
        dimensoes: `${f2(area)} m² × ${p.entulhoEmpPct > 0 ? `${esp} m × ${f2(emp)}` : `${esp} m`}`, coef: `empolamento ${p.entulhoEmpPct}%`, perda: p.entulhoEmpPct, bruto: v })
    }
  }
  demol('Demolição de alvenaria', lev.demolir.paredes, p.demolEspParedeM, 'a espessura da parede')
  demol('Demolição de revestimento de parede', lev.demolir.revestimento, p.demolEspRevM, 'a espessura do revestimento')
  demol('Demolição de piso e contrapiso', lev.demolir.piso, p.demolEspPisoM, 'a espessura do piso')
  if (lev.demolir.forro > 0) add({ etapa: DEM, material: 'Retirada de forro', unidade: 'm²', tipo: 'Geométrico', formula: 'área do forro retirado', dimensoes: `${f2(lev.demolir.forro)} m²`, coef: '—', perda: 0, bruto: lev.demolir.forro })
  if (lev.demolir.esquadrias > 0) add({ etapa: DEM, material: 'Retirada de portas e janelas', unidade: 'un', tipo: 'Geométrico', formula: 'quantidade retirada', dimensoes: `${lev.demolir.esquadrias} un`, coef: '—', perda: 0, bruto: lev.demolir.esquadrias })
  if (entulhoM3 > 0 && p.caminhaoM3 > 0)
    add({ etapa: DEM, material: 'Remoção de entulho (viagens)', unidade: 'viagem', tipo: 'Geométrico', formula: 'entulho ÷ capacidade do caminhão', dimensoes: `entulho ${f2(entulhoM3)} m³`, coef: `caminhão ${p.caminhaoM3} m³`, perda: 0, bruto: entulhoM3 / p.caminhaoM3 })
  const lista = (t: AcaoTotais, verbo: string, formula: string) => {
    const linhas: [string, number, string][] = [['paredes', t.paredes, 'm²'], ['revestimento de paredes', t.revestimento, 'm²'], ['piso', t.piso, 'm²'], ['forro', t.forro, 'm²'], ['portas e janelas', t.esquadrias, 'un']]
    for (const [nome, q, un] of linhas) if (q > 0) add({ etapa: R2, material: `${verbo}: ${nome}`, unidade: un, tipo: 'Geométrico', formula, dimensoes: `${f2(q)} ${un}`, coef: '—', perda: 0, bruto: q })
  }
  lista(lev.recuperar, 'Recuperar', 'quantidade a recuperar (material novo não calculado; use composições próprias se precisar)')
  lista(lev.reaproveitar, 'Reaproveitar', 'quantidade a reaproveitar (sem compra de material)')
}
