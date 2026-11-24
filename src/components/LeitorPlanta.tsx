import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Ruler, ScanSearch, Trash2 } from 'lucide-react'
import type { Ambiente } from '../types'
import type { Abertura } from '../lib/engine'
import { lerPlantaImagem, prepararImagem, type Leitura } from '../lib/leitor'
import { conferir, criarEscala, distanciaM, dimensoesCaixaM, type Escala, type Pagina, type Ponto } from '../lib/planta/escala'
import { detectarCotas, dicasDeCotas, type Cota } from '../lib/planta/cotas'
import VisorPlanta, { type ModoVisor } from './VisorPlanta'

export interface Confirmacao { ambientes: Ambiente[]; altura: number | null; aberturas: Abertura[] }

const MAX_PDF = 25_000_000
const m = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Pagina1 { dataUrl: string; pagina: Pagina; cotas: Cota[] }

export default function LeitorPlanta({ onConfirmar }: { onConfirmar: (c: Confirmacao) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pdf, setPdf] = useState<{ doc: import('../lib/planta/pdf').DocumentoPdf; paginas: number } | null>(null)
  const [numero, setNumero] = useState(1)
  const [img, setImg] = useState<Pagina1 | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [r, setR] = useState<Leitura | null>(null)
  const [conferi, setConferi] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [modo, setModo] = useState<ModoVisor>('navegar')
  const [escala, setEscala] = useState<Escala | null>(null)
  const [pendente, setPendente] = useState<{ a: Ponto; b: Ponto } | null>(null) // calibração aguardando a distância real
  const [metrosTxt, setMetrosTxt] = useState('')
  const [medida, setMedida] = useState<{ a: Ponto; b: Ponto } | null>(null)
  const geracao = useRef(0)

  const zerar = () => { setR(null); setErro(''); setConferi(false); setSel(null); setModo('navegar'); setEscala(null); setPendente(null); setMedida(null); setMetrosTxt('') }

  // carrega a página (imagem ou PDF) sempre que o arquivo ou a página mudam
  useEffect(() => {
    if (!arquivo) { setImg(null); setPdf(null); return }
    const g = ++geracao.current
    ;(async () => {
      setPreparando(true); setErro('')
      try {
        if (arquivo.type === 'application/pdf') {
          if (arquivo.size > MAX_PDF) throw new Error('PDF acima de 25 MB: reduza o arquivo ou exporte a página como imagem.')
          const { abrirPdf, renderizarPagina, textoDaPagina } = await import('../lib/planta/pdf')
          const doc = pdf?.doc && numero > 1 ? pdf.doc : await abrirPdf(new Uint8Array(await arquivo.arrayBuffer()))
          if (g !== geracao.current) return
          const [rend, texto] = await Promise.all([renderizarPagina(doc, numero), textoDaPagina(doc, numero)])
          if (g !== geracao.current) return
          setPdf({ doc, paginas: doc.numPages }); setImg({ ...rend, cotas: detectarCotas(texto.itens) })
        } else {
          const p = await prepararImagem(arquivo)
          if (g !== geracao.current) return
          setPdf(null); setImg({ ...p, cotas: [] })
        }
      } catch (e) { if (g === geracao.current) { setErro((e as Error).message || 'Não foi possível abrir o arquivo.'); setImg(null) } }
      finally { if (g === geracao.current) setPreparando(false) }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo, numero])

  const interpretar = async () => {
    if (!img) return
    setCarregando(true); setErro(''); setR(null); setConferi(false)
    try { setR(await lerPlantaImagem(img.dataUrl, dicasDeCotas(img.cotas))) } catch (e) { setErro((e as Error).message) } finally { setCarregando(false) }
  }
  const upd = (id: string, d: object) => r && setR({ ...r, ambientes: r.ambientes.map((a) => (a.id === id ? { ...a, ...d } : a)) })

  const aplicarEscala = () => {
    if (!pendente || !img) return
    try { setEscala(criarEscala(pendente.a, pendente.b, parseFloat(metrosTxt.replace(',', '.')), img.pagina)); setPendente(null); setModo('navegar'); setErro('') }
    catch (e) { setErro((e as Error).message) }
  }
  const aoPontos = (a: Ponto, b: Ponto) => { setErro(''); if (modo === 'calibrar') setPendente({ a, b }); else if (modo === 'medir') setMedida({ a, b }) }

  const conferencias = useMemo(() => new Map((r?.ambientes ?? []).filter((a) => a.caixa && escala).map((a) => [a.id, conferir(escala!, { comprimento: a.comprimento, largura: a.largura }, a.caixa!)])), [r, escala])
  const caixas = (r?.ambientes ?? []).flatMap((a) => (a.caixa ? [{ id: a.id, rotulo: a.nome, caixa: a.caixa, estado: conferencias.get(a.id)?.status === 'divergente' ? 'divergente' as const : conferencias.get(a.id)?.status === 'ok' ? 'ok' as const : 'neutro' as const }] : []))
  const ambiguas = (img?.cotas ?? []).filter((c) => c.confianca === 'ambigua').length

  const confirmar = () => r && onConfirmar({
    ambientes: r.ambientes.map((a) => ({ id: a.id, nome: a.nome, comprimento: a.comprimento, largura: a.largura, unidade: 'm' as const,
      origem: { fonte: 'planta' as const, confianca: a.confianca, observacao: [a.origem === 'cota' ? 'medida de cota' : 'medida estimada', a.observacao].filter(Boolean).join('; ') } })),
    altura: r.alturaParede, aberturas: r.aberturas,
  })
  const linha = pendente ?? medida ?? (escala ? { a: escala.p1, b: escala.p2 } : null)
  const rotuloLinha = pendente ? undefined : medida && escala ? `${m(distanciaM(escala, medida.a, medida.b))} m` : !medida && escala ? `${m(escala.metros)} m (referência)` : undefined

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="cartao" aria-label="Planta original">
        <h2 className="mb-3 font-semibold">Planta original</h2>
        <input className="campo" type="file" accept="image/jpeg,image/png,application/pdf" aria-label="Arquivo da planta" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setNumero(1); setPdf(null); zerar() }} />
        {preparando && <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Preparando a planta…</p>}
        {pdf && pdf.paginas > 1 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <label htmlFor="pagina">Página</label>
            <select id="pagina" className="campo !w-24" value={numero} onChange={(e) => { setNumero(Number(e.target.value)); zerar() }}>{Array.from({ length: pdf.paginas }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
            <span className="text-xs text-slate-500">de {pdf.paginas}</span>
          </div>
        )}
        {img && (
          <div className="mt-3">
            <VisorPlanta imagem={img.dataUrl} pagina={img.pagina} caixas={caixas} cotas={img.cotas.map((c) => c.caixa)} selecionado={sel} onSelecionar={setSel} modo={modo} onPontos={aoPontos} linha={linha ? { ...linha, rotulo: rotuloLinha } : null} />
            {pdf && <p className="mt-1 text-xs text-slate-500">{img.cotas.length > 0 ? `${img.cotas.length} cota(s) encontrada(s) no texto do PDF (em laranja)${ambiguas ? `; ${ambiguas} sem unidade (cm ou mm?)` : ''}.` : 'Este PDF não tem texto selecionável (provavelmente escaneado): só a IA lerá a imagem.'}</p>}
          </div>
        )}
        <button className="btn btn-primario mt-3" disabled={!img || carregando || preparando} onClick={interpretar}>
          {carregando ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />} Interpretar planta
        </button>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A imagem da planta (e os textos de cota do PDF) são enviados a um serviço de IA externo só para esta leitura e não são armazenados. Pode gerar custo na conta da API. DXF ainda não é suportado.</p>
        {erro && <p className="mt-2 text-sm text-red-600" role="alert">{erro}</p>}
      </section>

      <section className="cartao" aria-label="Medidas interpretadas">
        <h2 className="mb-3 font-semibold">Medidas interpretadas</h2>
        {!r ? <p className="text-sm text-slate-500">Envie uma planta e clique em interpretar. Você poderá conferir e corrigir tudo antes de calcular.</p> : (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Ruler size={16} className="text-amber-600" />
                <strong>Escala</strong>
                <button className={`btn ${modo === 'calibrar' ? 'btn-primario' : 'btn-sec'} !py-1`} onClick={() => { setModo(modo === 'calibrar' ? 'navegar' : 'calibrar'); setPendente(null) }}>Calibrar</button>
                <button className={`btn ${modo === 'medir' ? 'btn-primario' : 'btn-sec'} !py-1`} disabled={!escala} onClick={() => { setModo(modo === 'medir' ? 'navegar' : 'medir'); setMedida(null) }}>Medir</button>
                {escala && <button className="btn btn-sec !py-1" onClick={() => { setEscala(null); setMedida(null); setModo('navegar') }}>Limpar</button>}
              </div>
              {pendente && (
                <div className="mt-2 flex items-end gap-2">
                  <div><label className="rotulo" htmlFor="metros">Distância real entre os dois pontos (m)</label>
                    <input id="metros" className="campo" inputMode="decimal" value={metrosTxt} onChange={(e) => setMetrosTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicarEscala()} /></div>
                  <button className="btn btn-primario" disabled={!metrosTxt.trim()} onClick={aplicarEscala}>Aplicar</button>
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {escala ? `Escala calibrada: ${m(escala.metros)} m entre os pontos marcados. Medidas tiradas dela são estimativas (dependem da precisão dos cliques), não cotas.` : 'Calibre com uma distância conhecida (uma cota do desenho) para conferir as medidas lidas e medir na planta.'}
              </p>
            </div>

            {r.ambientes.map((a, n) => {
              const cf = conferencias.get(a.id), dim = escala && a.caixa ? dimensoesCaixaM(escala, a.caixa) : null
              const duvida = a.confianca < 0.7 || !a.comprimento || !a.largura
              return (
                <div key={a.id} className={`rounded-lg border p-2 ${sel === a.id ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => setSel(a.id)}>
                  <div className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2">
                    <input className="campo" aria-label={`Nome do ambiente ${n + 1}`} value={a.nome} onChange={(e) => upd(a.id, { nome: e.target.value })} />
                    <input className="campo" type="number" step="any" min={0} title="Comprimento (m)" value={a.comprimento || ''} onChange={(e) => upd(a.id, { comprimento: parseFloat(e.target.value) || 0 })} />
                    <input className="campo" type="number" step="any" min={0} title="Largura (m)" value={a.largura || ''} onChange={(e) => upd(a.id, { largura: parseFloat(e.target.value) || 0 })} />
                    <button className="btn btn-sec" aria-label="Remover" onClick={() => setR({ ...r, ambientes: r.ambientes.filter((x) => x.id !== a.id) })}><Trash2 size={16} /></button>
                  </div>
                  <p className={`mt-1 text-xs ${duvida ? 'text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>
                    {n + 1}. {a.origem === 'cota' ? 'Medida lida de cota' : 'Medida estimada'} · confiança {Math.round(a.confianca * 100)}%{duvida && ' · conferir'} {a.observacao}
                  </p>
                  {cf && dim && (
                    <p className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${cf.status === 'divergente' ? 'text-red-600' : 'text-green-700 dark:text-green-500'}`}>
                      {cf.status === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {cf.status === 'sem_medida' ? 'Sem medida lida; ' : cf.status === 'ok' ? 'Confere com a escala; ' : 'Diverge da escala; '}pela escala: {m(dim.comprimento)} × {m(dim.largura)} m (caixa aproximada)
                      <button className="btn btn-sec !py-0.5 !text-xs" onClick={(e) => { e.stopPropagation(); upd(a.id, { comprimento: Math.round(dim.comprimento * 100) / 100, largura: Math.round(dim.largura * 100) / 100, origem: 'estimada', observacao: 'medida pela escala calibrada' }) }}>Usar medida da escala</button>
                    </p>
                  )}
                  {!a.caixa && escala && <p className="mt-1 text-xs text-slate-500">A IA não marcou a posição deste ambiente na planta; não dá para conferir pela escala.</p>}
                </div>
              )
            })}
            <p className="text-xs text-slate-500">Colunas: nome · comprimento (m) · largura (m). Clique no ambiente (ou na caixa azul na planta) para destacá-lo.</p>
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
