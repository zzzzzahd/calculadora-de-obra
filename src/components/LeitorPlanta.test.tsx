// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VisorPlanta from './VisorPlanta'
import LeitorPlanta from './LeitorPlanta'
import type { Leitura } from '../lib/leitor'

vi.mock('../lib/leitor', async (orig) => ({ ...(await orig<typeof import('../lib/leitor')>()), prepararImagem: vi.fn(), lerPlantaImagem: vi.fn() }))
vi.mock('../lib/planta/pdf', () => ({ abrirPdf: vi.fn(), renderizarPagina: vi.fn(), textoDaPagina: vi.fn() }))
import * as leitor from '../lib/leitor'
import * as pdf from '../lib/planta/pdf'

const PG = { largura: 1000, altura: 500 }
const clicar = (svg: Element, x: number, y: number) => fireEvent.click(svg, { clientX: x, clientY: y })
beforeEach(() => {
  // jsdom não calcula layout: o SVG exibido tem 500 × 250 px (metade da imagem de 1000 × 500)
  Element.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 500, height: 250, right: 500, bottom: 250, x: 0, y: 0, toJSON: () => ({}) } as DOMRect }
  File.prototype.arrayBuffer ??= async function () { return new ArrayBuffer(8) }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('visor da planta: cliques viram coordenadas normalizadas', () => {
  it('calibrar: dois cliques chamam onPontos com pontos de 0 a 1 e avisam o segundo ponto', () => {
    const onPontos = vi.fn()
    render(<VisorPlanta imagem="data:image/jpeg;base64,AAAA" pagina={PG} modo="calibrar" onPontos={onPontos} />)
    const svg = screen.getByTestId('camada-planta')
    expect(screen.getByText(/dois pontos com distância real/)).toBeTruthy()
    clicar(svg, 50, 125)
    expect(screen.getByText('Clique no segundo ponto.')).toBeTruthy(); expect(onPontos).not.toHaveBeenCalled()
    clicar(svg, 300, 125)
    expect(onPontos).toHaveBeenCalledWith({ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 })
  })
  it('navegar: clicar na caixa seleciona o ambiente e não gera pontos', () => {
    const onSel = vi.fn(), onPontos = vi.fn()
    const { container } = render(<VisorPlanta imagem="data:," pagina={PG} caixas={[{ id: 'a', rotulo: 'Sala', caixa: { x: 0.1, y: 0.1, w: 0.4, h: 0.3 } }]} onSelecionar={onSel} onPontos={onPontos} />)
    fireEvent.click(container.querySelector('g')!)
    expect(onSel).toHaveBeenCalledWith('a'); expect(onPontos).not.toHaveBeenCalled()
    expect(screen.getByText('1. Sala')).toBeTruthy()
  })
  it('zoom aumenta e diminui dentro dos limites', () => {
    render(<VisorPlanta imagem="data:," pagina={PG} />)
    expect((screen.getByLabelText('Diminuir zoom') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aumentar zoom')); expect(screen.getByText('150%')).toBeTruthy()
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByLabelText('Aumentar zoom'))
    expect(screen.getByText('400%')).toBeTruthy(); expect((screen.getByLabelText('Aumentar zoom') as HTMLButtonElement).disabled).toBe(true)
  })
})

const leitura = (): Leitura => ({
  ambientes: [
    { id: 'a', nome: 'Sala', comprimento: 5, largura: 1, origem: 'cota', confianca: 0.9, observacao: '', caixa: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 } },
    { id: 'b', nome: 'Quarto', comprimento: 7, largura: 1, origem: 'cota', confianca: 0.9, observacao: '', caixa: { x: 0.1, y: 0.5, w: 0.5, h: 0.2 } },
    { id: 'c', nome: 'Banho', comprimento: 2, largura: 2, origem: 'estimada', confianca: 0.5, observacao: '' },
  ],
  alturaParede: 2.8, aberturas: [], avisos: [], cotas: [],
})
const enviar = (nome: string, tipo: string) => fireEvent.change(screen.getByLabelText('Arquivo da planta'), { target: { files: [new File(['x'], nome, { type: tipo })] } })

