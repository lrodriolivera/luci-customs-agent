/**
 * Accesos de la interfaz que se muestran u ocultan en bloque.
 *
 * Reunion del 10/Nov/2026 y UAT del 11/Nov/2026 con las agentes de aduanas:
 * el agente trabaja desde el expediente, asi que se ocultan el alta directa de
 * H1 y de H7 y la generacion de ENS (alta manual e importacion por lotes). Las
 * rutas y el codigo siguen existiendo: para volver a mostrarlos basta con
 * poner el valor a `true`.
 */
export const MODULOS_VISIBLES = Object.freeze({
  nuevaH1: false,
  nuevaH7: false,
  crearEns: false
})
