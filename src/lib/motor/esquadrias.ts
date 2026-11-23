/** Etapa(s) do cálculo: Esquadrias: portas e janelas agrupadas por medida. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, f2 } from './contexto'

export function esquadrias(c: Ctx): void {
  // ESQUADRIAS — portas e janelas cadastradas, agrupadas por medida
  const { p, abertTodas, add } = c
  if (p.esquadrias > 0) {
    const grupos = new Map<string, number>()
    for (const a of abertTodas) { const k = `${a.tipo} ${f2(a.largura)} × ${f2(a.altura)} m`; grupos.set(k, (grupos.get(k) ?? 0) + a.qtd) }
    for (const [material, q] of grupos) add({ etapa: 'Esquadrias', material, unidade: 'un', tipo: 'Geométrico', formula: 'quantidade cadastrada', dimensoes: `${q} un`, coef: '—', perda: 0, bruto: q })
    const portas = abertTodas.filter((a) => a.tipo === 'Porta').reduce((t, a) => t + a.qtd, 0)
    add({ etapa: 'Esquadrias', material: 'Fechadura e dobradiças (jogo)', unidade: 'un', tipo: 'Estimativa por composição', formula: '1 jogo por porta', dimensoes: `${portas} porta(s)`, coef: '1 jogo/porta', perda: 0, bruto: portas })
  }
}
