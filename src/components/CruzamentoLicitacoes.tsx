import { useEffect, useMemo, useState } from 'react'
import { Link2, Unlink } from 'lucide-react'
import { listar } from '../licitacoes/db'
import { carregarEquivalencias, salvarEquivalencias } from '../licitacoes/equivalencias'
import { chaveItem, cruzar, sugerirMateriais, type Equivalencia, type ItemLista, type LinhaCruzamento } from '../licitacoes/cruzamento'
import type { Material, Processo } from '../licitacoes/tipos'
import type { Movimento } from '../licitacoes/movimentos'
import { uid } from '../lib/uid'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const hoje = () => new Date().toISOString().slice(0, 10)
const rotulo = (m: Material, p?: Processo) => `${m.nomePadronizado || m.descricaoOriginal}${p ? ` — ${p.numeroInstrumento || p.numeroProcesso}` : ''} (${m.unidadeFornecimento})`

interface Dados { processos: Processo[]; materiais: Material[]; movimentos: Movimento[]; equivalencias: Equivalencia[] }

/** Lista de compras x saldos das licitações. Ligação manual, fator informado pelo usuário, nada é reservado automaticamente. */
export default function CruzamentoLicitacoes({ lista, obraNome }: { lista: ItemLista[]; obraNome: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [obra, setObra] = useState(obraNome)
  const [soLigados, setSoLigados] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [processos, materiais, movimentos, equivalencias] = await Promise.all([listar<Processo>('processos'), listar<Material>('materiais'), listar<Movimento>('movimentos'), carregarEquivalencias()])
        if (vivo) setDados({ processos, materiais, movimentos, equivalencias })
      } catch { if (vivo) setErro('Não foi possível ler os dados das licitações neste navegador (armazenamento local indisponível).') }
    })()
    return () => { vivo = false }
  }, [])

  const salvar = async (equivalencias: Equivalencia[]) => {
    if (!dados) return
    try { await salvarEquivalencias(equivalencias); setDados({ ...dados, equivalencias }); setErro('') } catch { setErro('Não foi possível gravar a ligação. Ela não foi salva.') }
  }
  const linhas = useMemo(() => (dados ? cruzar(lista, dados.equivalencias, dados.materiais, dados.processos, dados.movimentos, obra, hoje()) : []), [dados, lista, obra])
  const ligados = linhas.filter((l) => l.estado !== 'sem-ligacao').length
  const visiveis = soLigados ? linhas.filter((l) => l.estado !== 'sem-ligacao') : linhas

  return (
    <section className="cartao overflow-x-auto" aria-label="Saldo das licitações">
      <h2 className="mb-1 font-semibold">Saldo das licitações na lista de compras</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Ligue cada item da lista a um material licitado e informe a conversão de unidades. Nada é ligado nem convertido sozinho. O resultado é só uma sugestão de onde cada quantidade pode vir (estoque, pedido em andamento, saldo da ata ou compra fora); nenhuma reserva ou pedido é criado aqui. Saldo de ata vencida, futura ou sem vigência não é usado.
      </p>
      {erro && <p className="mb-2 text-sm text-red-600" role="alert">{erro}</p>}
      {!dados && !erro && <p className="text-sm text-slate-500">Carregando as licitações…</p>}
      {dados && dados.materiais.length === 0 && <p className="text-sm text-slate-500">Nenhum material de licitação cadastrado neste navegador. Importe ou cadastre no módulo Licitações para cruzar com esta lista.</p>}
      {dados && dados.materiais.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div><label className="rotulo" htmlFor="obra-reserva">Nome da obra nas reservas</label>
              <input id="obra-reserva" className="campo" value={obra} onChange={(e) => setObra(e.target.value)} placeholder="igual ao usado nas reservas" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soLigados} onChange={(e) => setSoLigados(e.target.checked)} /> Mostrar só os itens ligados</label>
            <span className="text-sm text-slate-500">{ligados} de {linhas.length} itens ligados</span>
          </div>
          <div className="space-y-2">
            {visiveis.map((l) => <Linha key={l.chave} l={l} dados={dados} onSalvar={salvar} />)}
          </div>
        </>
      )}
    </section>
  )
}

