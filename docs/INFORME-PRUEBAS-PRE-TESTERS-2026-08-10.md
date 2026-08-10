# LUCI Customs Agent — Informe de pruebas previo a testers humanos

**Fecha:** 10 de agosto de 2026
**Versión desplegada:** `0ac56f4`
**Entorno:** `https://aduanas.strixai.es` (homelab STRIX AI)
**AEAT:** entorno **PRE (pruebas)** — `AEAT_ENVIRONMENT=test`. En ningún momento se ha enviado nada a producción de AEAT.
**Autor:** Luis Rodríguez (Tech Lead)

---

## 1. Qué es este documento y cómo leerlo

Del 7 al 10 de agosto se ha recorrido la aplicación pantalla por pantalla contra el
entorno de pruebas de AEAT. Este informe recoge **qué se probó, qué se encontró y
cómo se verificó cada corrección**, para que el equipo de testers sepa qué terreno
está ya pisado y dónde conviene insistir.

Cada afirmación de este documento es comprobable: hay un identificador de commit,
un MRN devuelto por AEAT o una consulta a base de datos detrás. Donde algo **no**
está verificado, se dice explícitamente en la sección 7.

**Sobre las capturas.** Las ocho figuras de este informe son pantallazos reales de la
aplicación tomados durante la campaña, con MRN devueltos por AEAT PRE. Contienen EORI,
NIF y nombres de usuario, así que **no se versionan en el repositorio**: viven en
`evidencia-e2e-luci-2026-08/` junto al proyecto (146 capturas en total; las 8
seleccionadas, en `seleccion-informe/`). El PDF sí las lleva incrustadas y es, por
tanto, el documento que se entrega.

**Advertencia de lectura.** Este informe no presenta un producto sin defectos.
Presenta 61 correcciones sobre defectos reales, muchos de ellos graves, y una lista
abierta de lo que queda. Se ha escrito así a propósito: un informe que solo cuenta
los aciertos no sirve para dirigir una campaña de pruebas.

---

## 2. Resumen de la campaña

| Métrica | Valor |
|---|---|
| Periodo | 7 – 10 de agosto de 2026 |
| Commits | **73** (14 el 7, 33 el 8, 6 el 9, 20 el 10) |
| De ellos correcciones de defectos (`fix:`) | **61** |
| Ficheros modificados | **204** |
| Líneas | **+21.855 / −5.516** |
| Pantallas recorridas de extremo a extremo | **19** |
| Defectos corregidos | **~90** (detalle en la sección 4) |
| Ficheros de prueba | 243 backend + 69 frontend |
| Tests backend | **8.588 pasando, 0 fallando** (batería completa, 10/Ago) |
| CI | **Verde** (ejecución 186: backend 7m35s + frontend 6m49s) |

De 73 commits, **61 son correcciones de defectos**. El resto: 5 de estabilización
de pruebas, 4 de funcionalidad nueva, 2 de reorganización y 1 de integración
continua. Es una proporción que conviene leer literalmente: esta campaña no ha sido
desarrollo, ha sido reparación.

### El patrón que se repitió en todas las pantallas

No fueron noventa defectos distintos. Fue **el mismo defecto noventa veces**, con
formas diferentes:

> LUCI presentaba como dato, veredicto o intercambio con AEAT algo que no había
> obtenido ni calculado.

Ejemplos reales de esta campaña:

- Un fallo de red de la IA se leía como un **rechazo aduanero**.
- Un mensaje generado internamente aparecía como una **respuesta de AEAT**.
- Un aviso decía «Modo demo: simula el envío» mientras **enviaba de verdad** a PRE.
- Un arancel del 0 % producía un **ahorro estimado de 1.500 €**.
- Un canal ROJO se pintaba como **«Canal VERDE»**.
- Un envío de correo que nunca salió quedaba **escrito en el expediente como entregado**.

**Y en casi todos los casos los tests fijaban el comportamiento incorrecto**, o
simulaban un contrato que la fuente real no tiene. Cuando una simulación de prueba
inventa un campo, el test deja de proteger exactamente donde está el fallo. Esto es
relevante para los testers: **la existencia de tests en verde no era garantía de
nada**, y por eso hace falta el ojo humano.

---

## 3. Acceso para los testers

