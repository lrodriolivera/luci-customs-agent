# Solicitud de Autorización para Servicios Web de Aduanas AEAT

## Datos del Solicitante

### Empresa Representante Aduanero
| Campo | Valor |
|-------|-------|
| **Razón Social** | Stock Logistic S.L. |
| **NIF/CIF** | B22477020 |
| **EORI** | ESB22477020000 |
| **Domicilio Social** | [Completar dirección] |
| **Código Postal** | [Completar] |
| **Municipio** | [Completar] |
| **Provincia** | [Completar] |
| **Teléfono** | [Completar] |
| **Email contacto** | [Completar] |

### Titular del Certificado Digital
| Campo | Valor |
|-------|-------|
| **Nombre completo** | JENIFER ROMERO |
| **NIF** | 70073780W |
| **Tipo certificado** | Certificado de Representante FNMT |
| **Número serie certificado** | [Ver en el certificado] |
| **Fecha caducidad** | 14/10/2027 |
| **Emisor** | FNMT-RCM (Fábrica Nacional de Moneda y Timbre) |

---

## Datos Técnicos de Conexión

### Dirección IP de Conexión
| Campo | Valor |
|-------|-------|
| **IP Pública** | 188.26.214.201 |
| **Tipo** | IP Fija |
| **Proveedor ISP** | [Completar nombre del proveedor] |
| **País** | España |

### Sistema de Conexión
| Campo | Valor |
|-------|-------|
| **Nombre aplicación** | LUCI Customs Agent |
| **Versión** | 1.0.0 |
| **Plataforma** | Node.js / Linux |
| **Protocolo** | HTTPS con TLS 1.2/1.3 |
| **Autenticación** | Certificado cliente FNMT (SSL Mutual Auth) |
| **Firma electrónica** | XAdES-EPES según especificación AEAT |

---

## Servicios Web Solicitados

### Declaraciones de Importación (H1)
| Servicio | Código | Descripción |
|----------|--------|-------------|
| Presentación H1 | CC515C | Envío de declaración de importación CAU |
| Consulta H1 | - | Consulta estado de declaración |
| Modificación H1 | CC513C | Modificación de declaración presentada |
| Invalidación H1 | CC514C | Anulación de declaración |

### Declaraciones de Bajo Valor (H7)
| Servicio | Código | Descripción |
|----------|--------|-------------|
| Presentación H7 | CC515B | Envío declaración envíos < 150€ |
| Consulta H7 | - | Consulta estado H7 |

### Declaraciones de Exportación (AES)
| Servicio | Código | Descripción |
|----------|--------|-------------|
| Presentación AES | CC615C | Declaración de exportación |
| Consulta AES | - | Consulta estado exportación |
| Modificación AES | - | Modificación declaración exportación |

### Tránsito Comunitario (NCTS Fase 6)
| Servicio | Código | Descripción |
|----------|--------|-------------|
| Presentación NCTS | IE015 | Declaración de tránsito |
| Notificación llegada | IE007 | Aviso de llegada |
| Consulta NCTS | - | Estado de tránsito |

### Otros Servicios
| Servicio | Descripción |
|----------|-------------|
| ICS2 (ENS) | Declaración sumaria de entrada |
| Bandeja de entrada | Consulta de declaraciones |
| Documentos digitalizados | Envío de documentación adjunta |
| SILICIE | Impuestos especiales (si aplica) |
| EMCS | Movimientos de impuestos especiales |

---

## Especificaciones Técnicas del Sistema

### Endpoints de Conexión Solicitados

**Entorno de Producción:**
```
Base URL: https://www1.agenciatributaria.gob.es
WS URL:   https://www2.agenciatributaria.gob.es
WS URL:   https://www3.agenciatributaria.gob.es
```

**Entorno de Pruebas (Pre-producción):**
```
Base URL: https://prewww1.aeat.es
WS URL:   https://prewww2.aeat.es
WS URL:   https://prewww3.aeat.es
```

### Configuración SSL/TLS
- **Protocolo**: TLS 1.2 / TLS 1.3
- **Autenticación cliente**: Certificado FNMT en formato P12/PFX
- **Verificación servidor**: Habilitada (rejectUnauthorized: true)
- **Cipher suites**: Estándar del sistema operativo

