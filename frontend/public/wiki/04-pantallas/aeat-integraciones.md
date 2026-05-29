# Pantallas — AEAT e Integraciones

[← Pantallas](README.md) · [Índice general](../README.md)

> Configurar tus **llaves digitales** (certificados FNMT) y **vigilar** el estado de las integraciones con AEAT y demás sistemas externos.

---

## Certificados AEAT

**Ruta**: `/aeat/certificates`

![Certificados AEAT](../img/aeat-certificados.png)

### Para qué sirve

Gestionar los **certificados digitales FNMT** que LUCI usa para firmar XML enviados a AEAT (XAdES) y autenticarse vía mTLS.

### Sin certificado no hay envío real a AEAT.

### 3 tipos soportados

| Tipo | Descripción | Cuándo usar |
|---|---|---|
| **FNMT_PF** | Persona Física | Autónomo declarando por sí mismo |
| **FNMT_PJ** | Persona Jurídica | Empresa con cert directo |
| **FNMT_REP** | Representante | Cert de un administrador/apoderado de la empresa |

### Tabla con 6 columnas

- Certificado (alias)
- Tipo
- Titular
- Validez (fecha vencimiento)
- Estado (Válido / Expirado / Revocado)
- Acciones

### Acciones por fila

- **Ver detalles** (icono ⓘ) — muestra Serial Number, Emisor, días restantes, panel «Análisis LUCI» con recomendaciones.
- **Verificar** (icono escudo verde) — comprobación criptográfica online (HTTP 200 + toast «Cert válido»).
- **Eliminar** (icono trash rojo) — elimina solo, no la confirma.

### Botones del header

- **+ Importar Certificado** (azul) — modal con 4 campos (file `.p12/.pfx` + password + tipo + alias).
- **Filtro**: «Incluir expirados» (toggle).
- **Actualizar**.

### Caso real probado

Importado el `.p12` real de Jenifer Romero (CEO STRIX, NIF 70073780W, representante de B22477020). Subject `70073780W JENIFER ROMERO (R: B22477020)`, válido hasta 14/10/2027 (528 días). Marcado válido para H1, H7, AES, NCTS.

### Análisis LUCI integrado

Al importar, LUCI devuelve automáticamente:

- Resumen del certificado.
- Capacidades (digitalSignature / nonRepudiation / keyEncipherment).
- Recomendaciones (renovar a 90 días de vencimiento).
- Warnings (si ya está cerca de expirar).

---

## Monitor AEAT

**Ruta**: `/aeat/monitor`

![Monitor AEAT](../img/aeat-monitor.png)

### Para qué sirve

Vigilar en **tiempo real** el estado de tus declaraciones enviadas a AEAT. Auto-refresh cada 60s.

### Qué muestra

| Bloque | Contenido |
|---|---|
| **Estado entorno** | PRE (sandbox) o PROD — con badge color |
| **Servicios AEAT** | 24 servicios disponibles, estado online/offline |
| **Certificados** | certLoaded: true · certificatesLoaded: 2 |
| **Declaraciones tracked** | Tabla con MRNs activos (últimos 30 días), canal, última actualización |
| **Alertas pendientes** | 4 niveles severity (critical / high / medium / low) |

### 6 MRN reales tracked en este tenant

```
26ES00280130001TT1   H1 ciclo completo - colchones TR
26ES00280130001U07   H1 directo - EXP-2026-MOKASSQ3
26ES19938245448511H7 H7 manifiesto - bufanda
26ES009999Z0000677   ENS RAIL - ferrocarril
26ES002801500473J5   NCTS T1 - tránsito desbloqueado
26ES17590081436606H7 H7 directo
```

### Botón «Predecir Canal» (IA)

Modal con 4 campos:
- País origen
- Código TARIC
- Valor aduanero EUR
- Tipo operación (importación / exportación)

LUCI devuelve:
- **Canal más probable** (verde/naranja/rojo/amarillo) con porcentaje.
- **Probabilidades** (suma 100%): green 64% / orange 16% / red 12% / yellow 8%.
- **RiskScore** /100.
- **Factores** que influyen (origen alto riesgo, TARIC sensible, operador nuevo).

