/**
 * Proteção comum às funções de IA (arquivo com "_" não vira rota na Vercel).
 * - Se ACCESS_CODE estiver definido na Vercel, toda chamada precisa enviar o cabeçalho x-codigo-acesso igual a ele.
 * - Rejeita chamadas vindas de outra origem (outros sites usando a sua função pelo navegador de alguém).
 */
declare const process: { env: Record<string, string | undefined> }

const resposta = (status: number, erro: string) => new Response(JSON.stringify({ erro }), { status, headers: { 'content-type': 'application/json' } })
const igual = (a: string, b: string) => { // comparação em tempo constante
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export function verificarAcesso(request: Request): Response | null {
  const origem = request.headers.get('origin')
  if (origem) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    try { if (new URL(origem).host !== host) return resposta(403, 'Origem não permitida.') } catch { return resposta(403, 'Origem inválida.') }
  }
  const codigo = process.env.ACCESS_CODE
  if (codigo && !igual(request.headers.get('x-codigo-acesso') ?? '', codigo)) return resposta(401, 'Código de acesso necessário ou inválido.')
  return null
}
