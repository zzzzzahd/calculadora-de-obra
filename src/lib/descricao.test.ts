import { describe, expect, it } from 'vitest'
import type { Obra } from '../types'
import { calcular, PARAMS_PADRAO } from './engine'
import { aplicarFlags, flagsIniciais } from './assistente'
import { resolverLevantamento } from './paredes'
import { aplicarIA, avisosDe, ehNaoSei, linhasResumo, mesclar, montarLevantamento, numerosDe, proximaPergunta, responder, resolverContradicao, sessaoVazia, simNao, termosCitados, validarExtracao, type Pergunta, type Sessao } from './descricao'

// Resposta que a IA devolveria para o cenário A (simulada: nenhum teste chama a IA de verdade)
const IA_CENARIO_A = JSON.stringify({
  obra: { pavimentos: null, altura_parede_m: 3, tipo: null, terreno: null, reforma: null },
  ambientes: [
    { nome: 'Sala 1', tipo: 'sala', comprimento_m: 7, largura_m: 7, divide_parede_com: [] },
    { nome: 'Sala 2', tipo: 'sala', comprimento_m: 7, largura_m: 7, divide_parede_com: [] },
  ],
  aberturas: [{ tipo: 'porta', qtd: null, largura_m: null, altura_m: null, ambiente: null }, { tipo: 'janela', qtd: null, largura_m: null, altura_m: null, ambiente: null }],
  materiais: { bloco: 'ceramico', bloco_medida_cm: null, telha: 'fibrocimento', piso_peca_cm: null },
  cobertura: { havera: null, comprimento_m: null, largura_m: null },
  instalacoes: { eletrica: true, tomadas: null, interruptores: null, pontos_luz: null, disjuntores: null, hidraulica: null },
  acabamentos: { piso_citado: true, revestimento: null, pintura: null, forro: null },
  duvidas: [],
})
const comecar = (json = IA_CENARIO_A): Sessao => aplicarIA(sessaoVazia(), validarExtracao(json), null).sessao

describe('validação da resposta da IA', () => {
  it('lê o cenário A: ambientes, medidas, bloco, telha, elétrica e o que ficou em branco', () => {
    const e = validarExtracao(IA_CENARIO_A)
    expect(e.ambientes).toEqual(['Sala 1', 'Sala 2'])
    expect(e.fatos['amb:sala 1:comprimento']).toBe(7)
    expect(e.fatos['obra.altura']).toBe(3)
    expect(e.fatos['geral.blocoMaterial']).toBe('ceramico')
    expect(e.fatos['geral.telhaPreset']).toBe(3)
    expect(e.fatos['geral.cobertura']).toBe(true) // "cobertura de fibrocimento" implica haver telhado
    expect(e.fatos['geral.eletrica']).toBe(true)
    expect(e.fatos['obra.pavimentos']).toBeUndefined()
    expect(e.fatos['geral.blocoPreset']).toBeUndefined() // só o material: o tamanho será perguntado
    expect(e.aberturas.map((a) => a.tipo)).toEqual(['Porta', 'Janela'])
  })
  it('aceita JSON dentro de bloco de código e rejeita lixo', () => {
    expect(validarExtracao('```json\n' + IA_CENARIO_A + '\n```').ambientes).toHaveLength(2)
    expect(() => validarExtracao('desculpe, não entendi')).toThrow('dados válidos')
    expect(() => validarExtracao('{ quebrado')).toThrow('dados válidos')
  })
  it('descarta valores inválidos em vez de aceitar ou inventar', () => {
    const e = validarExtracao(JSON.stringify({ obra: { pavimentos: -2, altura_parede_m: 'alto', tipo: 'castelo' },
      ambientes: [{ nome: 'Sala', comprimento_m: -7, largura_m: 99999, piso: 'ouro', acoes: { paredes: 'explodir', piso: 'manter' } }],
      aberturas: [{ tipo: 'portao', qtd: 2 }, { tipo: 'porta', qtd: 0, largura_m: 50 }], materiais: { bloco_medida_cm: 'grande', telha: 'palha' } }))
    expect(e.fatos['obra.pavimentos']).toBeUndefined(); expect(e.fatos['obra.altura']).toBeUndefined(); expect(e.fatos['obra.tipo']).toBeUndefined()
    expect(e.fatos['amb:sala:comprimento']).toBeUndefined(); expect(e.fatos['amb:sala:largura']).toBeUndefined(); expect(e.fatos['amb:sala:piso']).toBeUndefined()
    expect(e.fatos['amb:sala:acao.paredes']).toBeUndefined(); expect(e.fatos['amb:sala:acao.piso']).toBe('manter')
    expect(e.aberturas).toEqual([{ tipo: 'Porta', qtd: undefined, largura: undefined, altura: undefined, ambiente: undefined }])
    expect(e.fatos['geral.blocoMedida']).toBeUndefined(); expect(e.fatos['geral.telhaPreset']).toBeUndefined()
  })
  it('identifica o bloco pela medida e pelo material; ambíguo continua em aberto', () => {
    const a = validarExtracao(JSON.stringify({ materiais: { bloco: 'ceramico', bloco_medida_cm: '14 x 19 x 39' } }))
    expect(a.fatos['geral.blocoPreset']).toBe(1)
    const b = validarExtracao(JSON.stringify({ materiais: { bloco_medida_cm: '14x19x39' } }))
    expect(b.fatos['geral.blocoPreset']).toBeUndefined() // existe cerâmico e de concreto com essa medida
  })
})

