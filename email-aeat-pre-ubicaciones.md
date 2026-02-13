# Email para AEAT - Soporte Aduanas

**Para:** atenusu@correo.aeat.es
**Asunto:** Solicitud configuracion ubicaciones y consulta SOIVRE en entorno PRE - EORI ESB22477020

---

Estimado Jose Antonio,

Muchas gracias por dar de alta nuestro EORI ESB22477020 en el entorno de pruebas. Hemos estado realizando pruebas con los servicios web y tenemos muy buenos avances:

**ENS (IE315V5) - FUNCIONANDO CORRECTAMENTE**
- Ya hemos recibido un MRN de prueba: 26ES009999Z0000030
- CSV: E695E89VCDSGKXSV
- La declaracion sumaria de entrada funciona perfectamente en modo ferrocarril.

**H1, H7 y AES - Bloqueados por ubicaciones**
Los tres servicios (ImportacionCompletaV1, DeclaSimpliImporV1 y CC515CV1) devuelven el mismo error:
- "Código de Ubicación no válido" (error 1180)
- Estamos usando el recinto 009999 con el formato ES009999T1

Le agradeceriamos si pudiera configurar alguna ubicacion de mercancias valida en el entorno de pruebas para el recinto 009999, para que podamos completar las pruebas de importacion y exportacion.

**NCTS (CC015CV1) - Casi funcionando**
Solo nos quedan 2 errores funcionales:
- Error 1660: "Recinto de expedición es distinto del de la ubicación" - relacionado con la falta de ubicaciones configuradas
- Error 1146: "Inconsistencias al rellenar el reference number UCR" - estamos investigando

**PUE/SOIVRE (SOIVREaltaV1) - Error de formato**
El servicio SOIVRE nos devuelve "Error en el formato de los datos" (codigo 10500). No encontramos documentacion sobre la estructura exacta del XML esperado.

Seria posible que nos facilitara:
- Un ejemplo de XML valido para el servicio SOIVREaltaV1SOAP, o
- Indicaciones sobre los campos obligatorios y su formato

**Resumen de lo que necesitamos:**
1. Configuracion de ubicaciones en PRE para el recinto 009999
2. Ejemplo XML o documentacion del servicio SOIVRE

Quedamos a su disposicion para cualquier consulta.

Un saludo,

Jenifer Romero
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
Email: despacho@strixai.es
