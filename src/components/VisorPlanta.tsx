import { useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { normalizar, type Caixa, type Pagina, type Ponto } from '../lib/planta/escala'

export type ModoVisor = 'navegar' | 'calibrar' | 'medir'
export interface CaixaVisor { id: string; rotulo: string; caixa: Caixa; estado?: 'ok' | 'divergente' | 'neutro' }

interface Props {
  imagem: string; pagina: Pagina
  caixas?: CaixaVisor[]; cotas?: Caixa[]
  selecionado?: string | null; onSelecionar?: (id: string) => void
  modo?: ModoVisor; onPontos?: (a: Ponto, b: Ponto) => void
  linha?: { a: Ponto; b: Ponto; rotulo?: string } | null // calibração ou medição já feita
}

const COR = { ok: '#16a34a', divergente: '#dc2626', neutro: '#2563eb' }

/** Imagem da planta com camada SVG por cima (mesmas coordenadas normalizadas enviadas à IA). */
export default function VisorPlanta({ imagem, pagina, caixas = [], cotas = [], selecionado, onSelecionar, modo = 'navegar', onPontos, linha }: Props) {
  const [zoom, setZoom] = useState(100)
  const [primeiro, setPrimeiro] = useState<Ponto | null>(null)
  const px = (p: Ponto) => ({ x: p.x * pagina.largura, y: p.y * pagina.altura })
  const raio = Math.max(pagina.largura, pagina.altura) / 120

  const clicar = (e: React.MouseEvent<SVGSVGElement>) => {
    if (modo === 'navegar' || !onPontos) return
    const r = e.currentTarget.getBoundingClientRect()
    const p = normalizar({ x: e.clientX - r.left, y: e.clientY - r.top }, { largura: r.width, altura: r.height })
    if (!primeiro) setPrimeiro(p)
    else { onPontos(primeiro, p); setPrimeiro(null) }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <button className="btn btn-sec !py-1" aria-label="Diminuir zoom" disabled={zoom <= 100} onClick={() => setZoom((z) => Math.max(100, z - 50))}><ZoomOut size={14} /></button>
        <span>{zoom}%</span>
        <button className="btn btn-sec !py-1" aria-label="Aumentar zoom" disabled={zoom >= 400} onClick={() => setZoom((z) => Math.min(400, z + 50))}><ZoomIn size={14} /></button>
        {modo !== 'navegar' && <span className="text-amber-700 dark:text-amber-500">{primeiro ? 'Clique no segundo ponto.' : modo === 'calibrar' ? 'Clique em dois pontos com distância real conhecida.' : 'Clique nos dois pontos a medir.'}</span>}
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="relative" style={{ width: `${zoom}%` }}>
          <img src={imagem} alt="Planta" className="block w-full select-none" draggable={false} />
          <svg data-testid="camada-planta" viewBox={`0 0 ${pagina.largura} ${pagina.altura}`} preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${modo === 'navegar' ? '' : 'cursor-crosshair'}`} onClick={clicar}>
            {cotas.map((c, i) => <rect key={`c${i}`} x={c.x * pagina.largura} y={c.y * pagina.altura} width={c.w * pagina.largura} height={c.h * pagina.altura} fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth={raio / 6} pointerEvents="none" />)}
            {caixas.map((b, n) => {
              const sel = selecionado === b.id, cor = COR[b.estado ?? 'neutro'], x = b.caixa.x * pagina.largura, y = b.caixa.y * pagina.altura
              return (
                <g key={b.id} onClick={(e) => { if (modo === 'navegar') { e.stopPropagation(); onSelecionar?.(b.id) } }} style={{ cursor: modo === 'navegar' ? 'pointer' : undefined }}>
                  <rect x={x} y={y} width={b.caixa.w * pagina.largura} height={b.caixa.h * pagina.altura} fill={sel ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.06)'} stroke={cor} strokeWidth={sel ? raio / 3 : raio / 6} strokeDasharray={b.estado === 'divergente' ? `${raio} ${raio / 2}` : undefined} />
                  <text x={x + raio / 2} y={y + raio * 1.6} fontSize={raio * 1.8} fill={cor} fontWeight="bold" pointerEvents="none">{n + 1}. {b.rotulo}</text>
                </g>
              )
            })}
            {linha && <g pointerEvents="none"><line x1={px(linha.a).x} y1={px(linha.a).y} x2={px(linha.b).x} y2={px(linha.b).y} stroke="#9333ea" strokeWidth={raio / 4} /><circle cx={px(linha.a).x} cy={px(linha.a).y} r={raio / 2} fill="#9333ea" /><circle cx={px(linha.b).x} cy={px(linha.b).y} r={raio / 2} fill="#9333ea" />
              {linha.rotulo && <text x={(px(linha.a).x + px(linha.b).x) / 2} y={(px(linha.a).y + px(linha.b).y) / 2 - raio} fontSize={raio * 1.8} fill="#9333ea" fontWeight="bold" textAnchor="middle">{linha.rotulo}</text>}</g>}
            {primeiro && <circle cx={px(primeiro).x} cy={px(primeiro).y} r={raio / 2} fill="#9333ea" pointerEvents="none" />}
          </svg>
        </div>
      </div>
    </div>
  )
}