describe('perguntas: uma por vez, sem repetir', () => {
  it('cenário A: segue a ordem, pergunta só o que falta e termina', () => {
    let s = comecar()
    const ordem: string[] = []
    const respostas: Record<string, string> = {
      pavimentos: '1', divisas: 'sim', 'ab:Porta:0': '2 e 0,80 x 2,10', 'ab:Janela:1': '4 e 1,20 x 1,00', bloco: '14 x 19 x 39', pisoPeca: '60',
      coberturaMedidas: '14 por 7', 'elt:Tomadas': '8', 'elt:Interruptores': '3', 'elt:PontosLuz': '4', 'elt:Disjuntores': '4',
      hidraulica: 'não', revestimento: 'sim', pintura: 'sim', forro: 'não',
    }
    for (let i = 0; i < 40; i++) {
      const p = proximaPergunta(s)
      if (!p) break
      ordem.push(p.id)
      const r = responder(s, p, respostas[p.id] ?? 'não sei')
      expect(r.erro, `${p.id}: ${r.erro}`).toBeUndefined()
      s = r.sessao
    }
    expect(ordem).toEqual(Object.keys(respostas)) // nada fora do roteiro, nada repetido
    expect(new Set(ordem).size).toBe(ordem.length)
    expect(proximaPergunta(s)).toBeNull()
    expect(proximaPergunta(s)).toBeNull() // continua sem perguntar de novo
  })
  it('não pergunta o que o usuário já disse (medidas, pé-direito, elétrica)', () => {
    const ids: string[] = []
    let s = comecar()
    for (let i = 0; i < 40; i++) { const p = proximaPergunta(s); if (!p) break; ids.push(p.id); s = responder(s, p, 'não sei').sessao }
    expect(ids.some((id) => id.startsWith('medidas') || id === 'peDireito' || id === 'eletrica' || id === 'cobertura' || id === 'telha')).toBe(false)
  })
  it('"não sei" encerra a pergunta sem inventar valor e não repete', () => {
    let s = comecar()
    const p = proximaPergunta(s)!
    expect(p.id).toBe('pavimentos')
    s = responder(s, p, 'não sei').sessao
    expect(s.fatos['obra.pavimentos']).toBeUndefined()
    expect(proximaPergunta(s)!.id).not.toBe('pavimentos')
  })
  it('resposta inválida mantém a mesma pergunta com a explicação do erro', () => {
    const s = comecar(), p = proximaPergunta(s)!
    const r = responder(s, p, 'dois e meio')
    expect(r.erro).toContain('número')
    expect(r.sessao.respondidas).not.toContain('pavimentos')
    expect(responder(s, p, '2,5').erro).toContain('inteiro')
    expect(responder(s, p, '99').erro).toContain('fora do esperado')
  })
  it('sem ambientes, a primeira pergunta pede a descrição dos ambientes (e só a IA entende texto livre)', () => {
    const p = proximaPergunta(sessaoVazia())!
    expect(p.id).toBe('ambientes'); expect(p.tipo).toBe('texto')
    expect(responder(sessaoVazia(), p, 'uma casa com sala e dois quartos').precisaIA).toBe(true)
  })
  it('perguntas trazem explicação dos termos técnicos', () => {
    let s = comecar(); s = responder(s, proximaPergunta(s)!, '1').sessao
    const div = proximaPergunta(s)!
    expect(div.id).toBe('divisas'); expect(div.explicacao).toContain('conta uma única vez')
    const pe = proximaPergunta(mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4 }], obra: { pavimentos: 1 } }))))!
    expect(pe.id).toBe('peDireito'); expect(pe.explicacao).toContain('Altura do piso até o teto')
  })
  it('terceira entrada: aberturas "não" encerra; reforma pede as ações só quando há reforma', () => {
    let s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 2.8, reforma: true }, ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4 }] })))
    const a = proximaPergunta(s)!
    expect(a.id).toBe('acoes')
    s = responder(s, a, 'nada disso').precisaIA ? s : s
    s = responder(s, a, 'não').sessao
    const b = proximaPergunta(s)!
    expect(b.id).toBe('aberturas')
    s = responder(s, b, 'não').sessao
    expect(proximaPergunta(s)!.id).toBe('bloco')
  })
})

