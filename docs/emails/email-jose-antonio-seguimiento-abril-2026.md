# Seguimiento a Jose Antonio - AEAT DIT

**Para:** atenusu@correo.aeat.es (Jose Antonio)
**De:** STRIX AI SL
**Asunto:** LUCI - Seguimiento pendientes PRE: ubicación H7 aduana 2801 + NCTS + ENS + EnvioDeDocumentos
**Fecha borrador:** 21/04/2026
**Referencia:** continúa correo del 11/03/2026 (mismo hilo si posible)

---

Estimado Jose Antonio,

Espero que sigas bien. Te escribo para retomar los pendientes que quedaron abiertos en mi correo del 11 de marzo y añadir un punto nuevo que nos apareció al intentar ampliar las pruebas de H7.

Contexto breve: con los builders que ya teníamos aceptados (H1, AES, ENS, y H7 con un MRN inicial 26ES002801300011Z6) hemos seguido reforzando la plataforma y preparando clientes reales. En concreto AIRGO EXPRESS arranca con nosotros y necesitamos cerrar los últimos puntos en PRE antes de pasar a producción.

## 1. [NUEVO] H7 — "Código de Ubicación no válido" en aduana 2801

Al intentar repetir envíos H7 con declarante ESB22477020 y distintas combinaciones de casilla 30, PRE nos rechaza con error *"Código de Ubicación no válido"* (casilla 30, aduana 2801). Hemos probado los siguientes códigos sin éxito:

- `2801AAAAAC`
- `2801EEEEEE`

El declarante (ESB22477020) sigue aceptado y el resto de casillas validan correctamente (EORI, garantía `26ESAGL2800000054`, IOSS…). El rechazo es específicamente por la ubicación.

¿Podrías indicarnos un **código de ubicación de mercancías válido en PRE para la aduana 2801** que podamos usar en H7 (C08 ImportadorParticular tanto con NIF como sin él)? Mientras tanto tenemos que usar fallback de simulación en nuestra plataforma para no bloquear la demo de AIRGO.

## 2. NCTS — sumarias activas en PRE

Seguimos a la espera de poder lanzar la prueba end-to-end. El builder XML pasa validación local contra el XSD oficial y tenemos todo lo demás listo con los datos que nos diste:
- Autorización expedición `ESACR02026000002`
- Autorización recepción `ESACE02026000008`
- Garantía tránsito `26ES0002800000010`

Solo nos falta una sumaria activa que podamos referenciar como documento previo (NMRN). Si puedes crear una o indicarnos el MRN de alguna disponible para pruebas de tránsito, terminamos la validación en esa misma semana.

## 3. ENS ICS2 — habilitación modos adicionales

Ferrocarril funciona perfectamente (hemos acumulado >30 MRN aceptados). Para cerrar el ciclo completo con clientes necesitamos habilitar también:

- **Modo 1** (marítimo)
- **Modo 3** (carretera)
- **Modo 4** (aéreo)

¿Basta con que lo habilitéis sobre nuestro certificado actual o requiere solicitud formal aparte?

## 4. EnvioDeDocumentosV1 — feedback de estructura

En una comunicación anterior nos indicaste correcciones sobre la etiqueta y la estructura XML de `EnvioDeDocumentosV1` que estamos aplicando. Antes de volver a lanzar pruebas, ¿podrías confirmarnos:

- ¿Está disponible en PRE para nuestro certificado (ESB22477020)?
- ¿Hay un XML de ejemplo oficial (aunque sea genérico) que podamos usar como referencia, o la guía V1.5 EnvioDeDocumentosV1 que circula es la definitiva?

---

Como nota de contexto, seguimos avanzando en paralelo la integración con Países Bajos (DMS/DECO 4.0 en BTO); el acceso nos fue concedido a mediados de marzo y ya tenemos los XSD pasando validación. Si en algún momento os interesa ver la arquitectura multi-país desde el lado técnico, encantados de enseñárosla.

Muchas gracias de nuevo por todo el soporte. Quedamos a tu disposición para cualquier aclaración — y si te es más cómodo, podemos pasarnos también por teléfono.

Un cordial saludo,

Jenifer Romero
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
despacho@strixai.es
