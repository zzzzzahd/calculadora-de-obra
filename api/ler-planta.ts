/**
 * Função serverless da Vercel: intermedia a chamada à API da Anthropic para que a chave
 * nunca chegue ao navegador. A chave vem de ANTHROPIC_API_KEY (variável protegida da Vercel).
 * A planta é enviada só para esta requisição e não é armazenada. O uso pode gerar custos na sua conta da API.
 */
import { verificarAcesso } from './_seguranca.js'

declare const process: { env: Record<string, string | undefined> }

const MAX_BASE64 = 6_000_000
const LIMITE_HORA = 10
const acessos = new Map<string, number[]>() // limite simples por IP (por instância)
const TIPOS = ['image/jpeg', 'image/png', 'application/pdf']

const PROMPT = `Você lê plantas baixas e croquis de obras. Responda SOMENTE com JSON válido, sem texto fora do JSON, neste formato:
{"ambientes":[{"nome":string,"comprimento_m":number|null,"largura_m":number|null,"origem":"cota"|"estimada","confianca":number,"observacao":string}],
"altura_parede_m":number|null,
"portas":[{"largura_m":number|null,"altura_m":number|null,"qtd":number,"origem":"cota"|"estimada","confianca":number}],
"janelas":[{"largura_m":number|null,"altura_m":number|null,"qtd":number,"origem":"cota"|"estimada","confianca":number}],
"avisos":[string]}
Regras obrigatórias: 1) NÃO invente medidas ilegíveis: use null. 2) Use origem "cota" só para medidas numéricas escritas no desenho; "estimada" para o resto. 3) Priorize cotas numéricas explícitas sobre a escala gráfica; use escala só se houver referência confiável. 4) Nunca assuma dimensões pela aparência. 5) confianca vai de 0 a 1. 6) Converta tudo para metros. 7) Registre dúvidas em "avisos".`

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  const negado = verificarAcesso(request)
  if (negado) return negado
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) return json({ erro: 'Leitor de plantas não configurado: defina ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.' }, 503)

  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const agora = Date.now()
  const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < 3_600_000)
  if (recentes.length >= LIMITE_HORA) return json({ erro: 'Limite de leituras por hora atingido. Tente mais tarde.' }, 429)
  acessos.set(ip, [...recentes, agora])

  let corpo: { dados?: unknown; tipo?: unknown }
  try { corpo = await request.json() } catch { return json({ erro: 'Requisição inválida.' }, 400) }
  const { dados, tipo } = corpo
  if (typeof dados !== 'string' || typeof tipo !== 'string' || !TIPOS.includes(tipo)) return json({ erro: 'Envie imagem JPG/PNG ou PDF.' }, 400)
  if (dados.length > MAX_BASE64) return json({ erro: 'Arquivo grande demais. Reduza a imagem ou o PDF.' }, 413)

  const bloco = tipo === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: tipo, data: dados } }
    : { type: 'image', source: { type: 'base64', media_type: tipo, data: dados } }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5', max_tokens: 2000,
      messages: [{ role: 'user', content: [bloco, { type: 'text', text: PROMPT }] }],
    }),
  })
  if (!r.ok) return json({ erro: `Falha no serviço de IA (HTTP ${r.status}).` }, r.status === 429 ? 429 : 502)
  const saida = (await r.json()) as { content?: { type: string; text?: string }[] }
  const texto = (saida.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  return json({ texto })
}
