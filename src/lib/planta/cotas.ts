/**
 * Detecção de cotas (medidas escritas) a partir dos itens de texto de um PDF. Roda no navegador, sem IA.
 * Não adivinha unidade: número com unidade explícita (m, cm, mm) é convertido; decimal sem unidade é tratado como metros
 * e inteiro sem unidade fica como AMBÍGUO (muitas plantas cotam em cm), para o usuário decidir.
 */
import type { Caixa } from './escala'

export interface ItemTexto { texto: string; caixa: Caixa }
export interface Cota { texto: string; valorM: number | null; valorBruto: number; unidade: 'm' | 'cm' | 'mm' | null; confianca: 'alta' | 'media' | 'ambigua'; caixa: Caixa; motivo: string }

const NUM = /(\d{1,5}(?:[.,]\d{1,3})?)\s*(mm|cm|m)?(?![\w²³])/gi
const MIN_M = 0.3, MAX_M = 60 // faixa plausível de uma cota de obra residencial/comercial

export function detectarCotas(itens: ItemTexto[]): Cota[] {
  const saida: Cota[] = []
  for (const it of itens) {
    const t = it.texto.trim()
    if (!t || t.length > 24) continue // frases longas não são cotas
    if (/\d\s*[:/]\s*\d/.test(t)) continue // escala "1:50" ou datas
    if (/[a-zA-Z]{3,}/.test(t.replace(/\b(mm|cm|m)\b/gi, ''))) continue // texto com palavras (títulos, nomes de ambiente)
    for (const m of t.matchAll(NUM)) {
      const bruto = parseFloat(m[1].replace(',', '.')), un = (m[2]?.toLowerCase() as 'm' | 'cm' | 'mm' | undefined) ?? null
      if (!(bruto > 0)) continue
      const decimal = /[.,]/.test(m[1])
      let valorM: number | null = null, conf: Cota['confianca'], motivo: string
      if (un) { valorM = un === 'm' ? bruto : un === 'cm' ? bruto / 100 : bruto / 1000; conf = 'alta'; motivo = `unidade explícita (${un})` }
      else if (decimal) { valorM = bruto; conf = 'media'; motivo = 'decimal sem unidade, tratado como metros' }
      else { conf = 'ambigua'; motivo = 'inteiro sem unidade: pode ser cm ou mm'; valorM = null }
      if (valorM !== null && (valorM < MIN_M || valorM > MAX_M)) continue
      if (conf === 'ambigua' && (bruto < 30 || bruto > 6000)) continue
      saida.push({ texto: m[0].trim(), valorM, valorBruto: bruto, unidade: un, confianca: conf, caixa: it.caixa, motivo })
    }
  }
  return saida
}

/** Resumo curto das cotas para enviar à IA como dica (o texto exato do PDF, com a posição aproximada). */
export function dicasDeCotas(cotas: Cota[], max = 60): string[] {
  const r = (n: number) => Math.round(n * 100) / 100
  return cotas.slice(0, max).map((c) => `"${c.texto}" em x=${r(c.caixa.x + c.caixa.w / 2)}, y=${r(c.caixa.y + c.caixa.h / 2)} (${c.confianca === 'ambigua' ? 'unidade incerta' : `${c.valorM} m`})`)
}
