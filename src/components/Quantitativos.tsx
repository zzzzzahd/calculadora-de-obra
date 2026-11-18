import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Plus, RotateCcw, ShoppingCart, Trash2, Upload } from 'lucide-react'
import type { Ambiente, Obra } from '../types'
import { calcular, consolidar, PARAMS_PADRAO, type Abertura, type Params } from '../lib/engine'
import { carregarParams, exportarConfig, importarConfig, salvarParams } from '../lib/config'
import { areaAmbiente } from '../lib/geometry'
import { BLOCOS, PISOS, TELHAS } from '../lib/presets'
import { ADITIVOS, TRACOS } from '../lib/tracos'
import { aplicarFlags, campoVisivel, flagsIniciais, grupoVisivel, PERGUNTAS, type Flags } from '../lib/assistente'
import { uid } from '../lib/uid'

type Num = Exclude<keyof Params, 'aberturas' | 'composicoes'>
const GRUPOS: { titulo: string; campos: [Num, string][] }[] = [
  { titulo: 'Alvenaria', campos: [['blocoC', 'Bloco: comprimento (m)'], ['blocoA', 'Bloco: altura (m)'], ['perdaBloco', 'Perda de blocos (%)'], ['argM3m2', 'Argamassa (m³/m²)'], ['argCimentoKg', 'Cimento na argamassa (kg/m³)'], ['argAreiaM3', 'Areia na argamassa (m³/m³)'], ['perdaArg', 'Perda de argamassa (%)'], ['calKgM3', 'Cal na argamassa (kg/m³, 0 = não)'], ['calSacoKg', 'Kg por saco de cal']] },
  { titulo: 'Vergas e contravergas (usa as portas e janelas)', campos: [['vergas', 'Calcular vergas (1 = sim, 0 = não)'], ['vergaApoio', 'Apoio de cada lado (m)'], ['vergaL', 'Largura = espessura da parede (m)'], ['vergaH', 'Altura da verga (m)']] },
  { titulo: 'Contrapiso e piso', campos: [['espContrapisoCm', 'Espessura do contrapiso (cm)'], ['ctCimentoKg', 'Cimento (kg/m³)'], ['ctAreiaM3', 'Areia (m³/m³)'], ['ctBritaM3', 'Brita (m³/m³)'], ['perdaConcreto', 'Perda do concreto (%)'], ['pisoC', 'Peça: comprimento (m)'], ['pisoL', 'Peça: largura (m)'], ['perdaPiso', 'Perda do piso (%)']] },
  { titulo: 'Terreno (0 = não calcular)', campos: [['aterroH', 'Altura média do aterro (m)'], ['escavH', 'Profundidade da escavação (m)'], ['perdaAterro', 'Empolamento/compactação (%)'], ['transporte', 'Transporte de terra (1 = sim)'], ['caminhaoM3', 'Capacidade do caminhão (m³)']] },
  { titulo: 'Fundação (só com dimensões)', campos: [['fundComp', 'Comprimento total (m)'], ['fundLarg', 'Largura (m)'], ['fundAlt', 'Altura (m)'], ['radierArea', 'Radier: área (m²)'], ['radierEsp', 'Radier: espessura (m)'], ['fundPerim', 'Radier: perímetro das bordas (m)'], ['radierTela', 'Radier: tela soldada (1 = sim)'], ['sapN', 'Sapatas isoladas (qtd.)'], ['sapL', 'Sapata: comprimento (m)'], ['sapB', 'Sapata: largura (m)'], ['sapH', 'Sapata: altura (m)'], ['estN', 'Estacas (qtd.)'], ['estDiam', 'Estaca: diâmetro (m)'], ['estProf', 'Estaca: profundidade (m)']] },
  { titulo: 'Estrutura (só com dimensões)', campos: [['pilarN', 'Pilares (qtd.)'], ['pilarL', 'Pilar: lado A (m)'], ['pilarB', 'Pilar: lado B (m)'], ['vigaComp', 'Vigas: comprimento total (m)'], ['vigaL', 'Viga: largura (m)'], ['vigaH', 'Viga: altura (m)'], ['estCimentoKg', 'Cimento (kg/m³)'], ['estAreiaM3', 'Areia (m³/m³)'], ['estBritaM3', 'Brita (m³/m³)'], ['acoKgM3', 'Aço do projeto (kg/m³, 0 = não)']] },
  { titulo: 'Revestimentos e forro', campos: [['revFaces', 'Faces revestidas'], ['espChapCm', 'Chapisco: espessura (cm)'], ['chapCimentoKg', 'Chapisco: cimento (kg/m³)'], ['chapAreiaM3', 'Chapisco: areia (m³/m³)'], ['espEmbCm', 'Emboço/reboco: espessura (cm)'], ['embCimentoKg', 'Emboço: cimento (kg/m³)'], ['embAreiaM3', 'Emboço: areia (m³/m³)'], ['perdaRev', 'Perda de revestimento (%)'], ['cerArea', 'Cerâmica de parede (m², 0 = não)'], ['forro', 'Forro (1 = sim, 0 = não)'], ['perdaForro', 'Perda do forro (%)'], ['espPerfil', 'Espaç. perfis do forro (m)'], ['barraPerfilM', 'Barra de perfil (m)']] },
  { titulo: 'Esquadrias (usa as portas e janelas)', campos: [['esquadrias', 'Listar portas e janelas para compra (1 = sim)']] },
  { titulo: 'Muro', campos: [['muroComp', 'Comprimento do muro (m)'], ['muroAlt', 'Altura (m)'], ['muroFundL', 'Fundação: largura (m)'], ['muroFundH', 'Fundação: altura (m)'], ['muroPilarEsp', 'Espaçamento dos pilaretes (m)'], ['muroPilarSec', 'Pilarete: lado (m)']] },
  { titulo: 'Calçada e áreas externas', campos: [['calcArea', 'Área (m²)'], ['calcEsp', 'Espessura do concreto (cm)'], ['calcLastroCm', 'Lastro de brita (cm)'], ['calcTela', 'Tela soldada (1 = sim)']] },
  { titulo: 'Escada de concreto', campos: [['escLarg', 'Largura (m)'], ['escAlt', 'Altura a vencer (m)'], ['escEspelho', 'Altura do espelho (m)'], ['escPiso', 'Profundidade do piso (m)'], ['escEspLaje', 'Espessura da laje (m)'], ['escFolga', 'Vão central da escada em U (m)']] },
  { titulo: 'Gesso e drywall', campos: [['dwComp', 'Paredes: comprimento total (m)'], ['dwAlt', 'Paredes: altura (m)'], ['dwFaces', 'Faces com chapa (1 ou 2)'], ['dwEspMont', 'Espaçamento dos montantes (m)'], ['dwBarraM', 'Barra de perfil (m)'], ['perdaDw', 'Perda (%)'], ['dwChapaC', 'Chapa: comprimento (m)'], ['dwChapaL', 'Chapa: largura (m)'], ['dwForroArea', 'Forro de gesso: área (m²)'], ['dwForroPerfilM2', 'Perfil do forro (m/m²)'], ['dwPendM2', 'Penduras (un/m²)'], ['dwParafM2', 'Parafusos (un/m² de chapa)'], ['dwFitaMM2', 'Fita (m/m² de chapa)'], ['dwMassaKgM2', 'Massa de junta (kg/m²)']] },
  { titulo: 'Estrutura metálica (perfis informados)', campos: [['metComp', 'Comprimento total de perfis (m)'], ['metKgM', 'Peso do perfil (kg/m, do projeto)'], ['metBarraM', 'Barra comercial (m)'], ['perdaMet', 'Perda (%)'], ['metSupM', 'Superfície (m² por metro de perfil)'], ['metDemaos', 'Demãos de fundo'], ['metRend', 'Rendimento do fundo (m²/L/demão)'], ['metSoldaKgKg', 'Eletrodo (kg por kg de aço)']] },
  { titulo: 'Estrutura de madeira (peças informadas)', campos: [['madComp', 'Comprimento total de peças (m)'], ['madBarraM', 'Barra comercial (m)'], ['madPregoKgM', 'Pregos/parafusos (kg por m)']] },
  { titulo: 'Laje pré-moldada', campos: [['preLajeArea', 'Área da laje (m²)'], ['preInter', 'Intereixo (m)'], ['preLajotaC', 'Comprimento da lajota/EPS (m)'], ['preCapEsp', 'Capeamento (cm)'], ['preTela', 'Tela soldada (1 = sim)']] },
  { titulo: 'Fossa séptica e sumidouro', campos: [['fosCompr', 'Fossa: comprimento interno (m)'], ['fosLarg', 'Fossa: largura interna (m)'], ['fosProf', 'Fossa: profundidade (m)'], ['fosEsp', 'Fossa: parede (m)'], ['sumDiam', 'Sumidouro: diâmetro interno (m)'], ['sumProf', 'Sumidouro: profundidade (m)'], ['sumEsp', 'Sumidouro: parede (m)'], ['sumBritaFundo', 'Brita no fundo (m)']] },
  { titulo: 'Piscina', campos: [['pisC', 'Comprimento interno (m)'], ['pisL', 'Largura interna (m)'], ['pisProf', 'Profundidade média (m)'], ['pisEsp', 'Espessura de fundo e paredes (m)'], ['pisFolga', 'Folga de escavação (m por lado)']] },
  { titulo: 'Laje', campos: [['lajeArea', 'Área da laje (m²)'], ['lajeEsp', 'Espessura (cm)'], ['escorasPorM2', 'Escoras por m²']] },
  { titulo: 'Formas e escoramento', campos: [['reusoForma', 'Reaproveitamentos da forma'], ['sarrafoMPorM2', 'Sarrafo (m por m² de forma)']] },
  { titulo: 'Impermeabilização', campos: [['imperArea', 'Área a impermeabilizar (m²)'], ['imperBaldrame', 'Incluir baldrame (1 = sim)'], ['imperKgM2', 'Consumo (kg/m², com demãos)']] },
  { titulo: 'Piso: acessórios', campos: [['rodape', 'Rodapé (1 = sim, 0 = não)'], ['rodapeBarraM', 'Peça de rodapé (m)'], ['perdaRodape', 'Perda do rodapé (%)'], ['rejunteKgM2', 'Rejunte (kg/m²)'], ['espPorPeca', 'Espaçadores por peça'], ['colanteKgM2', 'Argamassa colante (kg/m²)'], ['colanteSacoKg', 'Kg por saco de colante']] },
  { titulo: 'Instalações elétricas (pontos)', campos: [['eltTomadas', 'Tomadas (qtd.)'], ['eltInterruptores', 'Interruptores (qtd.)'], ['eltPontosLuz', 'Pontos de iluminação'], ['eltDisjuntores', 'Disjuntores (qtd. do projeto)'], ['eltMPorPonto', 'Eletroduto (m por ponto)'], ['eltCaboMPorPonto', 'Cabo (m por ponto)'], ['barraEletrodutoM', 'Barra de eletroduto (m)'], ['perdaInst', 'Perda das instalações (%)']] },
  { titulo: 'Hidráulica e sanitária (pontos)', campos: [['hidPontosAgua', 'Pontos de água'], ['sanPontos', 'Pontos de esgoto'], ['hidRegistros', 'Registros'], ['caixasSifonadas', 'Caixas sifonadas'], ['ralos', 'Ralos'], ['caixasInspecao', 'Caixas de inspeção'], ['vasos', 'Vasos sanitários'], ['lavatorios', 'Lavatórios'], ['pias', 'Pias'], ['chuveiros', 'Chuveiros'], ['reservatorios', 'Reservatórios'], ['hidMPorPonto', 'Tubo de água (m por ponto)'], ['sanMPorPonto', 'Tubo de esgoto (m por ponto)'], ['conexPorPonto', 'Conexões por ponto'], ['barraTuboM', 'Barra de tubo (m)']] },
  { titulo: 'Drenagem', campos: [['drenTuboM', 'Tubo de drenagem (m)'], ['drenCaixas', 'Caixas'], ['drenRalos', 'Ralos'], ['canaletaM', 'Canaletas (m)'], ['drenBritaM3m', 'Brita de envelopamento (m³/m)']] },
  { titulo: 'Cobertura (informe comprimento e largura)', campos: [['roofC', 'Comprimento do telhado (m)'], ['roofL', 'Largura no sentido do caimento (m)'], ['aguas', 'Águas (1, 2 ou 4)'], ['inclinacao', 'Inclinação (%)'], ['beiral', 'Beiral (m)'], ['telhaRend', 'Telhas por m²'], ['perdaTelha', 'Perda de telhas (%)'], ['espTerca', 'Espaç. terças (m)'], ['espCaibro', 'Espaç. caibros (m)'], ['espRipa', 'Espaç. ripas (m)'], ['tesouras', 'Tesouras (qtd.)'], ['barraM', 'Barra de madeira (m)'], ['perdaMadeira', 'Perda de madeira (%)'], ['cumeeiraM', 'Peça de cumeeira (m)'], ['calha', 'Calha (1 = sim, 0 = não)'], ['calhaBarraM', 'Barra de calha (m)'], ['condutorN', 'Condutores (qtd.)'], ['condutorAltM', 'Altura de cada condutor (m)'], ['condutorBarraM', 'Barra de condutor (m)'], ['rufoM', 'Rufo (m)'], ['espigaoExtraM', 'Espigões/rincões informados (m)'], ['fixPorM2', 'Fixação do telhado (un/m²)'], ['mantaCob', 'Manta de subcobertura (1 = sim)'], ['telhaMetalica', 'Telha metálica (1 = sim; escolha acima)'], ['sobreMetal', 'Sobreposição da telha metálica (%)']] },
  { titulo: 'Pintura', campos: [['faces', 'Faces a pintar'], ['massaTipo', 'Massa: 0 = não, 1 = PVA, 2 = acrílica'], ['massaPct', '% da área com massa'], ['demaosMassa', 'Demãos de massa'], ['rendMassa', 'Massa (m²/lata/demão)'], ['seladorPct', '% da área com selador'], ['demaosSelador', 'Demãos de selador'], ['rendSelador', 'Selador (m²/L/demão)'], ['latSeladorL', 'Litros por lata de selador'], ['demaos', 'Demãos de tinta'], ['rendTinta', 'Tinta (m²/L/demão)'], ['latL', 'Litros por lata de tinta'], ['cor2Pct', '% da área na 2ª cor (0 = cor única)'], ['lixaM2', 'Lixa (m² por folha)'], ['roloM2', 'Rolo (m² por rolo)'], ['pincelM2', 'Pincel (m² por pincel)'], ['fitaM', 'Fita crepe (m por rolo)']] },
  { titulo: 'Compra', campos: [['sacoKg', 'Kg por saco de cimento']] },
]
const BOOLS = new Set<string>(['esquadrias', 'vergas', 'radierTela', 'preTela', 'imperBaldrame', 'calcTela', 'mantaCob', 'telhaMetalica', 'transporte', 'rodape'])
const ESCOLHAS: Record<string, [number, string][]> = {
  massaTipo: [[0, 'Não'], [1, 'Massa corrida PVA'], [2, 'Massa acrílica']], aguas: [[1, 'Uma água'], [2, 'Duas águas'], [4, 'Quatro águas']], dwFaces: [[1, 'Uma face'], [2, 'Duas faces']],
}
const limpaRotulo = (r: string) => r.replace(/\s*\(1 = sim[^)]*\)/, '').replace(/: 0 = não, 1 = PVA, 2 = acrílica/, '').replace(/\s*\(1, 2 ou 4\)/, '').replace(/\s*\(1 ou 2\)/, '')

