import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { abrirPdf, textoDaPagina } from './pdf'
import { detectarCotas } from './cotas'

const node = Number(process.versions.node.split('.')[0])
// PDF.js 4.x exige Node 20 ou superior (correção de segurança); em Node 18 estes testes são pulados.
const d = node >= 20 ? describe : describe.skip

async function pdfDeTeste() {
  const doc = await PDFDocument.create(), fonte = await doc.embedFont(StandardFonts.Helvetica)
  const pg = doc.addPage([600, 400]) // largura 600, altura 400 (pontos)
  const t = (s: string, x: number, y: number) => pg.drawText(s, { x, y, size: 12, font: fonte }) // y do pdf-lib é de baixo para cima
  t('SALA', 100, 300); t('3,50', 150, 350); t('4,20 m', 450, 200); t('350', 300, 50); t('1:50', 20, 20); t('Planta baixa do pavimento terreo', 20, 380)
  pg.drawRectangle({ x: 100, y: 100, width: 350, height: 200, borderWidth: 1 })
  const p2 = doc.addPage([300, 500]); p2.drawText('2,10', { x: 50, y: 400, size: 12, font: fonte })
  return doc.save()
}

d('PDF.js: texto com coordenadas normalizadas', () => {
  it('abre o PDF, lê as páginas e normaliza as posições (origem no canto superior esquerdo)', async () => {
    const pdf = await abrirPdf(await pdfDeTeste())
    expect(pdf.numPages).toBe(2)
    const { itens, pagina } = await textoDaPagina(pdf, 1)
    expect(pagina).toEqual({ largura: 600, altura: 400 })
    const cota = itens.find((i) => i.texto === '3,50')!
    expect(cota.caixa.x).toBeCloseTo(150 / 600, 2)
    expect(cota.caixa.y).toBeGreaterThan((400 - 350 - 14) / 400 - 0.02); expect(cota.caixa.y).toBeLessThan((400 - 350) / 400 + 0.02) // y cresce para baixo
    expect(cota.caixa.w).toBeGreaterThan(0.02); expect(cota.caixa.w).toBeLessThan(0.1)
    for (const i of itens) for (const v of Object.values(i.caixa)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
    const p2 = await textoDaPagina(pdf, 2)
    expect(p2.pagina).toEqual({ largura: 300, altura: 500 }); expect(p2.itens.map((i) => i.texto)).toEqual(['2,10'])
  })
  it('detecta cotas do PDF e ignora título, escala e nome do ambiente', async () => {
    const { itens } = await textoDaPagina(await abrirPdf(await pdfDeTeste()), 1)
    const cotas = detectarCotas(itens)
    expect(cotas.map((c) => c.texto).sort()).toEqual(['3,50', '350', '4,20 m'])
    expect(cotas.find((c) => c.texto === '3,50')).toMatchObject({ valorM: 3.5, confianca: 'media' })
    expect(cotas.find((c) => c.texto === '4,20 m')).toMatchObject({ valorM: 4.2, confianca: 'alta', unidade: 'm' })
    expect(cotas.find((c) => c.texto === '350')).toMatchObject({ valorM: null, confianca: 'ambigua' }) // não decide cm sozinho
  })
  it('PDF inválido dá erro, não trava', async () => {
    await expect(abrirPdf(new Uint8Array([1, 2, 3]))).rejects.toBeTruthy()
  })
})