describe('contradições', () => {
  it('valor diferente do já informado vira pergunta e nada é sobrescrito antes da resposta', () => {
    const s = mesclar(comecar(), validarExtracao(JSON.stringify({ ambientes: [{ nome: 'sala 1', comprimento_m: 8 }] })))
    expect(s.fatos['amb:sala 1:comprimento']).toBe(7)
    const p = proximaPergunta(s)!
    expect(p.tipo).toBe('contradicao'); expect(p.texto).toContain('7 m'); expect(p.texto).toContain('8 m')
    const r = responder(s, p, '2')
    expect(r.sessao.fatos['amb:sala 1:comprimento']).toBe(8)
    expect(proximaPergunta(r.sessao)!.tipo).not.toBe('contradicao')
    expect(responder(s, p, '1').sessao.fatos['amb:sala 1:comprimento']).toBe(7)
  })
  it('repetir o mesmo valor não gera contradição nem duplica ambientes ou aberturas', () => {
    const s = mesclar(comecar(), validarExtracao(IA_CENARIO_A))
    expect(s.contradicoes).toHaveLength(0); expect(s.ambientes).toHaveLength(2); expect(s.aberturas).toHaveLength(2)
  })
  it('"sem elétrica" com pontos elétricos informados: pergunta qual vale', () => {
    let s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ instalacoes: { eletrica: false, tomadas: 6 } })))
    const p = proximaPergunta(s)!
    expect(p.id).toBe('regra:eletrica')
    const com = resolverContradicao(s, p.id, 'com')
    expect(com.fatos['geral.eletrica']).toBe(true); expect(com.fatos['geral.eltTomadas']).toBe(6)
    s = resolverContradicao(s, p.id, 'sem')
    expect(s.fatos['geral.eletrica']).toBe(false); expect(s.fatos['geral.eltTomadas']).toBeUndefined()
    expect(s.contradicoes).toHaveLength(0)
  })
  it('"sem telhado" com telha escolhida e "sem forro" com forro no ambiente também são apontados', () => {
    const a = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ cobertura: { havera: false }, materiais: { telha: 'ceramica_romana' } })))
    expect(a.contradicoes.map((c) => c.id)).toContain('regra:cobertura')
    const b = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ acabamentos: { forro: false }, ambientes: [{ nome: 'Sala', forro: true }] })))
    expect(b.contradicoes.map((c) => c.id)).toContain('regra:forro')
  })
  it('avisos de plausibilidade: pé-direito, porta mais alta que o pé-direito, medidas estranhas', () => {
    const s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { altura_parede_m: 2 }, ambientes: [{ nome: 'Sala', comprimento_m: 45, largura_m: 5 }], aberturas: [{ tipo: 'porta', qtd: 1, largura_m: 0.8, altura_m: 2.1, ambiente: 'Sala' }] })))
    const av = avisosDe(s).join(' | ')
    expect(av).toContain('comprimento de 45 m é incomum'); expect(av).toContain('maior que o pé-direito')
  })
  it('abertura com ambiente que não existe fica sem ambiente, com aviso', () => {
    const s = mesclar(comecar(), validarExtracao(JSON.stringify({ aberturas: [{ tipo: 'janela', qtd: 1, largura_m: 1, altura_m: 1, ambiente: 'Cozinha' }] })))
    expect(avisosDe(s).join(' ')).toContain('"Cozinha": ambiente não descrito')
  })
})