/** Campo de parâmetro: Sim/Não, lista de opções ou número. */
function CampoParam({ k, rot, p, setP }: { k: Num; rot: string; p: Params; setP: (x: Params) => void }) {
  const set = (v: number) => setP({ ...p, [k]: v })
  return (
    <div><label className="rotulo">{limpaRotulo(rot)}</label>
      {BOOLS.has(k) ? <select className="campo" value={p[k] > 0 ? 1 : 0} onChange={(e) => set(parseInt(e.target.value))}><option value={1}>Sim</option><option value={0}>Não</option></select>
        : ESCOLHAS[k] ? <select className="campo" value={p[k]} onChange={(e) => set(parseInt(e.target.value))}>{ESCOLHAS[k].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        : <input className="campo" type="number" step="any" min={0} value={p[k]} onChange={(e) => set(parseFloat(e.target.value) || 0)} />}
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function Quantitativos({ obra, ambientes, aberturasIniciais = [] }: { obra: Obra; ambientes: Ambiente[]; aberturasIniciais?: Abertura[] }) {
  const [p, setP] = useState<Params>(() => ({ ...carregarParams(), aberturas: aberturasIniciais }))
  const [flags, setFlags] = useState<Flags>(() => flagsIniciais(p))
  const pe = useMemo(() => aplicarFlags(p, flags), [p, flags])
  const [esc, setEsc] = useState({ telha: -1, bloco: -1, piso: -1 })
  const [tr, setTr] = useState<Record<string, number>>({})
  const [precos, setPrecos] = useState<Record<string, number>>({})
  const arq = useRef<HTMLInputElement>(null)
  useEffect(() => salvarParams(p), [p])
  const backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportarConfig(p)], { type: 'application/json' })); a.download = 'configuracoes-calculadora.json'; a.click() }
  const importar = async (f?: File) => { if (!f) return; try { setP({ ...importarConfig(await f.text()), aberturas: p.aberturas }) } catch (e) { alert((e as Error).message) } }
  const itens = useMemo(() => calcular(obra, ambientes, pe), [obra, ambientes, pe])
  const lista = useMemo(() => consolidar(itens), [itens])
  const etapas = [...new Set(itens.map((i) => i.etapa))]
  const exportar = async (completo: boolean) => {
    const { gerarXlsx, baixar } = await import('../lib/exportExcel')
    const base = (obra.nome || 'levantamento').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'levantamento'
    baixar(await gerarXlsx(obra, ambientes, itens, completo, precos), `${base}-${completo ? 'completo' : 'lista-de-compras'}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  const exportarPdf = async () => {
    const { gerarPdf } = await import('../lib/exportPdf'); const { baixar } = await import('../lib/exportExcel')
    baixar(gerarPdf(obra, ambientes, itens, precos), `${(obra.nome || 'levantamento').trim().replace(/\s+/g, '-').toLowerCase()}-relatorio.pdf`, 'application/pdf')
  }
  const area = ambientes.reduce((s, a) => s + areaAmbiente(a), 0) * obra.pavimentos
  const custoTotal = lista.reduce((s, l) => s + l.final * (precos[`${l.material}|${l.unidade}`] || 0), 0)
  const upAb = (id: string, d: object) => setP({ ...p, aberturas: p.aberturas.map((a) => (a.id === id ? { ...a, ...d } : a)) })

  return (
    <div className="mt-6 space-y-4">
      <section className="cartao">
        <h2 className="mb-1 font-semibold">Assistente: o que a obra terá?</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">As respostas definem quais campos aparecem e o que entra no cálculo. Perguntas novas surgem conforme você responde.</p>
        <div className="space-y-2">
          {PERGUNTAS.filter((q) => !q.quando || q.quando(flags)).map((q) => (
            <div key={q.k} className="flex items-center justify-between gap-3 text-sm">
              <span>{q.texto}</span>
              <span className="flex shrink-0 gap-1">
                <button className={`btn !px-3 !py-1 ${flags[q.k] ? 'btn-primario' : 'btn-sec'}`} onClick={() => setFlags({ ...flags, [q.k]: true })}>Sim</button>
                <button className={`btn !px-3 !py-1 ${!flags[q.k] ? 'btn-primario' : 'btn-sec'}`} onClick={() => setFlags({ ...flags, [q.k]: false })}>Não</button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([['Tipo de bloco', BLOCOS, 'bloco'], ['Tipo de telha', TELHAS, 'telha'], ['Tamanho da peça de piso', PISOS, 'piso']] as const).map(([rot, lista, k]) => (
            <div key={k}><label className="rotulo">{rot}</label>
              <select className="campo" value={esc[k]} onChange={(e) => { const i = parseInt(e.target.value); setEsc({ ...esc, [k]: i }); if (i >= 0) { const { nome: _nome, ...campos } = lista[i]; setP({ ...p, ...campos }) } }}>
                <option value={-1}>Escolher (preenche os parâmetros)</option>
                {lista.map((x, i) => <option key={x.nome} value={i}>{x.nome}</option>)}
              </select></div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rendimentos e dimensões são valores usuais de exemplo: confira com o fabricante e ajuste nos campos.</p>
        {flags.fundacao && (
          <div className="mt-4 sm:w-1/2"><label className="rotulo">Tipo de fundação</label>
            <select className="campo" value={p.fundTipo} onChange={(e) => setP({ ...p, fundTipo: parseInt(e.target.value) })}>
              <option value={0}>Baldrame / sapata corrida</option><option value={1}>Radier</option><option value={2}>Sapatas isoladas</option><option value={3}>Estacas</option>
            </select></div>
        )}
        {flags.escada && (
          <div className="mt-4 sm:w-1/2"><label className="rotulo">Tipo de escada</label>
            <select className="campo" value={p.escTipo} onChange={(e) => setP({ ...p, escTipo: parseInt(e.target.value) })}>
              <option value={0}>Reta</option><option value={1}>Em L com patamar</option><option value={2}>Em U com patamar</option><option value={3}>Em L com leque (estimativa)</option>
            </select></div>
        )}
        {obra.movimentoTerra === 'nenhum' && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Terreno: para informar aterro ou escavação, escolha a opção em "Aterro ou escavação" nos dados da obra.</p>}
      </section>

      <section className="cartao">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Portas e janelas (descontadas da alvenaria)</h2>
          <button className="btn btn-sec" onClick={() => setP({ ...p, aberturas: [...p.aberturas, { id: uid(), tipo: 'Porta', largura: 0.8, altura: 2.1, qtd: 1 }] })}><Plus size={16} /> Adicionar</button>
        </div>
        {p.aberturas.map((a) => (
          <div key={a.id} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select className="campo" value={a.tipo} onChange={(e) => upAb(a.id, { tipo: e.target.value })}><option>Porta</option><option>Janela</option></select>
            <input className="campo" type="number" step="any" min={0} value={a.largura} onChange={(e) => upAb(a.id, { largura: parseFloat(e.target.value) || 0 })} title="Largura (m)" />
            <input className="campo" type="number" step="any" min={0} value={a.altura} onChange={(e) => upAb(a.id, { altura: parseFloat(e.target.value) || 0 })} title="Altura (m)" />
            <input className="campo" type="number" min={1} value={a.qtd} onChange={(e) => upAb(a.id, { qtd: parseInt(e.target.value) || 1 })} title="Quantidade" />
            <button className="btn btn-sec" aria-label="Remover" onClick={() => setP({ ...p, aberturas: p.aberturas.filter((x) => x.id !== a.id) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <p className="text-xs text-slate-500 dark:text-slate-400">Colunas: tipo · largura (m) · altura (m) · quantidade.</p>
      </section>

      {flags.cobertura && <section className="cartao border-amber-500">
        <h2 className="mb-1 font-semibold">Cobertura / telhado</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Preencha comprimento e largura do telhado para calcular telhas, terças, caibros, ripas e cumeeira.</p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {GRUPOS.filter((g) => g.titulo.startsWith('Cobertura')).flatMap((g) => g.campos).filter(([k]) => campoVisivel(k, flags, p)).map(([k, rot]) => (
            <CampoParam key={k} k={k} rot={rot} p={p} setP={setP} />
          ))}
        </div>
      </section>}

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Parâmetros técnicos (editáveis)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {GRUPOS.filter((g) => !g.titulo.startsWith('Cobertura') && grupoVisivel(g.titulo, flags, obra)).map((g) => (
            <div key={g.titulo} className="space-y-2">
              <h3 className="text-sm font-medium text-amber-600">{g.titulo}</h3>
              {g.campos.filter(([k]) => campoVisivel(k, flags, p)).map(([k, rot]) => (
                <CampoParam key={k} k={k} rot={rot} p={p} setP={setP} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-sec" onClick={backup}><Download size={16} /> Exportar configurações (JSON)</button>
          <button className="btn btn-sec" onClick={() => arq.current?.click()}><Upload size={16} /> Importar configurações</button>
          <button className="btn btn-sec" onClick={() => setP({ ...PARAMS_PADRAO, aberturas: p.aberturas })}><RotateCcw size={16} /> Restaurar padrão</button>
          <input ref={arq} type="file" accept="application/json" className="hidden" onChange={(e) => { importar(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Os parâmetros ficam salvos neste navegador. Instalações: contagem por quantidades informadas; circuitos, bitolas e diâmetros exigem projeto e profissional habilitado. Valores iniciais são exemplos de composição: confira com a sua realidade antes de comprar.</p>
      </section>

      <section className="cartao">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Biblioteca técnica: composições próprias</h2>
          <button className="btn btn-sec" onClick={() => setP({ ...p, composicoes: [...p.composicoes, { id: uid(), nome: 'Novo material', etapa: 'Outros', unidade: 'un', base: 'area', coef: 0, perda: 0 }] })}><Plus size={16} /> Adicionar</button>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Crie materiais próprios: quantidade = base × coeficiente × (1 + perda). Ficam salvos no navegador e entram no backup JSON. Colunas: nome · etapa · unidade de compra · base · coeficiente · perda (%).</p>
        {p.composicoes.map((c) => {
          const up = (d: Partial<typeof c>) => setP({ ...p, composicoes: p.composicoes.map((x) => (x.id === c.id ? { ...x, ...d } : x)) })
          return (
            <div key={c.id} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-7">
              <input className="campo sm:col-span-2" value={c.nome} onChange={(e) => up({ nome: e.target.value })} title="Nome do material" />
              <input className="campo" value={c.etapa} onChange={(e) => up({ etapa: e.target.value })} title="Etapa" />
              <input className="campo" value={c.unidade} onChange={(e) => up({ unidade: e.target.value })} title="Unidade de compra" />
              <select className="campo" value={c.base} onChange={(e) => up({ base: e.target.value as typeof c.base })} title="Base de cálculo">
                <option value="area">Área construída</option><option value="parede">Área de parede</option><option value="fixa">Quantidade fixa</option></select>
              <input className="campo" type="number" step="any" min={0} value={c.coef} onChange={(e) => up({ coef: parseFloat(e.target.value) || 0 })} title="Coeficiente" />
              <div className="flex gap-1">
                <input className="campo" type="number" step="any" min={0} value={c.perda} onChange={(e) => up({ perda: parseFloat(e.target.value) || 0 })} title="Perda (%)" />
                <button className="btn btn-sec" aria-label="Excluir" onClick={() => setP({ ...p, composicoes: p.composicoes.filter((x) => x.id !== c.id) })}><Trash2 size={16} /></button>
              </div>
            </div>
          )
        })}
      </section>

      <section className="cartao space-y-3">
        <h2 className="font-semibold">Traços e aditivos</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Escolha um traço pré-definido (em volume) para preencher os consumos. Eles são estimados a partir do traço e continuam editáveis nos parâmetros; confira com a prática da sua obra.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRACOS.map((g) => (
            <div key={g.chave}><label className="rotulo">{g.rotulo}</label>
              <select className="campo" value={tr[g.chave] ?? -1} onChange={(e) => { const i = parseInt(e.target.value); setTr({ ...tr, [g.chave]: i }); if (i >= 0) { const { nome: _nome, ...campos } = g.lista[i]; setP({ ...p, ...campos }) } }}>
                <option value={-1}>Escolher traço…</option>{g.lista.map((x, i) => <option key={x.nome} value={i}>{x.nome}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{g.resumo(p)}</p></div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['Aditivo no concreto', 'aditivoConc', 'aditivoConcPct'], ['Aditivo nas argamassas', 'aditivoArg', 'aditivoArgPct']] as const).map(([rot, k, kp]) => (
            <div key={k}><label className="rotulo">{rot}</label>
              <div className="flex gap-1">
                <select className="campo" value={p[k]} onChange={(e) => { const cod = parseInt(e.target.value); setP({ ...p, [k]: cod, [kp]: ADITIVOS[cod].pct }) }}>{ADITIVOS.map((a) => <option key={a.cod} value={a.cod}>{a.nome}</option>)}</select>
                {p[k] > 0 && <input className="campo !w-24" type="number" step="any" min={0} title="% do peso do cimento" value={p[kp]} onChange={(e) => setP({ ...p, [kp]: parseFloat(e.target.value) || 0 })} />}
              </div>
              {p[k] > 0 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">% do peso do cimento (valor usual): siga a bula do fabricante.</p>}</div>
          ))}
        </div>
      </section>

      {itens.length === 0 ? (
        <p className="cartao text-sm">Preencha comprimento e largura de pelo menos um ambiente para ver os quantitativos.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primario" onClick={() => exportar(true)}><FileSpreadsheet size={16} /> Exportar Excel completo</button>
            <button className="btn btn-sec" onClick={exportarPdf}><FileText size={16} /> Relatório PDF</button>
            <button className="btn btn-sec" onClick={() => exportar(false)}><ShoppingCart size={16} /> Exportar só a lista de compras</button>
          </div>
          {etapas.map((e) => (
            <section key={e} className="cartao overflow-x-auto">
              <h2 className="mb-2 font-semibold">{e}</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th>Material</th><th>Tipo</th><th className="text-right">Antes de arredondar</th><th className="text-right">Compra</th><th>Un.</th></tr></thead>
                <tbody>
                  {itens.filter((i) => i.etapa === e).map((i) => (
                    <tr key={i.material} className="border-t border-slate-200 align-top dark:border-slate-700">
                      <td className="py-1">{i.material}
                        <details className="text-xs text-slate-500 dark:text-slate-400"><summary className="cursor-pointer">Memória de cálculo</summary>
                          <p>Fórmula: {i.formula}</p><p>Dimensões: {i.dimensoes}</p><p>Coeficiente: {i.coef} · Perda: {i.perda}%</p></details></td>
                      <td className="text-xs">{i.tipo}</td>
                      <td className="text-right">{fmt(i.bruto)}</td><td className="text-right font-semibold">{fmt(i.final)}</td><td className="pl-2">{i.unidade}</td>
                    </tr>))}
                </tbody>
              </table>
            </section>
          ))}
          <section className="cartao overflow-x-auto">
            <h2 className="mb-2 font-semibold">Lista geral de compras (consolidada)</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th>Material</th><th className="text-right">Quantidade</th><th>Un.</th><th className="pl-2">Etapas</th><th className="text-right">Preço unit. (R$)</th><th className="text-right">Custo (R$)</th></tr></thead>
              <tbody>{lista.map((l) => (
                <tr key={l.material + l.unidade} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1">{l.material}</td><td className="text-right font-semibold">{fmt(l.final)}</td><td className="pl-2">{l.unidade}</td><td className="pl-2 text-xs">{l.etapas}</td>
                  <td className="w-28 py-1 pl-2"><input className="campo !py-1 text-right" type="number" step="any" min={0} value={precos[l.material + '|' + l.unidade] ?? ''} onChange={(e) => setPrecos({ ...precos, [l.material + '|' + l.unidade]: parseFloat(e.target.value) || 0 })} /></td>
                  <td className="pl-2 text-right">{fmt(l.final * (precos[l.material + '|' + l.unidade] || 0))}</td></tr>))}</tbody>
            </table>
            {custoTotal > 0 && <p className="mt-3 text-sm font-semibold">Custo total estimado: R$ {fmt(custoTotal)}{area > 0 && ` · R$ ${fmt(custoTotal / area)}/m²`}</p>}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Estimativa baseada em composições, não é projeto executivo. Estruturas, instalações elétricas e hidráulicas exigem profissional habilitado.</p>
          </section>
        </>
      )}
    </div>
  )
}
