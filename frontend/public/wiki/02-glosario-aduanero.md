# 2. Glosario aduanero rápido

[← Volver al índice](README.md)

> Si llevas tiempo en aduanas, sáltate este capítulo. Si eres nuevo o te has olvidado de qué es exactamente una sumaria, esto es tu chuleta.

---

## Documentos y números clave

### MRN — *Movement Reference Number*

Es el **identificador único** que asigna AEAT (o cualquier aduana europea) a una declaración aceptada. Tiene 18 caracteres y empieza por el año + país.

**Ejemplo real:** `26ES00280130001TT1` (año 2026, país ES, aduana 002801, asignación interna).

**Cuándo lo ves:** después de pulsar *Enviar a AEAT* y que el envío sea aceptado. LUCI lo guarda en el expediente; con él puedes:
- Hacer seguimiento del estado de la declaración.
- Pedir el levante.
- Generar el justificante para el cliente.
- Consultarlo desde otra aduana de la UE.

### EORI — *Economic Operators Registration and Identification*

Identificador único en toda la UE para cualquier operador económico. Imprescindible para presentar cualquier declaración aduanera. En España lo emite la AEAT y suele ser **`ES` + el NIF** de la empresa.

**Ejemplo:** `ESB22477020` (STRIX AI SL).

> Una empresa española que importa o exporta sin EORI **no puede declarar**. Es el primer dato que pide cualquier formulario de LUCI.

### NIF / CIF

El número fiscal español. Para personas físicas (autónomos), es el DNI con letra. Para sociedades, empieza por una letra (B = SL, A = SA, etc.).

### TARIC

La nomenclatura combinada europea de mercancías. Cada producto del mundo tiene un **código TARIC de 10 dígitos** que identifica:

- Capítulo (los 2 primeros dígitos): el «sector» del producto.
- Partida (4 dígitos): el grupo dentro del sector.
- Subpartida (6 dígitos): la categoría específica.
- Código CN (8 dígitos): el código de la nomenclatura combinada UE.
- TARIC completo (10 dígitos): incluye sufijos para excepciones, suspensiones, contingentes…

**Ejemplos reales:**

| TARIC | Producto |
|---|---|
| `8471300000` | Ordenadores portátiles |
| `6109100090` | Camisetas de algodón, las demás |
| `9404211000` | Colchones de espuma de caucho |
| `8703211000` | Vehículos de motor de cilindrada ≤ 1.000 cm³ |

LUCI tiene 21.946 códigos TARIC en su BD oficial, sincronizados con la EU TARIC vía UK Trade Tariff API.

### LRN — *Local Reference Number*

Identificador interno que el declarante asigna a cada declaración antes de enviar. Es como tu «factura número 002» para AEAT. Una vez aceptado el envío, AEAT te devuelve el MRN; el LRN sigue en tu expediente como referencia local.

### GRN — *Guarantee Reference Number*

Número de la garantía aduanera (aval bancario, depósito, seguro, etc.) que respalda los derechos potenciales de las declaraciones. Cada operador de cierto volumen debe tener al menos una.

**Ejemplo STRIX:** `26ESAGL2800000054`.

---

## Tipos de declaración

| Sigla | Nombre | Cuándo se usa |
|---|---|---|
| **H1** | DUA importación | Importación normal de cualquier mercancía con valor superior al franquicia (>150 € en general). Es la declaración estándar. |
| **H7** | DUA bajo valor (e-commerce) | Envíos B2C ≤ 150 € (ej. paquetería express). Versión simplificada. |
| **AES** | Automated Export System | Exportación de cualquier valor. Sustituye al antiguo EXS. |
| **NCTS** | New Computerised Transit System | Tránsito comunitario T1/T2/T2F + tránsitos TIR. Mercancía que circula sin pagar derechos hasta destino. |
| **ENS** | Entry Summary Declaration | Declaración sumaria de entrada (anuncio de la mercancía antes de su llegada). Reemplazada por ICS2 para aire/mar/carretera; **solo el ferrocarril sigue por ENS legacy** (CC315A). |
| **EXS** | Exit Summary Declaration | Sumaria de salida. Se cumple junto con AES en muchos casos. |
| **PUE** | Punto Único de Entrada | Solicitud de control SOIVRE (calidad comercial), ROHS/RAEE (electrónica), seguridad de productos, etc. — controles paraduaneros. |
| **DSDT** | Declaración Sumaria de Depósito Temporal | Mercancía en almacén bajo control aduanero antes de declararla definitivamente. |

