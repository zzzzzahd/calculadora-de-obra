import { expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import Quantitativos from './Quantitativos'

const obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm' as const, pavimentos: 1, terreno: 'plano' as const, desnivel: false, movimentoTerra: 'nenhum' as const }
it('perguntas de 0/1 viram Sim/Não e a seção de traços aparece', () => {
  const h = renderToString(<Quantitativos obra={obra} ambientes={[{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' }]} />).replace(/<!-- -->/g, '')
  expect(h).not.toContain('1 = sim')
  for (const t of ['Calcular vergas', 'Traços e aditivos', 'Aditivo no concreto', 'Reboco forte', 'Massa corrida PVA']) expect(h).toContain(t)
  expect(h).toMatch(/<option[^>]*value="1"[^>]*>Sim<\/option><option[^>]*value="0"[^>]*>Não<\/option>/)
})

it('parâmetros de demolição só aparecem quando há algo a demolir', () => {
  const render = (acoes?: { paredes: 'demolir' }) => renderToString(<Quantitativos obra={obra} ambientes={[{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm', acoes }]} />).replace(/<!-- -->/g, '')
  expect(render()).not.toContain('Espessura da parede demolida')
  const h = render({ paredes: 'demolir' })
  for (const t of ['Demolição e entulho', 'Espessura da parede demolida', 'Empolamento do entulho']) expect(h).toContain(t)
})
