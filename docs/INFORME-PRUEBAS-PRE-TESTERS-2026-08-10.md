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

**Sobre las capturas.** Las **44 figuras** de este informe son pantallazos reales de la
aplicación en producción, con MRN devueltos por AEAT PRE. Hay al menos una de **cada una
de las 36 pantallas** de la aplicación: las de la campaña —tomadas en el momento en que
se encontró cada defecto— y un recorrido completo de solo lectura hecho el 10/08 para
que no falte ninguna sección. Contienen EORI, NIF y nombres de usuario, así que **no se
versionan en el repositorio**: viven en `evidencia-e2e-luci-2026-08/` junto al proyecto
(191 ficheros en total; el recorrido de las 36 pantallas en `pantallas-completas/`, las
ocho de los hallazgos en `seleccion-informe/`, y el material de trabajo de la campaña en
`ens/`, `transit/` y `sueltas/`). El PDF sí las lleva incrustadas y es, por tanto, el
documento que se entrega.

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
| Pantallas recorridas de extremo a extremo | **19** de 36 (las 17 restantes, en el anexo A) |
| Defectos corregidos | **~90** (detalle en la sección 4) |
| Defectos nuevos encontrados al redactar este informe | **6**, sin corregir (ver 7.2) |
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

### 4.0 Punto de entrada: escritorio y expedientes

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/00-dashboard.png)

*Figura 1 — Escritorio con datos reales: 33 expedientes (6 pendientes, 18 en proceso,
7 completados), 16 alertas críticas y los cinco expedientes recientes con su estado
aduanero (Listo H1, Canal Verde, Borrador). El conmutador AEAT / DMS-DECO de arriba a
la derecha es el cambio de país: España y Países Bajos.*

> **Defecto encontrado al tomar esta captura.** En el panel «Plataforma», la fila
> **«Países: 21946»** no cuenta países: es el total de códigos TARIC. La etiqueta es
> `dashboard.countries` sobre el valor `taricCodesTotal`
> (`Dashboard.jsx:402`). No corregido — figura en la sección 7.2.

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/01-expedientes.png)

*Figura 2 — Listado de expedientes: 33 registros con cliente, NIF, tipo, país, estado
del circuito (Canal Verde, Canal Naranja, Levante, Docs Validados…) y número de
documentos adjuntos. Es la pantalla desde la que arranca cualquier operación.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/02-expediente-nuevo.png)

*Figura 3 — Alta de expediente en tres pasos: Tipo y Cliente → Mercancías →
Transporte.*

### 4.1 Declaraciones y despacho

| Pantalla | Lo más grave que se encontró | Estado |
|---|---|---|
| `/declarations` + H1 | «Generar H1» devolvía error 500; el panel de Régimen/Incoterm salía vacío; un aviso decía «Modo demo: simula» mientras **enviaba de verdad a PRE** | Corregido. H1 DUA completo con EXP real y CC515C |
| `/h7` | Reglamento 2026/382 aplicado; H7 reescrito al esquema `AltaH7V1Ent` | **MRN real `26ESH7A000067965R5`, canal verde** |
| `/classification` (TARIC) | Clasificar y Validar estaban rotos (URL, cuerpo de petición y envoltorio); se mostraba JSON crudo al usuario | Corregido |
| `/channels` y `/requirements` | **Fuga de datos entre clientes** en las estadísticas; dos respaldos de IA que fingían un «Canal VERDE» sobre un canal ROJO | Corregido (6 defectos) |

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/06-h7-listado.png)

*Figura 4 — H7 (comercio electrónico): 41 declaraciones, 2.770 € de valor y 643,26 € de
derechos recaudados. Las dos primeras filas llevan **MRN real de AEAT PRE**
(`26ESH7A000067966R4` y `...965R5`) en estado Levante. Arriba, el aviso del
**Reglamento (UE) 2026/382** marcado «EN VIGOR» con enlace a EUR-Lex: es la supresión
de la franquicia de 150 €.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/07-h7-nueva.png)

*Figura 5 — Alta de H7. El aviso recoge la consecuencia práctica del reglamento:
**derecho fijo de 3 € por artículo** para envíos IOSS y postales.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/05-h1-nueva.png)

