import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { verificarAcesso } from '../../api/_seguranca'
import { POST as lerLicitacao } from '../../api/ler-licitacao'
import { POST as lerPlanta } from '../../api/ler-planta'

const req = (headers: Record<string, string> = {}) => new Request('http://app/api/x', { method: 'POST', headers: { host: 'app.exemplo.com', ...headers }, body: JSON.stringify({ dados: 'QUJD', tipo: 'application/pdf' }) })
afterEach(() => { delete process.env.ACCESS_CODE; delete process.env.ANTHROPIC_API_KEY; vi.unstubAllGlobals() })

describe('controle de acesso das funções de IA', () => {
  it('sem ACCESS_CODE configurado, o comportamento anterior é mantido', () => {
    expect(verificarAcesso(req())).toBeNull()
  })
  it('com ACCESS_CODE, exige o código correto', async () => {
    process.env.ACCESS_CODE = 'segredo-123'
    expect((verificarAcesso(req()) as Response).status).toBe(401)
    expect((verificarAcesso(req({ 'x-codigo-acesso': 'errado' })) as Response).status).toBe(401)
    expect((verificarAcesso(req({ 'x-codigo-acesso': 'segredo-12' })) as Response).status).toBe(401)
    expect(verificarAcesso(req({ 'x-codigo-acesso': 'segredo-123' }))).toBeNull()
  })
  it('rejeita origem diferente do próprio site; aceita a mesma', () => {
    expect((verificarAcesso(req({ origin: 'https://site-malicioso.com' })) as Response).status).toBe(403)
    expect((verificarAcesso(req({ origin: 'nao-e-url' })) as Response).status).toBe(403)
    expect(verificarAcesso(req({ origin: 'https://app.exemplo.com' }))).toBeNull()
  })
  it('as duas funções barram antes de chamar a API de IA', async () => {
    process.env.ACCESS_CODE = 'segredo-123'; process.env.ANTHROPIC_API_KEY = 'chave'
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect((await lerLicitacao(req())).status).toBe(401)
    expect((await lerPlanta(req({ origin: 'https://outro.com' }))).status).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })
  it('a mensagem de erro não revela o código nem a chave', async () => {
    process.env.ACCESS_CODE = 'segredo-123'; process.env.ANTHROPIC_API_KEY = 'chave-super-secreta'
    const corpo = await (await lerLicitacao(req())).text()
    expect(corpo).not.toContain('segredo-123'); expect(corpo).not.toContain('chave-super-secreta')
  })
})

describe('cabeçalhos de segurança e página', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { headers: { key: string; value: string }[] }[]; rewrites: { source: string }[] }
  const h = Object.fromEntries(v.headers[0].headers.map((x) => [x.key, x.value]))
  it('cabeçalhos obrigatórios presentes', () => {
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(h['Content-Security-Policy']).toContain("object-src 'none'")
    expect(h['Referrer-Policy']).toBeTruthy()
    expect(h['Strict-Transport-Security']).toContain('max-age=')
  })
  it('política estrita (relatório) não permite script inline nem eval', () => {
    const p = h['Content-Security-Policy-Report-Only']
    expect(p).toContain("script-src 'self'")
    expect(p).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/)
  })
  it('index.html não tem script inline (pronto para impor a política estrita)', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/)
    expect(html).toContain('/tema.js')
    expect(readFileSync('public/tema.js', 'utf8')).toContain("localStorage.getItem('tema')")
  })
  it('rotas da API não são reescritas para o index.html', () => {
    expect(v.rewrites[0].source).toContain('api/')
  })
})
