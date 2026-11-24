/** Etapa(s) do cálculo: Instalações elétricas, hidráulicas e sanitárias e drenagem (por quantidades informadas). Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com } from './contexto'
import { quantidadeConexao, totaisHidro } from '../hidraulica'

export function instalacoes(c: Ctx): void {
  // INSTALAÇÕES — contagem por quantidades informadas; circuitos, bitolas e diâmetros exigem projeto e profissional habilitado
  const { p, add, ambientes } = c
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
  // Pontos: os cadastrados nos ambientes somam aos contadores gerais dos parâmetros (sem ambiente)
  const th = totaisHidro(ambientes, p)
  const nAgua = th.agua, nEsgoto = th.esgoto
  const origem = (geral: number, amb: number) => (amb > 0 ? ` (ambientes ${amb} + gerais ${geral})` : '')
  cont(HI, 'Tubo de água fria (diâmetro conforme projeto)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${nAgua} pontos${origem(p.hidPontosAgua, th.aguaAmbientes)} × ${p.hidMPorPonto} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(nAgua * p.hidMPorPonto, p.barraTuboM), p.perdaInst))
  // Conexões detalhadas (definidas pelo usuário): quando existem para um sistema, substituem o coeficiente único "conexões por ponto"
  const detalhadas = p.conexoes.map((x) => ({ x, ...quantidadeConexao(x, th, p) }))
  const temDetalhe = (s: 'agua' | 'esgoto') => detalhadas.some((d) => d.x.sistema === s && d.qtd > 0)
  const conexoes = (s: 'agua' | 'esgoto') => {
    for (const { x, qtd, partes } of detalhadas) if (x.sistema === s && qtd > 0)
      cont(HI, `Conexão (${s === 'agua' ? 'água fria' : 'esgoto'}): ${x.nome}`, 'un', 'Σ (pontos de cada tipo × conexões por ponto) + pontos gerais × coeficiente + quantidade fixa, × (1 + perda)', partes.join(' + '), `perda ${x.perda}%`, x.perda, com(qtd, x.perda))
  }
  if (!temDetalhe('agua')) cont(HI, 'Conexões de água fria', 'un', 'pontos × conexões por ponto', `${nAgua} pontos${origem(p.hidPontosAgua, th.aguaAmbientes)}`, `${p.conexPorPonto} un/ponto`, 0, nAgua * p.conexPorPonto)
  conexoes('agua')
  cont(HI, 'Tubo de esgoto (diâmetro conforme projeto)', 'barra', 'pontos × m por ponto ÷ barra × (1 + perda)', `${nEsgoto} pontos${origem(p.sanPontos, th.esgotoAmbientes)} × ${p.sanMPorPonto} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(nEsgoto * p.sanMPorPonto, p.barraTuboM), p.perdaInst))
  if (!temDetalhe('esgoto')) cont(HI, 'Conexões de esgoto', 'un', 'pontos × conexões por ponto', `${nEsgoto} pontos${origem(p.sanPontos, th.esgotoAmbientes)}`, `${p.conexPorPonto} un/ponto`, 0, nEsgoto * p.conexPorPonto)
  conexoes('esgoto')
  for (const [m, q] of [['Registro', p.hidRegistros + th.porTipo.registro], ['Caixa sifonada', p.caixasSifonadas + th.porTipo.caixaSifonada], ['Ralo', p.ralos + th.porTipo.ralo], ['Caixa de inspeção', p.caixasInspecao], ['Vaso sanitário', p.vasos + th.porTipo.vaso], ['Lavatório', p.lavatorios + th.porTipo.lavatorio], ['Pia', p.pias + th.porTipo.pia], ['Chuveiro', p.chuveiros + th.porTipo.chuveiro], ['Reservatório', p.reservatorios], ['Tanque', th.porTipo.tanque], ['Torneira', th.porTipo.torneira]] as [string, number][]) inf(HI, m, q)
  const DR = 'Drenagem'
  cont(DR, 'Tubo de drenagem (barras)', 'barra', 'metros ÷ barra × (1 + perda)', `${p.drenTuboM} m`, `barra ${p.barraTuboM} m`, p.perdaInst, com(dv(p.drenTuboM, p.barraTuboM), p.perdaInst))
  inf(DR, 'Caixa de drenagem', p.drenCaixas); inf(DR, 'Ralo de drenagem', p.drenRalos)
  cont(DR, 'Canaleta', 'm', 'metros informados × (1 + perda)', `${p.canaletaM} m`, '—', p.perdaInst, com(p.canaletaM, p.perdaInst))
  cont(DR, 'Brita de envelopamento', 'm³', 'metros de tubo × m³/m', `${p.drenTuboM} m`, `${p.drenBritaM3m} m³/m`, 0, p.drenTuboM * p.drenBritaM3m)
}