*Figura 6 — Alta de H1 (DUA de importación) con la casilla 1.1 del documento: tipo de
declaración IM/CO y adicional A/D/Y. Es el formulario completo, no un resumen.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/04-declarations.png)

*Figura 7 — Generador de declaraciones: elección entre H1 (importación) y AES
(exportación), con el país aduanero seleccionado arriba. Aquí estaba el aviso «Modo
demo: simula» que en realidad enviaba a PRE.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/03-classification.png)

*Figura 8 — Clasificación TARIC con sus cuatro modos: Básico, Buscar Código, Explorar
Árbol y Avanzado IA.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/16-channels.png)

*Figura 9 — Circuitos aduaneros: 11 en Canal Verde con levante autorizado. Las
estadísticas de esta pantalla eran las que **filtraban datos entre clientes**.*

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

*Figura 10 — El aviso de la propia aplicación tras enviar: «Declaración enviada a AEAT
· MRN: 26ES009999Z0000741». Detrás, el listado con las ENS aceptadas y su MRN en la
columna correspondiente.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/01-ens-mrn-cc328a-aduana-pre.png)

*Figura 11 — Detalle de `ENS-2026-000019`: MRN `26ES009999Z0000750`, respuesta de AEAT
`CC328A` y aduana de entrada `ES009999 — PRE Pruebas Peninsula`. Es el entorno de
pruebas de AEAT, nunca producción.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/04-ens-historial-estados.png)

*Figura 12 — Pestaña «Historial» de la misma declaración: Borrador → Enviada →
Aceptada, las tres el 08/08/2026 a las 21:57.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/03-ens-listado-15-declaraciones.png)

*Figura 13 — El listado tal como estaba durante la campaña, con 15 declaraciones: las
cinco con MRN en la columna son las que AEAT aceptó y el resto eran borradores locales.
La diferencia se ve en la propia pantalla: sin MRN no hay declaración presentada.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/08-ens.png)

*Figura 14 — El mismo listado el 10/08 al cerrar el informe, y **no coincide con la
figura anterior**: quedan 8 declaraciones, todas con MRN real y en «Aceptada» (71,3 Tn,
442 bultos). Los borradores intermedios y las `ENS-2026-000011/000012` de la importación
por lote ya no están; las referencias saltan de `000005` a `000015`. Se deja constancia
del descuadre: si un tester ve un recuento distinto al de la figura 13, es esto, no un
fallo. **Las ocho son modo RAIL** — el único que cubre ICS2 hoy (ver 7.1).*

> **Detalle que conviene mirar.** La columna «Riesgo» marca «Pendiente» en las ocho.
> Eso es lo correcto tras la corrección: AEAT no ha comunicado análisis de riesgo, así
> que no hay canal. Antes, ese hueco se rellenaba con un acuse propio y **el levante se
> daba por concedido**. Un «Pendiente» aquí es una buena señal, no una carencia.

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

*Figura 15 — Tránsito T1 `26ES002801501095J7` liberado en partida (ES002801 → ES002901),
con precinto declarado y el contador «3 mensaje(s) NCTS». Ese contador es justo lo que
se corrigió: de los tres mensajes anotados, solo dos cruzaron la red — el `IE029` se
generaba en local y se presentaba igual que un levante concedido por AEAT. Hoy el
listado distingue los intercambiados de los que son solo registro local.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/05-transit-error-aeat-visible.png)

*Figura 16 — El comportamiento correcto ante un rechazo: AEAT devuelve «El elemento no
cumple con el formato exigido» con el patrón que espera, y la interfaz lo muestra tal
cual sobre el LRN `LRNMSKEKS0T7E5C9Z`. Antes de la corrección, una respuesta así podía
acabar presentada como éxito.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/24-transit.png)

*Figura 17 — Listado de tránsitos: 37 operaciones, todas T1 (T2, T2F y TIR a cero).
Conviene mirar la mezcla: los seis `26ES0028015010xx` con MRN de formato AEAT válido
—en «Liberado» o «En Tránsito»— frente a la mayoría en «Borrador» con LRN pero sin MRN,
que son los que **nunca se presentaron**. Un tránsito en «Borrador» no está en poder de
la aduana; el listado no debería leerse como cartera de operaciones vivas.*

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

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/12-excise-duties.png)

