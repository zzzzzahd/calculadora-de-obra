import { useState } from 'react'
import { ArrowLeft, FileUp, HardHat, Landmark, Moon, PencilRuler, RotateCcw, Sun } from 'lucide-react'
import type { Ambiente, Obra } from './types'
import type { Abertura } from './lib/engine'
import { useTema } from './lib/useTema'
import Levantamento from './components/Levantamento'
import Quantitativos from './components/Quantitativos'
import LeitorPlanta from './components/LeitorPlanta'
import Licitacoes from './licitacoes/Licitacoes'
import { uid } from './lib/uid'

const VERSAO = 'v23'
const obraVazia = (): Obra => ({ nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' })

export default function App() {
  const { escuro, alternar } = useTema()
  const [modo, setModo] = useState<null | 'manual' | 'planta' | 'licitacoes'>(null)
  const [obra, setObra] = useState<Obra>(obraVazia)
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [aberturas, setAberturas] = useState<Abertura[]>([])
  const [chave, setChave] = useState(0)
  const [iniciado, setIniciado] = useState(false) // levantamento já começado (permanece ao voltar ao menu)

  const novo = () => { setModo(null); setObra(obraVazia()); setAmbientes([]); setAberturas([]); setIniciado(false); setChave((c) => c + 1) }

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
          <button className="cartao text-left hover:border-amber-500" onClick={() => { setModo('manual'); setIniciado(true); if (ambientes.length === 0) setAmbientes([{ id: uid(), nome: 'Ambiente 1', comprimento: 0, largura: 0, unidade: 'm' }]) }}>
            <PencilRuler className="mb-2 text-amber-600" /><div className="font-semibold">{iniciado ? 'Continuar levantamento' : 'Inserir dimensões'}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Informe comprimento, largura e demais dados manualmente.</p>
          </button>
          <button className="cartao text-left hover:border-amber-500" onClick={() => setModo('planta')}>
            <FileUp className="mb-2 text-amber-600" /><div className="font-semibold">Importar planta ou croqui</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">A IA lê as medidas e você confere antes de calcular.</p>
          </button>
          <button className="cartao text-left hover:border-amber-500 sm:col-span-2" onClick={() => setModo('licitacoes')}>
            <Landmark className="mb-2 text-amber-600" /><div className="font-semibold">Materiais licitados</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Cadastre atas, contratos e materiais da Prefeitura e acompanhe os saldos. Não precisa iniciar uma obra.</p>
          </button>
        </div>
      )}

      {modo === 'licitacoes' && <Licitacoes />}

      {modo === 'planta' && (
        <LeitorPlanta onConfirmar={(c) => {
          setAmbientes(c.ambientes); setAberturas(c.aberturas)
          if (c.altura) setObra({ ...obra, alturaParede: c.altura, unidadeAltura: 'm' })
          setIniciado(true); setModo('manual')
        }} />
      )}

      {iniciado && (
        <div className={modo === 'manual' ? '' : 'hidden'}>
          <Levantamento obra={obra} ambientes={ambientes} setObra={setObra} setAmbientes={setAmbientes} />
          <Quantitativos key={chave} obra={obra} ambientes={ambientes} aberturasIniciais={aberturas} />
        </div>
      )}
      <footer className="mt-8 text-center text-xs text-slate-400">Calculadora de Obras · versão {VERSAO}</footer>
    </div>
  )
}
