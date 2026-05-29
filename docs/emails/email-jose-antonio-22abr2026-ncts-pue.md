# Seguimiento a Jose Antonio - Cierre 6 builders PRE

**Para:** atenusu@correo.aeat.es (Jose Antonio)
**De:** STRIX AI SL
**Asunto:** LUCI - Avances 22/Abr + 2 bloqueos concretos (NCTS sumaria + PUE/SOIVRE MRN)
**Fecha borrador:** 22/04/2026
en qu

---

Estimado Jose Antonio,

Primero, **muchísimas gracias** por toda la información que nos fuiste enviando entre el 2 y el 20 de marzo (datos de pruebas, autorizaciones, sumarias, corrección del XML de `EnvioDeDocumentosV1`). Con todo eso hemos conseguido un avance muy grande y te escribo para contártelo y para cerrar los dos únicos puntos que nos quedan bloqueados, que parecen ser ya de entorno y no de nuestro XML.

## Estado actual: 4 de 6 servicios aceptados por PRE con MRN real

Con declarante `ESB22477020` (STRIX AI SL), certificado FNMT persona jurídica, y los datos de prueba que nos facilitaste:

| Servicio | Estado | MRN ejemplo 22/04/2026 | Canal |
|---|---|---|---|
| **H7** (DeclaSimpliImporV1) | ✅ aceptado | `26ES39053587438791H7` | Verde |
| **H1** (ImportacionCompletaV1) | ✅ aceptado | `26ES00280130001PZ2` | Verde |
| **AES** (CC515CV1) | ✅ aceptado | `26ES002801100120B4` | Verde, DS (despachado) |
| **ENS** (IE315V5 ferrocarril) | ✅ aceptado | `26ES009999Z0000650` | — |
| NCTS (CC015CV1) | ❌ ver punto 1 | — | — |
| PUE/SOIVRE (ROHSsolicitudV1) | ❌ ver punto 2 | — | — |

