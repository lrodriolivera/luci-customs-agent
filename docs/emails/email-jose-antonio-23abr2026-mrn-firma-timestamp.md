# Respuesta a Jose Antonio - Datos del envio NCTS (MRN 25ES00280180003993)

- **Para:** atenusu@correo.aeat.es (Jose Antonio)
- **De:** STRIX AI SL
- **Asunto:** RE: LUCI - Datos de firma y timestamp del envio NCTS con MRN 25ES00280180003993
- **Fecha borrador:** 23/04/2026
- **En respuesta a:** email Jose Antonio 23/04/2026 09:56

---

## Cuerpo del email (copiar desde aqui)

Estimado Jose Antonio,

Muchas gracias por la respuesta tan rapida y sobre todo por habilitar las nuevas ubicaciones (4811CDF001 rojo, 4801ADT005 naranja, 4611ADT031 Valencia). Eso nos permite forzar canal de forma determinista en pruebas, que era justo lo que necesitabamos para demos y tests E2E.

Te paso a continuacion los datos que nos pediste del envio NCTS que fallo referenciando el MRN 25ES00280180003993.

DATOS DEL ENVIO
---------------

- NIF firma electronica: ESB22477020 (STRIX AI SL)
- Tipo certificado: FNMT persona juridica (representante: Jenifer Romero Hijano)
- Fecha/hora del envio (preparationDateAndTime): 2026-03-03 18:32:47
- Fecha/hora respuesta AEAT: 2026-03-03 19:32:48
- messageIdentification: 20260303153247
- correlationIdentifier (respuesta AEAT): 20260303153247532016346
- LRN: LRN-NCTS-2026030315
- Aduana partida / destino: ES002801 / ES002801
- Autorizacion C521: ESACR02026000002
- Ubicacion mercancia: 2801AAAAAC
- Garantia (GRN): 26ES0002800000010
- Holder of transit procedure: ESB22477020 (Jenifer Romero)
- Consignee (HouseConsignment): ESB22477020

PREVIOUSDOCUMENT ENVIADO (el que disparo el rechazo)
----------------------------------------------------

  sequenceNumber: 1
  type: NMRN
  referenceNumber: DUA25ES00280180003993
  goodsItemNumber: 1
  measurementUnitAndQualifier: KGM
  quantity: 450.000

RESPUESTA LITERAL DE AEAT
-------------------------

  errorPointer: /CC015C/Consignment/HouseConsignment[1]/ConsignmentItem[1]/PreviousDocument[1]referenceNumber
  errorCode: 14
  errorReason: 90006
  errorDescription: ADDV_ No existe el documento DUA y/o partida 25ES00280180003993001
  originalAttributeValue: Documento: DUA25ES00280180003993  Extractor del transito: ESB22477020

DUDAS QUE NOS QUEDAN
--------------------

Ya que confirmas que el MRN 25ES00280180003993 si existe, se nos ocurren tres posibles causas del rechazo:

1) Formato del referenceNumber. Enviamos el prefijo "DUA" + MRN de 18 caracteres = 21 caracteres totales (DUA25ES00280180003993), con type=NMRN. AEAT al buscar concatena MRN + partida y obtiene 25ES00280180003993001. ¿Es correcto ese prefijo DUA con type NMRN, o deberiamos usar otro codigo (por ejemplo N820, N821 o N337) o un formato distinto para referenciar sumarias H1?

2) Partida. La sumaria que nos pasaste indica partida 00001 (5 digitos). Nosotros enviamos goodsItemNumber=1, y AEAT la busca como 001. ¿La partida correcta a enviar es el 1 del ConsignmentItem, o hay que referenciar la partida 00001 de la sumaria H1 origen en otro campo adicional al referenceNumber?

3) Extractor del transito. El originalAttributeValue incluye literalmente "Extractor del transito: ESB22477020". ¿La sumaria tiene que estar habilitada previamente para que ESB22477020 la pueda extraer, o el extractor se establece automaticamente al ser el HolderOfTheTransitProcedure del CC015C?

Con estos datos deberias poder reproducir la traza en vuestro lado. Si necesitas el XML completo del request, los headers HTTP o cualquier dato adicional, me lo dices y te lo mando.

OBSERVACION ADICIONAL - Portal PRE y persistencia de declaraciones
------------------------------------------------------------------

