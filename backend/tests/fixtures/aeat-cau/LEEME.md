Esquemas oficiales del servicio web `CC415AV1` de la AEAT (H1 de importación adaptado al CAU),
descargados el 12/11/2026 de
`https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/`.
Se usan solo en las pruebas, para validar el XML que construye `h1CauXmlBuilder.js`.

`CC432AV1Ent.xsd` y `ES_CC432A.xsd`: activación de una predeclaración (mismo origen, descargados el 12/11/2026).

Respuestas reales de la preproducción de la AEAT (recinto de pruebas 009999, sin modo test, 13/11/2026,
con permiso expreso): `predeclaracion-alta-…` (estado 63, número de registro), `predeclaracion-consulta-pendiente-…`,
`predeclaracion-activacion-rechazo-…` (error 80118: no se admite `ContactPerson` en la activación),
`predeclaracion-activacion-respuesta-…` (estado 90, activada) y `predeclaracion-anulacion-respuesta-…`
(`CC410A`, anulada). El teléfono de contacto se ha sustituido por uno de relleno.

`dap-ba-respuesta-real-002801.xml`: respuesta real de la preproducción (aduana 002801, modo test, 16/11/2026) a un
H1 DAP de 10.000 EUR con deducción BA de 1.000 EUR (MRN 26ES002801I01BQ0R1): la AEAT liquida A00 9.000/1.080 y
B00 10.080/2.116,80, es decir, la base del IVA es valor en aduana + arancel, sin volver a sumar el BA.
