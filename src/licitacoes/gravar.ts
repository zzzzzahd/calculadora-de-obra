export type ResultadoGravacao = { ok: true } | { ok: false; mensagem: string }

export function mensagemDeErro(e: unknown): string {
  if ((e as { name?: string } | null)?.name === 'QuotaExceededError') return 'Espaço de armazenamento do navegador insuficiente. Os dados NÃO foram salvos. Libere espaço ou exporte um backup.'
  const m = e instanceof Error ? e.message : String(e)
  return `Não foi possível gravar no armazenamento do navegador (${m}). Os dados NÃO foram salvos.`
}

/** Executa uma gravação. Nunca deixa a falha passar em silêncio: devolve a mensagem para a tela exibir. */
export async function gravarSeguro(fn: () => Promise<unknown>): Promise<ResultadoGravacao> {
  try { await fn(); return { ok: true } } catch (e) { return { ok: false, mensagem: mensagemDeErro(e) } }
}
