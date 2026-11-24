import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PONTOS_HIDRO, type Ambiente, type PontoHidro } from '../types'
import type { ConexaoHidro } from '../lib/engine'
import type { Params } from '../lib/params'
import { CONEXOES_COMUNS, pontoDoSistema, quantidadeConexao, TIPOS_HIDRO, totaisHidro } from '../lib/hidraulica'
import { uid } from '../lib/uid'

interface Props { conexoes: ConexaoHidro[]; onChange: (c: ConexaoHidro[]) => void; ambientes: Ambiente[]; params: Pick<Params, 'hidPontosAgua' | 'sanPontos'> }

const SISTEMA = { agua: 'água fria', esgoto: 'esgoto' } as const
const nova = (nome: string, sistema: 'agua' | 'esgoto'): ConexaoHidro => ({ id: uid(), nome, sistema, porPonto: {}, porPontoGeral: 0, fixa: 0, perda: 0 })
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Detalhamento das conexões hidráulicas: você define cada conexão e quantas vão em cada tipo de ponto. Nada é assumido. */
export default function ConexoesHidro({ conexoes, onChange, ambientes, params }: Props) {
  const [sistemaNovo, setSistemaNovo] = useState<'agua' | 'esgoto'>('agua')
  const th = useMemo(() => totaisHidro(ambientes, params), [ambientes, params])
  const up = (id: string, d: Partial<ConexaoHidro>) => onChange(conexoes.map((c) => (c.id === id ? { ...c, ...d } : c)))
  const upPonto = (c: ConexaoHidro, t: PontoHidro, v: number) => up(c.id, { porPonto: { ...c.porPonto, [t]: v > 0 ? v : undefined } })

  return (
    <section className="cartao">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Conexões hidráulicas (detalhamento por tipo de ponto)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="campo !w-auto" aria-label="Sistema da nova conexão" value={sistemaNovo} onChange={(e) => setSistemaNovo(e.target.value as 'agua' | 'esgoto')}>
            <option value="agua">Água fria</option><option value="esgoto">Esgoto</option>
          </select>
          <select className="campo !w-auto" aria-label="Adicionar conexão comum" value="" onChange={(e) => { if (e.target.value) onChange([...conexoes, nova(`${e.target.value} (diâmetro conforme projeto)`, sistemaNovo)]) }}>
            <option value="">Adicionar conexão comum…</option>
            {CONEXOES_COMUNS[sistemaNovo].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn btn-sec" onClick={() => onChange([...conexoes, nova('Nova conexão', sistemaNovo)])}><Plus size={16} /> Em branco</button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Cada linha é uma conexão que você define (o diâmetro e o material ficam no nome). Informe quantas unidades vão em cada tipo de ponto: quantidade = Σ (pontos de cada tipo nos ambientes × conexões por ponto) + pontos gerais × coeficiente + quantidade fixa, × (1 + perda).
        O programa não assume tipos, diâmetros nem quantidades de conexões: tudo começa em zero. Quando há conexões detalhadas para um sistema, o coeficiente único "conexões por ponto" desse sistema deixa de ser somado, para não contar em dobro. Levantamento preliminar; confirme com o projeto hidráulico.
      </p>
      {conexoes.length === 0 && <p className="text-sm text-slate-500">Nenhuma conexão detalhada: o cálculo usa só o coeficiente único "conexões por ponto" (Parâmetros).</p>}
      <div className="space-y-2">
        {conexoes.map((c) => {
          const q = quantidadeConexao(c, th, params), total = q.qtd * (1 + c.perda / 100)
          return (
            <details key={c.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{c.nome}</span> <span className="text-slate-500">({SISTEMA[c.sistema]})</span> — {q.qtd > 0 ? `${fmt(total)} un` : 'sem quantidade (preencha os coeficientes)'}
              </summary>
              <div className="mt-2 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem_6rem_auto]">
                  <input className="campo" aria-label="Nome da conexão" value={c.nome} maxLength={80} onChange={(e) => up(c.id, { nome: e.target.value })} />
                  <select className="campo" aria-label="Sistema" value={c.sistema} onChange={(e) => up(c.id, { sistema: e.target.value as 'agua' | 'esgoto' })}><option value="agua">Água fria</option><option value="esgoto">Esgoto</option></select>
                  <input className="campo" type="number" min={0} max={100} step="any" aria-label="Perda (%)" title="Perda (%)" value={c.perda || ''} placeholder="perda %" onChange={(e) => up(c.id, { perda: Math.min(100, parseFloat(e.target.value) || 0) })} />
                  <button className="btn btn-sec" aria-label="Excluir conexão" onClick={() => onChange(conexoes.filter((x) => x.id !== c.id))}><Trash2 size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIPOS_HIDRO.filter((t) => pontoDoSistema(t, c.sistema)).map((t) => (
                    <div key={t}><label className="rotulo" htmlFor={`${c.id}-${t}`}>{PONTOS_HIDRO[t].rotulo} <span className="text-slate-400">({th.porTipo[t]})</span></label>
                      <input id={`${c.id}-${t}`} className="campo" type="number" min={0} step="any" value={c.porPonto[t] ?? ''} onChange={(e) => upPonto(c, t, parseFloat(e.target.value) || 0)} /></div>
                  ))}
                  <div><label className="rotulo" htmlFor={`${c.id}-geral`}>Pontos gerais <span className="text-slate-400">({c.sistema === 'agua' ? params.hidPontosAgua : params.sanPontos})</span></label>
                    <input id={`${c.id}-geral`} className="campo" type="number" min={0} step="any" value={c.porPontoGeral || ''} onChange={(e) => up(c.id, { porPontoGeral: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="rotulo" htmlFor={`${c.id}-fixa`}>Quantidade fixa</label>
                    <input id={`${c.id}-fixa`} className="campo" type="number" min={0} step="any" value={c.fixa || ''} onChange={(e) => up(c.id, { fixa: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <p className="text-xs text-slate-500">Cada campo é "conexões por ponto" daquele tipo; entre parênteses, quantos pontos desse tipo há nos ambientes. {q.partes.length > 0 && <>Conta atual: {q.partes.join(' + ')}.</>}</p>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
