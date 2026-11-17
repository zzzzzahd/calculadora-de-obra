/** Identificador único. Usa crypto.randomUUID quando existe; senão (Node 18, navegador sem https) usa um sorteio. */
export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`
