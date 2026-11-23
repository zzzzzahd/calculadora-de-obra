import { postarIA } from './acesso'
import { validarExtracao, type Extracao } from './descricao'

/** Envia o texto à função serverless (que só extrai fatos) e valida a resposta. Nada é guardado no servidor. */
export async function interpretarTexto(mensagem: string, contexto?: { pergunta?: string; ambientes?: string[] }): Promise<Extracao> {
  const r = await postarIA('/api/assistente-obra', { mensagem, contexto })
  const j = (await r.json().catch(() => ({}))) as { texto?: string; erro?: string }
  if (!r.ok || !j.texto) throw new Error(j.erro ?? `Erro ao interpretar o texto (HTTP ${r.status}).`)
  return validarExtracao(j.texto)
}
