import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import { excluir, iniciar, limpar, listar, salvar, VERSAO_FORMATO } from './db'

beforeEach(async () => { await limpar('processos'); await limpar('materiais'); await limpar('meta') })

it('salva, atualiza, lista e exclui', async () => {
  await salvar('materiais', { id: 'm1', nome: 'Cimento' } as { id: string })
  await salvar('materiais', { id: 'm1', nome: 'Cimento CP II' } as { id: string })
  await salvar('materiais', { id: 'm2', nome: 'Areia' } as { id: string })
  expect(await listar('materiais')).toHaveLength(2)
  expect((await listar<{ id: string; nome: string }>('materiais')).find((m) => m.id === 'm1')!.nome).toBe('Cimento CP II')
  await excluir('materiais', 'm1')
  expect((await listar('materiais')).map((m) => (m as { id: string }).id)).toEqual(['m2'])
})
it('registra a versão do formato uma única vez', async () => {
  await iniciar(); await iniciar()
  const meta = await listar<{ id: string; versao: number }>('meta')
  expect(meta).toHaveLength(1)
  expect(meta[0].versao).toBe(VERSAO_FORMATO)
})
