/** Armazenamento local (IndexedDB). Cada alteração é gravada na hora (salvamento automático). */
export const STORES = ['processos', 'materiais', 'movimentos', 'meta'] as const
export type Store = (typeof STORES)[number]
export const VERSAO_FORMATO = 2

const NOME = 'licitacoes-db'
let conexao: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  conexao ??= new Promise((res, rej) => {
    const r = indexedDB.open(NOME, 2)
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => { conexao = null; rej(r.error) }
  })
  return conexao
}

async function tx<T>(store: Store, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((res, rej) => {
    const t = db.transaction(store, modo)
    const r = fn(t.objectStore(store))
    t.oncomplete = () => res(r.result)
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}

export const listar = <T>(store: Store) => tx<T[]>(store, 'readonly', (s) => s.getAll())
export const salvar = (store: Store, obj: { id: string }) => tx(store, 'readwrite', (s) => s.put(obj))
export const excluir = (store: Store, id: string) => tx(store, 'readwrite', (s) => s.delete(id))
export async function salvarLote(store: Store, objs: { id: string }[]) {
  const db = await abrir()
  return new Promise<void>((res, rej) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    objs.forEach((o) => s.put(o))
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}
export const limpar = (store: Store) => tx(store, 'readwrite', (s) => s.clear())

/**
 * Substitui processos, materiais e movimentos de uma vez, numa única transação: ou tudo é gravado ou nada muda.
 * A tabela `meta` só recebe gravações (não é limpa), para não perder marcadores internos do banco.
 */
export async function substituirTudo(dados: { processos: { id: string }[]; materiais: { id: string }[]; movimentos: { id: string }[]; meta: { id: string }[] }): Promise<void> {
  const db = await abrir()
  return new Promise((res, rej) => {
    const t = db.transaction([...STORES], 'readwrite')
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error ?? new Error('Gravação cancelada: nada foi alterado.'))
    try {
      for (const nome of ['processos', 'materiais', 'movimentos'] as const) { const st = t.objectStore(nome); st.clear(); for (const o of dados[nome]) st.put(o) }
      const meta = t.objectStore('meta'); for (const o of dados.meta) meta.put(o)
    } catch (e) { try { t.abort() } catch { /* já encerrada */ } rej(e) }
  })
}

/** Registra a versão do formato dos dados (usada pelo backup no Sprint 7). */
export async function iniciar() {
  const meta = await listar<{ id: string; versao?: number }>('meta')
  if (!meta.some((m) => m.id === 'schema' && m.versao === VERSAO_FORMATO)) await salvar('meta', { id: 'schema', versao: VERSAO_FORMATO, criadoEm: new Date().toISOString() } as { id: string })
}
