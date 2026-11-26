import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Upload } from 'lucide-react'
import type { Abertura, Ambiente, Obra } from '../types'
import { analisarBackup, montarBackup, PARTES, type Analise, type BackupArquivo, type Levantamento, type Parte } from '../lib/backup'
import { carregarParams, salvarParams } from '../lib/config'
import type { Params } from '../lib/params'
import { lerLicitacoes, restaurarLicitacoes } from '../licitacoes/backupDb'

interface Props {
  versao: string
  obra: Obra; ambientes: Ambiente[]; aberturas: Abertura[]; iniciado: boolean
  onRestaurar: (r: { configuracoes?: Params; levantamento?: Levantamento }) => void
}

const ROTULO: Record<Parte, string> = { configuracoes: 'Configurações e biblioteca técnica', levantamento: 'Levantamento (dados da obra e ambientes)', licitacoes: 'Licitações (processos, materiais, movimentações e ligações)' }
const n = (x: number) => x.toLocaleString('pt-BR')

function baixar(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const nomeArquivo = () => `calculadora-obra-backup-${new Date().toISOString().slice(0, 10)}.json`

export default function Backup({ versao, obra, ambientes, aberturas, iniciado, onRestaurar }: Props) {
  const temLevantamento = iniciado && ambientes.length > 0
  const [escolha, setEscolha] = useState<Record<Parte, boolean>>({ configuracoes: true, levantamento: temLevantamento, licitacoes: true })
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [analise, setAnalise] = useState<Analise | null>(null)
  const [nomeLido, setNomeLido] = useState('')
  const [restaurar, setRestaurar] = useState<Record<Parte, boolean>>({ configuracoes: false, levantamento: false, licitacoes: false })
  const [entendi, setEntendi] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const montarAtual = async (partes: Record<Parte, boolean>): Promise<BackupArquivo> => {
    const p: Parameters<typeof montarBackup>[1] = {}
    if (partes.configuracoes) p.configuracoes = carregarParams()
    if (partes.levantamento && temLevantamento) p.levantamento = { obra, ambientes, aberturas }
    if (partes.licitacoes) p.licitacoes = await lerLicitacoes()
    return montarBackup(versao, p)
  }
  const fazerBackup = async (partes: Record<Parte, boolean>, aviso: string) => {
    if (!PARTES.some((x) => partes[x])) { setMsg({ tipo: 'erro', texto: 'Marque pelo menos uma parte.' }); return }
    setOcupado(true); setMsg(null)
    try { baixar(nomeArquivo(), JSON.stringify(await montarAtual(partes), null, 1)); setMsg({ tipo: 'ok', texto: aviso }) }
    catch { setMsg({ tipo: 'erro', texto: 'Não foi possível ler os dados deste navegador para o backup (armazenamento local indisponível). Nada foi baixado.' }) }
    finally { setOcupado(false) }
  }

  const abrir = async (f: File | undefined) => {
    setAnalise(null); setMsg(null); setEntendi(false)
    if (!f) return
    setNomeLido(f.name)
    try {
      const a = analisarBackup(await f.text())
      setAnalise(a)
      setRestaurar({ configuracoes: !!a.dados?.configuracoes, levantamento: !!a.dados?.levantamento, licitacoes: !!a.dados?.licitacoes })
    } catch { setMsg({ tipo: 'erro', texto: 'Não foi possível ler o arquivo.' }) }
  }

  const aplicar = async () => {
    const d = analise?.dados
    if (!d) return
    setOcupado(true); setMsg(null)
    const feitas: string[] = []
    try {
      if (restaurar.licitacoes && d.licitacoes) { await restaurarLicitacoes(d.licitacoes); feitas.push('licitações') }
      if (restaurar.configuracoes && d.configuracoes) {
        if (!salvarParams(d.configuracoes)) throw new Error('config')
        feitas.push('configurações e biblioteca')
      }
      if (restaurar.levantamento && d.levantamento) feitas.push('levantamento')
      onRestaurar({ ...(restaurar.configuracoes && d.configuracoes ? { configuracoes: d.configuracoes } : {}), ...(restaurar.levantamento && d.levantamento ? { levantamento: d.levantamento } : {}) })
      setMsg({ tipo: 'ok', texto: `Restaurado: ${feitas.join(', ')}.` }); setAnalise(null); setEntendi(false)
    } catch (e) {
      const parcial = feitas.length ? ` Já restaurado antes da falha: ${feitas.join(', ')}.` : ' Nada foi alterado.'
      setMsg({ tipo: 'erro', texto: (e as Error).message === 'config' ? `Não foi possível gravar as configurações neste navegador (armazenamento cheio ou bloqueado).${parcial}` : `A restauração das licitações falhou e foi desfeita.${parcial}` })
    } finally { setOcupado(false) }
  }

  const pode = !!analise?.ok && PARTES.some((p) => restaurar[p]) && entendi && !ocupado
  return (
    <div className="space-y-4">
      <section className="cartao" aria-label="Fazer backup">
        <h2 className="mb-1 font-semibold">Fazer backup</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Gera um arquivo JSON com o que você escolher, para guardar fora do navegador. Os dados deste programa ficam só neste navegador: limpar os dados do site apaga tudo.</p>
        <div className="space-y-1">
          {PARTES.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={escolha[p]} disabled={p === 'levantamento' && !temLevantamento} onChange={(e) => setEscolha({ ...escolha, [p]: e.target.checked })} /> {ROTULO[p]}{p === 'levantamento' && !temLevantamento && <span className="text-xs text-slate-500"> (ainda não há levantamento)</span>}</label>
          ))}
        </div>
        <button className="btn btn-primario mt-3" disabled={ocupado} onClick={() => fazerBackup(escolha, 'Backup baixado. Guarde o arquivo em local seguro.')}><Download size={16} /> Baixar backup</button>
      </section>

      <section className="cartao" aria-label="Restaurar backup">
        <h2 className="mb-1 font-semibold">Restaurar backup</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Escolha um arquivo de backup. Primeiro mostro o que ele contém e o que seria substituído; nada é alterado antes da sua confirmação.</p>
        <input className="campo" type="file" accept="application/json,.json" aria-label="Arquivo de backup" onChange={(e) => abrir(e.target.files?.[0])} />
        {analise && !analise.ok && (
          <ul className="mt-3 space-y-1 text-sm text-red-600" role="alert">{analise.erros.map((t, i) => <li key={i} className="flex gap-1"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t}</li>)}</ul>
        )}
        {analise?.ok && (
          <div className="mt-3 space-y-3">
            <p className="text-sm">Arquivo <strong>{nomeLido}</strong>{analise.versaoApp && <> · gerado na versão {analise.versaoApp}</>}{analise.geradoEm && <> em {new Date(analise.geradoEm).toLocaleString('pt-BR')}</>}</p>
            <div className="space-y-2">
              {analise.resumo.configuracoes && (
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restaurar.configuracoes} onChange={(e) => setRestaurar({ ...restaurar, configuracoes: e.target.checked })} />
                  <span><strong>{ROTULO.configuracoes}</strong>: {n(analise.resumo.configuracoes.composicoes)} composição(ões), {n(analise.resumo.configuracoes.conexoes)} conexão(ões) hidráulica(s), {n(analise.resumo.configuracoes.itensEletricos)} item(ns) elétrico(s). <em>Substitui todos os parâmetros atuais.</em></span></label>
              )}
              {analise.resumo.levantamento && (
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restaurar.levantamento} onChange={(e) => setRestaurar({ ...restaurar, levantamento: e.target.checked })} />
                  <span><strong>{ROTULO.levantamento}</strong>: obra "{analise.resumo.levantamento.nomeObra || 'sem nome'}", {n(analise.resumo.levantamento.ambientes)} ambiente(s), {n(analise.resumo.levantamento.aberturas)} porta(s)/janela(s). <em>Substitui o levantamento atual{temLevantamento ? ` (${n(ambientes.length)} ambiente(s))` : ''}.</em></span></label>
              )}
              {analise.resumo.licitacoes && (
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={restaurar.licitacoes} onChange={(e) => setRestaurar({ ...restaurar, licitacoes: e.target.checked })} />
                  <span><strong>{ROTULO.licitacoes}</strong>: {n(analise.resumo.licitacoes.processos)} processo(s), {n(analise.resumo.licitacoes.materiais)} material(is), {n(analise.resumo.licitacoes.movimentos)} movimentação(ões), {n(analise.resumo.licitacoes.ligacoes)} ligação(ões). <em>Substitui TODAS as licitações atuais, de uma vez (ou nada muda se falhar).</em></span></label>
              )}
            </div>
            {analise.avisos.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-500 p-2 text-xs" role="note">{analise.avisos.map((t, i) => <li key={i} className="flex gap-1"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" /> {t}</li>)}</ul>
            )}
            <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <p className="mb-2 text-sm">Antes de restaurar, guarde uma cópia do que existe hoje (recomendado):</p>
              <button className="btn btn-sec" disabled={ocupado} onClick={() => fazerBackup({ configuracoes: restaurar.configuracoes, levantamento: restaurar.levantamento, licitacoes: restaurar.licitacoes }, 'Cópia do estado atual baixada.')}><Download size={16} /> Baixar cópia do estado atual</button>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} /> Entendi que a restauração substitui os dados atuais das partes marcadas</label>
            </div>
            <button className="btn btn-primario" disabled={!pode} onClick={aplicar}><Upload size={16} /> Restaurar partes marcadas</button>
          </div>
        )}
      </section>
      {msg && <p className={`flex items-center gap-2 text-sm ${msg.tipo === 'ok' ? 'text-green-700 dark:text-green-500' : 'text-red-600'}`} role={msg.tipo === 'erro' ? 'alert' : 'status'}>{msg.tipo === 'ok' && <CheckCircle2 size={16} />}{msg.texto}</p>}
    </div>
  )
}