| Dato | Valor |
|---|---|
| URL | `https://aduanas.strixai.es` |
| Usuario de pruebas | `tester@strixai.es` |
| Contraseña | *se entrega por canal aparte — no se versiona en el repositorio* |
| Rol | admin (ve todas las pantallas) |

**Antes de empezar, dos cosas:**

1. **`Ctrl+Shift+R` en la primera carga.** El navegador cachea el paquete de la
   aplicación y las traducciones con mucha agresividad; sin recarga forzada se
   pueden ver textos y comportamientos de versiones anteriores. Esto ya nos hizo
   perder tiempo durante la campaña.
2. **Todo lo que envíes va a AEAT PRE, no a producción.** Los MRN que obtengas son
   reales dentro del entorno de pruebas de la Agencia Tributaria. No hay riesgo
   fiscal, pero **no son ficticios**: son respuestas auténticas del sistema.

---

## 4. Pantallas recorridas y qué se encontró en cada una

Orden aproximado de recorrido. La columna «Lo más grave» es lo que conviene que un
tester intente romper de nuevo.

### 4.1 Declaraciones y despacho

| Pantalla | Lo más grave que se encontró | Estado |
|---|---|---|
| `/declarations` + H1 | «Generar H1» devolvía error 500; el panel de Régimen/Incoterm salía vacío; un aviso decía «Modo demo: simula» mientras **enviaba de verdad a PRE** | Corregido. H1 DUA completo con EXP real y CC515C |
| `/h7` | Reglamento 2026/382 aplicado; H7 reescrito al esquema `AltaH7V1Ent` | **MRN real `26ESH7A000067965R5`, canal verde** |
| `/classification` (TARIC) | Clasificar y Validar estaban rotos (URL, cuerpo de petición y envoltorio); se mostraba JSON crudo al usuario | Corregido |
| `/channels` y `/requirements` | **Fuga de datos entre clientes** en las estadísticas; dos respaldos de IA que fingían un «Canal VERDE» sobre un canal ROJO | Corregido (6 defectos) |

### 4.2 ENS / ICS2 (declaración sumaria de entrada)

| Qué se probó | Lo más grave | Estado |
|---|---|---|
| ENS por API, modo RAIL | — | **CC328A con MRN real** |
| Acuse de AEAT | El `CC328A` guardado como «riesgo aceptado» **concedía el levante**; un botón «\[DEMO] Simular levante automático» daba la mercancía por despachada | Corregido (4 defectos) |
| ENS por navegador | `MesSenMES3` llevaba el EORI del transportista en vez del declarante: **las 4 ENS anteriores se habían aceptado por coincidencia** | Corregido (12 defectos) |
| Rectificación IE313 | **Los cambios no se aplicaban nunca**; `CC304A` es aceptación y `CC305A` rechazo (estaban al revés) | **Rectificación ACEPTADA en PRE** (5 defectos) |

**8 ENS con MRN real de AEAT PRE**, todas en modo RAIL:
`26ES009999Z0000685`, `...693`, `...709`, `...717`, `...725`, `...733`, `...741`, `...750`.

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/02-ens-toast-mrn-envio-aeat.png)

*Figura 1 — El aviso de la propia aplicación tras enviar: «Declaración enviada a AEAT
· MRN: 26ES009999Z0000741». Detrás, el listado con las ENS aceptadas y su MRN en la
columna correspondiente.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/01-ens-mrn-cc328a-aduana-pre.png)

*Figura 2 — Detalle de `ENS-2026-000019`: MRN `26ES009999Z0000750`, respuesta de AEAT
`CC328A` y aduana de entrada `ES009999 — PRE Pruebas Peninsula`. Es el entorno de
pruebas de AEAT, nunca producción.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/04-ens-historial-estados.png)

*Figura 3 — Pestaña «Historial» de la misma declaración: Borrador → Enviada →
Aceptada, las tres el 08/08/2026 a las 21:57.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/03-ens-listado-15-declaraciones.png)

*Figura 4 — Listado completo de ENS (15 declaraciones). Las cinco con MRN en la
columna son las que AEAT aceptó; el resto son borradores locales. La diferencia se ve
en la propia pantalla: sin MRN no hay declaración presentada.*

### 4.3 Tránsito NCTS

