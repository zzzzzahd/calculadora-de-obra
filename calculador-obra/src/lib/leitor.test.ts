import { describe, expect, it } from 'vitest'
import { validarLeitura } from './leitor'

const resp = '```json\n' + JSON.stringify({
  ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 7, origem: 'cota', confianca: 0.95 }, { nome: 'Quarto', comprimento_m: null, largura_m: 3, confianca: 2 }],
  altura_parede_m: 2.7, portas: [{ largura_m: 0.8, altura_m: 2.1, qtd: 2 }, { largura_m: null, altura_m: 2.1, qtd: 1 }], janelas: [{ largura_m: 1.2, altura_m: 1, qtd: 1 }], avisos: ['escala ausente'],
}) + '\n```'

describe('leitor de plantas — validação', () => {
  const l = validarLeitura(resp)
  it('mantém cotas e zera medidas ilegíveis sem inventar', () => {
    expect(l.ambientes[0]).toMatchObject({ comprimento: 5, largura: 7, origem: 'cota' })
    expect(l.ambientes[1]).toMatchObject({ comprimento: 0, largura: 3, origem: 'estimada', confianca: 1 })
    expect(l.avisos.some((a) => a.includes('Quarto'))).toBe(true)
  })
  it('converte portas e janelas válidas e descarta as incompletas', () => {
    expect(l.aberturas).toHaveLength(2)
    expect(l.aberturas[0]).toMatchObject({ tipo: 'Porta', qtd: 2 })
    expect(l.alturaParede).toBe(2.7)
  })
  it('rejeita resposta sem JSON', () => {
    expect(() => validarLeitura('não consegui ler')).toThrow()
  })
})