function Linha({ l, dados, onSalvar }: { l: LinhaCruzamento; dados: Dados; onSalvar: (e: Equivalencia[]) => void }) {
  const sug = useMemo(() => sugerirMateriais(l, dados.materiais), [l, dados.materiais])
  const [matId, setMatId] = useState('')
  const escolhido = dados.materiais.find((m) => m.id === matId)
  const sugerido = escolhido && escolhido.unidadeFornecimento.trim().toLowerCase() === l.unidade.trim().toLowerCase() ? '1' : ''
  const [fatorTxt, setFatorTxt] = useState('')
  const fatorLig = fatorTxt !== '' ? fatorTxt : sugerido
  const fatorNum = parseFloat(fatorLig.replace(',', '.'))
  const procDe = (m: Material) => dados.processos.find((p) => p.id === m.processoId)
  const outros = dados.materiais.filter((m) => !sug.some((s) => s.id === m.id)).sort((a, b) => a.nomePadronizado.localeCompare(b.nomePadronizado)).slice(0, 300)
  const ligar = () => onSalvar([...dados.equivalencias.filter((e) => e.item !== l.chave), { id: uid(), item: l.chave, materialId: matId, fator: fatorNum }])
  const desligar = () => onSalvar(dados.equivalencias.filter((e) => e.item !== l.chave))
  const mudarFator = (v: string) => { const n = parseFloat(v.replace(',', '.')); onSalvar(dados.equivalencias.map((e) => (e.item === l.chave ? { ...e, fator: Number.isFinite(n) ? n : 0 } : e))) }

  return (
    <div className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span><strong>{l.material}</strong> — precisa de {fmt(l.necessidade)} {l.unidade}</span>
        {l.estado !== 'sem-ligacao' && <button className="btn btn-sec !py-0.5 !text-xs" onClick={desligar}><Unlink size={12} /> Desligar</button>}
      </div>
      {l.estado === 'sem-ligacao' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <select className="campo" aria-label={`Material licitado para ${l.material}`} value={matId} onChange={(e) => { setMatId(e.target.value); setFatorTxt('') }}>
            <option value="">Escolher o material licitado…</option>
            {sug.length > 0 && <optgroup label="Sugestões (por palavras em comum)">{sug.map((m) => <option key={m.id} value={m.id}>{rotulo(m, procDe(m))}</option>)}</optgroup>}
            <optgroup label="Todos os materiais">{outros.map((m) => <option key={m.id} value={m.id}>{rotulo(m, procDe(m))}</option>)}</optgroup>
          </select>
          <input className="campo" inputMode="decimal" aria-label={`Fator de conversão de ${l.material}`} placeholder={`1 un. licitada = ? ${l.unidade}`} value={fatorLig} onChange={(e) => setFatorTxt(e.target.value)} />
          <button className="btn btn-sec" disabled={!matId || !(fatorNum > 0)} onClick={ligar}><Link2 size={14} /> Ligar</button>
        </div>
      )}
      {l.estado === 'invalido' && <p className="mt-1 text-xs text-red-600" role="alert">{l.motivo}</p>}
      {l.estado === 'ligado' && l.materialLicitado && (
        <div className="mt-1 space-y-1">
          <p className="text-xs text-slate-500">Ligado a: {rotulo(l.materialLicitado, l.processo)} · 1 unidade licitada = <input className="campo !inline-block !w-20 !py-0 text-right" aria-label={`Fator de ${l.material}`} defaultValue={l.equivalencia?.fator} onBlur={(e) => mudarFator(e.target.value)} /> {l.unidade}</p>
          <p>
            <span className="mr-3">Estoque (reservado {fmt(l.reservadoObra)} + livre {fmt(l.disponivelLivre)}): <strong>{fmt(l.deEstoque)}</strong></span>
            <span className="mr-3">Pedido aguardando entrega: <strong>{fmt(l.deAguardando)}</strong> <span className="text-xs text-slate-500">(de {fmt(l.aguardandoEntrega)})</span></span>
            <span className="mr-3">Saldo da ata a solicitar: <strong>{fmt(l.deAta)}</strong> <span className="text-xs text-slate-500">(de {fmt(l.saldoAta)})</span></span>
            <span className={l.aComprar > 0 ? 'font-semibold text-amber-700 dark:text-amber-500' : ''}>Comprar fora: <strong>{fmt(l.aComprar)}</strong></span>
          </p>
          {l.avisos.map((a, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-500">{a}</p>)}
        </div>
      )}
    </div>
  )
}