*Figura 18 — Impuestos especiales tras la corrección. El texto de la pantalla ya cita
el artículo de la Ley 38/1992 que aplica a cada base: cerveza €/hl por grado Plato
(art. 26), **vino a tipo cero (art. 30)** y alcohol etílico €/hl de alcohol puro
(art. 39). El vino a tipo cero es justo lo que estaba mal: se cobraba como producto
intermedio.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/13-quotas.png)

*Figura 19 — Contingentes arancelarios. El subtítulo dice ahora lo que antes se
ocultaba: «El saldo es el de la última sincronización con la Comisión, **no una
consulta en vivo**». Y el campo exige 6 dígitos, porque con menos se devolvían
contingentes de otro producto.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/10-calculator.png)

*Figura 20 — Calculadora de derechos: código TARIC, valor en aduana y país de origen.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/11-preferences.png)

*Figura 21 — Preferencias arancelarias (FTA, GSP, GSP+, EBA), con sus tres pestañas:
Verificar Elegibilidad, Validar Certificado y Recomendaciones. El «Ahorro Estimado»
inventado estaba aquí.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/15-regulations.png)

*Figura 22 — Buscador de normativa sobre EUR-Lex (CAU) y BOE, con el catálogo del
Reglamento (UE) 952/2013. Es la pantalla donde EUR-Lex devolvía `202` con cuerpo vacío
y el artículo salía sin contenido, en verde.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/14-rules-engine.png)

*Figura 23 — Motor de reglas: analiza requisitos, aranceles, impuestos y controles de
una operación concreta.*

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

> **Estas cifras son de la base de datos completa, no de lo que verá cada usuario.** Los
> listados filtran por propietario, así que casi ningún recuento de pantalla va a coincidir
> con esta tabla: de los 53 tránsitos, 37 son del usuario con el que se tomaron las
> capturas y 16 del de pruebas; las 12 garantías son todas del usuario de pruebas, y por
> eso `/guarantees` muestra 0 en la figura 30. Una diferencia entre esta tabla y la
> pantalla es lo normal; lo que **no** es normal es que el escritorio avise de garantías
> de otro usuario — ver 7.2, punto 1.

---

## 7. Lo que NO está verificado — dónde conviene que insistan los testers

Esta sección es la más útil del documento. Aquí no hay red de seguridad.

### 7.1 Sin recorrer por navegador

- **`/ens`: el asistente y «Nueva ENS» en los cuatro modos de transporte.** Solo
  se ha verificado **RAIL**. Los plazos de ROAD (1 h), AIR (4 h) y SEA (24 h) no
  se han ejercitado por interfaz.
- **`/ens`: «Importar Lote»** de extremo a extremo (CSV separado por `;`).

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/07-ens-ics2-solo-rail.png)

*Figura 24 — `ENS-2026-000008`, modo marítimo: el botón «Enviar a AEAT» está
deshabilitado y explica por qué — «Este modo debe declararse mediante ICS2 (no por el
canal AEAT actual)». La limitación se avisa en pantalla en vez de dejar que el envío
falle. Los modos ROAD, AIR y SEA siguen sin recorrer por navegador.*

![](../../evidencia-e2e-luci-2026-08/seleccion-informe/08-ens-importar-lote.png)

*Figura 25 — «Importar Lote» sí se ha ejercitado hasta el paso 3: 2 de 2 declaraciones
procesadas, creadas como `ENS-2026-000011` y `...012`. Quedan **sin MRN** (columna a
guiones), es decir, creadas en LUCI pero no presentadas: eso es lo que falta recorrer.*
- **`/pue`** (Punto Único de Entrada / SOIVRE): es el **único generador de
  documentos sin MRN real**, porque AEAT lo tiene bloqueado para nuestro EORI.

### 7.2 Defectos conocidos y no corregidos

#### Encontrados al redactar este informe (10/Ago, verificados, sin corregir)

Recorrer las 36 pantallas para ilustrar el documento destapó **seis defectos
nuevos**. Se dejan aquí sin corregir a propósito: sirven de calibración: son
exactamente el tipo de cosa que se busca, y los testers pueden comprobar si los
encuentran por su cuenta.

**1. 🔴 El escritorio avisa de garantías agotadas que no existen** — el mismo
patrón de la campaña, y el más grave de los seis.