describe('leitor de planta em tela dividida: calibração e conferência', () => {
  it('fluxo completo: imagem → interpretar → calibrar → conferir → usar medida da escala → confirmar', async () => {
    vi.mocked(leitor.prepararImagem).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', pagina: PG })
    vi.mocked(leitor.lerPlantaImagem).mockResolvedValue(leitura())
    const onConfirmar = vi.fn()
    render(<LeitorPlanta onConfirmar={onConfirmar} />)
    expect((screen.getByText('Interpretar planta').closest('button') as HTMLButtonElement).disabled).toBe(true)
    enviar('planta.png', 'image/png')
    await waitFor(() => expect((screen.getByText('Interpretar planta').closest('button') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Interpretar planta'))
    await screen.findByDisplayValue('Sala')
    expect(leitor.lerPlantaImagem).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA', [])
    expect((screen.getByText('Medir') as HTMLButtonElement).disabled).toBe(true) // medir só depois de calibrar

    fireEvent.click(screen.getByText('Calibrar'))
    const svg = screen.getByTestId('camada-planta')
    clicar(svg, 50, 125); clicar(svg, 300, 125) // 500 px da imagem → 5 m: 0,01 m/px
    fireEvent.change(screen.getByLabelText(/Distância real/), { target: { value: '5' } })
    fireEvent.click(screen.getByText('Aplicar'))
    expect(await screen.findByText(/Escala calibrada: 5,00 m/)).toBeTruthy()

    expect(screen.getByText(/Confere com a escala; pela escala: 5,00 × 1,00 m/)).toBeTruthy() // Sala: lida 5×1
    expect(screen.getByText(/Diverge da escala; pela escala: 5,00 × 1,00 m/)).toBeTruthy() // Quarto: lida 7×1
    expect(screen.getByText(/não marcou a posição deste ambiente/)).toBeTruthy() // Banho sem caixa

    fireEvent.click(screen.getAllByText('Usar medida da escala')[1]) // Quarto
    await waitFor(() => expect(screen.getAllByText(/Confere com a escala/)).toHaveLength(2))
    fireEvent.click(screen.getByLabelText(/Conferi as medidas/)) // checkbox
    fireEvent.click(screen.getByText('Confirmar e usar estas medidas'))
    const c = onConfirmar.mock.calls[0][0]
    expect(c.ambientes.map((a: { nome: string; comprimento: number; largura: number }) => [a.nome, a.comprimento, a.largura])).toEqual([['Sala', 5, 1], ['Quarto', 5, 1], ['Banho', 2, 2]])
    expect(c.ambientes[1].origem.observacao).toContain('medida estimada'); expect(c.ambientes[1].origem.observacao).toContain('medida pela escala calibrada')
    expect(c.ambientes[0].origem.observacao).toContain('medida de cota')
  })
  it('medir depois de calibrar mostra a distância em metros', async () => {
    vi.mocked(leitor.prepararImagem).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', pagina: PG })
    vi.mocked(leitor.lerPlantaImagem).mockResolvedValue(leitura())
    render(<LeitorPlanta onConfirmar={() => {}} />)
    enviar('p.png', 'image/png'); await waitFor(() => expect((screen.getByText('Interpretar planta').closest('button') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Interpretar planta')); await screen.findByDisplayValue('Sala')
    fireEvent.click(screen.getByText('Calibrar')); const svg = screen.getByTestId('camada-planta')
    clicar(svg, 50, 125); clicar(svg, 300, 125); fireEvent.change(screen.getByLabelText(/Distância real/), { target: { value: '5' } }); fireEvent.click(screen.getByText('Aplicar'))
    await screen.findByText(/Escala calibrada/)
    fireEvent.click(screen.getByText('Medir'))
    clicar(svg, 100, 50); clicar(svg, 100, 200) // 150 px de altura de exibição = 300 px da imagem → 3 m
    expect(await screen.findByText('3,00 m')).toBeTruthy()
  })
  it('calibração inválida mostra o erro e não cria escala', async () => {
    vi.mocked(leitor.prepararImagem).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', pagina: PG })
    vi.mocked(leitor.lerPlantaImagem).mockResolvedValue(leitura())
    render(<LeitorPlanta onConfirmar={() => {}} />)
    enviar('p.png', 'image/png'); await waitFor(() => expect((screen.getByText('Interpretar planta').closest('button') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Interpretar planta')); await screen.findByDisplayValue('Sala')
    fireEvent.click(screen.getByText('Calibrar')); const svg = screen.getByTestId('camada-planta')
    clicar(svg, 50, 125); clicar(svg, 51, 125) // 2 px de imagem: perto demais
    fireEvent.change(screen.getByLabelText(/Distância real/), { target: { value: '5' } }); fireEvent.click(screen.getByText('Aplicar'))
    expect((await screen.findByRole('alert')).textContent).toContain('muito próximos')
    expect(screen.queryByText(/Escala calibrada/)).toBeNull()
  })
  it('erro da IA aparece sem derrubar a tela', async () => {
    vi.mocked(leitor.prepararImagem).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', pagina: PG })
    vi.mocked(leitor.lerPlantaImagem).mockRejectedValue(new Error('Leitor de plantas não configurado'))
    render(<LeitorPlanta onConfirmar={() => {}} />)
    enviar('p.png', 'image/png'); await waitFor(() => expect((screen.getByText('Interpretar planta').closest('button') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Interpretar planta'))
    expect((await screen.findByRole('alert')).textContent).toContain('não configurado')
  })
  it('PDF: seletor de página, cotas do texto viram dicas para a IA e o arquivo é aberto uma vez', async () => {
    const doc = { numPages: 3 }
    vi.mocked(pdf.abrirPdf).mockResolvedValue(doc as never)
    vi.mocked(pdf.renderizarPagina).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,BBBB', pagina: PG })
    vi.mocked(pdf.textoDaPagina).mockResolvedValue({ pagina: { largura: 600, altura: 300 }, itens: [{ texto: '3,50', caixa: { x: 0.2, y: 0.3, w: 0.05, h: 0.02 } }, { texto: '420', caixa: { x: 0.5, y: 0.3, w: 0.05, h: 0.02 } }, { texto: 'SALA', caixa: { x: 0.1, y: 0.1, w: 0.05, h: 0.02 } }] })
    vi.mocked(leitor.lerPlantaImagem).mockResolvedValue(leitura())
    render(<LeitorPlanta onConfirmar={() => {}} />)
    enviar('planta.pdf', 'application/pdf')
    expect(await screen.findByText(/2 cota\(s\) encontrada\(s\) no texto do PDF.*1 sem unidade/)).toBeTruthy()
    expect(screen.getByLabelText('Página')).toBeTruthy()
    fireEvent.click(screen.getByText('Interpretar planta'))
    await screen.findByDisplayValue('Sala')
    expect(leitor.lerPlantaImagem).toHaveBeenCalledWith('data:image/jpeg;base64,BBBB', ['"3,50" em x=0.23, y=0.31 (3.5 m)', '"420" em x=0.53, y=0.31 (unidade incerta)'])
    fireEvent.change(screen.getByLabelText('Página'), { target: { value: '2' } })
    await waitFor(() => expect(pdf.renderizarPagina).toHaveBeenLastCalledWith(doc, 2))
    expect(pdf.abrirPdf).toHaveBeenCalledTimes(1) // trocar de página reaproveita o PDF aberto
    expect(screen.queryByDisplayValue('Sala')).toBeNull() // a leitura da página anterior é descartada
  })
  it('PDF sem texto selecionável avisa que só a IA lerá a imagem; PDF grande demais é recusado', async () => {
    vi.mocked(pdf.abrirPdf).mockResolvedValue({ numPages: 1 } as never)
    vi.mocked(pdf.renderizarPagina).mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,CCCC', pagina: PG })
    vi.mocked(pdf.textoDaPagina).mockResolvedValue({ pagina: { largura: 600, altura: 300 }, itens: [] })
    render(<LeitorPlanta onConfirmar={() => {}} />)
    enviar('escaneado.pdf', 'application/pdf')
    expect(await screen.findByText(/não tem texto selecionável/)).toBeTruthy()
    cleanup()
    render(<LeitorPlanta onConfirmar={() => {}} />)
    const grande = new File(['x'], 'g.pdf', { type: 'application/pdf' }); Object.defineProperty(grande, 'size', { value: 26_000_000 })
    fireEvent.change(screen.getByLabelText('Arquivo da planta'), { target: { files: [grande] } })
    expect((await screen.findByRole('alert')).textContent).toContain('25 MB')
  })
})
