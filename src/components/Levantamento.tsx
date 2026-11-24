import { useMemo } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { ACOES, LADOS, PISOS, PONTOS_HIDRO, REVESTIMENTOS, TIPOS_AMBIENTE } from '../types'
import type { Abertura, Acao, Acoes, Ambiente, LadoIdx, Obra, PisoTipo, PontoHidro, RevParede, TipoAmbiente } from '../types'
import { areaAmbiente, perimetroAmbiente } from '../lib/geometry'
import { toMetros } from '../lib/units'
import { definirDivisa, limpar, novoAmbiente, removerAmbiente } from '../lib/cadastro'
import { resolverLevantamento } from '../lib/paredes'
import { totaisHidro } from '../lib/hidraulica'
import Medida from './Medida'
import { uid } from '../lib/uid'

interface Props {
  obra: Obra; ambientes: Ambiente[]
  setObra: (o: Obra) => void; setAmbientes: (a: Ambiente[]) => void
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ELEMENTOS_ACAO: [keyof Acoes, string][] = [['paredes', 'Paredes (alvenaria)'], ['revestimento', 'Revestimento e pintura das paredes'], ['piso', 'Contrapiso e piso'], ['forro', 'Forro']]
const OpcoesAcao = () => <>{Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</>
const ORIGEM: Record<string, string> = { manual: 'digitado', planta: 'lido da planta', texto: 'descrito em texto', importado: 'importado' }

export default function Levantamento({ obra, ambientes, setObra, setAmbientes }: Props) {
  const alturaM = toMetros(obra.alturaParede, obra.unidadeAltura)
  const set = <K extends keyof Obra>(k: K, v: Obra[K]) => setObra({ ...obra, [k]: v })
  const upd = (id: string, p: Partial<Ambiente>) => setAmbientes(ambientes.map((a) => (a.id === id ? limpar({ ...a, ...p }) : a)))
  const lev = useMemo(() => resolverLevantamento(obra, ambientes, []), [obra, ambientes])
  const hid = useMemo(() => totaisHidro(ambientes, { hidPontosAgua: 0, sanPontos: 0 }), [ambientes])
  const updAb = (a: Ambiente, abId: string, d: Partial<Abertura>) => upd(a.id, { aberturas: (a.aberturas ?? []).map((x) => (x.id === abId ? { ...x, ...d } : x)) })
  const updPonto = (a: Ambiente, t: PontoHidro, v: number) => upd(a.id, { pontos: { ...a.pontos, [t]: v > 0 ? Math.min(99, Math.floor(v)) : undefined } })
  const updAcoes = (a: Ambiente, k: keyof Acoes, v: string) => upd(a.id, { acoes: { ...a.acoes, [k]: v === 'construir' ? undefined : (v as Acao) } })
  const updAc = (a: Ambiente, d: Partial<NonNullable<Ambiente['acabamento']>>) => upd(a.id, { acabamento: { ...a.acabamento, ...d } })

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
            <Medida rotulo="Altura das paredes (padrão dos ambientes)" valor={obra.alturaParede} unidade={obra.unidadeAltura}
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
            {ambientes.map((a) => {
              const outros = ambientes.filter((x) => x.id !== a.id)
              const r = lev.ambientes.find((x) => x.id === a.id)
              const nDet = (a.aberturas?.length ?? 0) + Object.keys(a.divisas ?? {}).length + Object.keys(a.acoes ?? {}).length + Object.values(a.pontos ?? {}).filter(Boolean).length
              return (
                <div key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                    <div><label className="rotulo">Nome</label>
                      <input className="campo" value={a.nome} onChange={(e) => upd(a.id, { nome: e.target.value })} /></div>
                    <Medida rotulo="Comprimento" valor={a.comprimento} unidade={a.unidade} onValor={(v) => upd(a.id, { comprimento: v })} onUnidade={(u) => upd(a.id, { unidade: u })} />
                    <div><label className="rotulo">Largura ({a.unidade})</label>
                      <input className="campo" type="number" min={0} step="any" value={a.largura || ''} onChange={(e) => upd(a.id, { largura: parseFloat(e.target.value) || 0 })} /></div>
                    <button className="btn btn-sec self-end" aria-label="Remover ambiente" onClick={() => setAmbientes(removerAmbiente(ambientes, a.id))}><Trash2 size={16} /></button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Área {fmt(areaAmbiente(a))} m² · Perímetro {fmt(perimetroAmbiente(a))} m
                    {r && <> · Pé-direito {fmt(r.altura)} m</>}
                    {a.origem && a.origem.fonte !== 'manual' && <> · Origem: {ORIGEM[a.origem.fonte]}{a.origem.confianca !== undefined && ` (confiança ${Math.round(a.origem.confianca * 100)}%)`}{a.origem.observacao ? ` — ${a.origem.observacao}` : ''}</>}
                  </p>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-500">
                      Detalhes do ambiente: tipo, pé-direito, paredes, portas e janelas, pontos hidráulicos, acabamentos, ações (construir, manter, demolir…){nDet > 0 && ` (${nDet})`}
                    </summary>
                    <div className="mt-3 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="rotulo">Tipo do ambiente</label>
                          <select className="campo" value={a.tipo ?? ''} onChange={(e) => upd(a.id, { tipo: (e.target.value || undefined) as TipoAmbiente | undefined })}>
                            <option value="">Não informado</option>
                            {Object.entries(TIPOS_AMBIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select></div>
                        <div><label className="rotulo">Pé-direito ({a.unidade}) — vazio = {fmt(alturaM)} m da obra</label>
                          <input className="campo" type="number" min={0} step="any" value={a.peDireito ?? ''} placeholder={String(Number((alturaM / toMetros(1, a.unidade)).toFixed(3)))}
                            onChange={(e) => upd(a.id, { peDireito: parseFloat(e.target.value) || undefined })} /></div>
                      </div>

                      <div>
                        <h3 className="mb-1 text-sm font-semibold">Paredes (cada lado: externa ou compartilhada com outro ambiente)</h3>
                        <div className="space-y-2">
                          {LADOS.map((l) => {
                            const dv = a.divisas?.[l.idx]
                            return (
                              <div key={l.idx} className="grid gap-2 sm:grid-cols-[10rem_1fr_9rem_1fr]">
                                <span className="self-center text-sm">{l.rotulo}</span>
                                <select className="campo" aria-label={`${l.rotulo} de ${a.nome}`} value={dv?.com ?? ''} disabled={outros.length === 0 && !dv}
                                  onChange={(e) => setAmbientes(definirDivisa(ambientes, a.id, l.idx as LadoIdx, e.target.value || null, dv?.trecho, dv?.acao))}>
                                  <option value="">Parede externa</option>
                                  {outros.map((o) => <option key={o.id} value={o.id}>Compartilhada com {o.nome}</option>)}
                                </select>
                                {dv && <input className="campo" type="number" min={0} step="any" placeholder="trecho (m)" title="Comprimento compartilhado em metros; vazio = o lado inteiro" value={dv.trecho ?? ''}
                                  onChange={(e) => setAmbientes(definirDivisa(ambientes, a.id, l.idx as LadoIdx, dv.com, parseFloat(e.target.value) || undefined, dv.acao))} />}
                                {dv && <select className="campo" aria-label={`Ação da parede compartilhada, ${l.rotulo} de ${a.nome}`} title="O que será feito com a parede compartilhada" value={dv.acao ?? ''}
                                  onChange={(e) => setAmbientes(definirDivisa(ambientes, a.id, l.idx as LadoIdx, dv.com, dv.trecho, (e.target.value || undefined) as Acao | undefined))}>
                                  <option value="">Ação: a dos ambientes</option><OpcoesAcao />
                                </select>}
                              </div>
                            )
                          })}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ao marcar a divisa, o lado oposto do outro ambiente é marcado também (você pode ajustar). A parede compartilhada entra uma vez na alvenaria.</p>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <h3 className="text-sm font-semibold">Portas e janelas deste ambiente</h3>
                          <button className="btn btn-sec !py-1" onClick={() => upd(a.id, { aberturas: [...(a.aberturas ?? []), { id: uid(), tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 1 }] })}><Plus size={14} /> Adicionar</button>
                        </div>
                        {(a.aberturas ?? []).map((x) => (
                          <div key={x.id} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-7">
                            <select className="campo" aria-label="Tipo" value={x.tipo} onChange={(e) => updAb(a, x.id, { tipo: e.target.value as Abertura['tipo'] })}><option>Porta</option><option>Janela</option></select>
                            <input className="campo" type="number" step="any" min={0} value={x.largura} onChange={(e) => updAb(a, x.id, { largura: parseFloat(e.target.value) || 0 })} title="Largura (m)" />
                            <input className="campo" type="number" step="any" min={0} value={x.altura} onChange={(e) => updAb(a, x.id, { altura: parseFloat(e.target.value) || 0 })} title="Altura (m)" />
                            <input className="campo" type="number" min={1} value={x.qtd} onChange={(e) => updAb(a, x.id, { qtd: parseInt(e.target.value) || 1 })} title="Quantidade" />
                            <select className="campo" aria-label="Lado" value={x.lado ?? ''} onChange={(e) => updAb(a, x.id, { lado: e.target.value === '' ? undefined : (Number(e.target.value) as LadoIdx) })}>
                              <option value="">Lado não informado</option>
                              {LADOS.map((l) => <option key={l.idx} value={l.idx}>{l.rotulo}</option>)}
                            </select>
                            <select className="campo" aria-label="Ação da abertura" value={x.acao ?? 'construir'} onChange={(e) => updAb(a, x.id, { acao: e.target.value === 'construir' ? undefined : (e.target.value as Acao) })}><OpcoesAcao /></select>
                            <button className="btn btn-sec" aria-label="Remover abertura" onClick={() => upd(a.id, { aberturas: (a.aberturas ?? []).filter((y) => y.id !== x.id) })}><Trash2 size={16} /></button>
                          </div>
                        ))}
                        <p className="text-xs text-slate-500 dark:text-slate-400">Colunas: tipo · largura (m) · altura (m) · quantidade · lado · ação. Abertura em parede compartilhada: cadastre em apenas um dos dois ambientes (ela desconta dos dois). Sem lado = parede externa.</p>
                      </div>

                      <div>
                        <h3 className="mb-1 text-sm font-semibold">Pontos hidráulicos deste ambiente</h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {(Object.keys(PONTOS_HIDRO) as PontoHidro[]).map((t) => (
                            <div key={t}><label className="rotulo" htmlFor={`${a.id}-${t}`}>{PONTOS_HIDRO[t].rotulo}</label>
                              <input id={`${a.id}-${t}`} className="campo" type="number" min={0} max={99} step={1} value={a.pontos?.[t] ?? ''} onChange={(e) => updPonto(a, t, parseInt(e.target.value) || 0)} /></div>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Informe só a contagem. Cada peça conta como ponto de água, de esgoto ou dos dois (vaso, lavatório, pia, tanque e máquina de lavar: água e esgoto; chuveiro e torneira: só água; ralo e caixa sifonada: só esgoto). Tubos e conexões são estimados por composições com os seus coeficientes (Parâmetros → composições próprias, base "Pontos de água fria" ou "Pontos de esgoto").</p>
                      </div>

                      <div>
                        <h3 className="mb-1 text-sm font-semibold">O que será feito neste ambiente</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {ELEMENTOS_ACAO.map(([k, rot]) => (
                            <div key={k}><label className="rotulo">{rot}</label>
                              <select className="campo" value={a.acoes?.[k] ?? 'construir'} onChange={(e) => updAcoes(a, k, e.target.value)}><OpcoesAcao /></select></div>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Só construir e substituir calculam material novo. Demolir e substituir geram demolição e entulho (informe as espessuras em Parâmetros → Demolição e entulho). Recuperar e reaproveitar aparecem na lista, sem material novo.</p>
                      </div>

                      <div>
                        <h3 className="mb-1 text-sm font-semibold">Acabamentos</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div><label className="rotulo">Piso</label>
                            <select className="campo" value={a.acabamento?.piso ?? ''} onChange={(e) => updAc(a, { piso: (e.target.value || undefined) as PisoTipo | undefined })}>
                              <option value="">Padrão do levantamento</option>
                              {Object.entries(PISOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select></div>
                          <div><label className="rotulo">Paredes internas</label>
                            <select className="campo" value={a.acabamento?.revParede ?? ''} onChange={(e) => updAc(a, { revParede: (e.target.value || undefined) as RevParede | undefined })}>
                              <option value="">Padrão (chapisco, emboço e pintura)</option>
                              {Object.entries(REVESTIMENTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select></div>
                          <div><label className="rotulo">Forro</label>
                            <select className="campo" value={a.acabamento?.forro === undefined ? '' : a.acabamento.forro ? 'sim' : 'nao'}
                              onChange={(e) => updAc(a, { forro: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
                              <option value="">Segue a opção geral</option><option value="sim">Com forro</option><option value="nao">Sem forro</option>
                            </select></div>
                          {a.acabamento?.revParede === 'ceramica' && (
                            <div><label className="rotulo">Altura da cerâmica ({a.unidade})</label>
                              <input className="campo" type="number" min={0} step="any" value={a.acabamento.alturaCeramica ?? ''} onChange={(e) => updAc(a, { alturaCeramica: parseFloat(e.target.value) || undefined })} /></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )
            })}
            {ambientes.length === 0 && <p className="text-sm text-slate-500">Nenhum ambiente cadastrado.</p>}
          </div>
        </section>
      </div>

      <aside className="cartao h-fit">
        <h2 className="mb-3 font-semibold">Resumo geométrico</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Área construída (1 pav.)</dt><dd>{fmt(lev.area1)} m²</dd></div>
          <div className="flex justify-between"><dt>Área total ({obra.pavimentos} pav.)</dt><dd>{fmt(lev.area1 * obra.pavimentos)} m²</dd></div>
          <div className="flex justify-between"><dt>Parede bruta (sem aberturas)</dt><dd>{fmt(lev.alvBruta)} m²</dd></div>
          {lev.compartilhadaM > 0 && <>
            <div className="flex justify-between"><dt>Parede externa</dt><dd>{fmt(lev.externaM)} m</dd></div>
            <div className="flex justify-between"><dt>Parede compartilhada (contada uma vez)</dt><dd>{fmt(lev.compartilhadaM)} m</dd></div>
          </>}
          {lev.areaAberturas > 0 && <div className="flex justify-between"><dt>Aberturas dos ambientes</dt><dd>{fmt(lev.areaAberturas)} m²</dd></div>}
          {(hid.aguaAmbientes > 0 || hid.esgotoAmbientes > 0) && <div className="flex justify-between"><dt>Pontos de água / esgoto (ambientes)</dt><dd>{hid.aguaAmbientes} / {hid.esgotoAmbientes}</dd></div>}
          {lev.alvConstruirBruta < lev.alvBruta - 1e-9 && <div className="flex justify-between"><dt>Parede a construir</dt><dd>{fmt(lev.alvConstruirBruta)} m²</dd></div>}
          {lev.demolir.paredes > 0 && <div className="flex justify-between"><dt>Parede a demolir</dt><dd>{fmt(lev.demolir.paredes)} m²</dd></div>}
          {(lev.demolir.piso > 0 || lev.demolir.revestimento > 0 || lev.demolir.forro > 0) && <div className="flex justify-between"><dt>Piso / revestimento / forro a demolir</dt><dd>{fmt(lev.demolir.piso)} / {fmt(lev.demolir.revestimento)} / {fmt(lev.demolir.forro)} m²</dd></div>}
        </dl>
        {lev.avisos.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg border border-amber-500 p-2 text-xs" role="alert">
            {lev.avisos.map((t, i) => <li key={i} className="flex gap-1"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" /> {t}</li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Quantitativo geométrico preliminar; as dimensões dos ambientes são internas (a espessura das paredes não entra). Descontos de portas e janelas entram na etapa de alvenaria.</p>
      </aside>
    </div>
  )
}
