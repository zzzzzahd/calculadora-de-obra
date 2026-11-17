import { describe, expect, it } from 'vitest'
import { calcular, consolidar, PARAMS_PADRAO } from './engine'
import type { Ambiente, Obra } from '../types'

const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }
const sala: Ambiente[] = [{ id: '1', nome: 'Sala', comprimento: 7, largura: 5, unidade: 'm' }]
const get = (i: ReturnType<typeof calcular>, etapa: string, mat: string) => i.find((x) => x.etapa === etapa && x.material === mat)!

describe('motor de cálculo — sala 5×7', () => {
  it('blocos com perda e arredondamento', () => {
    const b = get(calcular(obra, sala, PARAMS_PADRAO), 'Alvenaria', 'Bloco')
    expect(b.bruto).toBeCloseTo((67.2 / (0.39 * 0.19)) * 1.05, 3)
    expect(b.final).toBe(Math.ceil(b.bruto))
  })
  it('desconta portas e janelas da alvenaria', () => {
    const p = { ...PARAMS_PADRAO, aberturas: [{ id: 'a', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 1 }] }
    const sem = get(calcular(obra, sala, PARAMS_PADRAO), 'Alvenaria', 'Bloco').bruto
    expect(get(calcular(obra, sala, p), 'Alvenaria', 'Bloco').bruto).toBeLessThan(sem)
  })
  it('volume do contrapiso = 35 × 0,05 × 1,05', () => {
    expect(get(calcular(obra, sala, PARAMS_PADRAO), 'Contrapiso e piso', 'Concreto do contrapiso').bruto).toBeCloseTo(1.8375, 4)
  })
  it('consolida cimento de várias etapas', () => {
    const itens = calcular(obra, sala, PARAMS_PADRAO)
    const c = consolidar(itens).find((x) => x.material === 'Cimento')!
    expect(c.bruto).toBeCloseTo(itens.filter((i) => i.material === 'Cimento').reduce((s, i) => s + i.bruto, 0))
    expect(c.etapas).toContain('Alvenaria')
  })
  it('sem medidas não gera itens', () => {
    expect(calcular(obra, [], PARAMS_PADRAO)).toEqual([])
  })
  it('cobertura usa a área inclinada, não a horizontal', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0 }
    const itens = calcular(obra, sala, p)
    const t = get(itens, 'Cobertura e madeiramento', 'Telha')
    expect(t.bruto).toBeCloseTo(10 * 6 * Math.sqrt(1.09) * 16 * 1.05, 3)
    expect(t.bruto).toBeGreaterThan(60 * 16 * 1.05)
    expect(itens.some((i) => i.material === 'Cumeeira')).toBe(true)
    expect(calcular(obra, sala, { ...p, aguas: 1 }).some((i) => i.material === 'Cumeeira')).toBe(false)
  })
  it('sem dimensões do telhado não inventa cobertura', () => {
    expect(calcular(obra, sala, PARAMS_PADRAO).some((i) => i.etapa === 'Cobertura e madeiramento')).toBe(false)
  })
  it('fundação e estrutura só com dimensões informadas', () => {
    expect(calcular(obra, sala, PARAMS_PADRAO).some((i) => i.etapa === 'Fundação' || i.etapa === 'Estrutura')).toBe(false)
    const p = { ...PARAMS_PADRAO, fundComp: 24, fundLarg: 0.3, fundAlt: 0.4 }
    const itens = calcular(obra, sala, p)
    expect(get(itens, 'Fundação', 'Concreto da fundação').bruto).toBeCloseTo(24 * 0.3 * 0.4 * 1.05, 4)
    expect(itens.some((i) => i.material.startsWith('Aço'))).toBe(false)
    expect(calcular(obra, sala, { ...p, acoKgM3: 80 }).some((i) => i.material.startsWith('Aço'))).toBe(true)
  })
  it('aterro só se a obra tem aterro', () => {
    const p = { ...PARAMS_PADRAO, aterroH: 0.3 }
    expect(calcular(obra, sala, p).some((i) => i.material === 'Aterro')).toBe(false)
    expect(get(calcular({ ...obra, movimentoTerra: 'aterro' }, sala, p), 'Preparação do terreno', 'Aterro').bruto).toBeCloseTo(35 * 0.3 * 1.2, 4)
  })
  it('revestimento usa área líquida × faces', () => {
    expect(get(calcular(obra, sala, PARAMS_PADRAO), 'Revestimentos', 'Chapisco').bruto).toBeCloseTo(67.2 * 2, 4)
  })
  it('pintura completa: massa, selador, lixa, rolo e pincel', () => {
    const i = calcular(obra, sala, PARAMS_PADRAO)
    expect(get(i, 'Pintura', 'Massa corrida PVA').bruto).toBeCloseTo((67.2 * 2) / 50, 4)
    expect(get(i, 'Pintura', 'Selador').bruto).toBeCloseTo(67.2 / 12 / 18, 4)
    expect(get(i, 'Pintura', 'Tinta').bruto).toBeCloseTo((67.2 * 2) / 10 / 18, 4)
    for (const m of ['Lixa', 'Rolo de pintura', 'Pincel']) expect(get(i, 'Pintura', m)).toBeTruthy()
    expect(i.some((x) => x.material === 'Fita crepe')).toBe(false)
  })
  it('duas cores dividem a tinta; massa acrílica; fita com aberturas', () => {
    const ab = [{ id: 'a', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 1 }]
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, cor2Pct: 40, massaTipo: 2, aberturas: ab })
    const liq = 67.2 - 0.8 * 2.1
    expect(get(i, 'Pintura', 'Tinta (cor 1)').bruto).toBeCloseTo((liq * 0.6 * 2) / 10 / 18, 4)
    expect(get(i, 'Pintura', 'Tinta (cor 2)').bruto).toBeCloseTo((liq * 0.4 * 2) / 10 / 18, 4)
    expect(i.some((x) => x.material === 'Massa acrílica')).toBe(true)
    expect(get(i, 'Pintura', 'Fita crepe').bruto).toBeCloseTo((2 * (0.8 + 2.1)) / 50, 4)
  })
  it('sem massa e sem selador, esses itens somem', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, massaTipo: 0, seladorPct: 0 })
    expect(i.some((x) => x.material.startsWith('Massa') || x.material === 'Selador')).toBe(false)
  })
  it('instalações só contam o que foi informado', () => {
    expect(calcular(obra, sala, PARAMS_PADRAO).some((i) => i.etapa.startsWith('Instalações') || i.etapa === 'Drenagem')).toBe(false)
    const p = { ...PARAMS_PADRAO, eltTomadas: 10, eltInterruptores: 4, eltPontosLuz: 6, eltDisjuntores: 8, hidPontosAgua: 5, vasos: 1, drenTuboM: 12 }
    const i = calcular(obra, sala, p)
    expect(get(i, 'Instalações elétricas', 'Caixa 4×2').bruto).toBe(14)
    expect(get(i, 'Instalações elétricas', 'Eletroduto (barras)').bruto).toBeCloseTo(((20 * 6) / 3) * 1.1, 4)
    expect(get(i, 'Instalações elétricas', 'Quadro de distribuição').bruto).toBe(1)
    expect(get(i, 'Instalações hidráulicas e sanitárias', 'Conexões de água fria').bruto).toBe(15)
    expect(get(i, 'Drenagem', 'Brita de envelopamento').bruto).toBeCloseTo(0.48, 4)
  })
  it('rodapé desconta largura das portas; acessórios do piso', () => {
    const ab = [{ id: 'a', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 1 }]
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, aberturas: ab })
    expect(get(i, 'Contrapiso e piso', 'Rodapé (peças)').bruto).toBeCloseTo(((24 - 0.8) / 2.4) * 1.1, 4)
    expect(get(i, 'Contrapiso e piso', 'Rejunte').bruto).toBeCloseTo(17.5, 4)
    expect(get(i, 'Contrapiso e piso', 'Argamassa colante').bruto).toBeCloseTo((35 * 4.5) / 20, 4)
  })
  it('calha e rufo só com cobertura e com opção ligada', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0, calha: 1, condutorN: 2, rufoM: 5 }
    const i = calcular(obra, sala, p)
    expect(get(i, 'Cobertura e madeiramento', 'Calha (barras)').bruto).toBeCloseTo(((10 * 2) / 3) * 1.05, 4)
    expect(get(i, 'Cobertura e madeiramento', 'Condutor (barras)').bruto).toBeCloseTo(2, 4)
    expect(calcular(obra, sala, { ...p, roofC: 0 }).some((x) => x.material.startsWith('Calha'))).toBe(false)
  })
  it('telhado de 4 águas: área inclinada, madeira por área, cumeeira e espigões', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0, aguas: 4 }
    const i = calcular(obra, sala, p)
    const fator = Math.sqrt(1.09), area = 10 * 6 * fator
    expect(get(i, 'Cobertura e madeiramento', 'Telha').bruto).toBeCloseTo(area * 16 * 1.05, 3)
    expect(get(i, 'Cobertura e madeiramento', 'Ripa (barras)').bruto).toBeCloseTo((area / 0.33 / 3) * 1.1, 3)
    expect(get(i, 'Cobertura e madeiramento', 'Cumeeira').bruto).toBeCloseTo((4 / 0.4) * 1.05, 3)
    expect(get(i, 'Cobertura e madeiramento', 'Espigão').bruto).toBeCloseTo(((4 * 3 * Math.sqrt(2.09)) / 0.4) * 1.05, 3)
    expect(calcular(obra, sala, { ...p, roofC: 6 }).some((x) => x.material === 'Cumeeira')).toBe(false) // pirâmide: sem cumeeira
    expect(get(calcular(obra, sala, { ...p, calha: 1 }), 'Cobertura e madeiramento', 'Calha (barras)').bruto).toBeCloseTo(((2 * 16) / 3) * 1.05, 3)
  })
  it('espigões informados valem para qualquer telhado', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0, aguas: 1, espigaoExtraM: 8 }
    expect(get(calcular(obra, sala, p), 'Cobertura e madeiramento', 'Espigão').bruto).toBeCloseTo((8 / 0.4) * 1.05, 3)
    expect(calcular(obra, sala, { ...p, espigaoExtraM: 0 }).some((x) => x.material === 'Espigão')).toBe(false)
  })
  it('vergas e contravergas pelas portas e janelas', () => {
    const ab = [{ id: 'a', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 1 }, { id: 'b', tipo: 'Janela' as const, largura: 1.2, altura: 1, qtd: 1 }]
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, aberturas: ab })
    expect(get(i, 'Alvenaria', 'Concreto de vergas e contravergas').bruto).toBeCloseTo(5 * 0.14 * 0.1 * 1.05, 5) // 1,4 + 2 × 1,8 = 5 m
    expect(calcular(obra, sala, { ...PARAMS_PADRAO, aberturas: ab, vergas: 0 }).some((x) => x.material.includes('vergas'))).toBe(false)
  })
  it('laje, formas e escoramento', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, lajeArea: 20, lajeEsp: 10 })
    expect(get(i, 'Laje', 'Concreto da laje').bruto).toBeCloseTo(2 * 1.05, 4)
    expect(get(i, 'Laje', 'Escora de laje').bruto).toBeCloseTo(24, 4)
    expect(get(i, 'Formas e escoramento', 'Compensado resinado (chapa 1,22 × 2,44 m)').bruto).toBeCloseTo((20 / 2.9768 / 3) * 1.1, 4)
  })
  it('impermeabilização, transporte de terra e cal', () => {
    expect(get(calcular(obra, sala, { ...PARAMS_PADRAO, imperArea: 6, imperBaldrame: 0 }), 'Impermeabilização', 'Impermeabilizante').bruto).toBeCloseTo(18, 4)
    const aterro = calcular({ ...obra, movimentoTerra: 'aterro' }, sala, { ...PARAMS_PADRAO, aterroH: 0.3, transporte: 1 })
    expect(get(aterro, 'Preparação do terreno', 'Transporte de terra (viagens)').bruto).toBeCloseTo((35 * 0.3 * 1.2) / 6, 4)
    expect(get(calcular(obra, sala, { ...PARAMS_PADRAO, calKgM3: 100 }), 'Alvenaria', 'Cal hidratada').bruto).toBeCloseTo((67.2 * 0.012 * 1.1 * 100) / 20, 4)
    expect(calcular(obra, sala, PARAMS_PADRAO).some((x) => x.material === 'Cal hidratada')).toBe(false)
  })
  it('fixação e manta do telhado', () => {
    const p = { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0, mantaCob: 1 }
    const i = calcular(obra, sala, p)
    const area = 10 * 6 * Math.sqrt(1.09)
    expect(get(i, 'Cobertura e madeiramento', 'Fixação do telhado (parafusos/ganchos)').bruto).toBeCloseTo(area * 2 * 1.05, 3)
    expect(get(i, 'Cobertura e madeiramento', 'Manta de subcobertura').bruto).toBeCloseTo(area * 1.05, 3)
  })
  it('esquadrias agrupadas por medida, com fechaduras', () => {
    const ab = [{ id: 'a', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 1 }, { id: 'b', tipo: 'Porta' as const, largura: 0.8, altura: 2.1, qtd: 2 }, { id: 'c', tipo: 'Janela' as const, largura: 1.2, altura: 1, qtd: 1 }]
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, aberturas: ab })
    expect(i.find((x) => x.etapa === 'Esquadrias' && x.material.startsWith('Porta'))!.bruto).toBe(3)
    expect(get(i, 'Esquadrias', 'Fechadura e dobradiças (jogo)').bruto).toBe(3)
    expect(calcular(obra, sala, { ...PARAMS_PADRAO, aberturas: ab, esquadrias: 0 }).some((x) => x.etapa === 'Esquadrias')).toBe(false)
  })
  it('muro: blocos, argamassa, fundação e pilaretes', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, muroComp: 20, muroAlt: 2 })
    expect(get(i, 'Muro', 'Bloco').bruto).toBeCloseTo((40 / (0.39 * 0.19)) * 1.05, 3)
    expect(get(i, 'Muro', 'Concreto do muro (fundação e pilaretes)').bruto).toBeCloseTo((20 * 0.3 * 0.4 + 8 * 0.14 * 0.14 * 2) * 1.05, 4)
    expect(i.some((x) => x.etapa === 'Formas e escoramento')).toBe(true)
  })
  it('calçada e escada', () => {
    const c = calcular(obra, sala, { ...PARAMS_PADRAO, calcArea: 30, calcEsp: 7, calcTela: 1 })
    expect(get(c, 'Calçada e áreas externas', 'Cimento').bruto).toBeCloseTo((30 * 0.07 * 1.05 * 300) / 50, 4)
    expect(get(c, 'Calçada e áreas externas', 'Brita de lastro').bruto).toBeCloseTo(30 * 0.05 * 1.05, 4)
    expect(get(c, 'Calçada e áreas externas', 'Tela soldada').bruto).toBeCloseTo(31.5, 4)
    const e = calcular(obra, sala, { ...PARAMS_PADRAO, escLarg: 1, escAlt: 2.7 })
    expect(get(e, 'Escada', 'Degraus (quantidade)').bruto).toBe(15)
    const li = Math.sqrt(4.2 * 4.2 + 2.7 * 2.7)
    expect(get(e, 'Escada', 'Concreto da escada').bruto).toBeCloseTo((li * 0.12 + 15 * 0.5 * 0.28 * 0.18) * 1.05, 4)
  })
  it('laje pré-moldada', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, preLajeArea: 20 })
    expect(get(i, 'Laje pré-moldada', 'Vigota').bruto).toBeCloseTo((20 / 0.42) * 1.05, 4)
    expect(get(i, 'Laje pré-moldada', 'Lajota/EPS de enchimento').bruto).toBeCloseTo((20 / (0.42 * 0.3)) * 1.05, 3)
    expect(get(i, 'Laje pré-moldada', 'Concreto do capeamento').bruto).toBeCloseTo(20 * 0.04 * 1.05, 4)
    expect(get(i, 'Laje pré-moldada', 'Escora de laje').bruto).toBeCloseTo(24, 4)
  })
  it('fossa e sumidouro', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, fosCompr: 2, fosLarg: 1, fosProf: 1.5, sumDiam: 1.2, sumProf: 3 })
    const S = 'Fossa séptica e sumidouro'
    expect(get(i, S, 'Concreto da fossa (fundo e tampa)').bruto).toBeCloseTo(2.28 * 1.28 * 0.18 * 1.05, 4)
    expect(get(i, S, 'Revestimento interno impermeável (fossa)').bruto).toBeCloseTo(11, 4)
    expect(i.find((x) => x.etapa === S && x.material === 'Brita' && x.tipo === 'Geométrico')!.bruto).toBeCloseTo(Math.PI * 0.74 ** 2 * 0.5, 4) // brita do fundo (a do concreto é outra linha)
    expect(i.filter((x) => x.etapa === S && x.material === 'Escavação')).toHaveLength(2)
  })
  it('piscina', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, pisC: 6, pisL: 3 })
    expect(get(i, 'Piscina', 'Concreto da piscina (fundo e paredes)').bruto).toBeCloseTo((6.3 * 3.3 * 0.15 + 2 * 9.6 * 1.4 * 0.15) * 1.05, 4)
    expect(get(i, 'Piscina', 'Impermeabilizante').bruto).toBeCloseTo(43.2 * 3, 4)
    expect(get(i, 'Piscina', 'Revestimento da piscina').bruto).toBeCloseTo(43.2 * 1.1, 4)
    expect(get(i, 'Piscina', 'Skimmer').bruto).toBe(1)
    expect(i.some((x) => x.etapa === 'Formas e escoramento')).toBe(true)
  })
  it('drywall: paredes e forro', () => {
    const w = calcular(obra, sala, { ...PARAMS_PADRAO, dwComp: 10, dwAlt: 2.7, dwFaces: 2 })
    const D = 'Gesso e drywall'
    expect(get(w, D, 'Chapa de drywall').bruto).toBeCloseTo((54 / 2.88) * 1.1, 4)
    expect(get(w, D, 'Montante (barras)').bruto).toBeCloseTo(((17 + 1) * 2.7 / 3) * 1.1, 4)
    expect(get(w, D, 'Guia (barras)').bruto).toBeCloseTo((20 / 3) * 1.1, 4)
    const f = calcular(obra, sala, { ...PARAMS_PADRAO, dwForroArea: 20 })
    expect(get(f, D, 'Chapa de drywall').bruto).toBeCloseTo((20 / 2.88) * 1.1, 4)
    expect(get(f, D, 'Pendural').bruto).toBeCloseTo(24, 4)
  })
  it('estrutura metálica e de madeira', () => {
    const m = calcular(obra, sala, { ...PARAMS_PADRAO, metComp: 60, metKgM: 8, madComp: 30 })
    expect(get(m, 'Estrutura metálica', 'Perfil metálico (bitola conforme projeto)').bruto).toBeCloseTo(10.5, 4)
    expect(get(m, 'Estrutura metálica', 'Peso do aço estrutural').bruto).toBe(480)
    expect(get(m, 'Estrutura metálica', 'Eletrodo de solda').bruto).toBeCloseTo(4.8, 4)
    expect(get(m, 'Estrutura metálica', 'Tinta de fundo anticorrosiva').bruto).toBeCloseTo((60 * 0.5 * 2) / 8 / 18, 4)
    expect(get(m, 'Estrutura de madeira', 'Madeira estrutural (bitola conforme projeto)').bruto).toBeCloseTo(11, 4)
    expect(get(m, 'Estrutura de madeira', 'Prego/parafuso para madeira').bruto).toBeCloseTo(0.6, 4)
  })
  it('telha metálica substitui a telha por unidade', () => {
    const i = calcular(obra, sala, { ...PARAMS_PADRAO, roofC: 10, roofL: 6, beiral: 0, telhaMetalica: 1 })
    expect(i.some((x) => x.material === 'Telha')).toBe(false)
    expect(get(i, 'Cobertura e madeiramento', 'Telha metálica trapezoidal').bruto).toBeCloseTo(10 * 6 * Math.sqrt(1.09) * 1.1 * 1.05, 3)
  })
  it('tipo de fundação: radier, sapatas e estacas (corrida só no tipo 0)', () => {
    const base = { ...PARAMS_PADRAO, fundComp: 24, fundLarg: 0.3, fundAlt: 0.4 }
    expect(calcular(obra, sala, { ...base, fundTipo: 1 }).some((x) => x.material === 'Concreto da fundação')).toBe(false)
    const r = calcular(obra, sala, { ...base, fundTipo: 1, radierArea: 40, fundPerim: 28 })
    expect(get(r, 'Fundação', 'Concreto do radier').bruto).toBeCloseTo(40 * 0.15 * 1.05, 4)
    expect(get(r, 'Fundação', 'Forma (área de contato)').bruto).toBeCloseTo(28 * 0.15, 4)
    expect(get(r, 'Fundação', 'Lona plástica').bruto).toBeCloseTo(42, 4)
    const s = calcular(obra, sala, { ...PARAMS_PADRAO, fundTipo: 2, sapN: 6, sapL: 0.8, sapB: 0.8, sapH: 0.4 })
    expect(get(s, 'Fundação', 'Concreto das sapatas').bruto).toBeCloseTo(6 * 0.8 * 0.8 * 0.4 * 1.05, 4)
    const e = calcular(obra, sala, { ...PARAMS_PADRAO, fundTipo: 3, estN: 8, estProf: 4 })
    expect(get(e, 'Fundação', 'Concreto das estacas').bruto).toBeCloseTo(8 * Math.PI * 0.125 ** 2 * 4 * 1.05, 4)
    expect(get(e, 'Fundação', 'Perfuração de estaca').bruto).toBe(32)
  })
  it('escada em L e em U com patamar', () => {
    const lance = (n: number) => 1 * (n * Math.sqrt(0.28 ** 2 + 0.18 ** 2)) * 0.12 + n * 0.5 * 0.28 * 0.18
    const base = { ...PARAMS_PADRAO, escLarg: 1, escAlt: 2.7 }
    const reta = get(calcular(obra, sala, base), 'Escada', 'Concreto da escada').bruto
    const L = calcular(obra, sala, { ...base, escTipo: 1 })
    expect(get(L, 'Escada', 'Degraus (quantidade)').bruto).toBe(15)
    expect(get(L, 'Escada', 'Concreto da escada').bruto).toBeCloseTo((lance(8) + lance(7) + 1 * 0.12) * 1.05, 4)
    expect(get(L, 'Escada', 'Revestimento dos degraus').bruto).toBeCloseTo((15 * 0.46 + 1) * 1.1, 4)
    const U = calcular(obra, sala, { ...base, escTipo: 2 })
    expect(get(U, 'Escada', 'Concreto da escada').bruto).toBeCloseTo((lance(8) + lance(7) + 2.1 * 0.12) * 1.05, 4)
    expect(get(L, 'Escada', 'Concreto da escada').bruto).toBeGreaterThan(reta)
    expect(get(calcular(obra, sala, { ...base, escTipo: 3 }), 'Escada', 'Concreto da escada').bruto).toBeCloseTo(reta, 6)
  })
})
