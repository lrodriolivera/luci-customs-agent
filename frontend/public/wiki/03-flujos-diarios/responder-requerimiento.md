# Responder un requerimiento

[← Flujos diarios](README.md) · [Índice](../README.md)

> Cuando AEAT no acepta tu declaración tal cual o necesita verificar algo, te envía un **requerimiento**. Tienes que responder en plazo (típicamente 10 días hábiles) aportando lo que pida o aclarando.

---

## Tipos de requerimiento

| Tipo | Qué te pide AEAT | Plazo típico |
|---|---|---|
| **Documental** | Factura original, contrato, certificado origen, etc. | 10 días hábiles |
| **Aclaración** | Justificar valor declarado, clasificación TARIC, origen | 10 días hábiles |
| **Inspección física** | Acudir a la aduana para que abran la mercancía | Cita en 2-5 días |
| **Aforo** | Verificar valor sin abrir bulto | 5-10 días hábiles |
| **Análisis laboratorio** | Toma de muestra (alimentos, químicos) | 30 días o más |

---

## Cómo te llega

Tres canales:

1. **Email** automático si tienes notificaciones activadas (*Configuración → Notificaciones*).
2. **Badge rojo** en el sidebar junto a *Operaciones → Requerimientos*.
3. **Pop-up** del [Monitor AEAT](../04-pantallas/aeat-integraciones.md#monitor-aeat) si lo tienes abierto.

---

## Pasos

### 1. Abrir el requerimiento

Sidebar → **Operaciones → Requerimientos**.

Verás un listado con:
- Referencia (R-2026-NNNN).
- MRN o expediente afectado.
- Tipo (documental / aclaración / inspección).
- Plazo restante (con badge rojo si quedan < 48 h).
- Estado (`PENDIENTE`, `RESPONDIDO`, `RESUELTO`).

Pulsa una fila para abrir el detalle.

### 2. Leer la solicitud

LUCI muestra:

- **Texto literal** que envió AEAT (escaneado o transcrito si llegó por XML AEAT-DUA).
- **Campos solicitados**: una lista estructurada de qué documentos / datos pide.
- **Vencimiento**: fecha límite + cuenta atrás visual.

### 3. Análisis con IA (recomendado)

Si te has quedado bloqueado leyendo el requerimiento jurídico, pulsa **Analizar con LUCI** (botón violeta arriba):

> «Te resumo qué pide AEAT y te sugiero los documentos necesarios:
> 1. Factura original con sello del proveedor (ya la tienes en docs).
> 2. Contrato de compraventa del 12/03/2026 — falta. Pídelo al cliente.
> 3. Justificación del valor de los m² declarados.»

Tienes en menos de 30 s una guía clara.

### 4. Recopilar y aportar documentos

En la pestaña **Documentos** del requerimiento:
- **+ Subir archivo** (PDF, JPG, PNG, hasta 10 MB cada uno).
- LUCI valida tipo / formato.
- Marca cada doc con su categoría (factura, contrato, certificado origen, etc.).

### 5. Redactar la respuesta

Tienes dos opciones:

#### Opción A — Plantilla automática IA

Pulsa **Generar respuesta con IA**. LUCI redacta un texto formal en español dirigido a AEAT, citando los artículos del CAU que respaldan tu posición y enumerando los documentos aportados. Lo revisas, ajustas, y listo.

#### Opción B — Redacción manual

Editor rich text con plantillas predefinidas (Aclaración valor / Aclaración clasificación / Aporte documental). Rellena tú directamente.

### 6. Firmar y enviar

Pulsa **Firmar y enviar respuesta**. LUCI:
- Construye el XML AEAT-EnvioDocumentosV1.5.
- Firma con tu certificado FNMT.
- Envía por mTLS al servicio de respuesta a requerimientos.
- Te muestra el justificante con número de registro.

### 7. Esperar y monitorizar

Tras enviar, AEAT puede:

- **Aceptar** y dar levante (canal pasa a verde) — recibes notificación en 1-3 días.
- **Pedir más** — nuevo requerimiento (la cuenta atrás se reinicia).
- **Rechazar** definitivamente — la mercancía no obtiene levante. Tú decides si recurres (vía sección *Recursos*) o reexpides.

---

## Si AEAT te llama a inspección física (canal rojo)

1. La cita aparece en **Inspecciones** del sidebar.
2. LUCI te muestra fecha, hora, aduana, número de funcionario asignado.
3. Confirma la cita pulsando **Confirmar asistencia** o solicita aplazamiento (con motivo).
4. El día de la inspección:
   - Acude con DNI + el código MRN impreso.
   - El funcionario abre la mercancía, comprueba.
   - Tras la inspección, AEAT actualiza el estado del MRN (LUCI te lo refleja en el timeline).

---

## Si algo falla

| Problema | Causa | Solución |
|---|---|---|
| **Plazo vencido** y no respondiste | Olvido / no llegó email | Si en plazo de gracia (5 días post-vencimiento), envía igual con disculpa formal. Pasado eso, AEAT puede dar **rechazo definitivo** y aplicar sanciones |
| El portal de respuesta dice «documento no aceptado» | Formato inválido (ZIP, RAR) | Convierte a PDF |
| LUCI no puede firmar — «certificado expirado» | Tu cert FNMT venció | Renuévalo en FNMT, importa el nuevo en *Certificados AEAT* |
| AEAT contesta «documento ilegible» | PDF de mala calidad / escaneo torcido | Re-escanea a 300 dpi mínimo |

---

## Plazos importantes (recuerda)

- **10 días hábiles** = aprox 2 semanas naturales.
- Días hábiles excluyen sábados, domingos y festivos nacionales (no autonómicos a efectos AEAT).
- Si el último día cae en festivo, se prorroga al siguiente hábil.
- LUCI calcula el deadline real considerando el calendario.

---

## Tip productivo: alertas anticipadas

En *Configuración → Notificaciones* activa:
- **Recordatorios de plazos** — email a 5 días, 2 días, 1 día y 4 horas del vencimiento.
- **Alertas de canal naranja/rojo** — push inmediato cuando AEAT responda con canal no verde.

Así nunca se te pasa un plazo.

---

[← Enviar a AEAT](enviar-aeat-y-mrn.md) · [Siguiente: Calcular derechos →](calcular-derechos.md)
