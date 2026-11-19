import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { gravarSeguro, mensagemDeErro } from './gravar'
import { salvar, type Store } from './db'

describe('falha ao gravar nunca passa em silêncio', () => {
  it('sucesso devolve ok', async () => {
    expect(await gravarSeguro(async () => 1)).toEqual({ ok: true })
  })
  it('erro vira mensagem clara dizendo que NÃO salvou', async () => {
    const r = await gravarSeguro(async () => { throw new Error('disco cheio') })
    expect(r).toMatchObject({ ok: false })
    expect(r.ok === false && r.mensagem).toMatch(/NÃO foram salvos/)
    expect(r.ok === false && r.mensagem).toMatch(/disco cheio/)
  })
  it('falta de espaço tem mensagem própria', () => {
    const e = Object.assign(new Error('x'), { name: 'QuotaExceededError' })
    expect(mensagemDeErro(e)).toMatch(/Espaço de armazenamento.*insuficiente/)
  })
  it('falha real do IndexedDB (loja inexistente) é capturada', async () => {
    const r = await gravarSeguro(() => salvar('nao-existe' as Store, { id: '1' }))
    expect(r.ok).toBe(false)
  })
})
