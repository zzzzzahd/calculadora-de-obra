/** Etapa(s) do cálculo: Revestimentos (chapisco, emboço, cerâmica de parede) e forro. Cada função recebe o contexto compartilhado e acrescenta itens por `c.add`. */
import { type Ctx, com, f2 } from './contexto'

export function revestimentos(c: Ctx): void {
  // REVESTIMENTOS E FORRO
  const { p, lev, liq, add, sufArea } = c
  // faces: 1 = só interna; 2 = interna + externa (valores maiores repetem a externa, como no v24)
  const fInt = Math.min(p.revFaces, 1), fExt = Math.max(0, p.revFaces - 1)
  const aR = lev.revInterno * fInt + lev.extLiquida * fExt
  if (aR > 0) {
    const R = 'Revestimentos'
    const dR = lev.simples && lev.compartilhadaM === 0
      ? `área líquida ${f2(liq)} m² × ${p.revFaces} face(s) = ${f2(aR)} m²`
      : `faces internas ${f2(lev.revInterno)} m² + faces externas ${f2(lev.extLiquida)} m² (faces: ${p.revFaces}) = ${f2(aR)} m²`
    const fRev = lev.simples && lev.compartilhadaM === 0 ? 'área líquida × faces' : 'faces internas + faces externas (descontadas as aberturas)'
    const arg = (nome: string, esp: number, cim: number, are: number, cal: number) => {
      const v = com((aR * esp) / 100, p.perdaRev)
      add({ etapa: R, material: nome, unidade: 'm²', tipo: 'Geométrico', formula: fRev, dimensoes: dR, coef: '—', perda: 0, bruto: aR })
      add({ etapa: R, material: 'Cimento', unidade: 'saco', tipo: 'Estimativa por composição', formula: `área × espessura ${esp} cm × (1 + perda) × kg/m³ ÷ kg/saco (${nome})`, dimensoes: `${dR}; argamassa ${f2(v)} m³`, coef: `${cim} kg/m³`, perda: p.perdaRev, bruto: (v * cim) / p.sacoKg })
      add({ etapa: R, material: 'Areia', unidade: 'm³', tipo: 'Estimativa por composição', formula: `argamassa (${nome}) × m³ de areia/m³`, dimensoes: `argamassa ${f2(v)} m³`, coef: `${are} m³/m³`, perda: p.perdaRev, bruto: v * are })
      add({ etapa: R, material: 'Cal hidratada', unidade: 'saco', tipo: 'Estimativa por composição', formula: `argamassa (${nome}) × kg de cal/m³ ÷ kg por saco`, dimensoes: `argamassa ${f2(v)} m³`, coef: `${cal} kg/m³; saco ${p.calSacoKg} kg`, perda: p.perdaRev, bruto: p.calSacoKg > 0 ? (v * cal) / p.calSacoKg : 0 })
    }
    arg('Chapisco', p.espChapCm, p.chapCimentoKg, p.chapAreiaM3, p.chapCalKgM3)
    arg('Emboço/reboco', p.espEmbCm, p.embCimentoKg, p.embAreiaM3, p.embCalKgM3)
  }
  const cerTotal = p.cerArea + lev.ceramica
  if (cerTotal > 0)
    add({ etapa: 'Revestimentos', material: 'Revestimento cerâmico de parede', unidade: 'm²', tipo: 'Geométrico',
      formula: lev.ceramica > 0 ? 'área informada + área dos ambientes (perímetro × altura − portas; janelas não descontadas) × (1 + perda)' : 'área informada × (1 + perda)',
      dimensoes: lev.ceramica > 0 ? `${f2(p.cerArea)} m² informados + ${f2(lev.ceramica)} m² dos ambientes = ${f2(cerTotal)} m²` : `${f2(p.cerArea)} m²`, coef: '—', perda: p.perdaRev, bruto: com(cerTotal, p.perdaRev) })
  const areaForro = lev.ambientes.reduce((t, a) => t + ((a.forro === null ? p.forro > 0 : a.forro) ? a.area : 0), 0)
  if (areaForro > 0) {
    add({ etapa: 'Forro', material: 'Forro', unidade: 'm²', tipo: 'Geométrico', formula: 'área × (1 + perda)', dimensoes: `${f2(areaForro)} m²${sufArea(areaForro)}`, coef: '—', perda: p.perdaForro, bruto: com(areaForro, p.perdaForro) })
    if (p.espPerfil > 0 && p.barraPerfilM > 0)
      add({ etapa: 'Forro', material: 'Perfil de sustentação (barras)', unidade: 'barra', tipo: 'Estimativa por composição', formula: '(área ÷ espaçamento) ÷ barra × (1 + perda)', dimensoes: `${f2(areaForro)} m²${sufArea(areaForro)}; espaçamento ${p.espPerfil} m`, coef: `barra ${p.barraPerfilM} m`, perda: p.perdaForro, bruto: com(areaForro / p.espPerfil / p.barraPerfilM, p.perdaForro) })
  }
}
