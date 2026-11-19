/** Envia a requisição às funções de IA. Se o servidor exigir código de acesso (ACCESS_CODE), pergunta uma vez e guarda só na memória da aba. */
let codigo = ''

export async function postarIA(url: string, corpo: unknown): Promise<Response> {
  const enviar = () => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(codigo ? { 'x-codigo-acesso': codigo } : {}) }, body: JSON.stringify(corpo) })
  let r = await enviar()
  if (r.status === 401) {
    const c = prompt('Informe o código de acesso para usar a leitura por IA:')
    if (c?.trim()) { codigo = c.trim(); r = await enviar() }
  }
  return r
}
