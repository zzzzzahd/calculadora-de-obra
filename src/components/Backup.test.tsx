// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Backup from './Backup'
import { montarBackup } from '../lib/backup'
import { carregarParams, salvarParams } from '../lib/config'
import { PARAMS_PADRAO } from '../lib/engine'
import { limpar, listar, salvar } from '../licitacoes/db'
import type { Ambiente, Obra } from '../types'
import type { Material, Processo } from '../licitacoes/tipos'

const obra: Obra = { nome: 'Casa A', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const amb: Ambiente[] = [{ id: 'a', nome: 'Sala', comprimento: 5, largura: 4, unidade: 'm', pontosEl: { tug: 4 } }]
const proc: Processo = { id: 'p1', tipo: 'ata', numeroProcesso: '1', modalidade: '', numeroInstrumento: '10/2026', ano: 2026, fornecedor: 'F', cnpj: '', dataAssinatura: '', vigenciaInicio: '', vigenciaFim: '', observacoes: '' }
const mat = { id: 'm1', processoId: 'p1', nomePadronizado: 'Cimento', unidadeFornecimento: 'saco' } as Material

let baixados: { nome: string; blob: Blob }[] = []
beforeEach(async () => {
  for (const s of ['processos', 'materiais', 'movimentos', 'meta'] as const) await limpar(s)
  localStorage.clear(); baixados = []
  let ultimo = ''
  URL.createObjectURL = ((b: Blob) => { baixados.push({ nome: '', blob: b }); return (ultimo = `blob:${baixados.length}`) }) as typeof URL.createObjectURL
  URL.revokeObjectURL = () => {}
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { const b = baixados.find((x, i) => `blob:${i + 1}` === this.href.replace(location.origin + '/', '') || `blob:${i + 1}` === this.href) ?? baixados[baixados.length - 1]; b.nome = this.download; void ultimo }
  File.prototype.text ??= function (this: File) { return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(this) }) }
  Blob.prototype.text ??= function (this: Blob) { return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(this) }) }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const props = (o: Partial<React.ComponentProps<typeof Backup>> = {}) => ({ versao: 'v33', obra, ambientes: amb, aberturas: [], iniciado: true, onRestaurar: vi.fn(), ...o })
const arquivo = (b: unknown, nome = 'backup.json') => new File([typeof b === 'string' ? b : JSON.stringify(b)], nome, { type: 'application/json' })
const escolher = (f: File) => fireEvent.change(screen.getByLabelText('Arquivo de backup'), { target: { files: [f] } })

