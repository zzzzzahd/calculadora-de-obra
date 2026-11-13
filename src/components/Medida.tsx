import type { Unidade } from '../types'

interface Props { rotulo: string; valor: number; unidade: Unidade; onValor: (v: number) => void; onUnidade: (u: Unidade) => void }

export default function Medida({ rotulo, valor, unidade, onValor, onUnidade }: Props) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      <div className="flex gap-1">
        <input className="campo" type="number" min={0} step="any" value={valor || ''} onChange={(e) => onValor(parseFloat(e.target.value) || 0)} />
        <select className="campo !w-20" value={unidade} onChange={(e) => onUnidade(e.target.value as Unidade)}>
          <option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option>
        </select>
      </div>
    </div>
  )
}
