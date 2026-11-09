/**
 * Mensaje de error al generar una declaracion.
 *
 * Si falta el EORI (422 del backend: del representante, del cliente...), el
 * mensaje que llega ya dice donde completarlo; para el del representante se
 * anade el enlace a Ajustes > Aduanas. Cualquier otro error devuelve el texto
 * del backend o `fallback`.
 */
export function esErrorEoriFaltante(error) {
  const respuesta = error?.response
  return respuesta?.status === 422 && ['EORI_FALTANTE', 'NOMBRE_FALTANTE'].includes(respuesta?.data?.code)
}

export function mensajeErrorGeneracion(error, fallback, t = (clave, defecto) => defecto) {
  const datos = error?.response?.data
  if (!esErrorEoriFaltante(error)) return datos?.error || datos?.message || fallback

  const aAjustes = datos.quien !== 'cliente'
  return (
    <span>
      {datos.error}
      {aAjustes && (
        <>
          {' '}
          <a href="/settings" className="underline font-medium">
            {t('declarations.irAAjustesAduanas', 'Ir a Ajustes > Aduanas')}
          </a>
        </>
      )}
    </span>
  )
}
