import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import DescreverObra from './DescreverObra'
import { aplicarIA, mesclar, sessaoVazia, validarExtracao } from '../lib/descricao'
import Quantitativos from './Quantitativos'
import App from '../App'

const html = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '')
const IA = JSON.stringify({ obra: { altura_parede_m: 3 }, ambientes: [{ nome: 'Sala 1', comprimento_m: 7, largura_m: 7 }, { nome: 'Sala 2', comprimento_m: 7, largura_m: 7 }], materiais: { bloco: 'ceramico' }, instalacoes: { eletrica: true } })
const sessao = () => aplicarIA(sessaoVazia(), validarExtracao(IA), null).sessao

describe('tela do assistente de texto livre', () => {
  it('começa pedindo a descrição, avisa sobre a IA externa e não inventa medidas', () => {
    const h = html(<DescreverObra onAplicar={() => {}} />)
    for (const t of ['Descreva a obra com suas palavras', 'Entender descrição', 'serviço de IA externo', 'Não invento medidas', 'Ainda nada']) expect(h).toContain(t)
    expect(h).toMatch(/<button[^>]*disabled[^>]*>.*Entender descrição/)
    expect(h).not.toContain('Tenho o que preciso')
  })
  it('depois da descrição mostra UMA pergunta com a explicação do termo, o resumo e o botão de aplicar', () => {
    const h = html(<DescreverObra onAplicar={() => {}} sessaoInicial={sessao()} />)
    expect(h).toContain('A obra terá quantos pavimentos (andares)?')
    expect(h).toContain('Cada andar da construção')
    expect(h).toContain('Sala 1 (7 × 7 m)'); expect(h).toContain('Pé-direito: 3 m'); expect(h).toContain('Instalação elétrica')
    expect(h).toContain('Em aberto')
    expect(h).toContain('Aplicar ao levantamento'); expect(h).toContain('Não sei')
    expect((h.match(/Quantos pavimentos|quantos pavimentos/g) ?? []).length).toBe(1)
  })
  it('perguntas sim/não viram botões Sim e Não', () => {
    let s = sessao()
    s = { ...s, fatos: { ...s.fatos, 'obra.pavimentos': 1 } }
    const h = html(<DescreverObra onAplicar={() => {}} sessaoInicial={s} />)
    expect(h).toContain('dividem uma parede?'); expect(h).toContain('conta uma única vez')
    expect(h).toMatch(/>Sim<\/button><button[^>]*>Não<\/button>/)
  })
  it('contradição vira pergunta com as duas opções e bloqueia aplicar', () => {
    const s = mesclar(sessao(), validarExtracao(JSON.stringify({ ambientes: [{ nome: 'Sala 1', comprimento_m: 8 }] })))
    const h = html(<DescreverObra onAplicar={() => {}} sessaoInicial={s} />)
    expect(h).toContain('Qual vale?'); expect(h).toContain('Manter 7 m'); expect(h).toContain('Usar 8 m')
    expect(h).toContain('Resolva a pergunta de conflito')
    expect(h).toMatch(/<button[^>]*disabled[^>]*>Aplicar ao levantamento/)
  })
  it('avisos de plausibilidade aparecem ao lado', () => {
    const s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ ambientes: [{ nome: 'Sala', comprimento_m: 45, largura_m: 5 }] })))
    expect(html(<DescreverObra onAplicar={() => {}} sessaoInicial={s} />)).toContain('comprimento de 45 m é incomum')
  })
})

describe('integração com o resto do app', () => {
  const obra = { nome: '', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm' as const, pavimentos: 1, terreno: 'plano' as const, desnivel: false, movimentoTerra: 'nenhum' as const }
  const amb = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 7, unidade: 'm' as const }]
  it('Quantitativos aplica os ajustes do assistente (elétrica ligada e quantidades preenchidas)', () => {
    const sem = html(<Quantitativos obra={obra} ambientes={amb} />)
    const com = html(<Quantitativos obra={obra} ambientes={amb} ajustes={{ params: { eltTomadas: 8 }, flags: { eletrica: true, forro: false } }} />)
    expect(sem).not.toContain('Número de tomadas')
    expect(com).toContain('Instalações elétricas')
    expect(com).toContain('value="8"')
  })
  afterEach(() => vi.unstubAllGlobals())
  it('o menu inicial oferece "Descrever a obra com palavras" e mostra a versão', () => {
    vi.stubGlobal('document', { documentElement: { classList: { contains: () => false, toggle: () => {} } } }) // o teste roda sem navegador
    const h = html(<App />)
    expect(h).toContain('Descrever a obra com palavras'); expect(h).toContain('versão v33')
  })
})
