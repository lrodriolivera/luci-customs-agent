# Email a Jose Antonio - AEAT DIT

**Para:** atenusu@correo.aeat.es (Jose Antonio)
**De:** STRIX AI SL
**Asunto:** LUCI - Pendientes AEAT PRE: NCTS sumarias + ENS ICS2 habilitaciones
**Fecha borrador:** 11/03/2026

---

Estimado Jose Antonio,

Espero que te encuentre bien. En primer lugar, quiero agradecerte enormemente toda la ayuda que nos has prestado durante las pruebas en el entorno PRE. Tras 47 rondas de testing, hemos conseguido que 4 de los 6 builders funcionen correctamente con MRN aceptados:

- **H1 Importacion**: MRN 26ES002801300011Y8 (Canal A)
- **H7 Low Value**: MRN 26ES002801300011Z6 (Canal A, garantia 26ESAGL2800000054)
- **AES Exportacion**: MRN 26ES002801100090B9 (Canal V, levante inmediato)
- **ENS Declaracion Sumaria**: Multiples MRN aceptados (Z0000112 a Z0000578)

Para completar las pruebas de los dos builders restantes y ampliar las capacidades de ENS, te escribo con tres consultas:

## 1. NCTS - Sumarias activas en PRE

Hemos validado completamente el schema XML del builder NCTS y los mensajes se generan correctamente segun la especificacion. Sin embargo, no hemos podido realizar la prueba end-to-end porque no encontramos sumarias activas en el entorno PRE que podamos referenciar como documento previo (NMRN).

Te agradeceria mucho si pudieras:
- Crear una sumaria activa en PRE que podamos utilizar, o
- Indicarnos el MRN de alguna sumaria existente que este disponible para pruebas de transito

Con los datos que nos proporcionaste (autorizacion expedicion ESACR02026000002, autorizacion recepcion ESACE02026000008, garantia transito 26ES0002800000010), tenemos todo lo necesario para lanzar la prueba en cuanto dispongamos de la sumaria.

## 2. ENS ICS2 - Habilitacion modos de transporte adicionales

Actualmente las pruebas de ENS se han realizado con exito, pero necesitariamos habilitacion para los siguientes modos de transporte adicionales:
- **Aereo** (modo 4)
- **Maritimo** (modo 1)
- **Carretera** (modo 3)

Nuestros clientes operan en estos tres modos y necesitamos validar que los mensajes ENS se aceptan correctamente para cada uno de ellos.

## 3. EnvioDeDocumentosV1 - Prueba de documentos adjuntos

Nos gustaria probar tambien el servicio **EnvioDeDocumentosV1** para el envio de documentos adjuntos asociados a declaraciones (facturas, conocimientos de embarque, certificados, etc.). Queremos verificar que podemos enviar documentacion complementaria de forma programatica.

¿Esta este servicio disponible en PRE para nuestro certificado? ¿Hay algun requisito adicional de habilitacion?

---

Como nota de contexto, te comento que estamos ampliando LUCI a otros paises de la UE. Ya tenemos en marcha la integracion con la aduana de Paises Bajos (DMS/DECO) y estamos registrados en su entorno de pruebas. La arquitectura multi-pais que estamos desarrollando deberia facilitar tambien futuras integraciones con otros Estados miembros.

Quedo a tu disposicion para cualquier cosa que necesites por nuestra parte. Muchas gracias de nuevo por todo el apoyo.

Un cordial saludo,

Jenifer Romero
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
