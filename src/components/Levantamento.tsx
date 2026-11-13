import { Plus, Trash2 } from 'lucide-react'
import type { Ambiente, Obra } from '../types'
import { areaAmbiente, areaParedeBruta, perimetroAmbiente } from '../lib/geometry'
import { toMetros } from '../lib/units'
import Medida from './Medida'

interface Props {
  obra: Obra; ambientes: Ambiente[]
  setObra: (o: Obra) => void; setAmbientes: (a: Ambiente[]) => void
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const novoAmbiente = (n: number): Ambiente => ({ id: crypto.randomUUID(), nome: `Ambiente ${n}`, comprimento: 0, largura: 0, unidade: 'm' })

export default function Levantamento({ obra, ambientes, setObra, setAmbientes }: Props) {
  const alturaM = toMetros(obra.alturaParede, obra.unidadeAltura)
  const set = <K extends keyof Obra>(k: K, v: Obra[K]) => setObra({ ...obra, [k]: v })
  const upd = (id: string, p: Partial<Ambiente>) => setAmbientes(ambientes.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const areaTotal = ambientes.reduce((s, a) => s + areaAmbiente(a), 0)
  const paredeTotal = ambientes.reduce((s, a) => s + areaParedeBruta(a, alturaM), 0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Dados da obra</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="rotulo">Nome ou identificação (opcional)</label>
              <input className="campo" value={obra.nome} onChange={(e) => set('nome', e.target.value)} /></div>
            <div><label className="rotulo">Tipo de construção</label>
              <select className="campo" value={obra.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {['Residencial', 'Comercial', 'Galpão', 'Edícula', 'Muro', 'Outro'].map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <Medida rotulo="Altura das paredes" valor={obra.alturaParede} unidade={obra.unidadeAltura}
              onValor={(v) => set('alturaParede', v)} onUnidade={(u) => set('unidadeAltura', u)} />
            <div><label className="rotulo">Pavimentos</label>
              <input className="campo" type="number" min={1} value={obra.pavimentos} onChange={(e) => set('pavimentos', Math.max(1, parseInt(e.target.value) || 1))} /></div>
            <div><label className="rotulo">Tipo de terreno</label>
              <select className="campo" value={obra.terreno} onChange={(e) => set('terreno', e.target.value as Obra['terreno'])}>
                <option value="plano">Plano</option><option value="inclinado">Inclinado</option></select></div>
            <div><label className="rotulo">Aterro ou escavação</label>
              <select className="campo" value={obra.movimentoTerra} onChange={(e) => set('movimentoTerra', e.target.value as Obra['movimentoTerra'])}>
                <option value="nenhum">Nenhum</option><option value="aterro">Aterro</option>
                <option value="escavacao">Escavação</option><option value="ambos">Aterro e escavação</option></select></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={obra.desnivel} onChange={(e) => set('desnivel', e.target.checked)} /> Existe desnível no terreno
            </label>
          </div>
        </section>

        <section className="cartao">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Ambientes ({ambientes.length})</h2>
            <button className="btn btn-sec" onClick={() => setAmbientes([...ambientes, novoAmbiente(ambientes.length + 1)])}><Plus size={16} /> Adicionar</button>
          </div>
          <div className="space-y-3">
            {ambientes.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                  <div><label className="rotulo">Nome</label>
                    <input className="campo" value={a.nome} onChange={(e) => upd(a.id, { nome: e.target.value })} /></div>
                  <Medida rotulo="Comprimento" valor={a.comprimento} unidade={a.unidade} onValor={(v) => upd(a.id, { comprimento: v })} onUnidade={(u) => upd(a.id, { unidade: u })} />
                  <div><label className="rotulo">Largura ({a.unidade})</label>
                    <input className="campo" type="number" min={0} step="any" value={a.largura || ''} onChange={(e) => upd(a.id, { largura: parseFloat(e.target.value) || 0 })} /></div>
                  <button className="btn btn-sec self-end" aria-label="Remover ambiente" onClick={() => setAmbientes(ambientes.filter((x) => x.id !== a.id))}><Trash2 size={16} /></button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Área {fmt(areaAmbiente(a))} m² · Perímetro {fmt(perimetroAmbiente(a))} m
                </p>
              </div>
            ))}
            {ambientes.length === 0 && <p className="text-sm text-slate-500">Nenhum ambiente cadastrado.</p>}
          </div>
        </section>
      </div>

      <aside className="cartao h-fit">
        <h2 className="mb-3 font-semibold">Resumo geométrico</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Área construída (1 pav.)</dt><dd>{fmt(areaTotal)} m²</dd></div>
          <div className="flex justify-between"><dt>Área total ({obra.pavimentos} pav.)</dt><dd>{fmt(areaTotal * obra.pavimentos)} m²</dd></div>
          <div className="flex justify-between"><dt>Parede bruta (sem aberturas)</dt><dd>{fmt(paredeTotal * obra.pavimentos)} m²</dd></div>
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Quantitativo geométrico. Descontos de portas e janelas entram na etapa de alvenaria.</p>
      </aside>
    </div>
  )
}