describe('interpretar respostas sem IA', () => {
  it('sim/não', () => {
    for (const t of ['sim', 'Sim!', 'claro', 'vai ter', 'com forro']) expect(simNao(t)).toBe(true)
    for (const t of ['não', 'Nao', 'nenhum', 'sem forro']) expect(simNao(t)).toBe(false)
    expect(simNao('talvez')).toBeUndefined()
    for (const t of ['não sei', 'Não sei', 'pular']) expect(ehNaoSei(t)).toBe(true)
    expect(ehNaoSei('não')).toBe(false)
  })
  it('números com vírgula e unidades', () => {
    expect(numerosDe('7 por 5')).toEqual([7, 5])
    expect(numerosDe('3,5 x 4,25 m')).toEqual([3.5, 4.25])
    expect(numerosDe('700 x 500 cm')).toEqual([7, 5])
    expect(numerosDe('2800 mm')).toEqual([2.8])
    expect(numerosDe('sem número')).toEqual([])
  })
  it('medidas em cm viram metros; fora da faixa pede conferir a unidade', () => {
    const s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ ambientes: [{ nome: 'Quarto' }] })))
    const p = proximaPergunta(s)!
    expect(p.id).toBe('medidas:quarto')
    expect(responder(s, p, '350 x 400 cm').sessao.fatos['amb:quarto:comprimento']).toBe(3.5)
    expect(responder(s, p, '7').erro).toContain('2 números')
    expect(responder(s, p, '7000 x 5').erro).toContain('fora do esperado')
  })
  it('pé-direito em cm e escolha por número ou pelo nome', () => {
    let s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1 }, ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4 }] })))
    s = responder(s, proximaPergunta(s)!, '280 cm').sessao
    expect(s.fatos['obra.altura']).toBe(2.8)
    const b = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 3 }, ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4 }], aberturas: [{ tipo: 'porta', qtd: 1, largura_m: 1, altura_m: 2 }], materiais: { bloco: 'concreto' } })))
    const p = proximaPergunta(b)!
    expect(p.id).toBe('bloco'); expect(p.opcoes!.map((o) => o.rotulo)).toEqual(['Concreto 14 × 19 × 39', 'Concreto 19 × 19 × 39'])
    expect(responder(b, p, '2').sessao.fatos['geral.blocoPreset']).toBe(3)
    expect(responder(b, p, '14 x 19 x 39').sessao.fatos['geral.blocoPreset']).toBe(2)
    expect(responder(b, p, 'o maior').erro).toContain('Escolha')
  })
  it('termos técnicos citados no texto são explicados', () => {
    const t = termosCitados('duas salas, pé-direito 3 m, tijolo cerâmico, contrapiso e telha de fibrocimento')
    expect(t.map((x) => x.termo)).toEqual(['pé-direito', 'contrapiso', 'tijolo ou bloco cerâmico', 'fibrocimento'])
    expect(t[1].explicacao).toContain('nivelada')
  })
})