La figura 1 muestra tres alertas **CRÍTICO** «Garantía con saldo bajo: 100 %
utilizado», y la figura 30 muestra «No hay garantías registradas». Ninguna de las
dos miente sobre lo que consulta; el problema es la consulta del escritorio
(`backend/src/routes/dashboard.js:101`):

```js
const lowBalanceGuarantees = await Guarantee.find({
  status: 'active',
  $expr: { $lt: ['$balance.available', { $multiply: ['$amount', 0.2] }] }
});
```

Los campos `balance.available` y `amount` **no existen en el modelo**: los reales
son `availableAmount` y `totalAmount`. En MongoDB una referencia a un campo
inexistente se evalúa como `null`, y **`$lt: [null, null]` es `true`**, así que la
consulta selecciona *todas* las garantías activas — 10 de 12 — y luego
`percentUsed` calcula `100 %` sobre esos mismos `undefined`. No hay ni un error en
el registro: la consulta funciona, sencillamente afirma lo contrario de la verdad.
Consultado con los campos correctos, el número de garantías con saldo bajo real es
**0**. Lo mismo ocurre con «garantías por vencer», que busca `expirationDate`
cuando el campo es `validUntil`.

Y hay un segundo problema en la misma consulta: **no filtra por cliente**. Las 7
consultas de `/api/dashboard/alerts` no acotan por `owner` ni por `tenantId`,
aunque su propia documentación dice «Alertas consolidadas del tenant». Hoy no se
nota porque solo hay un cliente en la base de datos, pero es la misma familia de
fuga que ya se corrigió en las estadísticas de canales y requerimientos. Por eso
`/guarantees` muestra 0: **ese** listado sí filtra (`owner: req.user._id`), y las
12 garantías pertenecen a `tester@strixai.es`, no al usuario con el que se tomó la
captura.

> Un tester que vea esas tres alertas rojas en el escritorio dará por hecho que hay
> garantías al límite. Es la definición del patrón de esta campaña: **una cifra
> creíble, alarmante y falsa, sin ningún error a la vista.**

**2. «Países: 21946» en el escritorio** no cuenta países: es el total de códigos
TARIC. La etiqueta `dashboard.countries` se pinta sobre el valor `taricCodesTotal`
(`Dashboard.jsx:402`), y **el test afirma el mismo valor equivocado**
(`Dashboard.test.jsx:627`) — otra vez un test fijando el fallo.

**3. La «Confianza de Modelos» de `/ml-insights` son tres números escritos a
mano.** Las barras del 85 %, 78 % y 92 % (figura 41) salen de
`stats?.…?.modelConfidence || 85` en `MLInsights.jsx:322-351`. Las dos primeras
tienen un origen real posible, pero el respaldo cableado gana siempre que el dato
falte; **la tercera (92 %, detección de fraude) no lo tiene en absoluto**:
`fraudDetectionService.getStatistics()` no devuelve `modelAccuracy`, así que ese
92 % es siempre el literal. Se pinta junto a «Precisión: N/A%» y 0 análisis.

**4. Las estadísticas de uso de `/integrations` están cableadas.** Las 3.040
llamadas y el 98,4 % de éxito de la figura 35 son literales en
`integrationManager.js:417`, en un método cuyo propio comentario lo dice: *«En
producción, esto leería de una base de datos»*. Además, el contador «Simulación: 0»
contradice a las tres tarjetas que muestran «Ambiente: simulation».

**5. `/settings` no carga: «Error al cargar la configuración»** (figura 43).
`GET /api/tenant` responde **400 `TENANT_REQUIRED`** con token válido. La causa:
`extractTenant` resuelve el cliente desde `req.user.tenantId`, pero la ruta
`/tenant` **no lleva el middleware `auth`** (`routes/tenant.js:72`), así que
`req.user` nunca se rellena y `requireTenant` rechaza la petición. Es primo hermano
del defecto ya corregido de las 9 rutas de gestión de clientes que devolvían 401 por
la misma razón.

**6. `GET /api/knowledge/categories` responde 404** al abrir `/assistant`. El
router solo expone `/regimes`, `/regime/:code`, `/incoterms` e `/incoterm/:code`; la
ruta de categorías no existe. La pantalla funciona igual —de ahí que pasara
inadvertido—, pero cada carga produce un 404 en la consola.

#### Ya conocidos de la campaña

