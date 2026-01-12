# AEAT - Endpoints y Servicios Web

**Ultima actualizacion**: 2026-01-12
**Fuente oficial**: https://sede.agenciatributaria.gob.es

---

## 1. INDICE DE SERVICIOS WEB DE ADUANAS

**URL Principal**: https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/ws.html

Este indice contiene todos los WSDLs, esquemas XML de entrada/salida y documentacion PDF para cada servicio.

---

## 2. ENTORNOS

### Produccion
| Servicio | URL Base |
|----------|----------|
| Web Services Aduanas | `https://www.agenciatributaria.gob.es/AEAT/ws/` |
| Web Services ADAA-JDIT | `https://www1.agenciatributaria.gob.es/wlpl/ADAA-JDIT/ws/` |

### Pruebas (Preproduccion)
| Servicio | URL Base |
|----------|----------|
| Portal Pruebas | https://preportal.aeat.es/ |
| WS Certificado Sello | `https://prewww10.aeat.es/wlpl/ADAA-JDIT/ws/` |
| WS Otros Certificados | `https://prewww1.aeat.es/wlpl/ADAA-JDIT/ws/` |

**Nota**: En entorno de pruebas se ignora el modo test de los mensajes.

---

## 3. SERVICIOS DE IMPORTACION (H1/CAU)

### 3.1 Presentacion de Declaraciones H1

**WSDL**: Disponible en indice de servicios web
**Guia Tecnica**: https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Aduanas/adu_electronica/info/guias_tecnicas/Guia_Servicios_Web_Importacion.pdf

**Operaciones disponibles**:
| Operacion | Descripcion |
|-----------|-------------|
| Alta Declaracion | Presentar nueva declaracion H1 |
| Modificacion | Modificar declaracion existente |
| Anulacion | Anular declaracion |
| Consulta Estado | Consultar estado por MRN/LRN |

**Formato de mensaje**: SOAP con XML en el Body
**Content-Type recomendado**: `text/xml`, `application/xml` o `application/soap+xml`

### 3.2 Envio de Documentacion Digitalizada

**Endpoint Pruebas (Cert. Sello)**: `https://prewww10.aeat.es/wlpl/ADAA-JDIT/ws/EnvioDeDocumentosV1SOAP`
**Endpoint Pruebas (Otros Cert.)**: `https://prewww1.aeat.es/wlpl/ADAA-JDIT/ws/EnvioDeDocumentosV1SOAP`

**Guia**: https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adaa/jdit/ws/Guia%20del%20Servicio%20Web%20Envio%20de%20Documentacion.%20V1.4.pdf

**Tipos de operacion para H1**:
| Codigo | Descripcion |
|--------|-------------|
| 12 | Importacion. Documentacion Previa al despacho H1 |
| 13 | Importacion. Documentacion para declaracion complementaria H1 |

### 3.3 Consulta de MRN

**Guia Tecnica**: https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/dit/adu/adex/ws/consmrn/ServicioConsultaMRNExporta-Importa-v04.pdf

**Operaciones**:
- Consultar estado de declaracion por MRN
- Obtener canal asignado (verde/naranja/rojo)
- Obtener deuda aduanera calculada

---

## 4. SERVICIOS DE EXPORTACION (AES)

### 4.1 Sistema Automatizado de Exportacion

**Documentacion**: Disponible en indice de servicios web

**Operaciones principales**:
| Operacion | Descripcion |
|-----------|-------------|
| IE515 | Declaracion de exportacion |
| IE513 | Modificacion de declaracion |
| IE514 | Anulacion de declaracion |
| IE528 | Autorizacion de salida |
| IE529 | Notificacion de salida |

---

## 5. TRANSITO (NCTS)

### 5.1 Sistema NCTS Fase 6

**Documentacion**: Disponible en indice de servicios web

**Operaciones principales**:
| Mensaje | Descripcion |
|---------|-------------|
| IE015 | Declaracion de transito |
| IE014 | Modificacion de transito |
| IE044 | Ultimacion de transito |
| IE045 | Notificacion de descarga |

---

## 6. ICS2 - CONTROL DE IMPORTACION