describe('cenário A de ponta a ponta: texto → perguntas → levantamento → quantitativos', () => {
  const rodar = () => {
    let s = comecar()
    const respostas: Record<string, string> = {
      pavimentos: '1', divisas: 'sim', 'ab:Porta:0': '2 e 0,80 x 2,10', 'ab:Janela:1': '4 e 1,20 x 1,00', bloco: '14 x 19 x 39', pisoPeca: '60',
      coberturaMedidas: '14 por 7', 'elt:Tomadas': '8', 'elt:Interruptores': '3', 'elt:PontosLuz': '4', 'elt:Disjuntores': '4', hidraulica: 'não', revestimento: 'sim', pintura: 'sim', forro: 'não',
    }
    for (let i = 0; i < 40; i++) { const p = proximaPergunta(s); if (!p) break; s = responder(s, p, respostas[p.id]).sessao }
    return s
  }
  it('monta obra, ambientes com parede compartilhada, parâmetros e opções', () => {
    const l = montarLevantamento(rodar())
    expect(l.obra).toMatchObject({ pavimentos: 1, alturaParede: 3 })
    expect(l.ambientes.map((a) => [a.nome, a.comprimento, a.largura, a.origem?.fonte])).toEqual([['Sala 1', 7, 7, 'texto'], ['Sala 2', 7, 7, 'texto']])
    expect(l.ambientes[0].divisas?.[1]?.com).toBe(l.ambientes[1].id)
    expect(l.ambientes[1].divisas?.[3]?.com).toBe(l.ambientes[0].id)
    expect(l.params).toMatchObject({ blocoC: 0.39, blocoA: 0.19, pisoC: 0.6, roofC: 14, roofL: 7, eltTomadas: 8, eltPontosLuz: 4, telhaRend: 0.42 })
    expect(l.flags).toMatchObject({ cobertura: true, eletrica: true, hidraulica: false, revest: true, pintura: true, forro: false })
    expect(l.aberturasGerais.map((a) => [a.tipo, a.qtd, a.largura, a.altura])).toEqual([['Porta', 2, 0.8, 2.1], ['Janela', 4, 1.2, 1]])
    expect(l.usouPadrao.join(' ')).toContain('lado de cada ambiente foi assumido')
    expect(l.usouPadrao.join(' ')).not.toContain('Bloco:')
  })
  it('os quantitativos batem com o cenário A (parede compartilhada uma vez, bloco, piso, telhado, elétrica)', () => {
    const l = montarLevantamento(rodar())
    const obra: Obra = { nome: '', tipo: 'Residencial', alturaParede: 2.8, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum', ...l.obra }
    const p = { ...PARAMS_PADRAO, ...l.params, aberturas: l.aberturasGerais }
    const itens = calcular(obra, l.ambientes, aplicarFlags(p, { ...flagsIniciais(p), ...l.flags }))
    const lev = resolverLevantamento(obra, l.ambientes, l.aberturasGerais)
    expect(lev.alvBruta).toBeCloseTo(147, 6)
    expect(lev.alvLiquida).toBeCloseTo(147 - (2 * 0.8 * 2.1 + 4 * 1.2), 6)
    const acha = (e: string, m: string) => itens.find((i) => i.etapa === e && i.material === m)
    expect(acha('Alvenaria', 'Bloco')!.bruto).toBeCloseTo(((147 - 8.16) / (0.39 * 0.19)) * 1.05, 4)
    expect(acha('Contrapiso e piso', 'Piso (área)')!.bruto).toBeCloseTo(98 * 1.1, 6)
    expect(itens.some((i) => i.etapa === 'Cobertura e madeiramento')).toBe(true)
    expect(itens.some((i) => i.etapa === 'Instalações elétricas')).toBe(true)
    expect(itens.some((i) => i.etapa === 'Forro')).toBe(false)
    expect(acha('Alvenaria', 'Bloco')!.dimensoes).toContain('42 m externa + 7 m compartilhada')
  })
  it('sem responder nada o programa diz o que assumiu ou deixou de calcular', () => {
    const l = montarLevantamento(comecar())
    const txt = l.usouPadrao.join(' | ')
    for (const t of ['Pavimentos: não informado', 'Bloco: tamanho não informado', 'Portas sem quantidade ou medidas', 'Telhado: dimensões não informadas', 'quantidade de tomadas não informada']) expect(txt).toContain(t)
    expect(l.aberturasGerais).toEqual([])
  })
  it('o resumo mostra o que foi entendido', () => {
    const r = linhasResumo(rodar()).join('\n')
    for (const t of ['Sala 1 (7 × 7 m)', 'Pé-direito: 3 m', 'Paredes compartilhadas: Sala 1 com Sala 2', 'Portas: 2 de 0,8 × 2,1 m', 'Bloco: Cerâmico 14 × 19 × 39', 'Telhado: Fibrocimento', '8 tomadas', 'Sem forro']) expect(r).toContain(t)
  })
})

describe('texto livre com demolição (reforma)', () => {
  it('ações vindas do texto entram no ambiente e geram demolição', () => {
    const s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 3, reforma: true }, ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4, acoes: { paredes: 'demolir', piso: 'manter' } }] })))
    expect(proximaPergunta(s)!.id).not.toBe('acoes') // as ações já foram ditas
    const l = montarLevantamento(s)
    expect(l.ambientes[0].acoes).toEqual({ paredes: 'demolir', piso: 'manter' })
    const itens = calcular({ nome: '', tipo: 'Residencial', alturaParede: 3, unidadeAltura: 'm', pavimentos: 1, terreno: 'plano', desnivel: false, movimentoTerra: 'nenhum' }, l.ambientes, { ...PARAMS_PADRAO, demolEspParedeM: 0.14 })
    expect(itens.find((i) => i.material === 'Demolição de alvenaria')!.bruto).toBeCloseTo(54, 6)
  })
  it('aplicarIA: texto que não traz nada novo não encerra a pergunta', () => {
    const s = comecar()
    const r = aplicarIA(s, validarExtracao('{}'), 'aberturas')
    expect(r.entendeu).toBe(false); expect(r.sessao.respondidas).not.toContain('aberturas')
  })
  it('aplicarIA: resposta útil encerra a pergunta de texto livre', () => {
    const s = mesclar(sessaoVazia(), validarExtracao(JSON.stringify({ obra: { pavimentos: 1, altura_parede_m: 3 }, ambientes: [{ nome: 'Sala', comprimento_m: 5, largura_m: 4 }] })))
    const p: Pergunta = proximaPergunta(s)!
    expect(p.id).toBe('aberturas')
    const r = aplicarIA(s, validarExtracao(JSON.stringify({ aberturas: [{ tipo: 'porta', qtd: 2, largura_m: 0.8, altura_m: 2.1, ambiente: 'Sala' }] })), p.id)
    expect(r.entendeu).toBe(true); expect(r.sessao.respondidas).toContain('aberturas')
    expect(montarLevantamento(r.sessao).ambientes[0].aberturas).toHaveLength(1)
  })
})
