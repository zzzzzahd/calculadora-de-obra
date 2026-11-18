import { useMemo, useState } from 'react'
import { AlertTriangle, Trash2, Upload } from 'lucide-react'
import type { Material, Processo } from './tipos'
import { prepararArquivo } from '../lib/leitor'
import { chamarApi, lerImagemIA, lerPdfIA, type Metadados } from './leitorPdf'
import { aplicarImportacao, avaliar, chaveItem, indexarExistentes, lerCsv, lerXlsx, norm, type AbaLida, type Estrategia, type ItemImportado } from './importacao'
import { uid } from '../lib/uid'

interface Vinculo { modo: 'existente' | 'novo'; processoId: string; numeroProcesso: string; vigenciaInicio: string; vigenciaFim: string; extra?: Partial<Processo> }
interface Props { processos: Processo[]; materiais: Material[]; onConcluir: (novosProcessos: Processo[], materiais: Material[]) => Promise<void> }

const POR_PAGINA = 40
const rotulos: Record<Estrategia, string> = {
  novos: 'Importar somente os itens novos', atualizar: 'Atualizar apenas os itens já cadastrados',
  'novo-processo': 'Cadastrar tudo como novo processo (cria cópias)', ignorar: 'Ignorar a importação',
}

export default function ImportarPlanilha({ processos, materiais, onConcluir }: Props) {
  const [abas, setAbas] = useState<AbaLida[]>([])
  const [aba, setAba] = useState('')
  const [itens, setItens] = useState<ItemImportado[]>([])
  const [vinc, setVinc] = useState<Record<string, Vinculo>>({})
  const [estrategia, setEstrategia] = useState<Estrategia>('novos')
  const [pagina, setPagina] = useState(0)
  const [soAlertas, setSoAlertas] = useState(false)
  const [arquivo, setArquivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])
  const [progresso, setProgresso] = useState('')

  const existentes = useMemo(() => indexarExistentes(materiais, processos), [materiais, processos])
  const duplicados = useMemo(() => itens.filter((i) => existentes.has(chaveItem(i.codigo, i.descricaoOriginal, i.fornecedor))).length, [itens, existentes])
  const comAlerta = itens.filter((i) => i.alertas.length).length
  const fornecedores = useMemo(() => [...new Set(itens.map((i) => i.fornecedor))], [itens])

  const escolherAba = (nome: string, lista = abas, meta?: Metadados) => {
    const a = lista.find((x) => x.nome === nome)
    if (!a) return
    setAba(nome); setItens(a.itens); setPagina(0)
    const v: Record<string, Vinculo> = {}
    for (const f of new Set(a.itens.map((i) => i.fornecedor))) {
      const p = processos.find((x) => !!meta?.numeroProcesso && norm(x.numeroProcesso) === norm(meta.numeroProcesso) && norm(x.fornecedor) === norm(f)) ?? processos.find((x) => norm(x.fornecedor) === norm(f))
      v[f] = { modo: p ? 'existente' : 'novo', processoId: p?.id ?? '', numeroProcesso: meta?.numeroProcesso ?? '', vigenciaInicio: meta?.vigenciaInicio ?? '', vigenciaFim: meta?.vigenciaFim ?? '',
        extra: meta ? { tipo: meta.tipo ?? 'ata', modalidade: meta.modalidade ?? '', numeroInstrumento: meta.numeroInstrumento ?? '', ano: meta.ano ?? null, cnpj: meta.cnpj ?? '', dataAssinatura: meta.dataAssinatura ?? '' } : undefined }
    }
    setVinc(v)
  }

  const abrir = async (file?: File) => {
    if (!file) return
    setErro(''); setAbas([]); setItens([]); setArquivo(file.name); setAvisos([])
    try {
      const nome = file.name.toLowerCase()
      let lidas: AbaLida[]
      let meta: Metadados | undefined
      if (nome.endsWith('.xlsx')) lidas = await lerXlsx(await file.arrayBuffer())
      else if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
        const buf = await file.arrayBuffer()
        let t = new TextDecoder('utf-8').decode(buf)
        if (t.includes('\uFFFD')) t = new TextDecoder('windows-1252').decode(buf)
        lidas = lerCsv(t, file.name)
      } else if (nome.endsWith('.xls')) throw new Error('Arquivos .xls antigos não são lidos. Abra no Excel e salve como .xlsx.')
      else if (nome.endsWith('.pdf') || /\.(jpe?g|png)$/.test(nome)) {
        if (!confirm('O documento será enviado a um serviço externo de IA para leitura (pode gerar custo na sua conta da API). Continuar?')) return
        const r = nome.endsWith('.pdf') ? await lerPdfIA(file.name, await file.arrayBuffer(), chamarApi, setProgresso) : await lerImagemIA(file.name, (await prepararArquivo(file)).dados, chamarApi)
        setAvisos(r.avisos)
        if (!r.itens.length) throw new Error(`Nenhum item encontrado no documento. ${r.avisos.join(' ')}`)
        lidas = [{ nome: file.name, itens: r.itens }]; meta = r.metadados
      }
      else throw new Error('Formato não suportado. Use .xlsx ou .csv.')
      if (!lidas.length) throw new Error('Não encontrei a linha de cabeçalho com as colunas PRODUTO e QTDE ATA.')
      setAbas(lidas)
      escolherAba(lidas.find((a) => norm(a.nome) === 'geral')?.nome ?? lidas[0].nome, lidas, meta)
    } catch (e) { setErro((e as Error).message) } finally { setProgresso('') }
  }

  const editar = (id: string, d: Partial<ItemImportado>) => setItens(itens.map((i) => { if (i.id !== id) return i; const n = { ...i, ...d }; n.alertas = avaliar(n); return n }))
  const nv = (s: string) => (s === '' ? null : parseFloat(s))

  const confirmar = async () => {
    if (estrategia === 'ignorar') { setItens([]); setAbas([]); return }
    const novos: Processo[] = [], mapa: Record<string, string> = {}
    for (const f of fornecedores) {
      const v = vinc[f]
      if (estrategia === 'novo-processo' || v.modo === 'novo') {
        if (!v.numeroProcesso.trim()) return alert(`Informe o número do processo/ata para "${f || 'sem fornecedor'}".`)
        const p: Processo = { id: uid(), tipo: 'ata', numeroProcesso: v.numeroProcesso.trim(), modalidade: '', numeroInstrumento: '', ano: null, fornecedor: f, cnpj: '', dataAssinatura: '', vigenciaInicio: v.vigenciaInicio, vigenciaFim: v.vigenciaFim, observacoes: `Importado de ${arquivo}`, ...(v.extra ?? {}) }
        novos.push(p); mapa[f] = p.id
      } else { if (!v.processoId) return alert(`Escolha o processo de "${f || 'sem fornecedor'}".`); mapa[f] = v.processoId }
    }
    const r = aplicarImportacao(itens, existentes, mapa, estrategia)
    setSalvando(true)
    try {
      await onConcluir(novos.filter((p) => r.salvar.some((m) => m.processoId === p.id)), r.salvar)
      alert(`Importação concluída: ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.ignorados} ignorado(s).`)
      setItens([]); setAbas([])
    } finally { setSalvando(false) }
  }

  const visiveis = itens.filter((i) => !soAlertas || i.alertas.length)
  const pagina_ = visiveis.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const campoN = (i: ItemImportado, k: 'quantidadeAta' | 'aditivo' | 'precoUnitario' | 'quantidadeSolicitada' | 'quantidadeFornecida') => (
    <input className="campo !px-1 !py-1 w-20 text-right" type="number" step="any" value={i[k] ?? ''} onChange={(e) => editar(i.id, { [k]: nv(e.target.value) })} />
  )

  return (
    <div className="space-y-4">
      <section className="cartao">
        <h2 className="mb-2 font-semibold">Importar planilha da licitação</h2>
        <input className="campo" type="file" accept=".xlsx,.csv,.txt,.xls,.pdf,.jpg,.jpeg,.png" onChange={(e) => abrir(e.target.files?.[0])} />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Lê só as colunas N°, PRODUTO, MARCA, UNID, QTDE LICITADA, QTDE ATA, ADITIVO, VALOR UNIT, QTDE SOLICITADA, QTDE FORNECIDA, QUANTIDADE, VALOR e FORNECEDOR. Para PDF e fotos de atas e contratos, a IA lê o documento em blocos de páginas e você confere cada item. Nada é cadastrado antes da sua confirmação.</p>
        {progresso && <p className="mt-2 text-sm">{progresso}</p>}
        {avisos.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-600">{avisos.map((a, k) => <li key={k} className="flex gap-1"><AlertTriangle size={14} className="shrink-0" />{a}</li>)}</ul>}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </section>

      {itens.length > 0 && (
        <>
          <section className="cartao space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="rotulo">Aba lida</label>
                <select className="campo" value={aba} onChange={(e) => escolherAba(e.target.value)}>{abas.map((a) => <option key={a.nome} value={a.nome}>{a.nome} ({a.itens.length} itens)</option>)}</select></div>
              <div className="text-sm sm:col-span-2">{itens.length} itens · {fornecedores.length} fornecedor(es) · <span className={comAlerta ? 'text-amber-600' : ''}>{comAlerta} com alerta de conferência</span> · {duplicados} já cadastrado(s)</div>
            </div>
            {abas.length > 1 && <p className="text-xs text-slate-500 dark:text-slate-400">A aba "GERAL" já reúne os itens das abas de cada fornecedor: importe só uma delas para não duplicar.</p>}
            <h3 className="text-sm font-medium text-amber-600">A que processo/ata cada fornecedor pertence?</h3>
            {fornecedores.map((f) => { const v = vinc[f]; if (!v) return null; const up = (d: Partial<Vinculo>) => setVinc({ ...vinc, [f]: { ...v, ...d } }); return (
              <div key={f} className="grid gap-2 sm:grid-cols-5">
                <div className="self-center text-sm sm:col-span-1">{f || 'Sem fornecedor'}</div>
                <select className="campo sm:col-span-2" value={v.modo === 'novo' ? 'novo' : v.processoId} onChange={(e) => (e.target.value === 'novo' ? up({ modo: 'novo', processoId: '' }) : up({ modo: 'existente', processoId: e.target.value }))}>
                  <option value="novo">Criar novo processo/ata</option>{processos.map((p) => <option key={p.id} value={p.id}>{p.numeroProcesso}{p.ano ? '/' + p.ano : ''} · {p.fornecedor || 'sem fornecedor'}</option>)}</select>
                {(v.modo === 'novo' || estrategia === 'novo-processo') && <>
                  <input className="campo" placeholder="Nº do processo *" value={v.numeroProcesso} onChange={(e) => up({ numeroProcesso: e.target.value })} />
                  <input className="campo" type="date" title="Término da vigência" value={v.vigenciaFim} onChange={(e) => up({ vigenciaFim: e.target.value })} /></>}
              </div>) })}
          </section>

          <section className="cartao space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soAlertas} onChange={(e) => { setSoAlertas(e.target.checked); setPagina(0) }} /> Mostrar só itens com alerta</label>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th>Aba/linha</th><th>Código</th><th>Nome</th><th>Un.</th><th>Ata</th><th>Aditivo</th><th>Preço</th><th>Solicit.</th><th>Fornec.</th><th /></tr></thead>
              <tbody>{pagina_.map((i) => (
                <tr key={i.id} className={`border-t border-slate-200 align-top dark:border-slate-700 ${i.alertas.length ? 'bg-amber-500/10' : ''}`}>
                  <td className="py-1">{i.pagina ? `${i.aba} p. ${i.pagina}` : `${i.aba} #${i.linha}`}</td><td>{i.codigo || 'pendente'}</td>
                  <td className="min-w-[16rem]"><input className="campo !px-1 !py-1" value={i.nome} onChange={(e) => editar(i.id, { nome: e.target.value })} title={i.descricaoOriginal} />
                    {i.alertas.map((a) => <div key={a} className="mt-0.5 flex gap-1 text-amber-600"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</div>)}
                    {i.trecho && <div className="mt-0.5 text-slate-500">“{i.trecho}”</div>}</td>
                  <td><input className="campo !px-1 !py-1 w-14" value={i.unidade} onChange={(e) => editar(i.id, { unidade: e.target.value })} /></td>
                  <td>{campoN(i, 'quantidadeAta')}</td><td>{campoN(i, 'aditivo')}</td><td>{campoN(i, 'precoUnitario')}</td><td>{campoN(i, 'quantidadeSolicitada')}</td><td>{campoN(i, 'quantidadeFornecida')}</td>
                  <td><button className="btn btn-sec !px-2 !py-1" aria-label="Excluir item" onClick={() => setItens(itens.filter((x) => x.id !== i.id))}><Trash2 size={14} /></button></td></tr>))}</tbody></table></div>
            <div className="flex items-center gap-2 text-sm"><button className="btn btn-sec !py-1" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <span>Página {pagina + 1} de {Math.max(1, Math.ceil(visiveis.length / POR_PAGINA))}</span>
              <button className="btn btn-sec !py-1" disabled={(pagina + 1) * POR_PAGINA >= visiveis.length} onClick={() => setPagina(pagina + 1)}>Próxima</button></div>
          </section>

          <section className="cartao space-y-2">
            {duplicados > 0 && <>
              <p className="flex gap-2 text-sm text-amber-600"><AlertTriangle size={16} className="shrink-0" />{duplicados} item(ns) parecem já estar cadastrados (mesmo código e fornecedor). Escolha o que fazer:</p>
              <select className="campo sm:w-1/2" value={estrategia} onChange={(e) => setEstrategia(e.target.value as Estrategia)}>{(Object.keys(rotulos) as Estrategia[]).map((k) => <option key={k} value={k}>{rotulos[k]}</option>)}</select></>}
            <div className="flex flex-wrap gap-2"><button className="btn btn-primario" disabled={salvando} onClick={confirmar}><Upload size={16} /> {estrategia === 'ignorar' ? 'Descartar importação' : 'Confirmar e cadastrar'}</button>
              <button className="btn btn-sec" onClick={() => { setItens([]); setAbas([]); setAvisos([]) }}>Cancelar importação</button></div>
          </section>
        </>
      )}
    </div>
  )
}
