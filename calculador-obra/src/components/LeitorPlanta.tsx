import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, ScanSearch, Trash2 } from 'lucide-react'
import type { Ambiente } from '../types'
import type { Abertura } from '../lib/engine'
import { lerPlanta, type Leitura } from '../lib/leitor'

export interface Confirmacao { ambientes: Ambiente[]; altura: number | null; aberturas: Abertura[] }

export default function LeitorPlanta({ onConfirmar }: { onConfirmar: (c: Confirmacao) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [r, setR] = useState<Leitura | null>(null)
  const [conferi, setConferi] = useState(false)

  useEffect(() => { if (!file) { setUrl(null); return } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u) }, [file])

  const interpretar = async () => {
    if (!file) return
    setCarregando(true); setErro(''); setR(null); setConferi(false)
    try { setR(await lerPlanta(file)) } catch (e) { setErro((e as Error).message) } finally { setCarregando(false) }
  }
  const upd = (id: string, d: object) => r && setR({ ...r, ambientes: r.ambientes.map((a) => (a.id === id ? { ...a, ...d } : a)) })
  const confirmar = () => r && onConfirmar({
    ambientes: r.ambientes.map((a) => ({ id: a.id, nome: a.nome, comprimento: a.comprimento, largura: a.largura, unidade: 'm' as const })),
    altura: r.alturaParede, aberturas: r.aberturas,
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="cartao">
        <h2 className="mb-3 font-semibold">Planta original</h2>
        <input className="campo" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setR(null); setErro('') }} />
        {url && file && (file.type === 'application/pdf'
          ? <iframe src={url} title="Planta" className="mt-3 h-96 w-full rounded-lg border" />
          : <img src={url} alt="Planta enviada" className="mt-3 max-h-96 w-full rounded-lg border object-contain" />)}
        <button className="btn btn-primario mt-3" disabled={!file || carregando} onClick={interpretar}>
          {carregando ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />} Interpretar planta
        </button>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A imagem é enviada a um serviço de IA externo só para esta leitura e não é armazenada. Pode gerar custo na conta da API. DXF ainda não é suportado.</p>
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Medidas interpretadas</h2>
        {!r ? <p className="text-sm text-slate-500">Envie uma planta e clique em interpretar. Você poderá conferir e corrigir tudo antes de calcular.</p> : (
          <div className="space-y-3">
            {r.ambientes.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <div className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2">
                  <input className="campo" value={a.nome} onChange={(e) => upd(a.id, { nome: e.target.value })} />
                  <input className="campo" type="number" step="any" min={0} title="Comprimento (m)" value={a.comprimento || ''} onChange={(e) => upd(a.id, { comprimento: parseFloat(e.target.value) || 0 })} />
                  <input className="campo" type="number" step="any" min={0} title="Largura (m)" value={a.largura || ''} onChange={(e) => upd(a.id, { largura: parseFloat(e.target.value) || 0 })} />
                  <button className="btn btn-sec" aria-label="Remover" onClick={() => setR({ ...r, ambientes: r.ambientes.filter((x) => x.id !== a.id) })}><Trash2 size={16} /></button>
                </div>
                <p className={`mt-1 text-xs ${a.confianca < 0.7 || !a.comprimento || !a.largura ? 'text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>
                  {a.origem === 'cota' ? 'Medida lida de cota' : 'Medida estimada'} · confiança {Math.round(a.confianca * 100)}%{(a.confianca < 0.7 || !a.comprimento || !a.largura) && ' · conferir'} {a.observacao}
                </p>
              </div>
            ))}
            <p className="text-xs text-slate-500">Colunas: nome · comprimento (m) · largura (m).</p>
            <p className="text-sm">Altura das paredes: {r.alturaParede ? `${r.alturaParede} m` : 'não identificada'} · Portas/janelas: {r.aberturas.length} tipo(s)</p>
            {r.avisos.length > 0 && <ul className="space-y-1 text-xs text-amber-600">{r.avisos.map((a, i) => <li key={i} className="flex gap-1"><AlertTriangle size={14} className="shrink-0" />{a}</li>)}</ul>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} /> Conferi as medidas com a planta</label>
            <button className="btn btn-primario" disabled={!conferi || r.ambientes.length === 0} onClick={confirmar}>Confirmar e usar estas medidas</button>
          </div>
        )}
      </section>
    </div>
  )
}
