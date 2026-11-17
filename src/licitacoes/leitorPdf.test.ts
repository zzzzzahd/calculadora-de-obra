import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { dividirPdf, ErroFatal, lerPdfIA, validarLicitacao, type Chamar } from './leitorPdf'
import { POST } from '../../api/ler-licitacao'

const resp = (o: object) => '```json\n' + JSON.stringify(o) + '\n```'
const item = (o: object = {}) => ({ pagina: 2, item: '1', descricao: '100 - CIMENTO CP II-Z-32 SACO 50 KG', unidade: 'SC', quantidade: 1000, valorUnitario: 38, valorTotal: 38000, confianca: 0.95, trecho: 'CIMENTO CP II-Z-32 ... 1.000 ... 38,00', ...o })
async function pdf(paginas: number) {
  const d = await PDFDocument.create()
  for (let i = 0; i < paginas; i++) d.addPage([200, 200])
  return (await d.save()).slice().buffer as ArrayBuffer
}

describe('validação da resposta da IA', () => {
  it('mapeia itens, soma o deslocamento de página e não inventa dados', () => {
    const r = validarLicitacao(resp({ processo: { numeroProcesso: '123/2026', tipoInstrumento: 'ata', vigenciaFim: '2027-05-01', vigenciaInicio: '01/05/2026', fornecedor: null }, itens: [item(), item({ descricao: '', pagina: 3 }), item({ descricao: 'TIJOLO', quantidade: null, valorUnitario: null, valorTotal: null, confianca: 7 })], avisos: ['escala ausente'] }), 'ata.pdf', 4)
    expect(r.metadados).toEqual({ numeroProcesso: '123/2026', tipo: 'ata', vigenciaFim: '2027-05-01' }) // data em formato errado e fornecedor nulo ficam de fora
    expect(r.itens).toHaveLength(2) // item sem descrição é descartado
    expect(r.itens[0]).toMatchObject({ codigo: '100', nome: 'CIMENTO CP II-Z-32 SACO 50 KG', pagina: 6, quantidadeAta: 1000, precoUnitario: 38, aba: 'ata.pdf' })
    expect(r.itens[1]).toMatchObject({ quantidadeAta: null, precoUnitario: null, confianca: 1 })
    expect(r.avisos).toEqual(['escala ausente'])
    expect(() => validarLicitacao('não consegui ler', 'x.pdf')).toThrow()
  })
})

describe('divisão do PDF em blocos', () => {
  it('10 páginas viram blocos de 4, 4 e 2', async () => {
    const { total, blocos } = await dividirPdf(await pdf(10))
    expect(total).toBe(10)
    expect(blocos.map((b) => [b.inicio, b.fim])).toEqual([[1, 4], [5, 8], [9, 10]])
    for (const b of blocos) expect((await PDFDocument.load(b.bytes)).getPageCount()).toBe(b.fim - b.inicio + 1)
  })
})

describe('leitura do PDF em blocos', () => {
  it('mescla metadados, corrige páginas, descarta repetidos, sinaliza baixa confiança e segue após falha', async () => {
    const respostas = [
      { texto: resp({ processo: { numeroProcesso: '123/2026', fornecedor: 'FORN X', vigenciaFim: '2027-05-01' }, itens: [item()] }) },
      { texto: resp({ processo: { numeroProcesso: '999' }, itens: [item({ pagina: 1 }), item({ pagina: 2, item: '2', descricao: '101 - AREIA', unidade: 'M³', quantidade: 20, valorUnitario: 100, valorTotal: 9999, confianca: 0.5 })] }), truncado: true },
    ]
    let n = 0
    const chamar: Chamar = async () => { if (n < 2) return respostas[n++]; throw new Error('falhou') }
    const r = await lerPdfIA('ata.pdf', await pdf(10), chamar)
    expect(r.metadados.numeroProcesso).toBe('123/2026') // vale o primeiro valor encontrado
    expect(r.itens).toHaveLength(2) // o item 1 repetido na segunda chamada foi descartado
    const areia = r.itens.find((i) => i.codigo === '101')!
    expect(areia.pagina).toBe(6)
    expect(areia.fornecedor).toBe('FORN X')
    expect(areia.alertas).toEqual(expect.arrayContaining(['Baixa confiança na leitura (50%)', 'Valor total do documento difere de quantidade × preço']))
    expect(r.itens.find((i) => i.codigo === '100')!.alertas).toEqual([])
    expect(r.avisos.join(' ')).toMatch(/Páginas 5–8: a resposta foi cortada/)
    expect(r.avisos.join(' ')).toMatch(/Páginas 9–10 não puderam ser lidas: falhou/)
    expect(r.avisos.join(' ')).toMatch(/1 item\(ns\) repetido/)
  })
  it('erro fatal (sem chave ou limite) interrompe sem insistir em cada bloco', async () => {
    let chamadas = 0
    const r = await lerPdfIA('ata.pdf', await pdf(10), async () => { chamadas++; throw new ErroFatal('não configurado') })
    expect(chamadas).toBe(1)
    expect(r.itens).toHaveLength(0)
    expect(r.avisos).toHaveLength(1)
  })
  it('recusa PDF acima de 60 páginas', async () => {
    await expect(lerPdfIA('grande.pdf', await pdf(61), async () => ({ texto: '{}' }))).rejects.toThrow(/61 páginas/)
  })
})

describe('função serverless ler-licitacao', () => {
  const req = (corpo: unknown) => new Request('http://x/api/ler-licitacao', { method: 'POST', body: JSON.stringify(corpo), headers: { 'x-forwarded-for': `ip-${Math.random()}` } })
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'chave-de-teste' })
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; vi.unstubAllGlobals() })
  it('sem chave configurada responde 503 e não chama a API', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect((await POST(req({ dados: 'abc', tipo: 'application/pdf' }))).status).toBe(503)
    expect(f).not.toHaveBeenCalled()
  })
  it('valida tipo e tamanho', async () => {
    expect((await POST(req({ dados: 'abc', tipo: 'text/html' }))).status).toBe(400)
    expect((await POST(req({ dados: 'x'.repeat(4_400_000), tipo: 'application/pdf' }))).status).toBe(413)
  })
  it('envia o PDF como documento, usa a chave só no servidor e devolve o texto', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{"itens":[]}' }], stop_reason: 'max_tokens' })))
    vi.stubGlobal('fetch', f)
    const r = await POST(req({ dados: 'QUJD', tipo: 'application/pdf' }))
    expect(await r.json()).toEqual({ texto: '{"itens":[]}', truncado: true })
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('chave-de-teste')
    expect(JSON.parse(init.body).messages[0].content[0]).toMatchObject({ type: 'document', source: { media_type: 'application/pdf', data: 'QUJD' } })
  })
  it('repassa limite do serviço de IA como 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    expect((await POST(req({ dados: 'QUJD', tipo: 'image/png' }))).status).toBe(429)
  })
})
