# Respuesta Jose Antonio AEAT (2/Mar/2026)

**De:** atenusu@correo.aeat.es
**A:** luis.rodriguez@strixai.es
**Fecha:** 2026-03-02 11:02

## Datos de pruebas AEAT PRE entregados

### Representación
- Somos representante aduanero con autorizacion global de despacho para:
  - **EORI representado:** `ES89890010F` (Juan Aduanero Aduanero)

### Garantías
| Codigo | Regimen |
|--------|---------|
| `26ESAGL2800000054` | Despacho a consumo (importacion) |
| `26ES0002800000010` | Expedicion de transito |

Jose Antonio ofrece dar de alta mas garantias de otros regimenes si se piden.

### Autorizaciones de transito
| Codigo | Tipo | Ubicacion verde | Ubicacion naranja | Ubicacion roja |
|--------|------|------------------|--------------------|-----------------|
| `ESACR02026000002` | Expedicion | `2801AAAAAC` | `4811CDF001` | `4801ADT005` |
| `ESACE02026000008` | Recepcion | `2801AAAAAC` | `2911ADTPRU` | `2901MLG005` |

### Sumarias disponibles

Sin contenedores:
- `24-ES-004611-8-000017-5` (clave antigua `4611-4-000017`) — partida `00001` en `4611ADT031`
- `25-ES-002801-8-000399-3` (clave antigua `2801-5-000399`) — partida `00001` en `2801AAAAAC`
- `25-ES-004801-8-000002-7` (clave antigua `4801-5-000002`) — partida `00001` en `4801ADT002`

Con contenedores:
- `24-ES-004611-8-000018-3` (clave antigua `4611-4-000018`) — partida `00001` en `4611ADT031`, contenedor `CONTENE001`, precinto `PRECINTO01`
- `24-ES-004611-8-000019-1` (clave antigua `4611-4-000019`):
  - Partida `00001` en `4611VLC001` / `VLC002` con `CONTENE001`+`CONTENE002` y precintos `PRECINTO01`+`PRECINTO02`
  - Partida `00002` en `4611VLC001` sin contenedores

Sumarias H7:
- `26-ES-003571-8-000002-0` (clave `3571-6-000002`) — partida `00001` en `3571ADT001` (Canarias)
- `21-ES-002801-8-000026-4` (clave `2801-1-000026`) — partidas `00002` y `00004` en `2801EEEEEE`

### Exportacion
- Ubicacion sugerida: `2801AAAAAC`

## Correo original (11/Feb/2026)
Se solicito el alta del EORI `ESB22477020` y acceso a datos de pruebas para los 6 servicios (H1, H7, AES, NCTS5, ENS/ICS2, SOIVRE).

## Follow-up Luis (2/Mar/2026 10:21)
Reporto estado:
- **ENS** operativo (MRN `26ES009999Z0000030`, CSV `E695E89VCDSGKXSV`).
- **H1/H7/AES** bloqueados por `Codigo de Ubicacion no valido` (err 1180) contra recinto 009999.
- **NCTS** errores 1660 (recinto expedicion != ubicacion) y 1146 (UCR).
- **PUE/SOIVRE** `Error en formato de los datos` (10500), solicitamos XML valido.

## Estado actual (22/Abr/2026)
- H7: **DESBLOQUEADO** 21/Abr commit `d26eb84` con ubicacion `2801EEEEEE` y otros 3 defaults. MRN real `26ES00280130001ND8` canal verde.
- H1/AES/NCTS: con estos datos de Jose Antonio **se pueden probar** en PRE real.
- NCTS err 1146 (UCR) pendiente investigar en codigo.
- PUE/SOIVRE: sin respuesta sobre formato XML — sigue bloqueado.
