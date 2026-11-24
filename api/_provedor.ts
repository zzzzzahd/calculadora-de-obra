/**
 * Provedor de IA configurável (variável PROVEDOR_IA): "anthropic" (padrão) ou "gemini". Só aqui se conhece o formato de
 * cada serviço; o resto do código pede um texto de resposta. As chaves ficam nas variáveis da Vercel e nunca vão ao navegador.
 *  - anthropic: ANTHROPIC_API_KEY (obrigatória) e ANTHROPIC_MODEL (opcional).
 *  - gemini:    GEMINI_API_KEY e GEMINI_MODEL (as duas obrigatórias: nenhum modelo é assumido).
 */
declare const process: { env: Record<string, string | undefined> }

export interface PedidoIA { texto: string; maxTokens: number; imagem?: { tipo: string; dados: string }; documento?: { tipo: string; dados: string } }
export type RespostaIA = { ok: true; texto: string } | { ok: false; status: number; erro: string }

const falha = (status: number, erro: string): RespostaIA => ({ ok: false, status, erro })

export async function consultarIA(p: PedidoIA): Promise<RespostaIA> {
  const provedor = (process.env.PROVEDOR_IA ?? 'anthropic').toLowerCase()
  if (provedor === 'anthropic') return anthropic(p)
  if (provedor === 'gemini') return gemini(p)
  return falha(503, 'PROVEDOR_IA inválido: use "anthropic" ou "gemini".')
}

async function anthropic(p: PedidoIA): Promise<RespostaIA> {
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) return falha(503, 'Leitor de plantas não configurado: defina ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.')
  const bloco = p.documento ? { type: 'document', source: { type: 'base64', media_type: p.documento.tipo, data: p.documento.dados } }
    : p.imagem ? { type: 'image', source: { type: 'base64', media_type: p.imagem.tipo, data: p.imagem.dados } } : null
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5', max_tokens: p.maxTokens, messages: [{ role: 'user', content: [...(bloco ? [bloco] : []), { type: 'text', text: p.texto }] }] }),
  })
  if (!r.ok) return falha(r.status === 429 ? 429 : 502, `Falha no serviço de IA (HTTP ${r.status}).`)
  const saida = (await r.json()) as { content?: { type: string; text?: string }[] }
  return { ok: true, texto: (saida.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n') }
}

async function gemini(p: PedidoIA): Promise<RespostaIA> {
  const chave = process.env.GEMINI_API_KEY, modelo = process.env.GEMINI_MODEL
  if (!chave || !modelo) return falha(503, 'Leitor de plantas não configurado para o Gemini: defina GEMINI_API_KEY e GEMINI_MODEL nas variáveis de ambiente da Vercel.')
  const anexo = p.documento ?? p.imagem
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [...(anexo ? [{ inline_data: { mime_type: anexo.tipo, data: anexo.dados } }] : []), { text: p.texto }] }],
      generationConfig: { maxOutputTokens: p.maxTokens, responseMimeType: 'application/json' },
    }),
  })
  if (!r.ok) return falha(r.status === 429 ? 429 : 502, `Falha no serviço de IA (HTTP ${r.status}).`)
  const saida = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; promptFeedback?: { blockReason?: string } }
  if (saida.promptFeedback?.blockReason) return falha(422, `O serviço de IA recusou a imagem (${saida.promptFeedback.blockReason}).`)
  return { ok: true, texto: (saida.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join('\n') }
}