Los 4 primeros los tenemos ya integrados end-to-end en nuestra plataforma LUCI (https://aduanas.strixai.es), incluidos los builders XML, el parseo de respuesta (MRN, CSV, circuito, levante) y los flujos de canal verde/naranja/rojo.

## 1. NCTS — nos falta una sumaria activa en `2801AAAAAC`

Hemos confirmado empíricamente que nuestro builder CC015C es aceptado por AEAT en cuanto a estructura:

- `Consignee` correctamente declarado en cada `HouseConsignment` (regla CSRDT009)
- `Guarantee` con la GRN `26ES0002800000010` que nos diste
- `PreviousDocument` con `type=NMRN` + `reference=DUA` + MRN 18 chars (21 chars total), `goodsItemNumber`, `measurementUnitAndQualifier=KGM`, `quantity`
- `LocationOfGoods` con `authorisationNumber=2801AAAAAC`
- `authorisationNumber` del declarante `ESACR02026000002`

Al intentar referenciar la sumaria que nos indicaste:

- `MRN: 25-ES-002801-8-000399-3`, Partida 00001, ubicación `2801AAAAAC`
- Codificada como `DUA25ES00280180003993` con partida 001

AEAT PRE responde:
> "ADDV_ No existe el documento DUA y/o partida 25ES00280180003993001"

Probamos también cambiando la oficina de partida (a `ES004611` con `4611ADT031`), pero ahí AEAT devuelve un error diferente — *"Es ubicación de tipo privada multiexpedidor y la aduana de partida no figura en la casilla 4.15 de la autorización C521 ACR"* — lo que confirma que la autorización `ESACR02026000002` está asociada exclusivamente a la aduana `002801` / ubicación `2801AAAAAC`, y que la única sumaria válida para nosotros sería una que esté en esa misma ubicación.

**¿Podrías comprobar si la sumaria `25-ES-002801-8-000399-3` sigue activa en PRE o si ha sido consumida/caducada? Si no estuviera disponible, te agradeceríamos mucho que nos crees (o reutilices) una sumaria H1/DUA activa en ubicación `2801AAAAAC`** para poder cerrar el ciclo NCTS end-to-end. Cualquiera de las que nos indicaste en marzo (sin contenedores o con contenedores) nos vale, siempre que coincida con esa ubicación.

## 2. PUE / SOIVRE — el MRN de declaración no se reconoce en tabla ROHS

Mismo patrón: nuestro builder de `SOIVREaltaV1` (ROHSsolicitudV1SOAP) ya pasa validación estructural:

- `MRNPartida` exactos 23 chars: `MRN(18) + partida(4) + claveZeta(1)`
- `TipoDocumento=DUA`
- `CodCice` + `CodPI` con catálogo válido (Madrid Barajas: `28` + `01`)
- `Especificidades` con al menos un código (p.ej. `01`)
- `CertificadoSolicitadoROHS/RAEE`, `UnidadDeMedidaDeMercancia`, `TipoDeclaracion`, `TipoOperacion=ALT`…

Hemos probado dos MRN distintos como referencia:

1. **Histórico ya aceptado**: `26ES002801300011Y8` (el H1 que aceptamos el 3 de marzo).
2. **Recién creado hoy**: `26ES00280130001PZ2` (H1 aceptado canal verde hace unos minutos).

En los dos casos, AEAT PRE responde:
> "El MRN proporcionado no existe. - 1230"

Pasamos de *"MRNPartida no es válido"* (que era un tema de formato, ya corregido) a *"El MRN no existe"*, lo que sugiere que SOIVRE/ROHS mantiene una base de datos separada de las declaraciones de importación y que los MRN aceptados en PRE por `ImportacionCompletaV1`/`DeclaSimpliImporV1` no se sincronizan automáticamente con la tabla de PUE.

**¿Podrías confirmarnos alguna de estas opciones?**

- ¿Existe un MRN de declaración específico para pruebas PUE/SOIVRE en PRE que podamos usar como `MRNPartida`?
- ¿Hay que dar de alta el MRN explícitamente en la tabla ROHS (p.ej. usando `SOIVRE_consulta` antes del alta)?
- ¿El servicio SOIVRE en PRE depende de una partida específica con ROHS/RAEE declarado en la casilla de medidas del H1? Si es así, ¿hay algún TARIC con esta marca que ya tenga partida habilitada en PRE?

## 3. Recordatorios de pendientes anteriores (21/Abr/2026)

De mi correo anterior siguen en espera:

- **Ubicación H7 válida en aduana 2801**: sigue sin aceptar `2801AAAAAC` ni `2801EEEEEE`. Estamos usando fallback de simulación para AIRGO mientras tanto. (Actualización: en la sesión de hoy hemos visto que `2801EEEEEE` sí está funcionando cuando el H7 incluye la sumaria `21-ES-002801-8-000026-4` como PreviousDocument — si esto es lo esperado nos lo puedes confirmar y cerramos ese punto.)
- **ENS ICS2 (CC315C)**: habilitación de modos aéreo/marítimo/carretera. Actualmente solo modo ferrocarril.
- **EnvioDeDocumentosV1**: ya aplicamos tu corrección (etiqueta `<env:EnvioDeDocumentosV1Ent>` + `SegmentosDeServicio`). Pendiente de habilitación para nuestro certificado en PRE.

---

De nuevo, muchísimas gracias por todo el soporte de estos meses. Con los datos que nos has ido dando hemos podido construir una plataforma que ya tiene 4 builders aceptados con MRN real y está lista para empezar a operar con clientes. Estamos muy cerca de cerrar los 6.

Cualquier aclaración o si te es más cómodo repasarlo por teléfono, dinos un hueco que te venga bien.

Un cordial saludo,

Luis Rodriguez
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
luis.rodriguez@strixai.es
