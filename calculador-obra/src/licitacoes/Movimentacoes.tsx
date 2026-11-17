import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Material } from './tipos'
import { aplicarMovimentos, cancelar, corrigir, INFORMATIVOS, movimentoVazio, reservadoPorObra, ROTULO_MOV, validarMovimento, type Movimento, type TipoMov } from './movimentos'
import { saldos } from './regras'

interface Props { materiais: Material[]; movimentos: Movimento[]; inicial: string; onSalvar: (movs: Movimento[]) => Promise<void> }
const TIPOS = (Object.keys(ROTULO_MOV) as TipoMov[]).filter((t) => !INFORMATIVOS.includes(t))
const f = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function Movimentacoes({ materiais, movimentos, inicial, onSalvar }: Props) {
  const [matId, setMatId] = useState(inicial || materiais[0]?.id || '')
  const [tipo, setTipo] = useState<TipoMov>('recebimento')
  const [qtd, setQtd] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [obra, setObra] = useState(''), [doc, setDoc] = useState(''), [obs, setObs] = useState(''), [conv, setConv] = useState(false), [just, setJust] = useState('')
  const [avisos, setAvisos] = useState<string[]>([]), [erros, setErros] = useState<string[]>([])
  const [corrigindo, setCorrigindo] = useState<Movimento | null>(null)

  const base = materiais.find((m) => m.id === matId)
  const doMaterial = useMemo(() => movimentos.filter((m) => m.materialId === matId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)), [movimentos, matId])
  const ativos = useMemo(() => doMaterial.filter((m) => m.status === 'ativa'), [doMaterial])
  const ef = base ? aplicarMovimentos(base, ativos) : null
  const s = ef ? saldos(ef) : null
  const reservado = obra.trim() ? reservadoPorObra(ativos, obra) : 0

  if (!materiais.length) return <p className="cartao text-sm">Cadastre ou importe materiais para registrar movimentações.</p>

  const limpar = () => { setQtd(''); setObra(''); setDoc(''); setObs(''); setConv(false); setJust(''); setAvisos([]); setErros([]); setCorrigindo(null) }
  const salvar = async () => {
    if (!base) return
    const novo: Movimento = { ...movimentoVazio(base.id, base.unidadeFornecimento, tipo), quantidade: parseFloat(qtd.replace(',', '.')), data, obra, documento: doc, observacoes: obs, justificativa: just.trim(), converteReserva: tipo === 'consumo' && conv }
    const v = validarMovimento(base, corrigindo ? ativos.filter((x) => x.id !== corrigindo.id) : ativos, novo)
    setErros(v.erros); setAvisos(v.avisos)
    if (v.erros.length || (v.avisos.length && !just.trim())) return // com alerta, só salva com justificativa escrita
    await onSalvar(corrigindo ? corrigir(corrigindo, novo) : [novo]); limpar()
  }
  const iniciarCorrecao = (m: Movimento) => {
    setCorrigindo(m); setTipo(m.tipo); setQtd(String(m.quantidade)); setData(m.data); setObra(m.obra); setDoc(m.documento); setObs(m.observacoes); setConv(m.converteReserva); setJust(''); setAvisos([]); setErros([])
  }
  const anular = async (m: Movimento) => {
    if (!base) return
    const depois = aplicarMovimentos(base, ativos.filter((x) => x.id !== m.id))
    const neg = depois.quantidadeEntregue - depois.quantidadeUtilizada - depois.quantidadeComprometida < 0 || depois.quantidadeComprometida < 0
    const j = neg ? prompt('O cancelamento deixa o saldo negativo. Escreva a justificativa para continuar:') : confirm('Cancelar esta movimentação? O registro será mantido no histórico.') ? 'ok' : null
    if (!j || !j.trim()) return
    await onSalvar([{ ...cancelar(m), justificativa: neg ? j.trim() : m.justificativa }])
  }

  return (
    <div className="space-y-4">
      <section className="cartao space-y-3">
        <h2 className="font-semibold">{corrigindo ? 'Corrigir movimentação (o registro original será preservado)' : 'Registrar movimentação'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3"><label className="rotulo">Material</label>
            <select className="campo" value={matId} disabled={!!corrigindo} onChange={(e) => { setMatId(e.target.value); setAvisos([]) }}>{materiais.map((m) => <option key={m.id} value={m.id}>{m.nomePadronizado}</option>)}</select></div>
          <div><label className="rotulo">Tipo</label><select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMov)}>{TIPOS.map((t) => <option key={t} value={t}>{ROTULO_MOV[t]}</option>)}</select></div>
          <div><label className="rotulo">Quantidade ({base?.unidadeFornecimento || 'unid.'}){tipo === 'ajuste-inventario' ? ' — pode ser negativa' : ''}</label><input className="campo" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          <div><label className="rotulo">Data</label><input className="campo" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><label className="rotulo">Obra relacionada{['reserva', 'cancelamento-reserva', 'consumo'].includes(tipo) ? ' *' : ''}</label><input className="campo" value={obra} onChange={(e) => setObra(e.target.value)} /></div>
          <div><label className="rotulo">Documento de referência</label><input className="campo" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Nota fiscal, ordem de fornecimento…" /></div>
          <div><label className="rotulo">Observações</label><input className="campo" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        {tipo === 'consumo' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={conv} onChange={(e) => setConv(e.target.checked)} /> Converter a reserva desta obra em consumo{obra.trim() ? ` (reservado: ${f(reservado)})` : ''}</label>}
        {erros.map((e) => <p key={e} className="text-sm text-red-600">{e}</p>)}
        {avisos.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-500 p-3 text-sm">
            {avisos.map((a) => <p key={a} className="flex gap-2 text-amber-600"><AlertTriangle size={16} className="shrink-0" />{a}</p>)}
            <label className="rotulo">Justificativa (obrigatória para confirmar)</label>
            <textarea className="campo" rows={2} value={just} onChange={(e) => setJust(e.target.value)} />
          </div>
        )}
        <div className="flex gap-2"><button className="btn btn-primario" onClick={salvar}>{avisos.length ? 'Confirmar com justificativa' : corrigindo ? 'Salvar correção' : 'Registrar'}</button>{(corrigindo || avisos.length > 0) && <button className="btn btn-sec" onClick={limpar}>Cancelar</button>}</div>
      </section>

      {ef && s && (
        <section className="cartao">
          <h3 className="mb-2 text-sm font-medium text-amber-600">Posição atual de {base!.nomePadronizado}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {([['Registrada + aditivo', (base!.quantidadeRegistrada ?? 0) + (base!.aditivo ?? 0)], ['Solicitada', ef.quantidadeSolicitada], ['Recebida', ef.quantidadeEntregue], ['Utilizada', ef.quantidadeUtilizada], ['Comprometida (reservas)', ef.quantidadeComprometida], ['Disponível (físico)', s.disponivel], ['A solicitar (saldo da ata)', s.saldoASolicitar], ['Aguardando entrega', s.aguardandoEntrega]] as const).map(([t, v]) => <div key={t}><div className="text-lg font-semibold">{f(v)}</div><div className="text-xs text-slate-500 dark:text-slate-400">{t}</div></div>)}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Estoque físico = recebida − utilizada − comprometida. O saldo ainda não entregue não conta como estoque.</p>
        </section>
      )}

      <section className="cartao overflow-x-auto">
        <h3 className="mb-2 text-sm font-medium">Histórico</h3>
        <table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th>Data</th><th>Tipo</th><th className="text-right">Qtd.</th><th>Obra</th><th>Documento</th><th>Situação</th><th>Observação / justificativa</th><th /></tr></thead>
          <tbody>{doMaterial.map((m) => (
            <tr key={m.id} className={`border-t border-slate-200 align-top dark:border-slate-700 ${m.status !== 'ativa' ? 'opacity-50' : ''}`}>
              <td className="py-1">{m.data}</td><td>{ROTULO_MOV[m.tipo]}</td><td className="text-right">{f(m.quantidade)}</td><td>{m.obra || '—'}</td><td>{m.documento || '—'}</td>
              <td>{m.status === 'ativa' ? 'Ativa' : m.status === 'corrigida' ? 'Corrigida (substituída)' : 'Cancelada'}{m.corrigeId ? ' · correção' : ''}</td>
              <td>{[m.observacoes, m.justificativa && `Justificativa: ${m.justificativa}`].filter(Boolean).join(' · ') || '—'}</td>
              <td className="whitespace-nowrap">{m.status === 'ativa' && !INFORMATIVOS.includes(m.tipo) && <><button className="btn btn-sec !px-2 !py-1" onClick={() => iniciarCorrecao(m)}>Corrigir</button> <button className="btn btn-sec !px-2 !py-1" onClick={() => anular(m)}>Cancelar</button></>}</td></tr>))}</tbody></table>
        {doMaterial.length === 0 && <p className="text-sm text-slate-500">Nenhuma movimentação para este material.</p>}
      </section>
    </div>
  )
}
