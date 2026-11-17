import { PARAMS_PADRAO, type Composicao, type Params } from './engine'
import { uid } from './uid'

const CHAVE = 'params-tecnicos'
const NUM_KEYS = (Object.keys(PARAMS_PADRAO) as (keyof Params)[]).filter((k) => k !== 'aberturas' && k !== 'composicoes')

const txt = (v: unknown, padrao: string) => (typeof v === 'string' && v.trim() ? v.trim() : padrao)
const nn = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)

function composicoes(v: unknown): Composicao[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((c): Composicao[] => {
    if (!c || typeof c !== 'object') return []
    const o = c as Record<string, unknown>
    if (typeof o.nome !== 'string' || !o.nome.trim()) return []
    return [{ id: typeof o.id === 'string' ? o.id : uid(), nome: o.nome.trim(), etapa: txt(o.etapa, 'Outros'), unidade: txt(o.unidade, 'un'),
      base: o.base === 'parede' || o.base === 'fixa' ? o.base : 'area', coef: nn(o.coef), perda: nn(o.perda) }]
  })
}

/** Mescla valores salvos com o padrão; aceita só números válidos e nunca traz aberturas (são do levantamento). */
export function sanear(bruto: unknown): Params {
  const out: Params = { ...PARAMS_PADRAO, aberturas: [] }
  if (bruto && typeof bruto === 'object') {
    const o = bruto as Record<string, unknown>
    out.composicoes = composicoes(o.composicoes)
    for (const k of NUM_KEYS) if (typeof o[k] === 'number' && Number.isFinite(o[k])) (out as unknown as Record<string, number>)[k] = o[k] as number
  }
  return out
}

export function carregarParams(): Params {
  try { return sanear(JSON.parse(localStorage.getItem(CHAVE) ?? 'null')) } catch { return sanear(null) }
}
export function salvarParams(p: Params) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ ...p, aberturas: undefined })) } catch { /* indisponível */ }
}

export const exportarConfig = (p: Params) => JSON.stringify({ versao: 1, parametros: { ...p, aberturas: undefined } }, null, 2)

export function importarConfig(texto: string): Params {
  const j = JSON.parse(texto)
  if (!j || typeof j !== 'object' || !j.parametros) throw new Error('Arquivo de configuração inválido.')
  return sanear(j.parametros)
}
