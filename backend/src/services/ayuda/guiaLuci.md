# Guía de uso de LUCI

Guía de la aplicación LUCI para agentes de aduanas. Describe las pantallas tal como están hoy. Los nombres entre comillas «» son los textos exactos de botones, pestañas y campos.

## Menú y pantallas principales {#menu}
> Dónde está cada cosa en el menú lateral y qué pantallas están ocultas.

- Menú lateral, por grupos:
  - «Operaciones»: «Dashboard», «Expedientes», «Circuitos», «Requerimientos».
  - «Declaraciones»: «Clasificación TARIC», «Declaraciones H1», «H7 E-commerce», «ENS/ICS2», «PUE SOIVRE».
  - «Cálculo y Normativa»: «Calculadora Derechos», «Preferencias», «Motor de Reglas», «Imp. Especiales», «Contingentes», «Normativa CAU/BOE».
  - «Control Aduanero»: «Plazos», «Inspecciones», «Comunicaciones».
  - «Regímenes»: «Garantías», «OEA», «Regímenes Especiales», «Tránsitos NCTS».
  - «AEAT e Integraciones»: «Certificados AEAT», «Monitor AEAT», «Aduanas NL», «Integraciones».
  - «Administración»: «Analytics», «Configuración», «ML Insights», «Admin Panel».
- Bajo el menú, el botón «Asistente LUCI» (etiqueta «IA») abre la pantalla completa del asistente. En todas las pantallas hay además un botón redondo abajo a la derecha con el asistente flotante, y otro de «Ayuda contextual» con la ayuda de la pantalla actual.
- El trabajo diario se hace desde el expediente: se crea el expediente, se suben documentos y desde su detalle se genera y presenta el H1.
- Ocultas a propósito: «+ Nueva H1 (DUA)» y «+ Nueva H7» (alta directa de declaraciones sin expediente), el botón de crear ENS y «Consultas ADDS» (era una demostración sin conexión real con la AEAT). El gestor de informes (/analytics/reports) tampoco tiene acceso en el menú.
- No hay wiki ni manual accesible dentro de la aplicación: la ayuda es la «Ayuda contextual» y este asistente.

## Crear un expediente {#crear-expediente}
> Alta manual en tres pasos o alta a partir de los documentos, que LUCI lee con IA.

Pasos: «Expedientes» > botón «Nuevo Expediente». La pantalla «Nuevo Expediente» tiene tres pasos: «Tipo y Cliente», «Mercancías» y «Transporte».

Alta desde documentos (lectura por IA):
1. En el bloque «Empezar por la documentación», pulsa «Seleccionar documentos» y elige la factura, el packing list y el documento de transporte (hasta 10 documentos por alta, 50 MB por archivo; PDF, imágenes, Word, Excel, TXT, CSV o XML).
2. LUCI los lee uno a uno y rellena los campos vacíos del alta. En cada documento puedes corregir el «Tipo de documento», «Quitar» el archivo o abrir «Ver los datos rellenados». Si un documento trae un dato distinto del que ya hay, LUCI no lo cambia y lo avisa en «Revisa estos puntos:».
3. Revisa los tres pasos y pulsa «Crear Expediente». Los documentos quedan adjuntos al expediente.

Alta manual:
1. «Tipo y Cliente»: país de destino aduanero (España o Países Bajos), «Tipo de Operación» («Importación» o «Exportación»), datos del importador (razón social, NIF/CIF, EORI, dirección, email) y del exportador o proveedor (razón social, país, ciudad). «Siguiente».
2. «Mercancías»: «Añadir Partida» por cada artículo: descripción, material, uso, «Código TARIC» (con el botón «IA» para clasificar), país de origen, cantidad, pesos neto y bruto, bultos, «Valor Factura» y divisa. «Siguiente».
3. «Transporte e Incoterm»: «Modo de Transporte», «Incoterm», «Lugar Incoterm», «Tipo de carga» (solo marítimo) y el documento de transporte. Revisa el «Resumen del Expediente» y pulsa «Crear Expediente».

Al crearlo se abre el detalle del expediente. Crear expedientes requiere el rol de administrador, supervisor o agente.

## Detalle del expediente {#detalle-expediente}
> Qué hay en la ficha del expediente y qué botones tiene.

