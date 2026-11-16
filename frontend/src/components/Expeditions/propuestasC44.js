/**
 * Que documentos de la casilla 44 corresponden a una partida de un H1
 * (importacion normal), a partir de la consulta del Arancel Integrado de la
 * AEAT y de los certificados que exigio la AEAT al presentar.
 *
 * Muchas medidas traen documentos condicionales que NO aplican a un H1:
 * - 107 (envios de escaso valor, <= 150 EUR) y 800 (tasa de gestion de la
 *   Union, ventas a distancia): son del H7.
 * - Suspensiones y destinos especiales (105, 115, 117, 119, 123...): solo si
 *   se solicitan (preferencia x10/x15/x20... o regimen 44).
 * - Preferencias (1xx con el pais de origen): solo si la partida usa ese
 *   arancel preferencial (prueba de origen).
 * Los certificados que la AEAT pidio al presentar si aplican siempre.
 * Las autorizaciones (C990, N990, D019) nunca van como documento de la partida.
 */

const AUTORIZACIONES = new Set(['C990', 'N990', 'D019'])
const SOLO_H7 = /^(107|800)-/
const SUSPENSION_O_DESTINO = /^(105|115|117|119|123|145|146)-/
const PREFERENCIA = /^1\d\d-/

/**
 * @param {object|null} datosAeat  - consulta del Arancel Integrado de la partida
 * @param {object} item            - partida del expediente
 * @param {object|null} certificados - aeatResponse.certificados del expediente
 * @returns {{ exigidos: object[], condicionales: object[] }}
 */
export function propuestasC44(datosAeat, item, certificados) {
  const exigidos = []
  const condicionales = []
  const yaEstan = new Set((item?.documentosC44 || []).map((d) => d.tipo))
  const anadir = (lista, doc) => {
    if (AUTORIZACIONES.has(doc.tipo) || yaEstan.has(doc.tipo)) return
    if ([...exigidos, ...condicionales].some((d) => d.tipo === doc.tipo)) return
    lista.push(doc)
  }

  for (const p of certificados?.partidas || []) {
    if (Number(p.numero) !== Number(item?.itemNumber)) continue
    for (const o of p.organismos || []) {
      for (const m of o.medidas || []) {
        for (const codigo of m.documentos || []) {
          anadir(exigidos, { tipo: codigo, descripcion: `${o.nombre || o.organismo} (${m.medida})`, motivo: 'aeatExige' })
        }
      }
    }
  }

  const preferenciaUsada = item?.aeatTariff?.medidaArancel
  for (const m of datosAeat?.medidas || []) {
    for (const d of m.documentos || []) {
      const doc = { tipo: d.codigo, descripcion: d.descripcion, medida: m.codigo }
      if (SOLO_H7.test(m.codigo)) anadir(condicionales, { ...doc, motivo: 'soloH7' })
      else if (SUSPENSION_O_DESTINO.test(m.codigo)) anadir(condicionales, { ...doc, motivo: 'siSeSolicita' })
      else if (PREFERENCIA.test(m.codigo) && !m.codigo.startsWith('103')) {
        anadir(preferenciaUsada === m.codigo ? exigidos : condicionales, { ...doc, motivo: preferenciaUsada === m.codigo ? 'preferenciaElegida' : 'siPreferencia' })
      } else anadir(exigidos, { ...doc, motivo: 'medida' })
    }
  }
  return { exigidos, condicionales }
}