### 6.1 Declaraciones Sumarias de Entrada (ENS)

**Versiones**: 3, 4, 5

**Operaciones**:
| Operacion | Descripcion |
|-----------|-------------|
| Presentacion ENS | Notificacion previa de entrada |
| Modificacion ENS | Actualizar datos de ENS |
| Consulta ENS | Estado de la declaracion sumaria |

---

## 7. OTROS SERVICIOS

### 7.1 Deposito Temporal (DSDT)

**Bloque de Servicios**: DSDT y G4
- Notificacion de mercancias en deposito temporal
- Gestion de existencias
- Salida de mercancias

### 7.2 EMCS - Control de Movimientos de Impuestos Especiales

**Versiones**: 3.2 y 4
- Movimientos intracomunitarios
- Movimientos internos
- Alcohol, tabaco, hidrocarburos

### 7.3 Certificados Especiales

- Licencias FLEGT (madera)
- Certificados fitosanitarios
- Productos de doble uso
- ROHS (sustancias peligrosas)
- Productos ecologicos

### 7.4 DIVA - Devolucion IVA Viajeros

- Validacion de facturas
- Procesamiento de reembolsos

---

## 8. AUTENTICACION

### Certificados Digitales Requeridos

Para acceder a los servicios web de AEAT se requiere:

1. **Certificado de Persona Juridica** o **Certificado de Representante**
2. Emitido por entidad de certificacion reconocida (FNMT, Camerfirma, etc.)
3. Instalado en el almacen de certificados del sistema

### Firma de Mensajes

Los mensajes XML deben firmarse digitalmente usando:
- Algoritmo: XMLDSig
- Canonicalizacion: Exclusive XML Canonicalization
- Hash: SHA-256

---

## 9. ESTRUCTURA DE MENSAJES

### Envelope SOAP

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:aeat="https://www.agenciatributaria.gob.es/AEAT/ws">
  <soapenv:Header>
    <!-- Firma digital aqui -->
  </soapenv:Header>
  <soapenv:Body>
    <!-- Contenido del mensaje -->
  </soapenv:Body>
</soapenv:Envelope>
```

### Codigos de Respuesta Comunes

| Codigo | Descripcion |
|--------|-------------|
| 0000 | Operacion correcta |
| 0001 | Pendiente de validacion |
| 1000 | Error de formato XML |
| 1001 | Error de firma digital |
| 1002 | Certificado no valido |
| 2000 | Datos incorrectos |
| 2001 | EORI no valido |
| 2002 | Codigo TARIC no valido |

---

## 10. CANALES DE INSPECCION

| Canal | Codigo | Descripcion |
|-------|--------|-------------|
| Verde | G | Levante automatico |
| Amarillo | Y | Pendiente certificados |
| Naranja | O | Revision documental |
| Rojo | R | Inspeccion fisica |

---

## 11. RECURSOS ADICIONALES

### Documentacion Oficial
- **Sede Electronica Aduanas**: https://sede.agenciatributaria.gob.es/Sede/aduanas.html
- **Aduana Electronica**: https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica.html
- **Guias Tecnicas**: https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas.html

### Librerias Open Source
- **Python**: https://pypi.org/project/aeat-web-services/
- **GitHub**: https://github.com/initios/aeat-web-services

### Especificaciones H1
- **Manual H1 DAIE**: https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Aduanas/Entrada_salida/ayuda/H1DAIE.pdf
- **Estructura Datos H1**: https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Aduanas/Entrada_salida/despacho/H1DIT_2025.pdf

---

## 12. NOTAS IMPORTANTES

1. **Historico de Envios**: AEAT mantiene en linea ~15 dias el historico. Envios duplicados (mismo NIF+tipo+ID) despues de 15 dias generan error.

2. **Tiempo de Respuesta**: Los servicios web deben responder en tiempo real (<30 segundos).

3. **Horario**: Los servicios estan disponibles 24/7, pero el soporte tecnico tiene horario limitado.

4. **Versionado**: Verificar siempre la version del servicio en el indice oficial antes de integrar.

---

**Documento creado por**: Claude Code
**Proyecto**: LUCI Customs Agent
