import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { CATEGORIAS, type Material, type Processo } from './tipos'
import { excluir, iniciar, listar, salvar, salvarLote } from './db'
import ImportarPlanilha from './ImportarPlanilha'
import Movimentacoes from './Movimentacoes'
import { aplicarMovimentos, movimentoVazio, type Movimento } from './movimentos'
import { FILTROS_VAZIOS, filtrar, indicadores, ROTULO_SITUACAO, saldos, situacao, type Filtros } from './regras'
import { uid } from '../lib/uid'

type Campo = { k: string; rotulo: string; tipo: 'text' | 'number' | 'date' | 'select' | 'textarea'; opcoes?: [string, string][] }

function Formulario({ campos, valor, onChange }: { campos: Campo[]; valor: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {campos.map((c) => {
        const v = String(valor[c.k] ?? '')
        const set = (x: unknown) => onChange({ ...valor, [c.k]: x })
        return (
          <div key={c.k} className={c.tipo === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="rotulo">{c.rotulo}</label>
            {c.tipo === 'select' ? <select className="campo" value={v} onChange={(e) => set(e.target.value)}><option value="">Selecione…</option>{c.opcoes!.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
              : c.tipo === 'textarea' ? <textarea className="campo" rows={2} value={v} onChange={(e) => set(e.target.value)} />
              : c.tipo === 'number' ? <input className="campo" type="number" step="any" min={0} value={v} onChange={(e) => set(e.target.value === '' ? null : parseFloat(e.target.value))} />
              : <input className="campo" type={c.tipo} value={v} onChange={(e) => set(e.target.value)} />}
          </div>
        )
      })}
    </div>
  )
}

const processoVazio = (): Processo => ({ id: uid(), tipo: 'ata', numeroProcesso: '', modalidade: '', numeroInstrumento: '', ano: null, fornecedor: '', cnpj: '', dataAssinatura: '', vigenciaInicio: '', vigenciaFim: '', observacoes: '' })
const materialVazio = (processoId: string): Material => ({ id: uid(), processoId, lote: '', item: '', codigo: '', nomePadronizado: '', descricaoOriginal: '', especificacao: '', categoria: '', marca: '', unidadeFornecimento: '', unidadeConsumo: '', fator: null, precoUnitario: null, quantidadeRegistrada: null, quantidadeSolicitada: 0, quantidadeEntregue: 0, quantidadeUtilizada: 0, quantidadeComprometida: 0, observacoes: '', fornecedor: '', aditivo: 0, quantidadeLicitada: null, disponivelPlanilha: null, valorPlanilha: null })

const CAMPOS_PROCESSO: Campo[] = [
  { k: 'tipo', rotulo: 'Tipo de instrumento', tipo: 'select', opcoes: [['ata', 'Ata de registro de preços'], ['contrato', 'Contrato administrativo'], ['processo', 'Processo / resultado de licitação']] },
  { k: 'numeroProcesso', rotulo: 'Número do processo licitatório *', tipo: 'text' }, { k: 'modalidade', rotulo: 'Modalidade / pregão', tipo: 'text' },
  { k: 'numeroInstrumento', rotulo: 'Número da ata ou contrato', tipo: 'text' }, { k: 'ano', rotulo: 'Ano da licitação', tipo: 'number' },
  { k: 'fornecedor', rotulo: 'Fornecedor vencedor', tipo: 'text' }, { k: 'cnpj', rotulo: 'CNPJ do fornecedor', tipo: 'text' },
  { k: 'dataAssinatura', rotulo: 'Data de assinatura', tipo: 'date' }, { k: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'date' },
  { k: 'vigenciaFim', rotulo: 'Término da vigência', tipo: 'date' }, { k: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
]

const fmt = (n: number | null, casas = 2) => (n === null ? 'pendente' : n.toLocaleString('pt-BR', { maximumFractionDigits: casas }))
const rotuloProc = (p?: Processo) => (p ? `${p.numeroProcesso || 'sem nº'}${p.ano ? '/' + p.ano : ''} · ${p.fornecedor || 'fornecedor pendente'}` : '—')

export default function Licitacoes() {
  const [aba, setAba] = useState<'painel' | 'processos' | 'materiais' | 'importar' | 'movimentacoes'>('painel')
  const [processos, setProcessos] = useState<Processo[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [selMat, setSelMat] = useState('')
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')
  const [edP, setEdP] = useState<Processo | null>(null)
  const [edM, setEdM] = useState<Material | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const hoje = new Date().toISOString().slice(0, 10)
  const [hist, setHist] = useState<(typeof aba)[]>([])
  const ir = (a: typeof aba) => { if (a !== aba) { setHist([...hist, aba]); setAba(a) } }
  const voltar = () => { const h = [...hist]; setAba(h.pop() ?? 'painel'); setHist(h) }

  useEffect(() => {
    (async () => {
      try { await iniciar(); setProcessos(await listar<Processo>('processos')); setMateriais(await listar<Material>('materiais')); setMovimentos(await listar<Movimento>('movimentos')) }
      catch (e) { setErro(`Não foi possível abrir o armazenamento local: ${(e as Error).message}`) }
      finally { setPronto(true) }
    })()
  }, [])

  const proc = useMemo(() => new Map(processos.map((p) => [p.id, p])), [processos])
  const efetivos = useMemo(() => materiais.map((m) => aplicarMovimentos(m, movimentos.filter((x) => x.materialId === m.id))), [materiais, movimentos]) // posição base + movimentações ativas
  const ind = useMemo(() => indicadores(processos, efetivos, hoje), [processos, efetivos, hoje])
  const lista = useMemo(() => filtrar(efetivos, processos, filtros, hoje), [efetivos, processos, filtros, hoje])
  const fornecedores = [...new Set([...processos.map((p) => p.fornecedor), ...materiais.map((m) => m.fornecedor)].filter(Boolean))]
  const upsert = <T extends { id: string }>(arr: T[], x: T) => (arr.some((a) => a.id === x.id) ? arr.map((a) => (a.id === x.id ? x : a)) : [...arr, x])

  const registrar = async (movs: Movimento[]) => {
    await salvarLote('movimentos', movs)
    const ids = new Set(movs.map((m) => m.id)), por = new Map(movs.map((m) => [m.id, m]))
    setMovimentos((atual) => [...atual.map((m) => (ids.has(m.id) ? por.get(m.id)! : m)), ...movs.filter((m) => !atual.some((x) => x.id === m.id))])
  }
  const gravarProcesso = async () => {
    if (!edP) return
    if (!edP.numeroProcesso.trim()) return alert('Informe o número do processo licitatório.')
    await salvar('processos', edP); setProcessos(upsert(processos, edP)); setEdP(null)
  }
  const gravarMaterial = async () => {
    if (!edM) return
    if (!edM.processoId || !edM.nomePadronizado.trim()) return alert('Escolha o processo e informe o nome padronizado.')
    const novo = !materiais.some((m) => m.id === edM.id)
    await salvar('materiais', edM); setMateriais(upsert(materiais, edM))
    if (novo) await registrar([{ ...movimentoVazio(edM.id, edM.unidadeFornecimento, 'cadastro-inicial'), quantidade: edM.quantidadeRegistrada ?? 0, observacoes: 'Cadastro manual' }])
    setEdM(null)
  }
  const concluirImportacao = async (novosProc: Processo[], mats: Material[]) => {
    await salvarLote('processos', novosProc); await salvarLote('materiais', mats)
    await registrar(mats.map((m) => ({ ...movimentoVazio(m.id, m.unidadeFornecimento, materiais.some((x) => x.id === m.id) ? 'atualizacao' : 'cadastro-inicial'), quantidade: m.quantidadeRegistrada ?? 0, observacoes: m.observacoes })))
    setProcessos([...processos, ...novosProc])
    const ids = new Map(mats.map((m) => [m.id, m]))
    setMateriais([...materiais.map((m) => ids.get(m.id) ?? m), ...mats.filter((m) => !materiais.some((x) => x.id === m.id))])
    setAba('materiais')
  }
  const apagarProcesso = async (p: Processo) => {
    if (materiais.some((m) => m.processoId === p.id)) return alert('Este processo tem materiais cadastrados. Exclua os materiais antes.')
    if (!confirm('Excluir este processo?')) return
    await excluir('processos', p.id); setProcessos(processos.filter((x) => x.id !== p.id))
  }
  const apagarMaterial = async (m: Material) => {
    if (!confirm(`Excluir "${m.nomePadronizado}"?`)) return
    for (const mv of movimentos.filter((x) => x.materialId === m.id)) await excluir('movimentos', mv.id)
    await excluir('materiais', m.id); setMateriais(materiais.filter((x) => x.id !== m.id)); setMovimentos(movimentos.filter((x) => x.materialId !== m.id))
  }

  if (!pronto) return <p className="text-sm">Abrindo armazenamento local…</p>
  const campoMaterial: Campo[] = [
    { k: 'processoId', rotulo: 'Processo / ata / contrato *', tipo: 'select', opcoes: processos.map((p) => [p.id, rotuloProc(p)]) },
    { k: 'nomePadronizado', rotulo: 'Nome padronizado * (ex.: Cimento CP II-Z-32 50 kg)', tipo: 'text' },
    { k: 'descricaoOriginal', rotulo: 'Descrição original da licitação (não alterar)', tipo: 'textarea' },
    { k: 'especificacao', rotulo: 'Especificação técnica', tipo: 'textarea' },
    { k: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: CATEGORIAS.map((c) => [c, c]) },
    { k: 'fornecedor', rotulo: 'Fornecedor do item', tipo: 'text' }, { k: 'quantidadeLicitada', rotulo: 'Quantidade licitada', tipo: 'number' }, { k: 'aditivo', rotulo: 'Aditivo (quantidade)', tipo: 'number' },
    { k: 'codigo', rotulo: 'Código do material', tipo: 'text' }, { k: 'lote', rotulo: 'Lote', tipo: 'text' }, { k: 'item', rotulo: 'Número do item', tipo: 'text' },
    { k: 'marca', rotulo: 'Marca', tipo: 'text' }, { k: 'unidadeFornecimento', rotulo: 'Unidade de fornecimento', tipo: 'text' },
    { k: 'unidadeConsumo', rotulo: 'Unidade de consumo', tipo: 'text' }, { k: 'fator', rotulo: 'Fator fornecimento → consumo (só se confirmado)', tipo: 'number' },
    { k: 'precoUnitario', rotulo: 'Preço unitário licitado (R$)', tipo: 'number' }, { k: 'quantidadeRegistrada', rotulo: 'Quantidade registrada/contratada', tipo: 'number' },
    { k: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
  ]
  const abaBtn = (k: typeof aba, t: string) => <button className={`btn ${aba === k ? 'btn-primario' : 'btn-sec'}`} onClick={() => ir(k)}>{t}</button>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{aba !== 'painel' && <button className="btn btn-sec" onClick={voltar}><ArrowLeft size={16} /> Voltar</button>}{abaBtn('painel', 'Painel')}{abaBtn('processos', `Processos (${processos.length})`)}{abaBtn('materiais', `Materiais (${materiais.length})`)}{abaBtn('importar', 'Importar planilha')}{abaBtn('movimentacoes', 'Movimentações')}</div>
      {erro && <p className="cartao text-sm text-red-600">{erro}</p>}

      {aba === 'painel' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([['Materiais cadastrados', ind.totalMateriais], ['Processos, contratos e atas', ind.totalProcessos], ['Com saldo disponível', ind.comSaldo], ['Sem saldo físico', ind.semSaldo], ['Com entrega pendente', ind.entregaPendente], ['Ata/contrato a vencer (60 dias)', ind.vencendo], ['Saldo baixo (até 20% do recebido)', ind.saldoBaixo]] as const).map(([t, v]) => (
              <div key={t} className="cartao"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-slate-500 dark:text-slate-400">{t}</div></div>
            ))}
          </div>
          <p className="cartao flex gap-2 text-xs text-slate-500 dark:text-slate-400"><AlertTriangle size={16} className="shrink-0 text-amber-600" />Os dados ficam salvos só neste navegador e neste computador. Limpar os dados do navegador ou trocar de computador apaga tudo. A exportação de backup chega no Sprint 7; até lá, mantenha os documentos originais guardados.</p>
        </>
      )}

      {aba === 'importar' && <ImportarPlanilha processos={processos} materiais={materiais} onConcluir={concluirImportacao} />}

      {aba === 'movimentacoes' && <Movimentacoes key={selMat} materiais={materiais} movimentos={movimentos} inicial={selMat} onSalvar={registrar} />}

      {aba === 'processos' && (edP ? (
        <section className="cartao"><h2 className="mb-3 font-semibold">Processo / ata / contrato</h2>
          <Formulario campos={CAMPOS_PROCESSO} valor={edP as unknown as Record<string, unknown>} onChange={(v) => setEdP(v as unknown as Processo)} />
          <div className="mt-3 flex gap-2"><button className="btn btn-primario" onClick={gravarProcesso}>Salvar</button><button className="btn btn-sec" onClick={() => setEdP(null)}>Cancelar</button></div></section>
      ) : (
        <section className="cartao overflow-x-auto">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Processos, contratos e atas</h2><button className="btn btn-sec" onClick={() => setEdP(processoVazio())}><Plus size={16} /> Novo</button></div>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th>Processo</th><th>Instrumento</th><th>Fornecedor</th><th>Vigência</th><th>Situação</th><th /></tr></thead>
            <tbody>{processos.map((p) => { const s = situacao(p, hoje); return (
              <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700"><td className="py-1">{p.numeroProcesso}{p.ano ? `/${p.ano}` : ''}</td><td>{p.numeroInstrumento || 'pendente'}</td><td>{p.fornecedor || 'pendente'}</td><td>{p.vigenciaFim ? `até ${p.vigenciaFim}` : 'pendente'}</td>
                <td className={s === 'vencida' ? 'font-semibold text-red-600' : s === 'a-vencer' ? 'text-amber-600' : ''}>{ROTULO_SITUACAO[s]}</td>
                <td className="whitespace-nowrap text-right"><button className="btn btn-sec !px-2 !py-1" aria-label="Editar" onClick={() => setEdP(p)}><Pencil size={14} /></button> <button className="btn btn-sec !px-2 !py-1" aria-label="Excluir" onClick={() => apagarProcesso(p)}><Trash2 size={14} /></button></td></tr>) })}</tbody></table>
          {processos.length === 0 && <p className="text-sm text-slate-500">Nenhum processo cadastrado.</p>}
        </section>
      ))}

      {aba === 'materiais' && (edM ? (
        <section className="cartao"><h2 className="mb-3 font-semibold">Material licitado</h2>
          <Formulario campos={campoMaterial} valor={edM as unknown as Record<string, unknown>} onChange={(v) => setEdM(v as unknown as Material)} />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Recebido, utilizado e comprometido são controlados na aba Movimentações e não são digitados aqui.</p>
          <div className="mt-3 flex gap-2"><button className="btn btn-primario" onClick={gravarMaterial}>Salvar</button><button className="btn btn-sec" onClick={() => setEdM(null)}>Cancelar</button></div></section>
      ) : (
        <section className="cartao space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Materiais licitados</h2>
            <button className="btn btn-sec" onClick={() => (processos.length ? setEdM(materialVazio(processos[0].id)) : alert('Cadastre um processo, ata ou contrato primeiro.'))}><Plus size={16} /> Novo</button></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="campo sm:col-span-3" placeholder="Buscar por nome, código, descrição ou especificação" value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} />
            <select className="campo" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}><option value="">Todas as categorias</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="campo" value={filtros.processoId} onChange={(e) => setFiltros({ ...filtros, processoId: e.target.value })}><option value="">Todos os processos</option>{processos.map((p) => <option key={p.id} value={p.id}>{rotuloProc(p)}</option>)}</select>
            <select className="campo" value={filtros.fornecedor} onChange={(e) => setFiltros({ ...filtros, fornecedor: e.target.value })}><option value="">Todos os fornecedores</option>{fornecedores.map((f) => <option key={f}>{f}</option>)}</select>
            <select className="campo" value={filtros.situacao} onChange={(e) => setFiltros({ ...filtros, situacao: e.target.value })}><option value="">Toda vigência</option>{Object.entries(ROTULO_SITUACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="campo" value={filtros.disponibilidade} onChange={(e) => setFiltros({ ...filtros, disponibilidade: e.target.value })}><option value="">Toda disponibilidade</option><option value="com-saldo">Com saldo físico</option><option value="sem-saldo">Sem saldo físico</option><option value="a-receber">Entrega pendente</option></select>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th>Material</th><th>Categoria</th><th>Processo</th><th className="text-right">Preço (R$)</th><th className="text-right">Registrada</th><th className="text-right">A solicitar</th><th className="text-right">Disponível (físico)</th><th className="text-right">A receber</th><th>Vigência</th><th /></tr></thead>
            <tbody>{lista.map((m) => { const s = saldos(m); const sit = situacao(proc.get(m.processoId), hoje); return (
              <tr key={m.id} className="border-t border-slate-200 align-top dark:border-slate-700"><td className="py-1">{m.nomePadronizado}<div className="text-xs text-slate-500">{m.unidadeFornecimento || 'unidade pendente'}</div></td><td>{m.categoria || 'pendente'}</td><td className="text-xs">{rotuloProc(proc.get(m.processoId))}</td>
                <td className="text-right">{fmt(m.precoUnitario)}</td><td className="text-right">{fmt(m.quantidadeRegistrada)}</td><td className="text-right">{fmt(s.saldoASolicitar)}</td><td className="text-right">{fmt(s.disponivel)}</td><td className="text-right">{fmt(s.aReceber)}</td>
                <td className={`text-xs ${sit === 'vencida' ? 'font-semibold text-red-600' : sit === 'a-vencer' ? 'text-amber-600' : ''}`}>{ROTULO_SITUACAO[sit]}</td>
                <td className="whitespace-nowrap text-right"><button className="btn btn-sec !px-2 !py-1" aria-label="Editar" onClick={() => setEdM(materiais.find((x) => x.id === m.id) ?? m)}><Pencil size={14} /></button> <button className="btn btn-sec !px-2 !py-1" aria-label="Movimentar" onClick={() => { setSelMat(m.id); ir('movimentacoes') }}><ArrowLeftRight size={14} /></button> <button className="btn btn-sec !px-2 !py-1" aria-label="Excluir" onClick={() => apagarMaterial(m)}><Trash2 size={14} /></button></td></tr>) })}</tbody></table></div>
          {lista.length === 0 && <p className="text-sm text-slate-500">Nenhum material encontrado.</p>}
        </section>
      ))}
    </div>
  )
}
