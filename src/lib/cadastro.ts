/** Operações puras sobre o cadastro central de ambientes (a interface só chama estas funções). */
import { ACOES, type Acao, type Ambiente, type Divisa, type LadoIdx } from '../types'
import { uid } from './uid'

export const novoAmbiente = (n: number): Ambiente => ({ id: uid(), nome: `Ambiente ${n}`, comprimento: 0, largura: 0, unidade: 'm', origem: { fonte: 'manual' } })

const semChave = <T extends object>(o: T | undefined, k: keyof T): T | undefined => {
  if (!o) return undefined
  const { [k]: _, ...resto } = o
  return Object.keys(resto).length ? (resto as T) : undefined
}

/**
 * Marca (ou limpa) o lado `lado` de `id` como compartilhado com `destino`. Mantém o outro ambiente em sincronia:
 * ao marcar, preenche o lado oposto (lado + 2) do destino se ele ainda estiver como parede externa (continua editável);
 * ao limpar, retira do destino a divisa que apontava de volta.
 */
export function definirDivisa(ambientes: Ambiente[], id: string, lado: LadoIdx, destino: string | null, trecho?: number, acao?: Acao): Ambiente[] {
  const atual = ambientes.find((a) => a.id === id)
  if (!atual) return ambientes
  const antigo = atual.divisas?.[lado]?.com
  const mk = (com: string): Divisa => ({ com, ...(trecho && trecho > 0 ? { trecho } : {}), ...(acao ? { acao } : {}) })
  return ambientes.map((a) => {
    if (a.id === id) {
      if (!destino) return { ...a, divisas: semChave(a.divisas, lado) }
      return { ...a, divisas: { ...a.divisas, [lado]: mk(destino) } }
    }
    if (antigo && a.id === antigo && antigo !== destino) { // saiu da divisa antiga: retira o retorno
      const k = ([0, 1, 2, 3] as LadoIdx[]).find((x) => a.divisas?.[x]?.com === id)
      return k === undefined ? a : { ...a, divisas: semChave(a.divisas, k) }
    }
    if (destino && a.id === destino) {
      const existente = ([0, 1, 2, 3] as LadoIdx[]).find((x) => a.divisas?.[x]?.com === id)
      if (existente !== undefined) return { ...a, divisas: { ...a.divisas, [existente]: mk(id) } } // mantém o retorno igual (trecho e ação)
      const oposto = ((lado + 2) % 4) as LadoIdx
      if (a.divisas?.[oposto]) return a
      return { ...a, divisas: { ...a.divisas, [oposto]: mk(id) } }
    }
    return a
  })
}

/** Remove um ambiente e limpa as divisas dos outros que apontavam para ele. */
export function removerAmbiente(ambientes: Ambiente[], id: string): Ambiente[] {
  return ambientes.filter((a) => a.id !== id).map((a) => {
    if (!a.divisas || !Object.values(a.divisas).some((d) => d?.com === id)) return a
    const divisas = Object.fromEntries(Object.entries(a.divisas).filter(([, d]) => d?.com !== id)) as Ambiente['divisas']
    return { ...a, divisas: divisas && Object.keys(divisas).length ? divisas : undefined }
  })
}

/** Remove os campos que ficaram sem valor, para o cadastro continuar enxuto. */
export const limpar = (a: Ambiente): Ambiente => {
  const r = { ...a }
  if (!r.peDireito) delete r.peDireito
  if (!r.aberturas?.length) delete r.aberturas
  const ac = r.acabamento
  if (ac && !ac.piso && !ac.revParede && ac.forro === undefined) delete r.acabamento
  if (r.pontos) {
    const f = Object.fromEntries(Object.entries(r.pontos).filter(([, v]) => typeof v === 'number' && v > 0)) as Ambiente['pontos']
    if (f && Object.keys(f).length) r.pontos = f; else delete r.pontos
  }
  if (r.pontosEl) {
    const f = Object.fromEntries(Object.entries(r.pontosEl).filter(([, v]) => typeof v === 'number' && v > 0)) as Ambiente['pontosEl']
    if (f && Object.keys(f).length) r.pontosEl = f; else delete r.pontosEl
  }
  if (r.acoes) {
    const f = Object.fromEntries(Object.entries(r.acoes).filter(([, v]) => v !== undefined && v !== 'construir')) as Ambiente['acoes']
    if (f && Object.keys(f).length) r.acoes = f; else delete r.acoes
  }
  return r
}

/** Texto curto das divisas de um ambiente (ex.: "Lado 2: Sala 2 (7 m)"); vazio quando todas as paredes são externas. */
export function descreverDivisas(a: Ambiente, ambientes: Ambiente[]): string {
  return ([0, 1, 2, 3] as LadoIdx[]).flatMap((i) => {
    const d = a.divisas?.[i]
    const o = d && ambientes.find((x) => x.id === d.com)
    return d && o ? [`Lado ${i + 1}: ${o.nome}${d.trecho ? ` (${d.trecho.toLocaleString('pt-BR')} m)` : ''}`] : []
  }).join('; ')
}

const ELEMENTOS: Record<string, string> = { paredes: 'paredes', revestimento: 'revestimento', piso: 'piso', forro: 'forro' }
/** Texto curto das ações diferentes de "construir" (ex.: "paredes: manter; piso: demolir"). */
export function descreverAcoes(a: Ambiente): string {
  return Object.entries(a.acoes ?? {}).filter(([, v]) => v && v !== 'construir').map(([k, v]) => `${ELEMENTOS[k] ?? k}: ${ACOES[v as Acao].split(' (')[0].toLowerCase()}`).join('; ')
}
