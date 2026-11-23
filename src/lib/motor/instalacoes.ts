/** Etapa(s) do cálculo: Instalações elétricas, hidráulicas e sanitárias e drenagem (por quantidades informadas). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com } from './contexto'

export function instalacoes(c: Ctx): void {
  // INSTALAÇÕES — contagem por quantidades informadas; circuitos, bitolas e diâmetros exigem projeto e profissional habilitado
  const { p, add } = c
  const dv = (a: number, b: number) => (b > 0 ? a / b : 0)
  const cont = (etapa: string, material: string, unidade: string, formula: string, dimensoes: string, coef: string, perda: number, bruto: number) => {
    if (bruto > 0) add({ etapa, material, unidade, tipo: 'Estimativa por composição', formula, dimensoes, coef, perda, bruto })
  }
  const inf = (etapa: string, material: string, qtd: number) => cont(etapa, material, 'un', 'quantidade informada', `${qtd} un`, '—', 0, qtd)
  const EL = 'Instalações elétricas', pts = p.eltTomadas + p.eltInterruptores + p.eltPontosLuz
  inf(EL, 'Tomada', p.eltTomadas); inf(EL, 'Interruptor', p.eltInterruptores); inf(EL, 'Ponto de iluminação', p.eltPontosLuz)
  cont(EL, 'Caixa 4×2', 'un', 'tomadas + interruptores', `${p.eltTomadas} + ${p.eltInterruptores}`, '—', 0, p.eltTomadas + p.eltInterruptores)
  cont(EL, 'Caixa octogonal', 'un', 'pontos de iluminação', `${p.eltPontosLuz}`, '—', 0, p.eltPontosLuz)
  inf(EL, 'Disjuntor (tipo e corrente conforme projeto)', p.eltDisjuntores)
  cont(EL, 'Quadro de distribuição', 'un', '1 quando há disjuntores', `${p.eltDisjuntores} disjuntor(es)`, '—', 0, p.eltDisjuntores > 0 ? 1 : 0)
  cont(EL, 'Eletroduto (barras)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${pts} pontos × ${p.eltMPorPonto} m`, `barra ${p.barraEletrodutoM} m`, p.perdaInst, com(dv(pts * p.eltMPorPonto, p.barraEletrodutoM), p.perdaInst))
  cont(EL, 'Cabo (bitola conforme projeto)', 'm', 'pontos × m de cabo por ponto × (1 + perda)', `${pts} pontos × ${p.eltCaboMPorPonto} m`, `${p.eltCaboMPorPonto} m/ponto`, p.perdaInst, com(pts * p.eltCaboMPorPonto, p.perdaInst))
  const HI = 'Instalações hidráulicas e sanitárias'
  cont(HI, 'Tubo de água fria (diâmetro conforme projeto)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${p.hidPontosAgua} pontos × ${p.hidMPorPonto} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.hidPontosAgua * p.hidMPorPonto, p.barraTuboM), p.perdaInst))
  cont(HI, 'Conexões de água fria', 'un', 'pontos × conexões por ponto', `${p.hidPontosAgua} pontos`, `${p.conexPorPonto} un/ponto`, 0, p.hidPontosAgua * p.conexPorPonto)
  cont(HI, 'Tubo de esgoto (diâmetro conforme projeto)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${p.sanPontos} pontos × ${p.sanMPorPonto} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.sanPontos * p.sanMPorPonto, p.barraTuboM), p.perdaInst))
  cont(HI, 'Conexões de esgoto', 'un', 'pontos × conexões por ponto', `${p.sanPontos} pontos`, `${p.conexPorPonto} un/ponto`, 0, p.sanPontos * p.conexPorPonto)
  for (const [m, q] of [['Registro', p.hidRegistros], ['Caixa sifonada', p.caixasSifonadas], ['Ralo', p.ralos], ['Caixa de inspeção', p.caixasInspecao], ['Vaso sanitário', p.vasos], ['Lavatório', p.lavatorios], ['Pia', p.pias], ['Chuveiro', p.chuveiros], ['Reservatório', p.reservatorios]] as [string, number][]) inf(HI, m, q)
  const DR = 'Drenagem'
  cont(DR, 'Tubo de drenagem (barras)', 'barra', 'metros ÷ barra × (1 + perda)', `${p.drenTuboM} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.drenTuboM, p.barraTuboM), p.perdaInst))
  inf(DR, 'Caixa de drenagem', p.drenCaixas); inf(DR, 'Ralo de drenagem', p.drenRalos)
  cont(DR, 'Canaleta', 'm', 'metros informados × (1 + perda)', `${p.canaletaM} m`, '—', p.perdaInst, com(p.canaletaM, p.perdaInst))
  cont(DR, 'Brita de envelopamento', 'm³', 'metros de tubo × m³/m', `${p.drenTuboM} m`, `${p.drenBritaM3m} m³/m`, 0, p.drenTuboM * p.drenBritaM3m)
}
