import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PONTOS_EL, type Ambiente, type PontoEl } from '../types'
import type { ItemEletrico } from '../lib/engine'
import type { Params } from '../lib/params'
import { ITENS_EL_COMUNS, quantidadeItemEl, SUBSTITUI, TIPOS_EL, totaisEl } from '../lib/eletrica'
import { uid } from '../lib/uid'

interface Props { itens: ItemEletrico[]; onChange: (i: ItemEletrico[]) => void; ambientes: Ambiente[]; params: Pick<Params, 'eltTomadas' | 'eltInterruptores' | 'eltPontosLuz'> }

const novo = (nome: string): ItemEletrico => ({ id: uid(), nome, unidade: 'un', porPonto: {}, fixa: 0, perda: 0 })
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Detalhamento dos itens elétricos: você define cada item e quanto vai em cada tipo de ponto. Nada é assumido. */
export default function ItensEletricos({ itens, onChange, ambientes, params }: Props) {
  const te = useMemo(() => totaisEl(ambientes, params), [ambientes, params])
  const up = (id: string, d: Partial<ItemEletrico>) => onChange(itens.map((c) => (c.id === id ? { ...c, ...d } : c)))
  const upPonto = (c: ItemEletrico, t: PontoEl, v: number) => up(c.id, { porPonto: { ...c.porPonto, [t]: v > 0 ? v : undefined } })

  return (
    <section className="cartao">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Itens elétricos (detalhamento por tipo de ponto)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="campo !w-auto" aria-label="Adicionar item elétrico comum" value="" onChange={(e) => { if (e.target.value) onChange([...itens, novo(e.target.value)]) }}>
            <option value="">Adicionar item comum…</option>
            {ITENS_EL_COMUNS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn btn-sec" onClick={() => onChange([...itens, novo('Novo item')])}><Plus size={16} /> Em branco</button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Cada linha é um material que você define (bitola e tipo ficam no nome; a unidade é sua, por exemplo m, barra ou un). Informe quanto vai em cada tipo de ponto: quantidade = Σ (pontos de cada tipo × quantidade por ponto) + quantidade fixa, × (1 + perda).
        Os pontos gerais dos Parâmetros entram como tomada de uso geral, interruptor e ponto de luz. O programa não assume bitolas, circuitos nem quantidades da NBR 5410: tudo começa em zero.
        Para não contar em dobro, indique qual linha geral (eletroduto, cabo ou caixa) o item substitui. Levantamento preliminar; confirme com o projeto elétrico.
      </p>
      {itens.length === 0 && <p className="text-sm text-slate-500">Nenhum item detalhado: o cálculo usa só os coeficientes únicos em metros por ponto (Parâmetros).</p>}
      <div className="space-y-2">
        {itens.map((c) => {
          const q = quantidadeItemEl(c, te), total = q.qtd * (1 + c.perda / 100)
          return (
            <details key={c.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{c.nome}</span> — {q.qtd > 0 ? `${fmt(total)} ${c.unidade}` : 'sem quantidade (preencha os coeficientes)'}{c.substitui && <span className="text-slate-500"> · substitui: {SUBSTITUI[c.substitui]}</span>}
              </summary>
              <div className="mt-2 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
                  <input className="campo" aria-label="Nome do item" value={c.nome} maxLength={80} onChange={(e) => up(c.id, { nome: e.target.value })} />
                  <input className="campo" aria-label="Unidade" value={c.unidade} maxLength={12} onChange={(e) => up(c.id, { unidade: e.target.value })} />
                  <input className="campo" type="number" min={0} max={100} step="any" aria-label="Perda (%)" title="Perda (%)" value={c.perda || ''} placeholder="perda %" onChange={(e) => up(c.id, { perda: Math.min(100, parseFloat(e.target.value) || 0) })} />
                  <button className="btn btn-sec" aria-label="Excluir item" onClick={() => onChange(itens.filter((x) => x.id !== c.id))}><Trash2 size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {TIPOS_EL.map((t) => (
                    <div key={t}><label className="rotulo" htmlFor={`${c.id}-${t}`}>{PONTOS_EL[t].rotulo} <span className="text-slate-400">({te.porTipo[t]})</span></label>
                      <input id={`${c.id}-${t}`} className="campo" type="number" min={0} step="any" value={c.porPonto[t] ?? ''} onChange={(e) => upPonto(c, t, parseFloat(e.target.value) || 0)} /></div>
                  ))}
                  <div><label className="rotulo" htmlFor={`${c.id}-fixa`}>Quantidade fixa</label>
                    <input id={`${c.id}-fixa`} className="campo" type="number" min={0} step="any" value={c.fixa || ''} onChange={(e) => up(c.id, { fixa: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div><label className="rotulo" htmlFor={`${c.id}-subs`}>Substitui a linha geral</label>
                  <select id={`${c.id}-subs`} className="campo" value={c.substitui ?? ''} onChange={(e) => up(c.id, { substitui: (e.target.value || undefined) as ItemEletrico['substitui'] })}>
                    <option value="">Nenhuma (soma com as linhas gerais)</option>
                    {(Object.keys(SUBSTITUI) as NonNullable<ItemEletrico['substitui']>[]).map((k) => <option key={k} value={k}>{SUBSTITUI[k]}</option>)}
                  </select></div>
                <p className="text-xs text-slate-500">Cada campo é "quantidade por ponto" daquele tipo; entre parênteses, quantos pontos desse tipo há (ambientes + gerais). {q.partes.length > 0 && <>Conta atual: {q.partes.join(' + ')}.</>}</p>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
