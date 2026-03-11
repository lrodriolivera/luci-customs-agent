# Informe de Pruebas AEAT PRE

## LUCI Customs Agent - Validacion de XML Builders

**Empresa:** STRIX AI SL (NIF: B22477020, EORI: ESB22477020)

**Fecha:** 3 de marzo de 2026

**Servidor:** https://prewww1.aeat.es (Preproduccion)

**Certificado:** FNMT - Jenifer Romero (70073780W, R: B22477020), valido hasta 14/10/2027

**Datos de prueba:** Proporcionados por Jose Antonio (DIT/AEAT) el 3/Mar/2026

---

## 1. Resumen ejecutivo

Se han realizado 47 rondas de pruebas contra el entorno de preproduccion de la AEAT, iterando sobre la estructura XML de los 6 builders del sistema LUCI Customs Agent. Los resultados finales son:

| Builder | Tipo declaracion | Estado | MRN / Referencia |
|---------|-----------------|--------|------------------|
| **H1** | Importacion Completa | **ACEPTADO** | 26ES002801300011Y8 |
| **H7** | Importacion Simplificada | **ACEPTADO** | 26ES002801300011Z6 |
| **AES** | Exportacion | **ACEPTADO** | 26ES002801100090B9 |
| **ENS** | Declaracion Sumaria Entrada | **ACEPTADO** | 26ES009999Z0000578 (y 30+ mas) |
| **NCTS** | Transito Comunitario | **Pendiente datos** | Schema XML validado, falta sumaria activa |
| **PUE** | Certificado ROHS/SOIVRE | **Bloqueado** | Requiere H1 aceptado con partidas ROHS |

**Resultado: 4 de 6 builders aceptados. NCTS pendiente de datos de test. PUE bloqueado por dependencia.**

---

## 2. Configuracion de pruebas

### 2.1 Datos del declarante

- **NIF:** B22477020
- **EORI:** ESB22477020
- **Razon social:** STRIX AI SL
- **Representante:** Jenifer Romero (70073780W)

### 2.2 Datos de Jose Antonio (DIT/AEAT)

| Concepto | Valor |
|----------|-------|
| Representante aduanero | ES89890010F (Juan Aduanero Aduanero) |
| Garantia importacion | 26ESAGL2800000054 |
| Garantia transito | 26ES0002800000010 |
| Auth transito expedicion | ESACR02026000002 |
| Auth transito recepcion | ESACE02026000008 |
| Ubicacion verde | 2801AAAAAC |
| Ubicacion naranja | 4811CDF001 |
| Ubicacion rojo | 4801ADT005 |
| Ubicacion export | 2801AAAAAC |

### 2.3 Endpoints SOAP utilizados

| Builder | Endpoint |
|---------|----------|
| H1 | /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP |
| H7 | /wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP |
| AES | /wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP |
| NCTS | /wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP |
| ENS | /wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP |
| PUE | /wlpl/AD44-JDIT/ws/rohs/ROHSsolicitudV1SOAP |

---

## 3. Resultado detallado por builder

### 3.1 H1 - Importacion Completa (ImportacionCompletaV1)

**Estado: ACEPTADO**

**Respuesta AEAT:**

- Codigo respuesta: 0 (Exito)
- Operacion: Presentacion de Predeclaracion Completa
- MRN asignado: **26ES002801300011Y8**
- Circuito: **A** (Aceptado)
- Total a pagar: 42.62 EUR
- Total a garantizar: 42.62 EUR
- Requiere certificados no aduaneros: Si (SOIVRE)

**Datos de la declaracion:**

- Aduana: 002801
- Mercancia: Cafe verde sin tostar (TARIC 0901110000)
- Peso bruto: 150 kg / Peso neto: 120 kg
- Valor factura: 120 EUR
- Ubicacion: ES002801AAAAAC
- Regimen: 40/00 (Despacho a consumo)
- Codigo adicional: F44
- Documentos: N380 (Factura) + N730 (CMR) + N741 (BL)

**Tributos liquidados por AEAT:**