| Qué se probó | Lo más grave | Estado |
|---|---|---|
| T1 completo | `notifyArrival` estaba **definido dos veces**: fingía éxito mientras AEAT rechazaba | Corregido (7 defectos) |
| CC007 | 6 errores de AEAT reducidos a 1 | Queda el error 856, que depende de un dato que solo AEAT puede darnos |
| Análisis IA | Un riesgo `HIGH` se pintaba como «Bajo» en verde | Corregido |
| Veredictos | Un límite de tokens cortaba el análisis y **el manejador de errores fabricaba el veredicto**: un fallo técnico se leía como rechazo aduanero | Corregido (4 veredictos fabricados) |
| Jurisdicción | Las 15 operaciones acababan en aduana extranjera y la interfaz ofrecía acciones que solo puede presentar el destinatario | Corregido (3 defectos) |

**6 tránsitos con MRN de formato AEAT válido**: `26ES002801501092J0` a `...097J5`.

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/06-transit-mrn-liberado-3-mensajes.png)

*Figura 5 — Tránsito T1 `26ES002801501095J7` liberado en partida (ES002801 → ES002901),
con precinto declarado y el contador «3 mensaje(s) NCTS». Ese contador es justo lo que
se corrigió: de los tres mensajes anotados, solo dos cruzaron la red — el `IE029` se
generaba en local y se presentaba igual que un levante concedido por AEAT. Hoy el
listado distingue los intercambiados de los que son solo registro local.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/05-transit-error-aeat-visible.png)

*Figura 6 — El comportamiento correcto ante un rechazo: AEAT devuelve «El elemento no
cumple con el formato exigido» con el patrón que espera, y la interfaz lo muestra tal
cual sobre el LRN `LRNMSKEKS0T7E5C9Z`. Antes de la corrección, una respuesta así podía
acabar presentada como éxito.*

### 4.4 Cálculo y normativa (la tanda más delicada)

Esta es la parte donde un error no da un mensaje de fallo: **da una cifra creíble y
equivocada**. Es lo que más conviene que un tester con conocimiento aduanero revise.

| Pantalla | Lo más grave | Estado |
|---|---|---|
| `/excise-duties` | **El peor hallazgo de la campaña.** Casi ningún tipo de impuestos especiales coincidía con la Ley 38/1992: cerveza con una tarifa inexistente, **todo el vino tratado como producto intermedio** (8.500 € inexistentes por contenedor), alcohol un 14 % por encima, los 8 valores del tabaco mal | Corregido contra el BOE consolidado |
| `/preferences` | «Ahorro Estimado» inventado en las dos capas: un 12,5 % fijo en la interfaz y una tabla de aranceles **por capítulo** en el servidor → 1.500 € de ahorro sobre un arancel real del 0 % | Corregido |
| `/quotas` | Saldos de contingente cableados presentados como disponibilidad real, y fecha de agotamiento extrapolada dada como dato | Corregido: **1.682 contingentes de 2026** traídos de la fuente oficial |
| Aranceles | 426 códigos con arancel al 50 %: era la **sanción a Rusia (Reg. 2024/1392) guardada como derecho general**. De 11 contingentes cableados, **10 no existían** | 378 aranceles repoblados de la fuente oficial |
| `/rules-engine` | Avisaba de sanciones a Rusia y a la vez listaba la documentación **omitiendo la autorización que impide despacharla** | Corregido |
| `/regulations` | EUR-Lex responde `202` con cuerpo vacío: no es un error, así que el documento se quedaba sin contenido y salía «Artículo no encontrado» **en verde** para el artículo 22 del Código Aduanero | Corregido |
| `/calculator` | Un problema de tipos marcaba `dutyType: 'mixed'` en unos 19.900 códigos | Corregido |

### 4.5 Envío de correo (10/Ago, `0ac56f4`)

El servicio de correo **no lanza error cuando falla**: devuelve un resultado con
`success: false` en tres situaciones distintas (sin transporte configurado,
destinatario en lista de supresión, o fallo de envío capturado internamente).
**Ninguno de los llamantes lo comprobaba** — 0 de 12.

Cuatro con defecto real, ordenados por gravedad:

1. **Enviar enlace del portal al cliente**: guardaba en el expediente una
   comunicación y un evento de cronología afirmando que el cliente había recibido
   el enlace, y respondía «Link enviado correctamente». **El expediente
   documentaba como entregado un correo que nunca salió.**
2. **Acción de correo en flujos de trabajo**: informaba `sent: true` y ese valor
   queda guardado en el histórico de la ejecución.