La ficha no tiene pestañas: son tarjetas en dos columnas.
- Cabecera: «Análisis IA» (abre «Análisis IA - Expediente» con «Sugerir Documentos», «Analizar Riesgo», «Detectar Inconsistencias» y «Análisis Completo»), «Enviar Portal» (enlace del portal del cliente) y, en importaciones, «Generar H1».
- Columna principal: importador/exportador, representación, «Datos para presentar el H1», «Carga marítima y declaración sumaria» (si es marítimo), «Mercancías» (botón «Editar» por partida), «Documentos» y «Vista previa del H1».
- Columna lateral: «Checklist de Documentos», transporte, declaración generada, respuesta de la AEAT, circuito, requerimientos, «Controles Paraduaneros», «Acciones» («Clasificar TARIC», «Calcular Derechos», «Descargar XML H1», «Descargar PDF Declaración», «Resumen Expediente PDF») e «Historial».
- Las partidas y los documentos dejan de poder editarse cuando la declaración ya está presentada.
- No existe un chat con el cliente dentro del expediente: lo que el cliente escribe en el chat de su portal no se muestra al agente en la aplicación.

## Documentos del expediente {#documentos}
> Subir, leer con IA, aplicar datos y eliminar documentos del expediente.

Subir un documento: en el detalle del expediente, tarjeta «Documentos», formulario «Añadir documentación al expediente».
1. Elige el «Tipo de documento» (factura comercial, proforma, packing list, BL, AWB, CMR, certificado de origen, EUR.1, EUR-MED, A.TR, certificados sanitarios, fitosanitarios, veterinarios, de fumigación o de seguro, autorización de despacho, licencias, certificado CE, de calidad, u «Otro»).
2. Elige el «Archivo» (hasta 50 MB). Para la autorización de despacho indica la «Fecha de la autorización» (vale 4 años desde esa fecha).
3. Deja marcada «Leer el documento con IA al subirlo» si quieres que LUCI lo lea, y pulsa «Subir documento».

En cada documento:
- «Abrir» lo muestra; «Leer con IA» (o «Volver a leer») lo analiza; «Ver lo leído» enseña lo extraído.
- Si lo leído no coincide con el expediente, LUCI propone los cambios («Rellena: …» o «actual → nuevo»). Solo vienen marcados los que rellenan un campo vacío; marca los que quieras y pulsa «Aplicar al expediente (N)».
- «Eliminar» borra el documento tras confirmar con «Sí, eliminar». No se puede deshacer.
- Con la declaración ya presentada no se pueden eliminar documentos ni aplicar datos.

El «Checklist de Documentos» de la columna lateral marca los documentos recibidos y los «Requerido» que faltan; se actualiza al subir o borrar.

## Portal del cliente: enlace para que el cliente suba documentos {#portal-cliente}
> Cómo enviar al cliente un enlace para que suba la factura comercial u otros documentos sin crear cuenta.

Cada expediente tiene su propio portal del cliente, con una dirección del tipo https://aduanas.strixai.ai/portal/<código-del-expediente>. El cliente entra con ese enlace, sin usuario ni contraseña, y puede subir los documentos que le pidas (por ejemplo la factura comercial).

Cómo enviar el enlace al cliente:
1. Abre el expediente («Expedientes» > «Ver Detalle»).
2. Pulsa «Enviar Portal», en la cabecera del expediente.
3. LUCI usa el email de contacto del cliente del expediente; si no lo tiene, te lo pide («Email del cliente para enviar el link del portal:»).
4. LUCI envía al cliente un correo con el botón «Acceder al Portal» y abre la ventana «Link del Portal del Cliente», donde ves el enlace. Con «Copiar Link» lo copias para mandarlo también por WhatsApp, por otro correo o como quieras; «Abrir Portal» lo abre para ver lo que verá el cliente.
5. El envío queda anotado en el historial del expediente.

Qué hace el cliente en el portal («Portal de Cliente»), con las pestañas «Inicio», «Documentos», «Chat con LUCI» y «Estado»:
- «Documentos»: elige el tipo («Factura Comercial», «Packing List», «Bill of Lading (B/L)», «Air Waybill (AWB)», «CMR», «Autorización de Despacho», «Certificado de Origen», «EUR.1», certificados sanitario y fitosanitario, «Póliza de Seguro» u «Otro Documento») y sube el archivo (PDF, Word o imagen, hasta 10 MB). Ve el checklist de lo que falta.
- «Inicio» muestra el progreso y los documentos obligatorios pendientes; «Estado» muestra la fase del expediente; «Chat con LUCI» le permite hacer consultas generales a LUCI.
- Lo que sube el cliente aparece en la tarjeta «Documentos» del expediente y marca el checklist.

Limitaciones actuales:
- Solo se obtiene el enlace con «Enviar Portal», que siempre manda el correo. Si el correo no se puede enviar, LUCI muestra «Error al enviar enlace» y no enseña el enlace.
- El correo no se envía solo al crear el expediente: hay que pulsar «Enviar Portal».
- No hay botón para regenerar ni revocar el enlace.

