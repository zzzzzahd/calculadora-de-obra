/** Etapa(s) do cálculo: Aditivos para concreto e argamassas. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, f2 } from './contexto'

export function aditivos(c: Ctx): void {
  // ADITIVOS — % do peso do cimento, separando concreto e argamassas (siga a bula do fabricante)
  const { p, estado, add } = c
  const NOME_ADIT = ['', 'Plastificante / redutor de água', 'Impermeabilizante (hidrófugo)', 'Adesivo PVA / resina para argamassa']
  const aditivo = (cod: number, pct: number, kg: number, escopo: string) => {
    if (cod > 0 && pct > 0) add({ etapa: 'Aditivos', material: `${NOME_ADIT[cod] ?? 'Aditivo'} (${escopo})`, unidade: 'kg', tipo: 'Estimativa por composição', formula: 'cimento do escopo × % do aditivo', dimensoes: `${f2(kg)} kg de cimento × ${pct}%`, coef: `${pct}% do peso do cimento (conferir a bula)`, perda: 0, bruto: (kg * pct) / 100 })
  }
  aditivo(p.aditivoConc, p.aditivoConcPct, estado.cimConcKg, 'concreto'); aditivo(p.aditivoArg, p.aditivoArgPct, estado.cimArgKg, 'argamassas')
}