3. **Recuperar contraseña**: decía «recibirás un enlace» y además **invalidaba el
   token que acababa de crear**, así que el usuario esperaba un correo inexistente.
4. **Aviso de canal al cliente**: el registro afirmaba «Client notified» sobre un
   aviso no entregado.

**Cómo se verificó en producción:** la respuesta del servidor es idéntica en éxito
y en fallo, y debe serlo para no revelar qué correos existen. Lo que discrimina es
el token: si el envío falla, la corrección lo borra. Se solicitó un
restablecimiento para `tester@strixai.es` y el token sha256 de 64 caracteres seguía
en base de datos con caducidad a 1 hora ⇒ **el correo salió de verdad**.

---

## 5. Datos oficiales cargados

Nada de esto es inventado; todo procede de fuente oficial y es contrastable.

| Catálogo | Registros | Fuente |
|---|---|---|
| Códigos TARIC | **21.946** | TARIC oficial de la Comisión Europea |
| Contingentes arancelarios 2026 | **1.682** | Sistema QUOTA (DDS2) de la Comisión |
| Aranceles repoblados | 378 | TARIC oficial |
| Tipos de impuestos especiales | Todos | BOE consolidado, Ley 38/1992 |

Para contrastar un arancel concreto, la consulta oficial es:

```
https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=es&SimDate=AAAAMMDD&Area=<ISO2>&Taric=<10 dígitos>&LangDescr=es&Expand=true
```

---

## 6. Estado del sistema en el momento de entregar a los testers

Verificado el 10/08/2026 a las 19:45:

| Comprobación | Resultado |
|---|---|
| Versión desplegada | `0ac56f4` (igual que el repositorio) |
| Contenedor del backend | `healthy` |
| MongoDB / Redis | `connected` |
| Sitio público | HTTP 200 |
| Inicio de sesión | Correcto |
| Errores en el registro | 0 |
| Avisos | 1 (Node 20 y el SDK de AWS — conocido e inofensivo) |
| Batería de pruebas del backend | **8.588 pasando, 0 fallando** |
| Integración continua | **Verde** (ejecución 186) |

### Contenido con el que se va a encontrar el tester

| Colección | Registros |
|---|---|
| Códigos TARIC | 21.946 |
| Contingentes arancelarios | 1.682 |
| Tránsitos | 53 |
| Declaraciones H7 | 41 |
| Expedientes | 33 |
| Comunicaciones con inspector | 25 |
| Inspecciones | 20 |
| Requerimientos | 15 |
| Garantías | 12 |
| Regímenes especiales | 10 |
| ENS | 8 |
| OEA | 5 |

---

## 7. Lo que NO está verificado — dónde conviene que insistan los testers

Esta sección es la más útil del documento. Aquí no hay red de seguridad.

### 7.1 Sin recorrer por navegador

- **`/ens`: el asistente y «Nueva ENS» en los cuatro modos de transporte.** Solo
  se ha verificado **RAIL**. Los plazos de ROAD (1 h), AIR (4 h) y SEA (24 h) no
  se han ejercitado por interfaz.
- **`/ens`: «Importar Lote»** de extremo a extremo (CSV separado por `;`).

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/07-ens-ics2-solo-rail.png)

*Figura 7 — `ENS-2026-000008`, modo marítimo: el botón «Enviar a AEAT» está
deshabilitado y explica por qué — «Este modo debe declararse mediante ICS2 (no por el
canal AEAT actual)». La limitación se avisa en pantalla en vez de dejar que el envío
falle. Los modos ROAD, AIR y SEA siguen sin recorrer por navegador.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/08-ens-importar-lote.png)

*Figura 8 — «Importar Lote» sí se ha ejercitado hasta el paso 3: 2 de 2 declaraciones
procesadas, creadas como `ENS-2026-000011` y `...012`. Quedan **sin MRN** (columna a
guiones), es decir, creadas en LUCI pero no presentadas: eso es lo que falta recorrer.*
- **`/pue`** (Punto Único de Entrada / SOIVRE): es el **único generador de
  documentos sin MRN real**, porque AEAT lo tiene bloqueado para nuestro EORI.

### 7.2 Defectos conocidos y no corregidos

