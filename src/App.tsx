import { lazy, Suspense, useState } from 'react'
import { ArrowLeft, FileUp, HardHat, Landmark, MessageSquareText, Moon, PencilRuler, RotateCcw, Sun, X } from 'lucide-react'
import type { Ambiente, Obra } from './types'
import type { Abertura } from './lib/engine'
import { useTema } from './lib/useTema'
import Levantamento from './components/Levantamento'
import Quantitativos, { type Ajustes } from './components/Quantitativos'
import LeitorPlanta from './components/LeitorPlanta'
import DescreverObra from './components/DescreverObra'
import type { LevantamentoTexto } from './lib/descricao'
const Licitacoes = lazy(() => import('./licitacoes/Licitacoes')) // módulo pesado (planilhas e PDF): carrega só quando aberto
import { novoAmbiente } from './lib/cadastro'

const VERSAO = 'v28'
const obraVazia = (): Obra => ({ nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' })

export default function App() {
  const { escuro, alternar } = useTema()
  const [modo, setModo] = useState<null | 'manual' | 'planta' | 'texto' | 'licitacoes'>(null)
  const [obra, setObra] = useState<Obra>(obraVazia)
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [aberturas, setAberturas] = useState<Abertura[]>([])
  const [chave, setChave] = useState(0)
  const [ajustes, setAjustes] = useState<Ajustes | undefined>(undefined) // parâmetros e respostas vindos do assistente de texto
  const [notas, setNotas] = useState<string[]>([]) // o que o assistente deixou em aberto
  const [iniciado, setIniciado] = useState(false) // levantamento já começado (permanece ao voltar ao menu)

  const novo = () => { setModo(null); setObra(obraVazia()); setAmbientes([]); setAberturas([]); setAjustes(undefined); setNotas([]); setIniciado(false); setChave((c) => c + 1) }
  const aplicarTexto = (l: LevantamentoTexto) => {
    if (iniciado && ambientes.some((a) => a.comprimento > 0 || a.largura > 0) && !confirm('Isto substitui os ambientes e dados do levantamento atual. Continuar?')) return
    setObra({ ...obraVazia(), ...l.obra }); setAmbientes(l.ambientes); setAberturas(l.aberturasGerais)
    setAjustes({ params: l.params, flags: l.flags }); setNotas(l.usouPadrao); setChave((c) => c + 1)
    setIniciado(true); setModo('manual')
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold"><HardHat className="text-amber-600" /> Calculadora de Obras</div>
        <div className="flex gap-2">
          {modo && <button className="btn btn-sec" onClick={() => setModo(null)}><ArrowLeft size={16} /> Menu</button>}
          {modo && modo !== 'licitacoes' && <button className="btn btn-sec" onClick={novo}><RotateCcw size={16} /> Novo levantamento</button>}
          <button className="btn btn-sec" onClick={alternar} aria-label="Alternar tema">{escuro ? <Sun size={16} /> : <Moon size={16} />}{escuro ? 'Claro' : 'Escuro'}</button>
        </div>
      </header>

      {!modo && (
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          <button className="cartao text-left hover:border-amber-500" onClick={() => { setModo('manual'); setIniciado(true); if (ambientes.length === 0) setAmbientes([novoAmbiente(1)]) }}>
            <PencilRuler className="mb-2 text-amber-600" /><div className="font-semibold">{iniciado ? 'Continuar levantamento' : 'Inserir dimensões'}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Informe comprimento, largura e demais dados manualmente.</p>
          </button>
          <button className="cartao text-left hover:border-amber-500" onClick={() => setModo('planta')}>
            <FileUp className="mb-2 text-amber-600" /><div className="font-semibold">Importar planta ou croqui</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">A IA lê as medidas e você confere antes de calcular.</p>
          </button>
          <button className="cartao text-left hover:border-amber-500 sm:col-span-2" onClick={() => setModo('texto')}>
            <MessageSquareText className="mb-2 text-amber-600" /><div className="font-semibold">Descrever a obra com palavras</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Conte o que vai ser feito; a IA entende e eu pergunto só o que faltar, uma pergunta por vez.</p>
          </button>
          <button className="cartao text-left hover:border-amber-500 sm:col-span-2" onClick={() => setModo('licitacoes')}>
            <Landmark className="mb-2 text-amber-600" /><div className="font-semibold">Materiais licitados</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Cadastre atas, contratos e materiais da Prefeitura e acompanhe os saldos. Não precisa iniciar uma obra.</p>
          </button>
        </div>
      )}

      {modo === 'licitacoes' && <Suspense fallback={<p className="text-sm">Carregando módulo…</p>}><Licitacoes /></Suspense>}

      {modo === 'planta' && (
        <LeitorPlanta onConfirmar={(c) => {
          setAmbientes(c.ambientes); setAberturas(c.aberturas)
          if (c.altura) setObra({ ...obra, alturaParede: c.altura, unidadeAltura: 'm' })
          setIniciado(true); setModo('manual')
        }} />
      )}

      {modo === 'texto' && <DescreverObra onAplicar={aplicarTexto} />}

      {iniciado && (
        <div className={modo === 'manual' ? '' : 'hidden'}>
          {notas.length > 0 && (
            <section className="cartao mb-4 border-amber-500" role="note">
              <div className="mb-1 flex items-center justify-between"><h2 className="font-semibold">O que ficou em aberto na sua descrição</h2>
                <button className="btn btn-sec !py-1" aria-label="Fechar aviso" onClick={() => setNotas([])}><X size={14} /></button></div>
              <ul className="list-disc space-y-1 pl-5 text-sm">{notas.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </section>
          )}
          <Levantamento obra={obra} ambientes={ambientes} setObra={setObra} setAmbientes={setAmbientes} />
          <Quantitativos key={chave} obra={obra} ambientes={ambientes} aberturasIniciais={aberturas} ajustes={ajustes} />
        </div>
      )}
      <footer className="mt-8 text-center text-xs text-slate-400">Calculadora de Obras · versão {VERSAO}</footer>
    </div>
  )
}
