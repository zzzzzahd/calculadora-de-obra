/**
 * Função serverless da Vercel: lê um trecho de documento de licitação (PDF de poucas páginas ou imagem)
 * com a API da Anthropic e devolve os itens em JSON. A chave fica só em ANTHROPIC_API_KEY (variável protegida).
 * O documento é enviado apenas para esta requisição e não é armazenado. O uso pode gerar custos na sua conta da API.
 */
declare const process: { env: Record<string, string | undefined> }

const MAX_BASE64 = 4_300_000 // limite de corpo da Vercel: ~4,5 MB
const LIMITE_HORA = 60 // um documento longo usa várias requisições
const acessos = new Map<string, number[]>()
const TIPOS = ['image/jpeg', 'image/png', 'application/pdf']

const PROMPT = `Você extrai itens de documentos de licitação brasileiros (atas de registro de preços, contratos, resultados de licitação, termos de referência, planilhas digitalizadas). Responda SOMENTE com JSON válido, sem texto fora do JSON:
{"processo":{"numeroProcesso":string|null,"modalidade":string|null,"numeroInstrumento":string|null,"tipoInstrumento":"ata"|"contrato"|"processo"|null,"ano":number|null,"fornecedor":string|null,"cnpj":string|null,"dataAssinatura":"AAAA-MM-DD"|null,"vigenciaInicio":"AAAA-MM-DD"|null,"vigenciaFim":"AAAA-MM-DD"|null},
"itens":[{"pagina":number,"lote":string|null,"item":string|null,"codigo":string|null,"descricao":string,"especificacao":string|null,"marca":string|null,"unidade":string|null,"quantidade":number|null,"valorUnitario":number|null,"valorTotal":number|null,"fornecedor":string|null,"confianca":number,"trecho":string}],
"avisos":[string]}
Regras obrigatórias: 1) NÃO invente: use null para dado ausente ou ilegível. 2) Um objeto por linha de item da tabela; copie a descrição completa, sem resumir. 3) "pagina" é o número da página DESTE trecho (1 = primeira página enviada). 4) "trecho" são até 200 caracteres copiados do documento de onde o item saiu. 5) Converta valores brasileiros (1.234,56) para número e datas para AAAA-MM-DD. 6) "confianca" vai de 0 a 1. 7) Ignore cabeçalhos repetidos, totais gerais e rodapés. 8) Registre dúvidas em "avisos".`

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) return json({ erro: 'Leitura por IA não configurada: defina ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.' }, 503)

  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const agora = Date.now()
  const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < 3_600_000)
  if (recentes.length >= LIMITE_HORA) return json({ erro: 'Limite de leituras por hora atingido. Tente mais tarde.' }, 429)
  acessos.set(ip, [...recentes, agora])

  let corpo: { dados?: unknown; tipo?: unknown }
  try { corpo = await request.json() } catch { return json({ erro: 'Requisição inválida.' }, 400) }
  const { dados, tipo } = corpo
  if (typeof dados !== 'string' || typeof tipo !== 'string' || !TIPOS.includes(tipo)) return json({ erro: 'Envie PDF, JPG ou PNG.' }, 400)
  if (dados.length > MAX_BASE64) return json({ erro: 'Trecho grande demais. Reduza o arquivo.' }, 413)

  const bloco = tipo === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: tipo, data: dados } }
    : { type: 'image', source: { type: 'base64', media_type: tipo, data: dados } }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5', max_tokens: 8000, messages: [{ role: 'user', content: [bloco, { type: 'text', text: PROMPT }] }] }),
  })
  if (!r.ok) return json({ erro: `Falha no serviço de IA (HTTP ${r.status}).` }, r.status === 429 ? 429 : 502)
  const saida = (await r.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string }
  const texto = (saida.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  return json({ texto, truncado: saida.stop_reason === 'max_tokens' })
}
