import type { Material, Processo, Situacao } from './tipos'

const n = (v: number | null) => v ?? 0

/**
 * disponível (estoque físico) = recebido − utilizado − comprometido
 * a receber = registrado − entregue (mostrado à parte; NUNCA somado ao estoque físico)
 */
export const saldos = (m: Material) => {
  const ata = n(m.quantidadeRegistrada) + (m.aditivo ?? 0)
  return {
    disponivel: m.quantidadeEntregue - m.quantidadeUtilizada - m.quantidadeComprometida, // estoque físico
    aReceber: Math.max(0, ata - m.quantidadeEntregue), // contratado e ainda não recebido
    saldoASolicitar: ata - m.quantidadeSolicitada, // saldo da ata ainda não pedido (é o "DISPONÍVEL" da planilha)
    aguardandoEntrega: Math.max(0, m.quantidadeSolicitada - m.quantidadeEntregue), // pedido e não recebido
  }
}

const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)

/** Situação do instrumento pela vigência. Vencida nunca é fonte para novas aquisições. */
export function situacao(p: Processo | undefined, hoje: string): Situacao {
  if (!p || !p.vigenciaFim) return 'sem-vigencia'
  if (p.vigenciaInicio && dias(p.vigenciaInicio, hoje) > 0) return 'futura'
  const d = dias(p.vigenciaFim, hoje)
  return d < 0 ? 'vencida' : d <= 60 ? 'a-vencer' : 'vigente'
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  vigente: 'Vigente', 'a-vencer': 'A vencer (até 60 dias)', vencida: 'Vencida', futura: 'Vigência ainda não iniciada', 'sem-vigencia': 'Vigência não informada',
}

export function indicadores(processos: Processo[], materiais: Material[], hoje: string) {
  const proc = new Map(processos.map((p) => [p.id, p]))
  const r = { totalMateriais: materiais.length, totalProcessos: processos.length, comSaldo: 0, semSaldo: 0, entregaPendente: 0, vencendo: 0, saldoBaixo: 0 }
  for (const m of materiais) {
    const s = saldos(m)
    if (s.disponivel > 0) r.comSaldo++
    else r.semSaldo++
    if (s.aReceber > 0) r.entregaPendente++
    if (situacao(proc.get(m.processoId), hoje) === 'a-vencer') r.vencendo++
    if (s.disponivel > 0 && s.disponivel <= 0.2 * m.quantidadeEntregue) r.saldoBaixo++ // saldo baixo: até 20% do recebido
  }
  return r
}

export interface Filtros { busca: string; categoria: string; processoId: string; fornecedor: string; situacao: string; disponibilidade: string }
export const FILTROS_VAZIOS: Filtros = { busca: '', categoria: '', processoId: '', fornecedor: '', situacao: '', disponibilidade: '' }

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function filtrar(materiais: Material[], processos: Processo[], f: Filtros, hoje: string): Material[] {
  const proc = new Map(processos.map((p) => [p.id, p]))
  const termos = norm(f.busca).split(/\s+/).filter(Boolean)
  return materiais.filter((m) => {
    const p = proc.get(m.processoId)
    const s = saldos(m)
    const texto = norm([m.nomePadronizado, m.codigo, m.descricaoOriginal, m.especificacao, m.marca].join(' '))
    return termos.every((t) => texto.includes(t))
      && (!f.categoria || m.categoria === f.categoria)
      && (!f.processoId || m.processoId === f.processoId)
      && (!f.fornecedor || (m.fornecedor || p?.fornecedor) === f.fornecedor)
      && (!f.situacao || situacao(p, hoje) === f.situacao)
      && (!f.disponibilidade || (f.disponibilidade === 'com-saldo' ? s.disponivel > 0 : f.disponibilidade === 'sem-saldo' ? s.disponivel <= 0 : s.aReceber > 0))
  })
}
