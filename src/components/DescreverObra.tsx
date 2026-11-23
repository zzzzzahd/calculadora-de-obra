import { useMemo, useState } from 'react'
import { AlertTriangle, HelpCircle, Loader2, MessageSquareText, Send } from 'lucide-react'
import { aplicarIA, avisosDe, GLOSSARIO, linhasResumo, montarLevantamento, proximaPergunta, responder, sessaoVazia, termosCitados, type LevantamentoTexto, type Pergunta, type Sessao } from '../lib/descricao'
import { interpretarTexto } from '../lib/descricaoIA'

interface Props { onAplicar: (l: LevantamentoTexto) => void; sessaoInicial?: Sessao }

export default function DescreverObra({ onAplicar, sessaoInicial }: Props) {
  const [sessao, setSessao] = useState<Sessao>(sessaoInicial ?? sessaoVazia())
  const [iniciou, setIniciou] = useState(!!sessaoInicial)
  const [texto, setTexto] = useState('')
  const [adicional, setAdicional] = useState('')
  const [resp, setResp] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [historico, setHistorico] = useState<[string, string][]>([])
  const [termos, setTermos] = useState<{ termo: string; explicacao: string }[]>([])
  const pergunta: Pergunta | null = useMemo(() => (iniciou ? proximaPergunta(sessao) : null), [sessao, iniciou])
  const resumo = useMemo(() => linhasResumo(sessao), [sessao])
  const avisos = useMemo(() => avisosDe(sessao), [sessao])
  const abertos = useMemo(() => montarLevantamento(sessao).usouPadrao, [sessao])

  const descrever = async (t: string, inicial: boolean) => {
    if (!t.trim()) return
    setCarregando(true); setErro('')
    try {
      const e = await interpretarTexto(t, { ambientes: sessao.ambientes })
      const r = aplicarIA(sessao, e, null)
      if (!r.entendeu) { setErro('Não consegui identificar dados nesse texto. Cite ambientes, medidas ou materiais (ex.: duas salas de 7 por 7 metros).'); return }
      setSessao(r.sessao); setIniciou(true)
      setTermos((x) => [...x, ...termosCitados(t).filter((n) => !x.some((y) => y.termo === n.termo))])
      setHistorico((h) => [...h, [inicial ? 'Descrição da obra' : 'Detalhes acrescentados', t]])
      inicial ? setTexto('') : setAdicional('')
    } catch (e) { setErro((e as Error).message) } finally { setCarregando(false) }
  }

  const enviar = async (valor?: string) => {
    if (!pergunta) return
    const t = (valor ?? resp).trim()
    setErro('')
    const r = responder(sessao, pergunta, t)
    if (r.erro) { setErro(r.erro); return }
    let novo = r.sessao
    if (r.precisaIA) {
      setCarregando(true)
      try {
        const x = aplicarIA(sessao, await interpretarTexto(t, { pergunta: pergunta.texto, ambientes: sessao.ambientes }), pergunta.id)
        if (!x.entendeu) { setErro('Não consegui identificar a informação. Escreva de outro jeito ou responda "não sei".'); return }
        novo = x.sessao
      } catch (e) { setErro((e as Error).message); return } finally { setCarregando(false) }
    }
    setSessao(novo); setHistorico((h) => [...h, [pergunta.texto, t]]); setResp('')
  }

  const botoes = pergunta && (pergunta.tipo === 'sim_nao' || pergunta.tipo === 'escolha' || pergunta.tipo === 'contradicao')
  const opcoes = pergunta?.tipo === 'sim_nao' ? [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'não', rotulo: 'Não' }] : pergunta?.opcoes ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {!iniciou ? (
          <section className="cartao">
            <h2 className="mb-1 flex items-center gap-2 font-semibold"><MessageSquareText size={18} className="text-amber-600" /> Descreva a obra com suas palavras</h2>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Conte o que vai ser feito, do seu jeito. Eu entendo o que você disse e pergunto só o que faltar, uma pergunta por vez.</p>
            <label className="rotulo" htmlFor="descricao">Descrição da obra</label>
            <textarea id="descricao" className="campo min-h-32" maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: duas salas de 7 m por 7 m, pé-direito 3 m, tijolo cerâmico, contrapiso, piso, cobertura de fibrocimento, portas e janelas e instalação elétrica" />
            <button className="btn btn-primario mt-3" disabled={!texto.trim() || carregando} onClick={() => descrever(texto, true)}>
              {carregando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Entender descrição
            </button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">O texto é enviado a um serviço de IA externo só para esta interpretação e não é armazenado. Pode gerar custo na conta da API. Não invento medidas: o que você não disser será perguntado ou ficará em branco.</p>
          </section>
        ) : (
          <section className="cartao" aria-live="polite">
            {sessao.duvidas.length > 0 && <p className="mb-2 text-xs text-slate-500">Dúvidas que o texto deixou: {sessao.duvidas.join(' · ')}</p>}
            {pergunta ? (
              <>
                <h2 className="mb-1 font-semibold">{pergunta.texto}</h2>
                {pergunta.explicacao && <p className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800"><HelpCircle size={16} className="mt-0.5 shrink-0 text-amber-600" /> <span>{pergunta.explicacao}</span></p>}
                {botoes ? (
                  <div className="flex flex-wrap gap-2">
                    {opcoes.map((o, i) => <button key={o.valor + i} className="btn btn-sec" disabled={carregando} onClick={() => enviar(pergunta.tipo === 'sim_nao' ? o.valor : String(i + 1))}>{o.rotulo}</button>)}
                  </div>
                ) : null}
                {(!botoes || pergunta.aceitaNumero) && (
                  <div className="mt-2">
                    <label className="rotulo" htmlFor="resposta">{pergunta.aceitaNumero ? 'Ou digite o tamanho em cm' : 'Sua resposta'}</label>
                    {pergunta.tipo === 'texto'
                      ? <textarea id="resposta" className="campo min-h-20" maxLength={1000} value={resp} onChange={(e) => setResp(e.target.value)} />
                      : <input id="resposta" className="campo" value={resp} onChange={(e) => setResp(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} />}
                    {pergunta.exemplo && <p className="mt-1 text-xs text-slate-500">Exemplo: {pergunta.exemplo}</p>}
                    <button className="btn btn-primario mt-2" disabled={!resp.trim() || carregando} onClick={() => enviar()}>
                      {carregando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Responder
                    </button>
                  </div>
                )}
                {pergunta.tipo !== 'contradicao' && <button className="btn btn-sec ml-2 mt-2" disabled={carregando} onClick={() => enviar('não sei')}>Não sei</button>}
                {erro && <p className="mt-2 text-sm text-red-600" role="alert">{erro}</p>}
              </>
            ) : (
              <>
                <h2 className="mb-1 font-semibold">Tenho o que preciso</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Confira o resumo ao lado e aplique ao levantamento. Você poderá editar tudo lá antes de calcular.</p>
              </>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-500">Acrescentar mais detalhes</summary>
              <textarea className="campo mt-2 min-h-20" aria-label="Mais detalhes" maxLength={4000} value={adicional} onChange={(e) => setAdicional(e.target.value)} placeholder="Ex.: o banheiro terá 2 por 3 metros e piso de porcelanato" />
              <button className="btn btn-sec mt-2" disabled={!adicional.trim() || carregando} onClick={() => descrever(adicional, false)}>Acrescentar</button>
              {!pergunta && erro && <p className="mt-2 text-sm text-red-600" role="alert">{erro}</p>}
            </details>
          </section>
        )}

        {termos.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Termos que você usou</h2>
            <dl className="space-y-1 text-sm">{termos.map((t) => <div key={t.termo}><dt className="inline font-medium">{t.termo}: </dt><dd className="inline">{GLOSSARIO[t.termo]}</dd></div>)}</dl>
          </section>
        )}
        {historico.length > 0 && (
          <details className="cartao">
            <summary className="cursor-pointer text-sm font-medium">Conversa até aqui ({historico.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">{historico.map(([q, r], i) => <li key={i}><span className="text-slate-500">{q}</span> → {r}</li>)}</ul>
          </details>
        )}
      </div>

      <aside className="cartao h-fit">
        <h2 className="mb-3 font-semibold">O que entendi</h2>
        {resumo.length === 0 ? <p className="text-sm text-slate-500">Ainda nada. Descreva a obra ao lado.</p> : <ul className="list-disc space-y-1 pl-4 text-sm">{resumo.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        {avisos.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg border border-amber-500 p-2 text-xs" role="alert">
            {avisos.map((t, i) => <li key={i} className="flex gap-1"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" /> {t}</li>)}
          </ul>
        )}
        {iniciou && abertos.length > 0 && (
          <details className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            <summary className="cursor-pointer font-medium">Em aberto ({abertos.length})</summary>
            <ul className="mt-1 list-disc space-y-1 pl-4">{abertos.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </details>
        )}
        <button className="btn btn-primario mt-4 w-full" disabled={sessao.ambientes.length === 0 || sessao.contradicoes.length > 0} onClick={() => onAplicar(montarLevantamento(sessao))}>
          Aplicar ao levantamento
        </button>
        {sessao.contradicoes.length > 0 && <p className="mt-1 text-xs text-slate-500">Resolva a pergunta de conflito antes de aplicar.</p>}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Levantamento preliminar; não substitui profissional habilitado. Tudo pode ser editado depois.</p>
      </aside>
    </div>
  )
}