| Qué | Consecuencia para el tester |
|---|---|
| **14 tránsitos con MRN de formato inválido** (`2026ES00384656` y similares) | Datos previos ya sembrados. El generador ya está corregido; los antiguos siguen mal. No es un fallo nuevo si los ves |
| **`2026ES00642137`: `released` sin ningún mensaje** | Un levante sin nada que lo respalde. Anterior a la instrumentación, sin rastro de origen. **Pendiente de decisión** |
| **Anular un tránsito no existe** | El estado `cancelled` está en el modelo pero **ninguna transición lo asigna**. Si buscas cómo anular, no lo hay |
| **Firma XAdES** | El resumen criptográfico de `SignedProperties` se calcula sobre el identificador y no sobre el bloque XML. **Primer sospechoso si AEAT rechaza por «digest»** |
| **`InspectorCommunication.petition`: la clave `type` de Mongoose** (figura 28) | El subdocumento usa `type` como nombre de campo, así que Mongoose lo interpreta como declaración de tipo y **descarta el dato entero al guardar**. Si registras una petición en una comunicación con el inspector, se pierde sin error. Es el último caso del barrido; los demás ya están corregidos |
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

## Anexo A — El resto de las pantallas

Las secciones anteriores documentan las **19 pantallas recorridas de extremo a
extremo**. La aplicación tiene 36 rutas con sesión, y las 17 restantes **no se han
recorrido**: se han abierto, comprobado que cargan y fotografiado, nada más. Es
terreno virgen para los testers, y por eso van aquí con lo que se ve en cada una.

El recorrido fue de solo lectura: navegar y fotografiar, sin crear ni enviar nada.

### A.1 Control aduanero

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/17-requirements.png)

*Figura 26 — Requerimientos: 15 en total (6 pendientes, 5 en proceso, 3 resueltos). Es
la pantalla cuyas estadísticas tenían la fuga entre clientes (ver 4.1); el recuento por
estado es lo primero que conviene contrastar con el listado.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/18-inspections.png)

*Figura 27 — Inspecciones físicas y documentales, con vista de lista y de calendario.
Los contadores de arriba están a cero aunque la base de datos tiene **20 inspecciones**:
son «Programadas Hoy» y «Pendientes», no el total. Merece una comprobación.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/19-communications.png)

*Figura 28 — Comunicaciones con inspectores (alegaciones y recursos): 25 registros en
base de datos. Aquí queda un defecto conocido sin corregir: el subdocumento `petition`
usa la clave reservada `type` de Mongoose, que **descarta el dato al guardar** sin
avisar. Ver 7.2.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/20-deadlines.png)

*Figura 29 — Gestor de plazos y vencimientos. Todos los contadores a cero: no hay
plazos sembrados. Un «0 vencidos» aquí no significa que el control funcione — significa
que no hay nada que controlar. Conviene crear plazos y forzar el vencimiento.*

### A.2 Regímenes

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/21-guarantees.png)

*Figura 30 — Garantías aduaneras: **«Garantías Activas 0 / 0,00 €» y «No hay garantías
registradas»**, mientras el escritorio de la figura 1 avisaba de tres garantías al 100 %
utilizado. Las dos pantallas leen la misma colección de 12 garantías y dicen cosas
incompatibles. Este contraste destapó un defecto nuevo al redactar el informe (7.2).*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/22-oea.png)

*Figura 31 — Operador Económico Autorizado (OEAC/OEAS/OEAF), con pestañas de
certificaciones, beneficios, simplificaciones y reconocimiento mutuo. Sin datos. Esta es
una de las rutas que llegó a servir **NIF y EORI sin token** y que ya está corregida:
comprobar que sigue exigiendo sesión es una prueba de valor.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/23-special-regimes.png)

*Figura 32 — Regímenes especiales del CAU (arts. 210-262): perfeccionamiento activo,
importación temporal y el resto, con asistente de IA. Los contadores marcan 0 con **10
regímenes en base de datos**.*

### A.3 AEAT e integraciones

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/25-aeat-certificates.png)

*Figura 33 — Certificados digitales AEAT: «No hay certificados». El certificado FNMT con
el que se firma **no se gestiona desde aquí**, sino desde la configuración del servidor,
así que esta pantalla vacía no impide firmar. Es una discrepancia que confunde.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/26-aeat-monitor.png)

