import { useState } from 'react'
import { FileUp, HardHat, Moon, PencilRuler, RotateCcw, Sun } from 'lucide-react'
import type { Ambiente, Obra } from './types'
import { useTema } from './lib/useTema'
import Levantamento from './components/Levantamento'
import Quantitativos from './components/Quantitativos'

const obraVazia = (): Obra => ({ nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' })

export default function App() {
  const { escuro, alternar } = useTema()
  const [modo, setModo] = useState<null | 'manual'>(null)
  const [obra, setObra] = useState<Obra>(obraVazia)
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [chave, setChave] = useState(0)

  const novo = () => { setModo(null); setObra(obraVazia()); setAmbientes([]); setChave((c) => c + 1) }

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold"><HardHat className="text-amber-600" /> Calculadora de Obras</div>
        <div className="flex gap-2">
          {modo && <button className="btn btn-sec" onClick={novo}><RotateCcw size={16} /> Novo levantamento</button>}
          <button className="btn btn-sec" onClick={alternar} aria-label="Alternar tema">{escuro ? <Sun size={16} /> : <Moon size={16} />}{escuro ? 'Claro' : 'Escuro'}</button>
        </div>
      </header>

      {!modo ? (
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          <button className="cartao text-left hover:border-amber-500" onClick={() => { setModo('manual'); setAmbientes([{ id: crypto.randomUUID(), nome: 'Ambiente 1', comprimento: 0, largura: 0, unidade: 'm' }]) }}>
            <PencilRuler className="mb-2 text-amber-600" /><div className="font-semibold">Inserir dimensões</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Informe comprimento, largura e demais dados manualmente.</p>
          </button>
          <div className="cartao opacity-60">
            <FileUp className="mb-2 text-amber-600" /><div className="font-semibold">Importar planta ou croqui</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Disponível no Sprint 2.</p>
          </div>
        </div>
      ) : (
        <>
          <Levantamento obra={obra} ambientes={ambientes} setObra={setObra} setAmbientes={setAmbientes} />
          <Quantitativos key={chave} obra={obra} ambientes={ambientes} />
        </>
      )}
    </div>
  )
}
