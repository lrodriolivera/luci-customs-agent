/**
 * Declarante que se muestra en pantalla antes de generar el H1 (casilla 14
 * del DUA, UAT 13/Nov/2026 - Patricia): en representacion directa o
 * indirecta es la agencia (el representative del expediente o, en su
 * defecto, el tenant cuyo certificado digital usa LUCI); en autodespacho es
 * el propio importador.
 *
 * Es solo para mostrar en pantalla: el backend calcula el mismo dato al
 * generar el H1 con la misma regla de comparar NIF/EORI
 * (services/forms/identificadorAduanero.js -> declarantePara). No se decide
 * aqui nada nuevo, solo se refleja lo que el backend ya resuelve.
 */

/** EORI de una parte: el campo `eori` si existe; si no, `ES` + `nif`. */
const eoriDeParte = (parte) => {
  const eori = String(parte?.eori || '').trim().toUpperCase()
  if (eori) return eori
  const nif = String(parte?.nif || '').trim().toUpperCase()
  return nif ? `ES${nif}` : ''
}

/** Solo el NIF, sin prefijo de pais, para comparar EORIs de paises distintos escritos igual. */
const soloNif = (eori) => String(eori || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ES/, '')

/**
 * @param {{
 *   representative?: { companyName?: string, nif?: string, eori?: string, representationType?: string },
 *   client?: { companyName?: string, nif?: string, eori?: string },
 *   tenant?: { name?: string, businessInfo?: { eori?: string, nif?: string } }
 * }} [datos]
 * @returns {{ companyName: string, eori: string, isSelf: boolean }}
 */
export function declaranteDe({ representative, client, tenant } = {}) {
  const eoriRepresentante = eoriDeParte(representative) || eoriDeParte(tenant?.businessInfo)
  const nombreRepresentante = representative?.companyName || tenant?.name || ''
  const eoriCliente = eoriDeParte(client)

  const nifRepresentante = soloNif(eoriRepresentante)
  const esAutodespacho = Boolean(nifRepresentante) && nifRepresentante === soloNif(eoriCliente)

  if (esAutodespacho) {
    return { companyName: client?.companyName || '', eori: eoriCliente, isSelf: true }
  }
  return { companyName: nombreRepresentante, eori: eoriRepresentante, isSelf: false }
}