| Qué | Consecuencia para el tester |
|---|---|
| **14 tránsitos con MRN de formato inválido** (`2026ES00384656` y similares) | Datos previos ya sembrados. El generador ya está corregido; los antiguos siguen mal. No es un fallo nuevo si los ves |
| **`2026ES00642137`: `released` sin ningún mensaje** | Un levante sin nada que lo respalde. Anterior a la instrumentación, sin rastro de origen. **Pendiente de decisión** |
| **Anular un tránsito no existe** | El estado `cancelled` está en el modelo pero **ninguna transición lo asigna**. Si buscas cómo anular, no lo hay |
| **Firma XAdES** | El resumen criptográfico de `SignedProperties` se calcula sobre el identificador y no sobre el bloque XML. **Primer sospechoso si AEAT rechaza por «digest»** |
| **~75 rejillas de MUI v5 sin migrar** (sobre todo en `/pue` y `/queries`) | Posible descuadre visual del diseño en esas pantallas |
| **`TransitManager` casi sin traducir** | Verás texto en castellano aunque cambies de idioma. ~7 claves traducidas en unas 2.100 líneas |
| **Facturación oculta a propósito** | No es un fallo: se ha ocultado deliberadamente |
| **ICS2 solo cubre RAIL** | Los otros modos usan el camino heredado |

### 7.3 Funciones sin pantalla que las invoque

Existen y funcionan en el servidor, pero no hay interfaz: `amend` de ENS
(verificado contra PRE, sin pantalla), `addDocument`, `searchByContainer`,
`searchByBOL`, `getDeadlines` y cuatro funciones de IA.

### 7.4 Bloqueado por AEAT, no por nosotros

- **`IE314V5SOAP` no habilitado** para nuestro EORI en PRE (responde
  `Codigo[404]. Web Service no habilitado`) ⇒ **la anulación de ENS no se puede
  verificar**. El `IE313` sí está habilitado y verificado.
- **El CC007 necesita un G4/DSDT en PRE que referencie un tránsito nuestro.** Sin
  ese vínculo el ciclo NCTS es intestable de extremo a extremo (error 856).
- **`/pue` / SOIVRE bloqueado**, de ahí la ausencia de MRN real.

---

## 8. Cómo reportar un hallazgo

Para que un informe sea accionable, hacen falta cuatro cosas:

1. **Qué esperabas y qué pasó.** Si es una cifra, di **cuál debería ser y por qué**
   (artículo, reglamento o código TARIC). En esta aplicación el fallo típico no es
   un mensaje de error: es un número creíble y equivocado.
2. **El MRN** si hubo intercambio con AEAT, o el identificador del expediente.
3. **Captura completa**, incluida la barra de direcciones.
4. **Si es visual, prueba antes con `Ctrl+Shift+R`** y dilo en el informe.

**Especialmente valioso:** cualquier pantalla que presente un resultado
tranquilizador —un «todo correcto» en verde, un ahorro, un canal verde, un plazo
holgado— **sin que se vea de dónde sale el dato**. Ese es exactamente el patrón que
ha producido los noventa defectos de esta campaña, y la razón por la que hay
testers humanos.

---

*Documento generado el 10/08/2026 sobre la versión `0ac56f4`. Todas las cifras
proceden del repositorio, de la base de datos de producción o de respuestas de
AEAT PRE, consultadas en el momento de escribirlo.*

---

## Anexo A — Los 73 commits de la campaña

Trazabilidad completa. Cada línea es verificable con `git show <hash>`.