## Clasificación TARIC con IA {#clasificacion-taric}
> Clasificar mercancías con IA en el alta del expediente o en la herramienta «Clasificación TARIC».

En el alta del expediente (paso «Mercancías»):
1. Escribe la descripción de la partida (mínimo 10 caracteres) y pulsa el botón «IA» junto a «Código TARIC» («Clasificar con IA»).
2. LUCI rellena la mejor sugerencia y muestra hasta 3 «Sugerencias de IA» con su confianza y arancel; las que no son declarables salen marcadas «No está en el catálogo TARIC».
3. Para usar otra sugerencia, pulsa «Aplicar» en su línea.

En un expediente ya creado: «Editar» en la partida abre «Editar partida», donde el código se escribe a mano (8 a 10 dígitos). No hay clasificación con IA por partida dentro del detalle; el botón «Clasificar TARIC» de «Acciones» abre la herramienta con la primera partida precargada.

Herramienta «Declaraciones» > «Clasificación TARIC»:
- Pestañas «Básico», «Buscar Código», «Explorar Árbol» y «Avanzado IA».
- «Básico»: descripción, material, uso, composición y origen; botón «Clasificar». Cada sugerencia se contrasta con el catálogo TARIC: «Código comprobado en el catálogo TARIC: existe y es declarable.» o, si no lo es, la lista de «Códigos declarables de la misma subpartida:». Botones «Validar» y «Copiar».
- «Análisis Completo IA» / «Avanzado IA»: evaluación final, confianza, código recomendado y validación normativa (reglas generales de interpretación, notas de sección y capítulo, medidas especiales, alternativas y documentación).
- «Buscar Código»: busca un código de 2 a 10 dígitos y muestra descripción, jerarquía, aranceles y notas.
- Esta herramienta no guarda el código en el expediente: hay que copiarlo y pegarlo en «Editar partida».

## Controles paraduaneros {#controles-paraduaneros}
> Detección de SOIVRE, sanidad, fitosanitario, CITES y otros controles en el expediente.

Están solo dentro del detalle del expediente, en la tarjeta «Controles Paraduaneros» (no tienen pantalla propia).
1. Al abrir el expediente, si no tiene controles, LUCI analiza las partidas solo; también puedes pulsar «Analizar». Las partidas sin código TARIC no se analizan.
2. Si hacen falta controles («Se requieren N control(es) paraduanero(s)»), pulsa «Crear Controles» para darlos de alta. Organismos que contempla: SOIVRE, MAPA (veterinario, fitosanitario, piensos), Sanidad, MITERD (CITES, residuos, REACH), AEMPS y AESAN.
3. Cada control muestra estado, mercancías afectadas y «Documentos requeridos» (con «Marcar proporcionado»). Se cierra a mano con «Aprobar» o «Rechazar».
4. Debajo, «Medidas de control de la UE (TARIC oficial)» lista los certificados a declarar y avisa de sanciones, prohibiciones por origen o doble uso. No incluye los controles nacionales.

No hay botones para programar la inspección, registrar su resultado ni emitir el certificado. Las solicitudes de PUE de SOIVRE están en «PUE SOIVRE».

## Datos para presentar el H1 {#datos-h1}
> La tarjeta del expediente con factura, nacionalidad del transporte, código postal del exportador, autorización de despacho, flete y seguro y cambio aplicado.

Está en el detalle de los expedientes de importación. Campos:
- «Número de la factura comercial» (hasta 70 caracteres).
- «Nacionalidad del medio de transporte en frontera»: código de país de 2 letras (p. ej. PA).
- «Código postal del exportador».
- «Autorización de despacho del representante»: «Por operación, sin registro electrónico en la AEAT», «Por operación, con registro electrónico en la AEAT» o «Global, registrada en la AEAT». No se usa en autodespacho; con autorización global no se declara ningún documento.
- «Flete y seguro hasta la entrada en la UE»: importe y divisa de cada uno. Aparecen o no según el Incoterm (con EXW o FOB hay que indicarlos, escribe 0 si no hubo; con CIF ya están incluidos).
- «Cambio aplicado: 1 EUR = … {divisa}»: solo si la factura está en una divisa que el BCE no cotiza (ver «Divisas»).

Pulsa «Guardar». Debajo, LUCI dice «El expediente tiene todos los datos que exige el H1.» o lista lo que falta («Faltan datos para presentar el H1:»), por ejemplo el EORI, la ubicación de las mercancías, la sumaria y su partida, el código postal del importador o los TARIC de 10 dígitos.

