import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../api/ler-planta'

let n = 0
const req = (b: unknown, headers: Record<string, string> = {}) => new Request('http://app/api/ler-planta', { method: 'POST', headers: { host: 'app.exemplo.com', 'x-forwarded-for': `10.1.0.${++n}`, ...headers }, body: typeof b === 'string' ? b : JSON.stringify(b) })
const anthropic = (texto: string) => vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: texto }] }), { status: 200 }))
const gemini = (texto: string) => vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), { status: 200 }))
const corpoEnviado = (f: ReturnType<typeof vi.fn>) => JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))
const chamada = (f: ReturnType<typeof vi.fn>) => f.mock.calls[0] as unknown as [string, RequestInit]
const IMG = { dados: 'AAAA', tipo: 'image/jpeg' }
afterEach(() => { for (const k of ['ACCESS_CODE', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'PROVEDOR_IA', 'GEMINI_API_KEY', 'GEMINI_MODEL']) delete process.env[k]; vi.unstubAllGlobals() })

describe('leitor de plantas (função serverless) com provedor configurável', () => {
  it('padrão Anthropic: manda imagem e prompt com coordenadas normalizadas, chave só no servidor', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-a'; const f = anthropic('{"ambientes":[]}'); vi.stubGlobal('fetch', f)
    const r = await POST(req(IMG))
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ texto: '{"ambientes":[]}' })
    const [url, init] = chamada(f)
    expect(url).toBe('https://api.anthropic.com/v1/messages'); expect((init.headers as Record<string, string>)['x-api-key']).toBe('chave-a')
    const c = corpoEnviado(f).messages[0].content
    expect(c[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } })
    expect(c[1].text).toContain('normalizado de 0 a 1'); expect(c[1].text).toContain('não chute coordenadas'); expect(c[1].text).toContain('"cotas"')
  })
  it('PDF continua aceito como documento (compatibilidade)', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-a'; const f = anthropic('{}'); vi.stubGlobal('fetch', f)
    await POST(req({ dados: 'JVBER', tipo: 'application/pdf' }))
    expect(corpoEnviado(f).messages[0].content[0]).toMatchObject({ type: 'document', source: { media_type: 'application/pdf' } })
  })
  it('dicas do PDF entram no prompt como dado, limitadas em quantidade e tamanho', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-a'; const f = anthropic('{}'); vi.stubGlobal('fetch', f)
    await POST(req({ ...IMG, dicas: Array.from({ length: 100 }, (_, i) => `"${i},50" em x=0.1, y=0.2 ${'z'.repeat(200)}`), outra: 1 }))
    const txt = corpoEnviado(f).messages[0].content[1].text as string
    expect(txt).toContain('não instruções'); expect(txt).toContain('- "0,50" em x=0.1'); expect(txt).toContain('- "79,50"'); expect(txt).not.toContain('- "80,50"'); expect(txt).not.toContain('z'.repeat(121))
  })
  it('sem dicas o prompt não traz a seção de textos do PDF', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-a'; const f = anthropic('{}'); vi.stubGlobal('fetch', f)
    await POST(req(IMG))
    expect(corpoEnviado(f).messages[0].content[1].text).not.toContain('Textos que o PDF traz')
  })
  it('Gemini: formato do pedido, chave no cabeçalho e resposta em JSON', async () => {
    process.env.PROVEDOR_IA = 'gemini'; process.env.GEMINI_API_KEY = 'chave-g'; process.env.GEMINI_MODEL = 'modelo-g'; const f = gemini('{"ambientes":[]}'); vi.stubGlobal('fetch', f)
    const r = await POST(req(IMG))
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ texto: '{"ambientes":[]}' })
    const [url, init] = chamada(f)
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/modelo-g:generateContent')
    expect(url).not.toContain('chave-g'); expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('chave-g')
    const b = corpoEnviado(f)
    expect(b.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } })
    expect(b.contents[0].parts[1].text).toContain('normalizado de 0 a 1'); expect(b.generationConfig).toEqual({ maxOutputTokens: 3000, responseMimeType: 'application/json' })
  })
  it('configuração incompleta ou inválida dá 503 claro, sem chamar a IA', async () => {
    const f = anthropic('{}'); vi.stubGlobal('fetch', f)
    let r = await POST(req(IMG)); expect(r.status).toBe(503); expect(await r.text()).toContain('ANTHROPIC_API_KEY')
    process.env.PROVEDOR_IA = 'gemini'; process.env.GEMINI_API_KEY = 'x'
    r = await POST(req(IMG)); expect(r.status).toBe(503); expect(await r.text()).toContain('GEMINI_MODEL')
    process.env.PROVEDOR_IA = 'outro'
    r = await POST(req(IMG)); expect(r.status).toBe(503); expect(await r.text()).toContain('PROVEDOR_IA inválido')
    expect(f).not.toHaveBeenCalled()
  })
  it('erro do serviço vira mensagem amigável sem expor a chave; bloqueio de conteúdo do Gemini é informado', async () => {
    process.env.ANTHROPIC_API_KEY = 'chave-secreta'
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })))
    let r = await POST(req(IMG)); expect(r.status).toBe(502); expect(await r.text()).not.toContain('chave-secreta')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 429 })))
    expect((await POST(req(IMG))).status).toBe(429)
    process.env.PROVEDOR_IA = 'gemini'; process.env.GEMINI_API_KEY = 'g'; process.env.GEMINI_MODEL = 'm'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 })))
    r = await POST(req(IMG)); expect(r.status).toBe(422); expect(await r.text()).toContain('SAFETY')
  })
  it('mantém código de acesso, origem, tipo, tamanho e limite por hora', async () => {
    process.env.ANTHROPIC_API_KEY = 'k'; process.env.ACCESS_CODE = 'segredo'; const f = anthropic('{}'); vi.stubGlobal('fetch', f)
    expect((await POST(req(IMG))).status).toBe(401)
    expect((await POST(req(IMG, { 'x-codigo-acesso': 'segredo', origin: 'https://outro.com' }))).status).toBe(403)
    expect(f).not.toHaveBeenCalled()
    delete process.env.ACCESS_CODE
    expect((await POST(req({ dados: 'x', tipo: 'text/html' }))).status).toBe(400)
    expect((await POST(req({ dados: 'a'.repeat(6_000_001), tipo: 'image/png' }))).status).toBe(413)
    vi.stubGlobal('fetch', anthropic('{}'))
    let ultimo = 200
    for (let i = 0; i < 11; i++) ultimo = (await POST(new Request('http://app/x', { method: 'POST', headers: { host: 'app.exemplo.com', 'x-forwarded-for': '198.51.100.7' }, body: JSON.stringify(IMG) }))).status
    expect(ultimo).toBe(429)
  })
})