### Formato de Mensajes
- **Protocolo**: SOAP 1.1
- **Encoding**: UTF-8
- **Firma**: XAdES-EPES según especificación AEAT
- **Namespace**: urn:wco:datamodel:WCO:DEC-DMS:2

---

## Justificación de la Solicitud

### Actividad de la Empresa
Stock Logistic S.L. es una empresa de representación aduanera que presta servicios de:

1. **Despacho de importación**: Tramitación de DUAs de importación para clientes
2. **Despacho de exportación**: Gestión de declaraciones de exportación
3. **Tránsito comunitario**: Operaciones NCTS
4. **Gestión documental**: Digitalización y envío de documentación aduanera
5. **Asesoramiento aduanero**: Clasificación arancelaria y régimen aduanero

### Volumen Estimado de Operaciones
| Tipo de Declaración | Volumen Mensual Estimado |
|---------------------|--------------------------|
| Importaciones H1 | [Completar] |
| Importaciones H7 | [Completar] |
| Exportaciones AES | [Completar] |
| Tránsitos NCTS | [Completar] |

### Beneficios de la Conexión Directa
1. Automatización del proceso de presentación de declaraciones
2. Reducción de tiempos de tramitación
3. Integración con sistema de gestión interno (LUCI Customs Agent)
4. Trazabilidad completa de las operaciones
5. Respuesta inmediata sobre estado de declaraciones

---

## Compromisos del Solicitante

El solicitante se compromete a:

1. **Seguridad**: Mantener la seguridad del certificado digital y no compartir credenciales
2. **Uso adecuado**: Utilizar los servicios web exclusivamente para operaciones aduaneras legítimas
3. **Actualización**: Mantener actualizada la información de contacto y técnica
4. **Cumplimiento**: Cumplir con las especificaciones técnicas y guías de AEAT
5. **Notificación**: Informar de cualquier incidencia de seguridad o cambio de IP

---

## Documentación Adjunta

- [ ] Copia del certificado digital (parte pública)
- [ ] Poder de representación (si aplica)
- [ ] Alta en el Registro de Operadores de Comercio Exterior
- [ ] Documento acreditativo de la actividad empresarial

---

## Datos de Contacto para Incidencias Técnicas

| Campo | Valor |
|-------|-------|
| **Responsable técnico** | [Nombre del técnico] |
| **Email técnico** | [email@empresa.com] |
| **Teléfono técnico** | [Teléfono] |
| **Horario disponibilidad** | L-V 09:00-18:00 |

---

## Procedimiento de Solicitud

### Paso 1: Acceso a Sede Electrónica
1. Acceder a https://sede.agenciatributaria.gob.es
2. Identificarse con certificado digital FNMT
3. Navegar a: Aduanas → Aduana Electrónica → Comunicaciones

### Paso 2: Formulario de Alta
1. Seleccionar "Alta de usuario en servicios web de Aduanas"
2. Rellenar los datos según este documento
3. Adjuntar documentación requerida
4. Firmar y enviar la solicitud

### Paso 3: Confirmación
1. Guardar el número de registro de la solicitud
2. Esperar confirmación por email (2-5 días hábiles)
3. Una vez autorizado, probar conectividad con entorno de pruebas

### Enlaces Útiles
| Recurso | URL |
|---------|-----|
| Sede Electrónica AEAT | https://sede.agenciatributaria.gob.es |
| Guías Técnicas Aduanas | https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas.html |
| Especificación Web Services | https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/ws.html |
| Estado de servicios | https://sede.agenciatributaria.gob.es/Sede/aduanas.html |
| Soporte técnico | cau.aeat@correo.aeat.es |

---

## Notas Importantes

1. **IP Fija obligatoria**: AEAT solo autoriza IPs fijas, no dinámicas
2. **Certificado vigente**: Debe tener al menos 30 días de validez
3. **EORI activo**: El número EORI debe estar registrado y activo
4. **Pruebas previas**: Se recomienda probar en entorno de pre-producción antes de producción

---

*Documento generado el: 22 de Enero de 2026*
*Sistema: LUCI Customs Agent v1.0.0*