*Figura 34 — Monitor de estado AEAT: «Entorno: Sandbox», 0 certificados y 0
monitorizando, con el rótulo «LUCI: Sistema operativo». Ese «Sistema operativo» en verde
sobre cero declaraciones monitorizadas es justo el tipo de mensaje tranquilizador que
conviene desconfiar y perseguir hasta su origen.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/27-integrations.png)

*Figura 35 — Integraciones: AEAT, VUA, TRACES y NCTS, las cuatro «active». **Dos cosas
que no cuadran y ya están verificadas como defecto** (7.2): el contador «Simulación 0»
mientras tres tarjetas dicen «Ambiente: simulation», y las «Estadísticas de Uso (últimos
30 días)» —3.040 llamadas, 98,4 % de éxito— que **están escritas a mano en el código**,
no medidas.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/32-nl-customs.png)

*Figura 36 — Panel de aduanas de Países Bajos (DMS 4.0 / DECO), ambos «operational».
Es la parte multi-país; el EORI de pruebas neerlandés y el certificado PKIoverheid
**todavía no están**, así que aquí no hay intercambio real posible.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/28-queries.png)

*Figura 37 — Consultas ADDS-JDIT, sin ninguna realizada. En esta pantalla queda parte de
las **~75 rejillas de MUI v5 sin migrar**, así que puede haber descuadre visual.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/09-pue.png)

*Figura 38 — PUE / SOIVRE (controles ROHS, COM, ECO, CAL): 0 solicitudes. Es el **único
generador de documentos sin MRN real** de toda la aplicación, porque AEAT lo tiene
bloqueado para nuestro EORI. No es un fallo nuestro (ver 7.4).*

### A.4 Analítica y administración

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/29-analytics.png)

*Figura 39 — Analítica avanzada. La franja superior dice «En tiempo real · Declaraciones
activas: 19 · Pendientes: 5 · AEAT: Conectado (709 ms)» y justo debajo las tarjetas
marcan **Declaraciones 0 y Valor Aduanero 0 €** para los últimos 30 días, con las dos
gráficas vacías. Dos cifras incompatibles en la misma pantalla: buen punto de partida.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/30-analytics-reports.png)

*Figura 40 — Gestor de informes (resumen ejecutivo, detalle de operaciones, financiero),
con generación y programación. Sin recorrer: **generar un informe y contrastar sus cifras
con las pantallas de origen es una de las pruebas más rentables que quedan**, porque un
informe consolida datos de varias fuentes y es donde una cifra inventada pasa
desapercibida.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/31-ml-insights.png)

*Figura 41 — ML Insights: los cinco subsistemas en «Operativo», todos los contadores a 0
y «Precisión: N/A%». Debajo, «Confianza de Modelos» con **85 %, 78 % y 92 %**. Esos tres
porcentajes son literales escritos en el frontend, no medidas — defecto verificado, ver
7.2.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/33-assistant.png)

*Figura 42 — Asistente LUCI, con preguntas sugeridas sobre origen preferencial, régimen
42, requisitos alimentarios y valor en aduana con FOB. **Es la pantalla más expuesta al
patrón de esta campaña**: un modelo de lenguaje responde siempre, con aplomo y sin
distinguir lo que sabe de lo que compone. Cualquier respuesta que cite un artículo, un
tipo impositivo o un código conviene contrastarla con el BOE o con TARIC.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/34-settings.png)

*Figura 43 — Configuración de la organización: **«Error al cargar la configuración»**.
Es un defecto reproducible y ya verificado en el servidor (7.2). Las pestañas (General,
Marca, Valores por Defecto, Notificaciones, Seguridad, Roles) se pintan, pero no hay
datos que guardar.*

![](../../evidencia-e2e-luci-2026-08/pantallas-completas/35-admin.png)

*Figura 44 — Panel de administración: 4 usuarios (4 activos), con pestañas de usuarios,
configuración y auditoría. Es la pantalla que llegó a servirse **sin token** —
`/api/admin/users` con NIF y EORI expuestos, el hallazgo de seguridad más serio de la
campaña— y está corregida. Merece una comprobación explícita: cerrar sesión e intentar
la URL directa.*

---

## Anexo B — Los 73 commits de la campaña

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