Hoy hemos accedido con nuestro certificado FNMT al portal PRE de consulta de declaraciones (https://prewww1.aeat.es/wlpl/ADIP-JDIT/SvH7SQuery y SvH1SQuery). El portal nos reconoce correctamente como STRIX AI PIONEER SOLUTIONS SL / B22477020, pero al buscar declaraciones del periodo 01/03/2026 - 23/04/2026 probando todas las combinaciones (representante R, importador I, en los dos formularios H7 y H1), no aparece NINGUNA de las declaraciones que vuestro sistema nos ha aceptado en estas semanas.

Es decir: los MRN que AEAT PRE nos devuelve con CodigoRespuesta 0 (por ejemplo 26ES002801300011Z6 en H7, o 26ES00280130001R50 que generamos hoy en H1) no aparecen posteriormente al consultar por EORI/fecha en el portal.

Como segunda comprobacion, hemos consultado esos mismos MRN H1 via el servicio SOAP oficial ConsultaImportacionV2 (que esta ACTIVO en PRE) con nuestro certificado. Los 4 MRN probados responden identico:

  Codigo 9: "No existe importacion con la referencia solicitada"

Incluyendo 26ES00280130001R50, que AEAT PRE nos acepto con CodigoRespuesta 0 hace apenas 2 horas desde el mismo endpoint y certificado.

Esto nos hace sospechar que AEAT PRE actua como un validador sintactico sin persistir las declaraciones en la BD consultable por otros servicios, lo que explicaria tambien los bloqueos concretos que ves arriba:

- NCTS no encuentra el DUA 25ES00280180003993 como PreviousDocument (aunque tu has confirmado que existe en tu sistema)
- SOIVRE/PUE responde "El MRN proporcionado no existe" con MRN H1 aceptados minutos antes por vuestro ImportacionCompletaV1SOAP
- ConsultaImportacionV2 responde "No existe importacion" con esos mismos MRN

¿Nos puedes confirmar cual de estos es el comportamiento esperado de PRE?

1. PRE no persiste las declaraciones en la BD consultable → en tal caso, ¿hay alguna forma de conseguir MRN persistentes en PRE para poder cerrar los flujos NCTS y PUE end-to-end?
2. PRE si persiste, pero el portal filtra por algun criterio adicional que nos estamos perdiendo (p.ej. necesita que la declaracion este "despachada" o en cierta situacion)
3. Las declaraciones estan persistidas pero en una BD distinta, y el portal SvH7SQuery/SvH1SQuery solo muestra un subconjunto

Si el caso es (1), nos ayudaria muchisimo que nos crees (o indiques) uno o varios MRN persistentes de ejemplo en PRE que podamos usar para referenciar desde NCTS (PreviousDocument) y desde PUE (MRNPartida). Con eso desbloquearamos los dos unicos servicios que nos faltan.

Para intentar verificar la persistencia por otra via probamos tambien servicios SOAP de consulta contra PRE. Hemos confirmado que estos estan ACTIVOS en PRE y respondiendo a nuestro certificado:

  - ConsultaImportacionV2 (H1)
  - CCAESCV1 (AES)
  - CCTRACV2 (NCTS)

Y estos responden "Desactivada temporalmente. Debe darse de alta en el formulario de habilitaciones":

  - ConsENSV3 (consulta ENS)
  - ConsDespV4 (consulta MRN generica export/import)
  - ConsultaDeclaracV1 (consulta por BOL/contenedor/ubicacion, ADDS-JDIT)
  - ListaDecV4 (bandeja de entrada)

¿Nos podrias habilitar en PRE para ESB22477020 estos 4 servicios desactivados? Los necesitariamos para:

  - Integrar en LUCI una vista unificada de monitoreo de declaraciones (ya tenemos la UI construida en /aeat/monitor)
  - Completar la verificacion de persistencia de MRN de forma programatica
  - Cubrir el flujo ENS (consulta de estado de declaraciones sumarias)
  - Permitir a usuarios finales (agentes aduaneros de AIRGO u otros clientes futuros) ver su bandeja de entrada y hacer consultas por BOL/contenedor

OTROS PENDIENTES
----------------

Sobre los otros temas (NCTS con sumaria de Valencia usando 4611ADT031, PUE/SOIVRE, EnvioDeDocumentosV1, ENS ICS2 modos aereo/maritimo/carretera) seguimos a la espera de lo que nos vayas comentando. Con los 3 circuitos deterministas de ESACR ya vamos preparando la bateria de tests E2E en paralelo.

De nuevo muchisimas gracias por la ayuda.

Un cordial saludo,

Luis Rodriguez
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
luis.rodriguez@strixai.es