Si la aduana elegida no es la del recinto donde están las mercancías, LUCI avisa de que el H1 se presentará en la del recinto: presentarlo en otra aduana es despacho centralizado, que exige la autorización C513 y LUCI no gestiona.

## Generar y presentar el H1 {#presentar-h1}
> Generar el H1, elegir declaración o predeclaración, enviarlo a la AEAT, activarlo, anularlo, consultar su estado y comparar la liquidación.

1. En el expediente de importación, completa «Datos para presentar el H1» y pulsa «Generar H1» (cabecera). LUCI genera la declaración (régimen 40 por defecto) y la «Vista previa del H1»; en la tarjeta «Declaración H1 Generada» puedes «Descargar XML» y «Descargar JSON».
2. En «Cómo se presenta» elige:
   - «Declaración: se activa al presentarla» (por defecto).
   - «Predeclaración: la activa la aduana cuando la sumaria esté activa».
   - «Predeclaración: la activo yo con «Activar»».
   En una predeclaración la AEAT liquida con el tipo de cambio del día de la activación.
3. Pulsa «Enviar a AEAT». Hace falta permiso para aprobar declaraciones. LUCI vuelve a comprobar la sumaria antes de enviar.
4. La respuesta aparece en «Respuesta AEAT»: MRN, circuito (verde, amarillo pendiente de certificados, naranja revisión documental, rojo reconocimiento físico, o sin circuito todavía), levante y «Total liquidado por la AEAT».

Después de presentar, en «Datos para presentar el H1» aparece el bloque «Estado en la AEAT · MRN …» (solo con el servicio adaptado al CAU):
- «Consultar estado en la AEAT»: estado, despacho, pago, circuito, admisión, levante, total a pagar, controles y documentos que pide la aduana. Solo consulta, no cambia nada en la AEAT.
- «Activar declaración»: para la predeclaración «la activo yo» pendiente de activar. Las mercancías deben estar ya presentadas en la ubicación declarada; confirma con «Confirmar activación».
- «Anular declaración»: pide un «Motivo de la anulación» y «Confirmar anulación». Si la declaración ya está activada no se puede anular por servicio web: hay que pedirlo a la aduana y la resolución llega por la Bandeja de Entrada de la AEAT.
- «Liquidación: LUCI frente a la AEAT»: tabla por partida y tributo (arancel A00, IVA B00) con la base y la cuota de LUCI y de la AEAT y la diferencia. Lo que se paga es lo que liquida la AEAT; si no cuadra, revisa las partidas marcadas en rojo.

Hoy el envío va al entorno de pruebas oficial de la AEAT (PRE): genera un MRN real de pruebas, sin efecto en producción.

La pantalla «Declaraciones H1» del menú también genera y envía un H1 a partir de un expediente, pero sin elegir predeclaración ni consultar, activar o anular: para eso usa el expediente.

## Sumaria y grupaje {#sumaria-grupaje}
> Declaración sumaria, partida y grupaje marítimo (LCL) en el H1.

En expedientes marítimos aparece la tarjeta «Carga marítima y declaración sumaria».
1. «Tipo de carga»: «Contenedor completo (FCL)» o «Grupaje (LCL)».
2. «Número de la declaración sumaria» (clave de 11 dígitos o MRN), «Partida», «Bultos de la sumaria» y «Peso bruto de la sumaria (kg)». «Guardar».
3. «Consultar en la AEAT» comprueba la partida: estado, saldo, si es partida máster, conocimiento y ubicación.

En grupaje el H1 necesita la sumaria de la desconsolidación. LUCI no deja generar ni presentar si falta la sumaria, la partida no existe, es partida máster, no está activada o no tiene saldo de bultos; las diferencias de bultos o kilos solo se avisan. La sumaria va en el H1 como documento previo, y su ubicación decide la aduana de despacho.

## Divisas y tipo de cambio {#divisas}
> Qué tipo de cambio usa LUCI y qué hacer con divisas que el BCE no cotiza.

- LUCI usa el tipo de cambio aduanero oficial: el del BCE del penúltimo miércoles del mes anterior, válido todo el mes. Al escribir un importe en el alta ves el contravalor en euros y el tipo aplicado.
- Todas las partidas del expediente deben estar en la misma divisa.
- Divisa que el BCE no cotiza (en el selector salen bajo «Sin tipo del BCE (el H1 irá en euros)»): indica el «Cambio aplicado» en «Datos para presentar el H1». Sin ese dato el H1 no se genera. El H1 se declara en euros con el documento 1017, que recoge la divisa y el cambio.