describe('fazer backup', () => {
  it('baixa um arquivo com configurações, levantamento e licitações atuais', async () => {
    await salvar('processos', proc); await salvar('materiais', mat); salvarParams({ ...PARAMS_PADRAO, eltTomadas: 7 })
    render(<Backup {...props()} />)
    fireEvent.click(screen.getByText('Baixar backup'))
    await screen.findByText(/Backup baixado/)
    expect(baixados[0].nome).toMatch(/^calculadora-obra-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const j = JSON.parse(await baixados[0].blob.text())
    expect(j).toMatchObject({ app: 'calculadora-obra', formato: 1, versaoApp: 'v33' })
    expect(j.configuracoes.eltTomadas).toBe(7); expect(j.levantamento.ambientes[0].nome).toBe('Sala'); expect(j.licitacoes.materiais[0].id).toBe('m1')
  })
  it('só as partes marcadas entram; sem levantamento a opção fica desabilitada', async () => {
    render(<Backup {...props({ iniciado: false, ambientes: [] })} />)
    const lev = screen.getByLabelText(/Levantamento \(dados da obra e ambientes\)/) as HTMLInputElement
    expect(lev.disabled).toBe(true); expect(lev.checked).toBe(false)
    fireEvent.click(screen.getByLabelText(/Licitações \(processos/)); fireEvent.click(screen.getByText('Baixar backup'))
    await screen.findByText(/Backup baixado/)
    const j = JSON.parse(await baixados[0].blob.text())
    expect(Object.keys(j).sort()).toEqual(['app', 'configuracoes', 'formato', 'geradoEm', 'versaoApp'])
  })
  it('nada marcado: avisa e não baixa', () => {
    render(<Backup {...props({ iniciado: false, ambientes: [] })} />)
    fireEvent.click(screen.getByLabelText(/Configurações e biblioteca/)); fireEvent.click(screen.getByLabelText(/Licitações \(processos/))
    fireEvent.click(screen.getByText('Baixar backup'))
    expect(screen.getByRole('alert').textContent).toContain('pelo menos uma parte'); expect(baixados).toHaveLength(0)
  })
})

describe('restaurar backup: prévia, confirmação e substituição', () => {
  const novo = () => montarBackup('v30', {
    configuracoes: { ...PARAMS_PADRAO, eltTomadas: 99, conexoes: [{ id: 'k', nome: 'Luva', sistema: 'agua', porPonto: { vaso: 1 }, porPontoGeral: 0, fixa: 0, perda: 0 }] },
    levantamento: { obra: { ...obra, nome: 'Casa Nova' }, ambientes: [{ id: 'x', nome: 'Quarto', comprimento: 3, largura: 3, unidade: 'm' }, { id: 'y', nome: 'Banho', comprimento: 2, largura: 2, unidade: 'm' }], aberturas: [] },
    licitacoes: { processos: [{ ...proc, id: 'pn' }], materiais: [{ ...mat, id: 'mn', processoId: 'pn', nomePadronizado: 'Areia' }], movimentos: [], equivalencias: [] },
  }, new Date('2026-10-01T10:00:00Z'))

  it('mostra o que o arquivo contém e o que será substituído, e só restaura depois da confirmação', async () => {
    await salvar('processos', proc); await salvar('materiais', mat); salvarParams({ ...PARAMS_PADRAO, eltTomadas: 7 })
    const onRestaurar = vi.fn()
    render(<Backup {...props({ onRestaurar })} />)
    escolher(arquivo(novo()))
    expect(await screen.findByText(/gerado na versão v30/)).toBeTruthy()
    expect(screen.getByText(/1 composição\(ões\)|0 composição\(ões\), 1 conexão/)).toBeTruthy()
    expect(screen.getByText(/obra "Casa Nova", 2 ambiente\(s\)/)).toBeTruthy(); expect(screen.getByText(/Substitui o levantamento atual \(1 ambiente\(s\)\)/)).toBeTruthy()
    expect(screen.getByText(/Substitui TODAS as licitações atuais, de uma vez/)).toBeTruthy()
    const botao = screen.getByText('Restaurar partes marcadas').closest('button') as HTMLButtonElement
    expect(botao.disabled).toBe(true) // falta confirmar
    expect((await listar<Material>('materiais')).map((m) => m.id)).toEqual(['m1']) // nada mudou até aqui
    fireEvent.click(screen.getByLabelText(/Entendi que a restauração substitui/)); expect(botao.disabled).toBe(false)
    fireEvent.click(botao)
    expect(await screen.findByText(/Restaurado: licitações, configurações e biblioteca, levantamento\./)).toBeTruthy()
    expect((await listar<Material>('materiais')).map((m) => m.id)).toEqual(['mn'])
    expect(carregarParams().eltTomadas).toBe(99); expect(carregarParams().conexoes).toHaveLength(1)
    expect(onRestaurar).toHaveBeenCalledTimes(1)
    const r = onRestaurar.mock.calls[0][0]
    expect(r.levantamento.obra.nome).toBe('Casa Nova'); expect(r.levantamento.ambientes.map((a: Ambiente) => a.nome)).toEqual(['Quarto', 'Banho']); expect(r.configuracoes.eltTomadas).toBe(99)
  })
  it('restaura só as partes marcadas: sem licitações, o banco não muda', async () => {
    await salvar('processos', proc); await salvar('materiais', mat)
    const onRestaurar = vi.fn(); render(<Backup {...props({ onRestaurar })} />)
    escolher(arquivo(novo())); await screen.findByText(/gerado na versão/)
    const sec = within(screen.getByLabelText('Restaurar backup')) // os mesmos rótulos existem na seção de backup
    fireEvent.click(sec.getByLabelText(/Licitações \(processos/)); fireEvent.click(sec.getByLabelText(/Configurações e biblioteca/))
    fireEvent.click(sec.getByLabelText(/Entendi/)); fireEvent.click(sec.getByText('Restaurar partes marcadas'))
    await screen.findByText(/Restaurado: levantamento\./)
    expect((await listar<Material>('materiais')).map((m) => m.id)).toEqual(['m1']); expect(carregarParams().eltTomadas).toBe(PARAMS_PADRAO.eltTomadas)
    expect(Object.keys(onRestaurar.mock.calls[0][0])).toEqual(['levantamento'])
  })
  it('arquivo inválido mostra os erros e não oferece restauração', async () => {
    render(<Backup {...props()} />)
    escolher(arquivo('isto não é json')); expect((await screen.findByRole('alert')).textContent).toContain('JSON válido')
    expect(screen.queryByText('Restaurar partes marcadas')).toBeNull()
    escolher(arquivo({ app: 'outro-app', formato: 1 })); await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('não é um backup da Calculadora'))
  })
  it('avisos de dados inconsistentes aparecem na prévia, e baixar a cópia do estado atual está disponível', async () => {
    const b = novo(); b.licitacoes!.materiais[0].processoId = 'inexistente'
    render(<Backup {...props()} />)
    escolher(arquivo(b)); expect((await screen.findByRole('note')).textContent).toContain('apontam para um processo que não está no arquivo')
    fireEvent.click(screen.getByText('Baixar cópia do estado atual')); await screen.findByText(/Cópia do estado atual baixada/)
    expect(JSON.parse(await baixados[0].blob.text()).licitacoes.processos).toEqual([]) // o estado atual (vazio) foi guardado
  })
  it('falha ao gravar as configurações: informa o que já tinha sido restaurado antes', async () => {
    render(<Backup {...props()} />)
    escolher(arquivo(novo())); await screen.findByText(/gerado na versão/)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cheio') })
    fireEvent.click(screen.getByLabelText(/Entendi/)); fireEvent.click(screen.getByText('Restaurar partes marcadas'))
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('Não foi possível gravar as configurações'); expect(alerta.textContent).toContain('Já restaurado antes da falha: licitações')
  })
})
