import { describe, expect, it } from 'vitest'
import { areaAmbiente, perimetroAmbiente, areaParedeBruta } from './geometry'
import { toMetros } from './units'
import type { Ambiente } from '../types'

const sala = (unidade: Ambiente['unidade'], c: number, l: number): Ambiente => ({ id: '1', nome: 'Sala', comprimento: c, largura: l, unidade })

describe('geometria', () => {
  it('sala 5 × 7 m', () => {
    expect(areaAmbiente(sala('m', 7, 5))).toBe(35)
    expect(perimetroAmbiente(sala('m', 7, 5))).toBe(24)
    expect(areaParedeBruta(sala('m', 7, 5), 2.8)).toBeCloseTo(67.2)
  })
  it('converte cm e mm', () => {
    expect(toMetros(250, 'cm')).toBe(2.5)
    expect(toMetros(2500, 'mm')).toBe(2.5)
    expect(areaAmbiente(sala('cm', 700, 500))).toBeCloseTo(35)
  })
})