| Commit | Fecha | Asunto |
|---|---|---|
| `4e5a0bd` | 2026-08-07 | fix: acotar stats de requerimientos por tenant y no fingir analisis IA fallidos |
| `0b99d49` | 2026-08-07 | fix: coherencia del filtro de canales y precarga desde expediente |
| `e41664b` | 2026-08-07 | fix: claves de estado de expediente faltantes en i18n (7 idiomas) |
| `7c44d37` | 2026-08-07 | refactor: migrar los ~40 parseos JSON de aiService a _extraerJsonString |
| `309f681` | 2026-08-07 | fix: pestaña de documentos IA vacia y flaky de planLimits |
| `4ceb90e` | 2026-08-07 | fix: el boton Clasificar de la pestaña Basico estaba roto (405 + contrato) |
| `a8b238a` | 2026-08-07 | fix: validacion muestra JSON crudo y analisis completo agota el timeout |
| `1f6c6e6` | 2026-08-07 | feat: reintento con backoff exponencial en callClaude ante errores transitorios |
| `d8111f5` | 2026-08-07 | fix: panel de regimen/incoterm vacio y panel 'Sobre H1' no cambiaba a AES |
| `c8491ba` | 2026-08-07 | fix: Generar H1/AES daba 500 (Expedition validation failed) |
| `fd32d72` | 2026-08-07 | fix: envio a AEAT/DMS usa modal propio en vez de confirm() nativo |
| `e87871e` | 2026-08-07 | refactor: sustituir los confirm() nativos por un modal reutilizable |
| `f0af0ab` | 2026-08-07 | fix(expeditions): aviso "Enviar a AEAT" reflejaba envío simulado siendo REAL a PRE |
| `efc59d1` | 2026-08-07 | feat(h7): aplicar Reglamento (UE) 2026/382 - fin franquicia + derecho fijo 3€/artículo |
| `c12da73` | 2026-08-08 | fix(h7): reference colisionaba (E11000) al crear H7 — usar máx sufijo, no countDocuments |
| `357e648` | 2026-08-08 | fix(h7): enviar H7 con el esquema oficial AltaH7V1Ent — MRN real de AEAT PRE |
| `2554ac7` | 2026-08-08 | fix(h7): orden de elementos del Importer en AltaH7V1 (eMailAddress, phoneNumber, ..., naturalPerson) |
| `06d902a` | 2026-08-08 | fix(h7): regex del MRN rechazaba el MRN real de AEAT (26ESH7A...) |
| `dcaaa35` | 2026-08-08 | fix(ens): mostrar al usuario el resultado del envío a AEAT (fallo silencioso) |
| `8f2ad95` | 2026-08-08 | fix(ens): el importador de lote no generaba partidas de mercancía (envío fallaba) |
| `05712d9` | 2026-08-08 | feat(ens): andamiaje ICS2 y bloqueo de envio legacy para SEA/AIR/ROAD |
| `3ddd104` | 2026-08-08 | fix(ens): migrar Grid a la API de MUI v7 y traducir 2 literales |
| `c3e0d23` | 2026-08-08 | fix(ens,h7): el envio a AEAT no es demo y la tabla de resultados de lote se pinta |
| `cac5131` | 2026-08-08 | fix(ens): la lista avisaba en silencio del envio a AEAT y no bloqueaba ICS2 |
| `b40c144` | 2026-08-08 | fix(aeat): el rechazo CC316A mostraba solo el valor, no el campo infractor |
| `4ab1eea` | 2026-08-08 | fix(ens): exigir codigo de mercancia real en vez de rellenar 000000 |
| `140184d` | 2026-08-08 | fix(ens): MesSenMES3 es el declarante que firma, no el transportista |
| `aaca8b3` | 2026-08-08 | fix(ens): el filtro Desde/Hasta acota la llegada prevista, no createdAt |
| `4f5cd4a` | 2026-08-08 | fix(i18n): 96 claves usadas sin traducir pintaban la clave cruda en la UI |
| `88eec3c` | 2026-08-08 | fix(transit): el formulario NCTS no pedia las partidas de mercancia ni guardaba los precintos |
| `29be8d0` | 2026-08-08 | fix: notifyArrival/notifyUnloading fingian exito ante rechazo de AEAT + documento previo en el formulario NCTS |
| `3d2433e` | 2026-08-08 | fix(ncts): CC007 y CC044 conformes con el XSD oficial de AEAT |
| `7e740b3` | 2026-08-08 | fix: CC007 NCTS cumple las reglas de negocio de AEAT (6 errores -> 1) |
| `d19a5ce` | 2026-08-08 | fix: el rechazo 856 del CC007 decia solo 'ADDS_No existe ninguna partida' |
| `5d8d306` | 2026-08-08 | fix(transit): el panel Analisis IA leia un contrato que el backend no devuelve |
| `8a288ac` | 2026-08-08 | fix: la etiqueta de modelo IA que ve el cliente decia 'opus-4'/'sonnet-4' |
| `84a8125` | 2026-08-08 | fix(transit): autocompletar IA leia otro contrato, borraba partidas y filtro no reseteaba pagina |
| `cdef9e9` | 2026-08-08 | fix(transit): no presentar como intercambio con AEAT los mensajes NCTS locales |
| `7a1cff5` | 2026-08-08 | fix(transit): backfill de la marca `exchanged` en los mensajes NCTS ya guardados |
| `b8c3ad2` | 2026-08-08 | fix: los prompts de transito interpolaban "undefined" como si fuera un dato |
| `e0fccef` | 2026-08-08 | fix: transitos 'recovered'/'written_off' se etiquetaban "Borrador" |
| `3db72aa` | 2026-08-08 | fix: un fallo del analisis IA de transito se presentaba como veredicto aduanero |
| `34b25e0` | 2026-08-08 | fix(transit): no ofrecer avisos NCTS imposibles, MRN con formato AEAT y salida del estado submitted |
| `266e832` | 2026-08-08 | fix(transit): el CC044 no declara precintos conformes sin comprobarlos, y el reintento no dice "enviada" |
| `ba44fe4` | 2026-08-08 | fix(transit): control de destino alcanzable, CC044 sin conformidad inventada y subdocumentos `type` que se perdian |
| `b76d731` | 2026-08-08 | fix(ens): 6 bugs de /ens hallados en E2E contra AEAT PRE |
| `41b2d73` | 2026-08-08 | fix(ens): 4 bugs mas que destapo el reenvio del IE313 a AEAT PRE |
| `da7241d` | 2026-08-09 | fix(ens): el acuse CC328A no es un analisis de riesgo ni un levante |
| `90142ea` | 2026-08-09 | feat(ens): processRiskResponse ya tiene llamante (ingesta del mensaje de riesgo AEAT) |
| `9c85974` | 2026-08-09 | fix: contador atomico de referencias en 8 modelos (adios al countDocuments+1) |
| `51809a5` | 2026-08-09 | fix: fuente unica de aduanas de entrada (habia tres listas contradictorias) |
| `f37d6d1` | 2026-08-09 | fix(ens): la plantilla de Importar Lote traia una aduana inexistente |
| `3a4ea2b` | 2026-08-09 | fix(ens): anular una sumaria presenta el IE314 a AEAT en lugar de fingirlo |
| `29dd1ce` | 2026-08-10 | fix(ens): la rectificacion IE313 declaraba los datos SIN rectificar y la daba por buena |
| `5b47caa` | 2026-08-10 | fix(calculator,preferences): tres datos que la UI presentaba sin haberlos obtenido |
| `42fd4f2` | 2026-08-10 | fix(preferences): el ahorro salia de una tabla de aranceles por capitulo, no del arancel real |
| `a2af4ee` | 2026-08-10 | fix(rules-engine): la autorizacion por sanciones no llegaba a la documentacion requerida |
| `8047d98` | 2026-08-10 | fix(excise,quotas): tipos de impuestos especiales contrastados con la Ley 38/1992 |
| `9a493d4` | 2026-08-10 | fix(regulations): un fallo al leer la norma se presentaba como "articulo no encontrado" |
| `3517b3f` | 2026-08-10 | fix(regulations): el fallo al leer la norma no dejaba nada en pantalla |
| `c1e4bf0` | 2026-08-10 | fix(preferences): el nombre interno del campo titulaba el problema del certificado |
| `521e443` | 2026-08-10 | fix: traer aranceles y contingentes de la fuente oficial en vez de valores cableados |
| `413e955` | 2026-08-10 | fix(quotas): el listado de criticos recortaba 91 contingentes en silencio |
| `2eb273c` | 2026-08-10 | fix: declarar lucide-react en frontend/package.json |
| `f0a454c` | 2026-08-10 | test: estabilizar el flaky de OEAManager antes de meter el frontend en el CI |
| `cfa6907` | 2026-08-10 | ci: ejecutar los tests del frontend, no solo el build |
| `ed13007` | 2026-08-10 | fix(tests): declarar mongodb-memory-server, que solo existia en un directorio ignorado |
| `157cd78` | 2026-08-10 | fix: fijar el locale es-ES en los importes y fechas de los mensajes al usuario |
| `6504c68` | 2026-08-10 | test: estabilizar apiKeyAuth.branches, que fallaba bajo la carga de la bateria |
| `56fe21a` | 2026-08-10 | test: fijar el dado del simulador VUA en vez de muestrearlo 20 veces |
| `b209f14` | 2026-08-10 | test: no fijar el separador de miles de toLocaleString en IntegrationsManager |
| `961896c` | 2026-08-10 | test: esperar el fin de la carga real en OEAManager, no que el mock se llame |
| `0ac56f4` | 2026-08-10 | fix: comprobar el success del envio de email, no solo las excepciones |