| Tributo | Base | Tipo | Cuota |
|---------|------|------|-------|
| A00 (Arancel) | 120.00 EUR | 12% | 14.40 EUR |
| B00 (IVA) | 134.40 EUR | 21% | 28.22 EUR |

**Reglas XSD descubiertas durante las pruebas:**

1. `C31EmpaquetamientoInterno` usa elementos internos: `C31EmpaqInternoClase`, `C31EmpaqInternoMarcas`, `C31EmpaqInternoNumeroBultos` (NO los externos `C31NumeroBultos/TipoBulto/Marcas`)
2. `C31DescripcionDeLaMercancia` es un string directo (NO tiene hijo `C31DescrMerc1`)
3. `C44DocumentosYCertificados` contiene `C44Tipo` + `C44Referencia` (NO `C44TipoDocumento/C44Identificador`)
4. Orden XSD Partida: C32 -> C31Empaq -> C31Descripcion -> C3312 -> C34 -> C35 -> C36 -> C37 -> C38 -> C41 -> C42 -> C44 -> C46 -> C47
5. `C14DeclaranteTipoAutorizaDespacho` debe ser `O` (no `G`)
6. Ubicacion formato: `ES00RRRRNNNNNN` (ej: `ES002801AAAAAC`)

---

### 3.2 H7 - Importacion Simplificada (DeclaSimpliImporV1)

**Estado: ACEPTADO**

**Respuesta AEAT:**

- Codigo respuesta: 0 (Exito)
- Operacion: Presentacion de Predeclaracion Simplificada
- MRN asignado: **26ES002801300011Z6**
- Circuito: **A** (Aceptado)
- Total a pagar: 2.63 EUR
- Total a garantizar: 2.63 EUR
- Garantia GRN utilizada: 26ESAGL2800000054 (importe real: 2.63 EUR)

**Datos de la declaracion:**

- Aduana: 002801
- Mercancia: Cafe verde sin tostar (TARIC 0901110000)
- Peso bruto: 0.200 kg / Peso neto: 0.150 kg
- Valor factura: 12.50 EUR
- Ubicacion: ES002801AAAAAC
- Procedimiento: C (Simplificado a complementar)
- Modalidad pago: R (Aplazamiento con garantia)
- Garantia GRN: 26ESAGL2800000054

**Tributos liquidados por AEAT:**

| Tributo | Base | Tipo | Cuota |
|---------|------|------|-------|
| B00 (IVA) | 12.50 EUR | 21% | 2.63 EUR |

**Reglas XSD descubiertas:**

1. H7 NO tiene: `C17aPaisDestino`, `C20CondicionesDeEntrega`, `C222ImporteFactura`, `C24NaturalezaTransaccion`, `C25ModoTransporteFrontera`, `C46ValorEstadistico`
2. Orden cabecera: C15a -> C19 -> C221 -> C30 -> CB (diferente al H1)
3. `C012ProcedimientoSolicitado` debe ser `C` (obligatorio para H7)
4. Modalidad pago `A` (previo) NO compatible con procedimiento `C`; usar `R` con GRN
5. `C47TributoDeclarado` obligatorio (A00 arancel + B00 IVA) incluso si cuota es 0
6. `CBImporteTotalTributos` debe coincidir con suma de cuotas de partidas

---

### 3.3 AES - Exportacion (CC515CV1)

**Estado: ACEPTADO**

**Respuesta AEAT:**

- Tipo respuesta: OK
- Codigo respuesta: L (Levante)
- MRN asignado: **26ES002801100090B9**
- Circuito AEAT: **V** (Verde)
- Fecha admision: 2026-03-03
- Fecha levante: 2026-03-03
- CSV declaracion: Q4PE36EEJJBAKRFZ
- CSV levante: GEXS5XYLZN6F5BBE
- Flag directa/indirecta: D (Directa)
- Estado AES: DS

**Datos de la declaracion:**

- Tipo: EX (Exportacion)
- Additional: A
- Security: 2
- Aduana export/salida: ES002801
- Exportador: ESB22477020 (STRIX AI SL)
- Consignatario: US TECH IMPORTS LLC (New York, US)
- Mercancia: Equipos informaticos (TARIC 84714100)
- Valor: 3000 EUR
- Ubicacion: 2801AAAAAC
- Transporte frontera: Carretera (modo 3)

