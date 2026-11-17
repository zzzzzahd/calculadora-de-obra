import type { Abertura } from './engine'
import { uid } from './uid'

export interface AmbienteLido { id: string; nome: string; comprimento: number; largura: number; origem: 'cota' | 'estimada'; confianca: number; observacao: string }
export interface Leitura { ambientes: AmbienteLido[]; alturaParede: number | null; aberturas: Abertura[]; avisos: string[] }

const med = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1000 ? v : null)
const conf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)
const origem = (v: unknown): 'cota' | 'estimada' => (v === 'cota' ? 'cota' : 'estimada')
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

/** Valida e saneia a resposta da IA. Medidas ilegíveis viram 0 para o usuário preencher (nada é inventado). */
export function validarLeitura(texto: string): Leitura {
  const t = texto.replace(/```json|```/g, '')
  const i = t.indexOf('{'), f = t.lastIndexOf('}')
  if (i < 0 || f < i) throw new Error('A resposta da IA não trouxe dados válidos.')
  const j = JSON.parse(t.slice(i, f + 1)) as Record<string, unknown>
  const avisos = Array.isArray(j.avisos) ? j.avisos.filter((a): a is string => typeof a === 'string') : []
  const ambientes = lista(j.ambientes).map((a, n): AmbienteLido => {
    const c = med(a.comprimento_m), l = med(a.largura_m)
    if (c === null || l === null) avisos.push(`"${String(a.nome ?? `Ambiente ${n + 1}`)}": medida ilegível, preencha manualmente.`)
    return { id: uid(), nome: typeof a.nome === 'string' && a.nome ? a.nome : `Ambiente ${n + 1}`, comprimento: c ?? 0, largura: l ?? 0,
      origem: origem(a.origem), confianca: conf(a.confianca), observacao: typeof a.observacao === 'string' ? a.observacao : '' }
  })
  const abr = (tipo: 'Porta' | 'Janela', arr: unknown) => lista(arr).flatMap((a) => {
    const l = med(a.largura_m), h = med(a.altura_m)
    return l && h ? [{ id: uid(), tipo, largura: l, altura: h, qtd: Math.max(1, Math.round(Number(a.qtd) || 1)) }] : []
  })
  return { ambientes, alturaParede: med(j.altura_parede_m), aberturas: [...abr('Porta', j.portas), ...abr('Janela', j.janelas)], avisos }
}

/** Prepara o arquivo no navegador: imagens são reduzidas (JPEG, fundo branco); PDF até 3 MB. Nada é guardado. */
export async function prepararArquivo(file: File): Promise<{ dados: string; tipo: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > 3_000_000) throw new Error('PDF acima de 3 MB: exporte uma página como imagem ou reduza o arquivo.')
    const b = new Uint8Array(await file.arrayBuffer()); let s = ''
    for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode(...b.subarray(k, k + 0x8000))
    return { dados: btoa(s), tipo: 'application/pdf' }
  }
  if (!file.type.startsWith('image/')) throw new Error('Formato não suportado. Use JPG, PNG ou PDF (DXF ainda não é suportado).')
  const img = await createImageBitmap(file)
  const k = Math.min(1, 1800 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
  return { dados: c.toDataURL('image/jpeg', 0.85).split(',')[1], tipo: 'image/jpeg' }
}

export async function lerPlanta(file: File): Promise<Leitura> {
  const corpo = await prepararArquivo(file)
  const r = await fetch('/api/ler-planta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
  const j = (await r.json().catch(() => ({}))) as { texto?: string; erro?: string }
  if (!r.ok || !j.texto) throw new Error(j.erro ?? `Erro ao interpretar a planta (HTTP ${r.status}).`)
  return validarLeitura(j.texto)
}