## Ajustes > Aduanas {#ajustes-aduanas}
> Configuración de países, certificados, servicio de la AEAT, medio de pago, garantía y contacto para el H1.

Menú «Administración» > «Configuración», pestaña «Aduanas»:
- Países activos, EORI por país y certificado digital («Subir certificado digital»: .p12 o .pfx con su contraseña). «Guardar configuracion de paises». Debajo, el estado de conexión por país.
- «Presentación del H1 (importación)»:
  - «Servicio de la AEAT»: «DUA anterior (cerrado para declaraciones reales)» o «H1 adaptado al CAU (CC415A)». Las predeclaraciones, la consulta de estado, la activación y la anulación solo funcionan con el H1 adaptado al CAU.
  - «Medio de pago»: «A — Pago previo al levante», «R — Pago aplazado con garantía» o «J — Aplazado sin garantía (entidades públicas)».
  - «Número de garantía (GRN)», obligatorio con R.
  - «Persona de contacto de la agencia»: nombre, teléfono y correo.
  - «Guardar presentación del H1».
- Si al generar el H1 falta el EORI del representante, el error trae el enlace «Ir a Ajustes > Aduanas».
- No hay ajuste de recinto ni de despacho centralizado: en España la aduana sale del recinto donde están las mercancías.

## H7 (comercio electrónico) {#h7}
> Declaraciones H7 de envíos de bajo valor: importar el manifiesto y enviar a la AEAT.

Menú «H7 E-commerce» (lista «Declaraciones H7», envíos de hasta 150 EUR).
1. Pulsa «Importar Manifiesto». Sube un CSV, TXT o TSV (hasta 50 MB); puedes bajar la «Plantilla CSV». En «Opciones avanzadas»: delimitador, transportista y número IOSS.
2. Revisa la vista previa y pulsa «Clasificar con IA (N envios)».
3. LUCI muestra «Listos para H7», «Requieren H1» y «Con errores». Pulsa «Crear N declaraciones H7».
4. En la lista, las H7 en borrador tienen «Enviar»; en el detalle, «Enviar a AEAT». Al enviarlas se muestra el MRN.

El alta manual de una H7 suelta («Nueva H7») está oculta: las H7 se crean importando el manifiesto. No se crean H7 desde un expediente.

## Exportación (AES) {#exportacion-aes}
> Cómo se genera y presenta una declaración de exportación.

1. Crea el expediente con «Tipo de Operación» = «Exportación».
2. Ve a «Declaraciones H1» del menú (pantalla «Generador de Declaraciones»), elige «AES - Exportación» y el expediente, y pulsa «Generar».
3. Pulsa «Descargar XML» o «Enviar a AEAT» y confirma.

En el detalle de un expediente de exportación no hay botón «Generar H1» ni tarjeta «Datos para presentar el H1»; si la AES ya está generada, desde allí se puede enviar.

## Analítica e informes {#analitica}
> Métricas, KPIs y análisis con IA de la operativa.

Menú «Administración» > «Analytics» (pantalla «Analítica Avanzada»):
- Selector de periodo y pestañas «Vision General», «KPIs», «Financiero» y «Cumplimiento».
- «Centro de Analisis IA»: «Insights», «Anomalías», «Tendencias», «Informe Ejecutivo», «KPI Analysis» y «Análisis Completo». El informe ejecutivo se puede descargar con «Descargar Reporte HTML».
- El gestor de informes programados no está disponible en el menú: no hay hoy una forma soportada de programar informes ni de exportarlos a PDF o Excel.

## Otras pantallas {#otras-pantallas}
> Circuitos, requerimientos, calculadora, normativa, plazos, garantías, tránsitos y certificados.

- «Circuitos»: expedientes por circuito (verde, naranja, rojo) y periodo.
- «Requerimientos»: lista de requerimientos de la AEAT; se responden dentro de cada expediente.
- «Calculadora Derechos»: código TARIC, valor en aduana, origen, preferencia e Incoterm; botón «Calcular Derechos». Desde el expediente, «Calcular Derechos» la abre con la primera partida.
- «Normativa CAU/BOE»: buscador de normativa con análisis de LUCI.
- «Plazos», «Inspecciones», «Comunicaciones», «Garantías», «OEA», «Regímenes Especiales», «Tránsitos NCTS», «Imp. Especiales», «Contingentes» y «Preferencias» tienen su pantalla en el menú.
- «Certificados AEAT»: certificados digitales para presentar; «Monitor AEAT»: estado de los servicios de la AEAT.