**Reglas XSD descubiertas:**

1. Export directa: NO incluir `inlandModeOfTransport` ni `DepartureTransportMeans`
2. `CountryOfRoutingOfConsignment` va DENTRO de Consignment: ...DepartureTransportMeans -> CountryOfRouting -> ActiveBorderTransport
3. `regionOfDispatch` obligatorio en Origin si `countryOfExport` = ES
4. `tipoRespuesta: OK` con `codigoRespuesta: L` indica levante inmediato

---

### 3.4 ENS - Declaracion Sumaria de Entrada (IE315V5)

**Estado: ACEPTADO (30+ MRN recibidos)**

**Ultimo MRN:** 26ES009999Z0000578

**CSV:** QTLFZQ3LBWVJGTXJ

**Respuesta AEAT (ejemplo):**

- Tipo mensaje: CC328A (Aceptada)
- MRN formato: YYCCOOOOOZSSSSSS
- Aduana entrada: ES009999 (Peninsula pruebas)

**Datos de la declaracion:**

- Formato: CC315A (Legacy ICS)
- Transportista: ESB22477020
- Modo transporte: 2 (Ferrocarril) - unico modo soportado en legacy
- Ruta: China (CNSZX) -> Espana (ESZAZ)
- Consignor: Shenzhen Electronics Co Ltd
- Consignee: STRIX AI SL
- Mercancia: Servidores rack (commodity 847130)

**Nota:** Los modos aereo (4), maritimo (1) y carretera (3) requieren ICS2 con formato CC315C. Pendiente habilitacion por Jose Antonio.

---

### 3.5 NCTS - Transito Comunitario (CC015CV1)

**Estado: Schema XML validado, pendiente datos de sumaria activa**

**Ultimo error:** "ADDV_ No existe el documento DUA y/o partida"

La estructura XML del builder NCTS ha sido completamente validada por AEAT (sin errores de schema). El unico error pendiente es funcional: las sumarias proporcionadas por Jose Antonio no se encuentran activas en el entorno PRE.

**Validaciones superadas:**

1. Estructura CC015C correcta
2. Authorisation C521 en posicion correcta (despues de TransitOperation)
3. PreviousDocument NMRN con formato correcto (DUA + 18 chars MRN = 21 chars)
4. Garantia tipo 1 con GRN: 26ES0002800000010
5. LocationOfGoods con authorisationNumber: 2801AAAAAC

**Pendiente:** Solicitar a Jose Antonio una sumaria activa en PRE para vincular con el transito T1.

---

### 3.6 PUE - Certificado ROHS/SOIVRE

**Estado: Bloqueado**

**Error:** Codigo 1128

El servicio PUE/ROHS requiere un H1 previamente aceptado con partidas que exijan certificado ROHS. Con el H1 ahora funcionando, el siguiente paso seria presentar un H1 con TARIC que requiera ROHS y luego solicitar el certificado PUE referenciando ese MRN.

---

## 4. Historial de iteraciones

### 4.1 Errores resueltos por builder

**H1 (13 rondas hasta aceptacion):**

| Ronda | Error | Solucion |
|-------|-------|----------|
| 1 | Ubicacion no valida (2801AAAAAC) | Formato ES00RRRRNNNNNN |
| 2-6 | C31EmpaqInternoClase faltante | Usar nombres internos: EmpaqInternoClase/Marcas/NumeroBultos |
| 7-8 | C31DescripcionDeLaMercancia con hijo | String directo sin wrapper |
| 9-10 | C44 en posicion incorrecta | Mover despues de C42, antes de C46 |
| 11 | C44Tipo/C44Referencia nombres | Corregir nombres de elementos |
| 12 | Unidades suplementarias TARIC | C41UnidadesSuplementarias con C41UnidadesCodigo |
| 13 | Codigo adicional incompatible | F44 + docs transporte N730/N741 |
| 14 | TipoAutorizaDespacho=G | Cambiar a O |

**H7 (14 rondas adicionales):**

