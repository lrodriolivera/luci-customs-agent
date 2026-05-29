# Respuesta a Jose Antonio - NCTS desbloqueado con N337 + bloqueo PUE/SOIVRE

- **Para:** atenusu@correo.aeat.es (Jose Antonio)
- **De:** STRIX AI SL
- **Asunto:** RE: LUCI - NCTS resuelto con N337, solo falta PUE/SOIVRE
- **Fecha borrador:** 24/04/2026
- **En respuesta a:** email Jose Antonio 24/04/2026 7:57 (correccion N337)

---

## Cuerpo del email (copiar desde aqui)

Estimado Jose Antonio,

Muchisimas gracias por la aclaracion. Efectivamente, estabamos enviando la sumaria como si fuese un DUA. En cuanto hemos cambiado `type=NMRN` por `type=N337`, quitado el prefijo "DUA" del `referenceNumber` y eliminado los campos `measurementUnitAndQualifier` y `quantity`, NCTS ha pasado a la primera.

Este es el MRN real que AEAT nos ha devuelto hace un rato:

NCTS REAL ACEPTADO
------------------

- MRN: 26ES002801500473J5
- Canal: V (verde)
- Fecha admision: 2026-04-24
- Fecha levante: 2026-04-24 (levante inmediato)
- Estado: DE (despachado)
- CSV Declaracion Electronica: 79VAZ58BCNCF67J6
- CSV de DAT: M58MNTM5JUGH6B9U
- Fecha limite llegada: 2026-04-30
- Sumaria referenciada: 25ES00280180003993 como PreviousDocument N337

Con esto pasamos de 4 a **5 builders aceptados en PRE con MRN real**: H7, H1, AES, ENS y NCTS. El unico que nos queda bloqueado es **PUE/SOIVRE (ROHSsolicitudV1)**.

PUE/SOIVRE - estado actual
---------------------------

Nuestro builder `ROHSSolicitudCertificadoV1Ent` ya pasa la validacion estructural de AEAT (`SegmentosDeServicio`, `TipoOperacion=ALT`, `MRNPartida` de 23 chars exactos, `CodCice`/`CodPI`, especificidades, etc.). El rechazo se produce al buscar el MRN en vuestra base de datos.

Hemos probado 5 combinaciones hoy para diagnosticar y AEAT nos devuelve dos codigos de respuesta distintos segun `TipoDocumento`:

| MRN probado | TipoDocumento | CodigoRespuesta | DescripcionRespuesta |
|---|---|---|---|
| H1 26ES00280130001PZ2 (aceptado 22/4) | DUA | 1128 | "El MRN proporcionado no existe. - 1230" |
| NCTS 26ES002801500473J5 (aceptado hoy) | DUA | 1128 | "El MRN proporcionado no existe. - 1230" |
| Sumaria 25ES00280180003993 | DUA | 1128 | "El MRN proporcionado no existe. - 1230" |
| NCTS 26ES002801500473J5 | Z | 7114 | "La referencia del Z introducida no existe. - 1230" |
| Sumaria 25ES00280180003993 | Z | 7114 | "La referencia del Z introducida no existe. - 1230" |

Los dos codigos distintos (1128 vs 7114) confirman que AEAT interpreta correctamente el `TipoDocumento` y busca en tablas diferentes, pero en ninguna de las dos encuentra las referencias que le pasamos.

DUDAS PARA DESBLOQUEAR PUE
---------------------------

1) ¿Puedes indicarnos un `MRNPartida` que si exista en la tabla SOIVRE/ROHS de PRE? Basta con uno de ejemplo que podamos usar para hacer una `SOIVREaltaV1` y cerrar el flujo end-to-end.

2) ¿Cual de los tipos (`DUA`, `DVD`, `Z`) es el que corresponde al flujo habitual? Entendemos que si la aduana marca una partida con medida ROHS/RAEE al despachar un H1, debe generarse automaticamente una solicitud PUE pendiente referenciable por `MRNPartida=DUA`. ¿Es asi en PRE, o hay que dar de alta la referencia SOIVRE manualmente por vuestra parte?

3) Si hace falta partida con TARIC sujeto a ROHS/RAEE declarado en el H1, dinos un TARIC de prueba y hacemos un H1 nuevo con esa partida. Si con eso ya queda indexado automaticamente en la tabla SOIVRE, cerrariamos el 6º y ultimo builder.

RESTO DE TEMAS
---------------

Sobre lo otro (no-persistencia aparente de MRN H1/H7 en PRE, activacion de ConsENSV3/ConsDespV4/ConsultaDeclaracV1/ListaDecV4, ENS ICS2 modos aereo/maritimo, EnvioDeDocumentosV1 habilitacion certificado) seguimos esperando tus comentarios cuando tengas un hueco. Con la correccion N337 de hoy ya tenemos los 5 builders principales en verde.

De nuevo, muchisimas gracias. Sin vuestra ayuda esto no seria posible.

Un cordial saludo,

Luis Rodriguez
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
luis.rodriguez@strixai.es