> Útil para anticipar el canal **antes** de enviar y ajustar valor/clasificación si el riesgo es alto.

### Bug arquitectónico corregido

> **Map in-memory cluster**: el servicio originalmente guardaba declaraciones en `new Map()` por proceso, pero LUCI corre en pm2 cluster x2 — cada worker tenía su propio Map. Resultado: a veces se veían 6 MRN, a veces 3. **Fix**: implementado `RedisBackedMap` con TTL 30 días + Set auxiliar para enumerar. Ahora todas las requests devuelven el mismo conjunto de declaraciones.

---

## Aduanas NL (Países Bajos)

**Ruta**: `/aduanas-nl`

### Para qué sirve

Integración con la aduana neerlandesa (Douane) para operaciones que pasan por NL.

### Características

- Soporte completo H7 (DECO) y DMS 4.0 para H1.
- Acceso al portal `nh.douane.nl` (credenciales concedidas 16/Mar/2026).
- Pendiente: certificado PKIoverheid del cliente para envío real (despriorizado, foco actual en España).

> **Estado**: pausado hasta cerrar la integración España al 100%.

---

## Integraciones

**Ruta**: `/integrations`

![Integraciones](../img/integraciones.png)

### Para qué sirve

Centro unificado de **conexiones con sistemas externos**. Estado, configuración y test de cada integración.

### 4 tabs

| Tab | Contenido |
|---|---|
| **Dashboard** | 5 stats cards (Total / Activas / Simulación / Error / Inactivas) + grid 4 tarjetas integración |
| **VUA** | Ventanilla Única Aduanera — 14 servicios + 6 autoridades conectadas (AEAT, SOIVRE, MAPA, SANIDAD, MITERD, AEMPS) |
| **TRACES** | Sistema sanitario UE — 4 tipos CHED + 12 BCPs (Border Control Posts) |
| **NCTS** | Phase 5 — 5 tipos tránsito + 10 tipos garantía + 7 aduanas salida ES |

### Tarjetas en Dashboard

Cada integración (AEAT / VUA / TRACES / NCTS):
- Icono custom por sistema
- Badge estado (active / simulation / error)
- País + Categoría
- Botón **Test connectivity** → POST `/api/integrations/:code/test` → toast con resultado

### Estadísticas de uso (últimos 30 días)

- AEAT: 1.250 llamadas, 98,4% éxito, 1,2s avg.
- VUA: 890 llamadas, 98,3% éxito.
- TRACES: 340 llamadas, 98,5% éxito.
- NCTS: 560 llamadas, 98,2% éxito.
- **Total: 3.040 llamadas, 98,4% éxito global.**

---

## Atajos útiles

- Desde el Dashboard → click sobre una alerta de cert próximo a expirar → **Certificados AEAT** filtrado por ese cert.
- Desde Monitor → click sobre un MRN tracked → expediente.
- Desde Integraciones → click TARJETA → modal con detalle del estado de conexión.

---

## Estado actual del entorno PRE (mayo 2026)

| Tipo declaración | Estado en PRE | MRN obtenido |
|---|---|---|
| **H1** | ✓ Funcional | `26ES00280130001TT1` ciclo completo · `26ES00280130001U07` H1 directo |
| **H7** | ✓ Funcional (con tenant adecuado) | `26ES19938245448511H7` manifiesto |
| **AES** | ✓ Funcional | (probado en suite 4/May, no incluido en MRN reales documentados) |
| **NCTS** | ✓ Desbloqueado 24/Abr | `26ES002801500473J5` |
| **ENS** | ✓ Solo modo RAIL | `26ES009999Z0000677` |
| **PUE** | ⚠️ Bloqueado | Esperando respuesta Jose Antonio para indexación SOIVRE PRE |

---

[← Regímenes](regimenes.md) · [Siguiente: Administración →](administracion.md)
