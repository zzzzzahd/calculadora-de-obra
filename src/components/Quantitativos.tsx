import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Ambiente, Obra } from '../types'
import { calcular, consolidar, PARAMS_PADRAO, type Params } from '../lib/engine'

type Num = Exclude<keyof Params, 'aberturas'>
const GRUPOS: { titulo: string; campos: [Num, string][] }[] = [
  { titulo: 'Alvenaria', campos: [['blocoC', 'Bloco: comprimento (m)'], ['blocoA', 'Bloco: altura (m)'], ['perdaBloco', 'Perda de blocos (%)'], ['argM3m2', 'Argamassa (m³/m²)'], ['argCimentoKg', 'Cimento na argamassa (kg/m³)'], ['argAreiaM3', 'Areia na argamassa (m³/m³)'], ['perdaArg', 'Perda de argamassa (%)']] },
  { titulo: 'Contrapiso e piso', campos: [['espContrapisoCm', 'Espessura do contrapiso (cm)'], ['ctCimentoKg', 'Cimento (kg/m³)'], ['ctAreiaM3', 'Areia (m³/m³)'], ['ctBritaM3', 'Brita (m³/m³)'], ['perdaConcreto', 'Perda do concreto (%)'], ['pisoC', 'Peça: comprimento (m)'], ['pisoL', 'Peça: largura (m)'], ['perdaPiso', 'Perda do piso (%)']] },
  { titulo: 'Pintura e compra', campos: [['faces', 'Faces a pintar'], ['demaos', 'Número de demãos'], ['rendTinta', 'Rendimento (m²/L/demão)'], ['latL', 'Litros por lata'], ['sacoKg', 'Kg por saco de cimento']] },
]
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function Quantitativos({ obra, ambientes }: { obra: Obra; ambientes: Ambiente[] }) {
  const [p, setP] = useState<Params>(PARAMS_PADRAO)
  const itens = useMemo(() => calcular(obra, ambientes, p), [obra, ambientes, p])
  const lista = useMemo(() => consolidar(itens), [itens])
  const etapas = [...new Set(itens.map((i) => i.etapa))]
  const upAb = (id: string, d: object) => setP({ ...p, aberturas: p.aberturas.map((a) => (a.id === id ? { ...a, ...d } : a)) })

  return (
    <div className="mt-6 space-y-4">
      <section className="cartao">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Portas e janelas (descontadas da alvenaria)</h2>
          <button className="btn btn-sec" onClick={() => setP({ ...p, aberturas: [...p.aberturas, { id: crypto.randomUUID(), tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 1 }] })}><Plus size={16} /> Adicionar</button>
        </div>
        {p.aberturas.map((a) => (
          <div key={a.id} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select className="campo" value={a.tipo} onChange={(e) => upAb(a.id, { tipo: e.target.value })}><option>Porta</option><option>Janela</option></select>
            <input className="campo" type="number" step="any" min={0} value={a.largura} onChange={(e) => upAb(a.id, { largura: parseFloat(e.target.value) || 0 })} title="Largura (m)" />
            <input className="campo" type="number" step="any" min={0} value={a.altura} onChange={(e) => upAb(a.id, { altura: parseFloat(e.target.value) || 0 })} title="Altura (m)" />
            <input className="campo" type="number" min={1} value={a.qtd} onChange={(e) => upAb(a.id, { qtd: parseInt(e.target.value) || 1 })} title="Quantidade" />
            <button className="btn btn-sec" aria-label="Remover" onClick={() => setP({ ...p, aberturas: p.aberturas.filter((x) => x.id !== a.id) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <p className="text-xs text-slate-500 dark:text-slate-400">Colunas: tipo · largura (m) · altura (m) · quantidade.</p>
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Parâmetros técnicos (editáveis)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="space-y-2">
              <h3 className="text-sm font-medium text-amber-600">{g.titulo}</h3>
              {g.campos.map(([k, rot]) => (
                <div key={k}><label className="rotulo">{rot}</label>
                  <input className="campo" type="number" step="any" min={0} value={p[k]} onChange={(e) => setP({ ...p, [k]: parseFloat(e.target.value) || 0 })} /></div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Valores iniciais são exemplos de composição: confira com a sua realidade antes de comprar.</p>
      </section>

      {itens.length === 0 ? (
        <p className="cartao text-sm">Preencha comprimento e largura de pelo menos um ambiente para ver os quantitativos.</p>
      ) : (
        <>
          {etapas.map((e) => (
            <section key={e} className="cartao overflow-x-auto">
              <h2 className="mb-2 font-semibold">{e}</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th>Material</th><th>Tipo</th><th className="text-right">Antes de arredondar</th><th className="text-right">Compra</th><th>Un.</th></tr></thead>
                <tbody>
                  {itens.filter((i) => i.etapa === e).map((i) => (
                    <tr key={i.material} className="border-t border-slate-200 align-top dark:border-slate-700">
                      <td className="py-1">{i.material}
                        <details className="text-xs text-slate-500 dark:text-slate-400"><summary className="cursor-pointer">Memória de cálculo</summary>
                          <p>Fórmula: {i.formula}</p><p>Dimensões: {i.dimensoes}</p><p>Coeficiente: {i.coef} · Perda: {i.perda}%</p></details></td>
                      <td className="text-xs">{i.tipo}</td>
                      <td className="text-right">{fmt(i.bruto)}</td><td className="text-right font-semibold">{fmt(i.final)}</td><td className="pl-2">{i.unidade}</td>
                    </tr>))}
                </tbody>
              </table>
            </section>
          ))}
          <section className="cartao overflow-x-auto">
            <h2 className="mb-2 font-semibold">Lista geral de compras (consolidada)</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th>Material</th><th className="text-right">Quantidade</th><th>Un.</th><th className="pl-2">Etapas</th></tr></thead>
              <tbody>{lista.map((l) => (
                <tr key={l.material + l.unidade} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1">{l.material}</td><td className="text-right font-semibold">{fmt(l.final)}</td><td className="pl-2">{l.unidade}</td><td className="pl-2 text-xs">{l.etapas}</td></tr>))}</tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Estimativa baseada em composições, não é projeto executivo. Estruturas, instalações elétricas e hidráulicas exigem profissional habilitado.</p>
          </section>
        </>
      )}
    </div>
  )
}