| Ronda | Error | Solucion |
|-------|-------|----------|
| 1-15 | "No se han declarado partidas" | C46ValorEstadistico NO existe en H7 |
| 16 | Orden elementos cabecera incorrecto | Reordenar: C15a->C19->C221->C30->CB |
| 17 | EmpaquetamientoInterno sin clase | Usar EmpaqInternoClase como H1 |
| 18 | DescripcionDeLaMercancia con wrapper | String directo |
| 19 | Marcas de bultos vacio | Valor obligatorio (S/M) |
| 20 | C44DocumentosYCertificados faltante | Anadir con tipo+referencia |
| 21 | C07 requiere doc 7007 | Cambiar a F44 |
| 22 | Tributos arancel obligatorio | Anadir A00 + B00 |
| 23 | Procedimiento C con pago A | Cambiar a pago R con GRN |
| 24 | Garantia GRN faltante | Anadir CBgarantiaGRN |

**AES (5 rondas):**

| Ronda | Error | Solucion |
|-------|-------|----------|
| 1 | inlandModeOfTransport no permitido | Quitar para export directa |
| 2 | CountryOfRoutingOfConsignment faltante | Dentro de Consignment, despues de DepartureTransport |
| 3 | regionOfDispatch obligatorio | Anadir en Origin cuando countryOfExport=ES |
| 4 | Posicion CountryOfRouting incorrecta | ...DepartureTransport -> CountryOfRouting -> ActiveBorder |
| 5 | Declaracion duplicada (LRN) | Exito confirmado - ya aceptada |

**NCTS (8 rondas):**

| Ronda | Error | Solucion |
|-------|-------|----------|
| 1 | Ubicacion privada sin C521 | Anadir Authorisation tipo C521 |
| 2 | PreviousDocument faltante | Anadir NMRN con DUA+MRN |
| 3 | Authorisation en posicion incorrecta | Mover despues de TransitOperation |
| 4 | Tipo N355 no valido | Cambiar a NMRN |
| 5 | goodsItemNumber no permitido para N355 | Obligatorio para NMRN |
| 6 | quantity obligatorio para NMRN | Anadir measurementUnitAndQualifier + quantity |
| 7 | quantity != netMass | Igualar a netWeight |
| 8 | Sumaria no encontrada | Pendiente de datos activos |

---

## 5. MRN obtenidos

| Builder | MRN | Fecha | Canal | CSV |
|---------|-----|-------|-------|-----|
| H1 | 26ES002801300011Y8 | 03/03/2026 19:32 | A | ModoTestModoTest |
| H7 | 26ES002801300011Z6 | 03/03/2026 19:32 | A | ModoTestModoTest |
| AES | 26ES002801100090B9 | 03/03/2026 13:10 | V (Verde) | Q4PE36EEJJBAKRFZ |
| ENS | 26ES009999Z0000578 | 03/03/2026 | - | QTLFZQ3LBWVJGTXJ |

Adicionalmente, se recibieron mas de 30 MRN de ENS durante las pruebas (26ES009999Z0000112 a Z0000578).

---

## 6. Proximos pasos

1. **NCTS:** Solicitar a Jose Antonio una sumaria activa en PRE para completar el test de transito
2. **PUE:** Presentar H1 con TARIC que requiera ROHS, luego solicitar certificado PUE
3. **ENS ICS2:** Solicitar habilitacion ICS2 para modos aereo/maritimo/carretera
4. **Produccion:** Verificar EORI en entorno de produccion antes de pasar a real

---

## 7. Archivos de prueba

Todos los archivos XML de request y response se encuentran en:

`luci-customs-agent/backend/tests/`

- `aeat-v2-request-*.xml` - XMLs enviados a AEAT
- `aeat-v2-response-*.xml` - Respuestas recibidas de AEAT
- `aeat-pre-test-v2-jose-antonio.js` - Script de test principal
- `aeat-ncts-sumaria-test.js` - Test NCTS con todas las sumarias
- `aeat-ncts-no-prevdoc-test.js` - Test NCTS sin PreviousDocument

---

*Documento generado el 3 de marzo de 2026*

*STRIX AI SL - NIF B22477020 - EORI ESB22477020*