---

## Circuitos / canales

Cuando AEAT acepta tu declaración, le asigna un canal:

| Canal | Significado | Acción del agente |
|---|---|---|
| 🟢 **Verde** | Levante automático sin verificación | Listo para retirar la mercancía. |
| 🟠 **Naranja** | Control documental | Adjuntar/aportar la documentación que pida AEAT. |
| 🔴 **Rojo** | Control físico | Te citan en aduana para inspección de la mercancía. |
| 🟡 **Amarillo** | Aforo | Verificación valor / clasificación / origen sin abrir bulto. |

LUCI puede **predecir** el canal antes de enviar, basándose en histórico ML + heurísticas (origen alto riesgo, TARIC sensible, operador nuevo, valor declarado…). Ver [Predicción de circuito](05-asistente-luci-ia.md#prediccion-de-circuito).

---

## Marcos normativos

### CAU — Código Aduanero de la Unión

Reglamento (UE) **952/2013**. Es el corpus normativo que rige toda operación aduanera en cualquiera de los 27 países UE. Reglamento de Ejecución 2015/2447 + Reglamento Delegado 2015/2446 lo desarrollan.

### MFN — *Most Favoured Nation*

Tipo de derecho arancelario aplicable a cualquier país sin acuerdo preferencial con la UE. Es la tarifa «por defecto».

### Preferencias arancelarias

Tipos reducidos cuando el origen tiene un acuerdo preferencial con la UE:
- ITA (Acuerdo TI de productos tecnológicos): muchas TICs van a 0%.
- Mercosur: bonificaciones para vacuno argentino, cítricos brasileños…
- CETA (Canadá), JAPAN-EU EPA, EUR-MED, GSP+, etc.

LUCI tiene una calculadora dedicada: **Cálculo y normativa → Preferencias**.

### IIEE — Impuestos Especiales (SILICIE)

Hidrocarburos, alcoholes, tabaco, electricidad. Se gestionan por SILICIE (Sistema Inmediato de Información Sobre Inventarios y Movimientos). Algunas mercancías llevan IIEE además del arancel + IVA.

LUCI: **Cálculo y normativa → IIEE / SILICIE**.

### Contingentes arancelarios

Cantidades limitadas de un producto que pueden importarse a tipo reducido (ej. 100.000 t de vacuno argentino al año al 7,5% en vez del 12,8%). Se asignan por orden de llegada (FIFO) o por subasta.

LUCI: **Cálculo y normativa → Contingentes**.

---

## Operadores y figuras

| | |
|---|---|
| **Importador** | Quien introduce la mercancía en territorio aduanero UE. Paga los derechos y el IVA. |
| **Exportador** | Quien saca la mercancía del territorio UE. Suele recibir devolución de IVA. |
| **Declarante** | Quien firma la declaración. Puede ser el importador/exportador directamente o su representante (agente de aduanas). |
| **Representante directo** | Actúa en nombre y por cuenta del importador. El importador es el único responsable. |
| **Representante indirecto** | Actúa en nombre propio pero por cuenta del importador. Co-responsable de la deuda. |
| **OEA** | Operador Económico Autorizado. Certificación de fiabilidad otorgada por AEAT. Acceso a procedimientos simplificados, menos inspecciones, vía rápida. |

---

## Aduanas, ubicaciones y oficinas

### Aduana española

Las identifica un **código de 6 dígitos**, donde los 2 primeros son la zona y los 4 siguientes el local.

**Ejemplos:**

| Código | Aduana |
|---|---|
| `2801` | Madrid Barajas (aeropuerto) |
| `0810` | Barcelona Puerto |
| `3410` | Valencia Puerto |
| `0481` | Algeciras |
| `1102` | Cádiz |

### Aduana de salida / destino (NCTS)

En tránsitos, cada movimiento define **dos oficinas**: la de partida (donde se constituye) y la de destino (donde se ultima). El MRN del tránsito viaja con la mercancía.

### Ubicación / depósito

Lugar físico donde está la mercancía cuando se declara. Cada uno tiene un código alfanumérico (ej. `2801EEEEEE` para destinos en Madrid, `LUCI01` cuando aplique configuración custom).

---

## ICS2 — Import Control System v2

Nuevo sistema UE de seguridad pre-llegada. Reemplaza al ENS legacy para los modos:

- **AIR** (Release 2 — desde 1/Jul/2024)
- **SEA** (Release 3 — desde 3/Jun/2024)
- **ROAD** (Release 3 — desde 3/Jun/2024)

**Solo el ferrocarril** sigue por ENS legacy (CC315A). LUCI alerta cuando intentas declarar un ENS por carretera/aire/mar y te recuerda que va por ICS2.

---

## Términos AEAT específicos

| | |
|---|---|
| **DSDT** | Declaración Sumaria de Depósito Temporal — mercancía en almacén bajo control aduanero. |
| **N337** | Nuevo modelo DUA digital para tránsitos comunitarios desde 9/Mar/2026. Sustituye a documentos previos. |
| **G4** | Régimen de mercancía no comunitaria en depósito temporal aéreo. |
| **PRE / PROD** | Pre-producción AEAT (`prewww1.aeat.es`, sin valor liberatorio real) vs Producción (`www1.aeat.es`). |
| **ADDS-JDIT** | Servicio de consultas AEAT para conocer estado de un MRN, contenedor o EORI. |

---

## Códigos de error AEAT frecuentes

| Código | Significado | Solución típica |
|---|---|---|
| `1180` | NIF declarante no autorizado | Verifica que tu EORI esté dado de alta para ese tipo de declaración. |
| `2004` | Documento previo inexistente | Indica un MRN previo válido en la casilla 40. |
| `4404` | Casilla 18 longitud > 17 caracteres | Recorta el ID transporte (matrícula, ID barco). |
| `2214` | Doc 7007 mal formateado | Debe ser `YYYYMMDD-XXXXXXXX` (11 chars + guión). |
| `4405` | Código adicional erróneo | Usar `F48` para H7 e-commerce, no `C07`. |
| `1230` | Especificidad PUE incorrecta | Revisa los códigos SOIVRE/ROHS introducidos. |
| `9002` | Servicio temporal no disponible | Reintentar en unos minutos. |

---

## Acrónimos varios

| Sigla | Significado |
|---|---|
| **DUA** | Documento Único Administrativo (ahora «declaración»). |
| **CN** | Combined Nomenclature (los 8 primeros dígitos del TARIC). |
| **CAU** | Código Aduanero de la Unión. |
| **DG TAXUD** | Dirección General Fiscalidad y Unión Aduanera (UE). |
| **VUA** | Ventanilla Única Aduanera. |
| **SOIVRE** | Servicio Oficial de Inspección, Vigilancia y Regulación de Exportaciones. |
| **TRACES** | TRade Control and Expert System (control sanitario UE). |
| **CHED** | Common Health Entry Document (en TRACES). |
| **BCP** | Border Control Post (puesto fronterizo). |
| **FNMT** | Fábrica Nacional de Moneda y Timbre — emite los certificados digitales. |
| **XAdES** | XML Advanced Electronic Signatures — formato firma digital del SOAP AEAT. |
| **mTLS** | Mutual TLS — autenticación cliente/servidor con certificado en ambos lados. |

---

[← 01. Empezando](01-empezando.md) · [Índice](README.md) · [Siguiente: 03. Flujos diarios →](03-flujos-diarios/)
