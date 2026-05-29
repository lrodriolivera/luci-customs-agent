# Enviar a AEAT y obtener un MRN

[← Flujos diarios](README.md) · [Índice](../README.md)

> Una vez la declaración está completa y firmada, falta enviarla. AEAT responde en segundos con un MRN, el canal asignado y, si todo va bien, el levante.

---

## Antes de empezar

- Declaración H1/H7/AES/NCTS/ENS en estado `DRAFT` o `READY`.
- **Certificado FNMT** importado en LUCI y vigente. Verifícalo en *AEAT e Integraciones → Certificados AEAT*.
- Conexión estable (el envío SOAP a AEAT con mTLS tarda 3-15s).

---

## Cómo funciona internamente

LUCI envía a AEAT siguiendo este flujo automático:

1. **Construye el XML** SOAP de la operación (H1XmlBuilder, H7XmlBuilder, etc.)
2. **Firma electrónicamente** el XML con tu certificado FNMT (XAdES)
3. **Establece TLS mutuo** (mTLS) con `prewww1.aeat.es` o `www1.aeat.es`
4. **POST** el SOAP firmado al endpoint del servicio (`SvDIDeclaracionH1V1.0.6` o equivalente)
5. **Recibe la respuesta** SOAP de AEAT
6. **Parsea**: extrae MRN, canal, código de error si lo hay
7. **Actualiza el expediente**: timeline, alertas, estado, documento de levante

Tú solo ves el resultado. Pero si algo falla, el [Monitor AEAT](../04-pantallas/aeat-integraciones.md#monitor-aeat) te muestra exactamente en qué paso se quedó.

---

## Pasos (lado del agente)

### 1. Pulsar «Enviar a AEAT»

Desde la página de la declaración (H1, H7, etc.), botón azul grande arriba a la derecha.

LUCI muestra un modal de confirmación:

> **¿Confirmas el envío a AEAT?**
>
> - Aduana: 2801 Madrid Barajas
> - Tipo: H1 importación
> - Declarante: ESB22477020 (STRIX AI SL)
> - Total tributos: 1.234,56 €
>
> [Cancelar] [Sí, enviar]

### 2. Esperar la respuesta

3 escenarios:

#### 🟢 OK — MRN asignado

```
✓ Declaración aceptada por AEAT

MRN: 26ES00280130001TT1
Canal: VERDE
Levante: AUTOMÁTICO
Fecha: 2026-04-22 13:45:30 UTC
```

Acciones siguientes:
- LUCI actualiza el estado del expediente a `MRN_ASSIGNED` o `RELEASED` según canal.
- Genera el **documento de levante** (PDF) — descargable desde *Documentos del expediente*.
- Añade entrada al timeline.

#### 🟠 Aceptada con condiciones — Canal naranja/rojo

```
✓ Declaración aceptada por AEAT

MRN: 26ESxxxxxxxxxxxxx
Canal: NARANJA — control documental
```

Acciones siguientes:
- LUCI te avisa con un badge naranja en el listado.
- Acude a [Inspecciones](../04-pantallas/control-aduanero.md) → tu MRN aparecerá en la pestaña *Pendientes*.
- Aporta los documentos que pida AEAT.

#### 🔴 Rechazada — Error AEAT

```
✗ Declaración rechazada

Código: 4404
Mensaje: La casilla 18 (identificación transporte) excede 17 caracteres
```

Acciones siguientes:
- LUCI **no** asigna MRN (todavía).
- Edita el campo problemático.
- Pulsa **Reenviar** (no es necesario regenerar el XML completo).

---

## Tabla de errores AEAT comunes

| Código | Mensaje | Causa | Solución |
|---|---|---|---|
| `1180` | NIF declarante no autorizado | EORI no apto para ese tipo declaración | Verificar; si OK pedir alta a AEAT |
| `2004` | Documento previo no existe | MRN/N337 referenciado inválido | Corregir o quitar |
| `2214` | Doc 7007 mal formado | Formato distinto a `YYYYMMDD-XXXXXXXX` | Corregir |
| `4404` | Casilla 18 longitud >17 | Identificación transporte demasiado larga | Recortar |
| `4405` | Código adicional erróneo (H7) | `C07` en vez de `F48` | Cambiar a `F48` |
| `1230` | Especificidad PUE incorrecta | Códigos SOIVRE/ROHS mal | Revisar tabla SOIVRE |
| `1090` | Garantía insuficiente | Monto declarado supera disponibilidad | Aumentar garantía o repartir |
| `9002` | Servicio AEAT temporal no disponible | Caída intermitente PRE | Reintentar 5-15 min |
| `CB Total Tributos` | Cabecera vs partidas no coinciden | Mapper LUCI mismatch | Reportar — corregido en versión actual |

---

## Si quieres re-enviar (modificación)

A veces necesitas modificar una declaración ya aceptada (cambio de valor, añadir mercancía, corregir TARIC).

Procedimiento:
1. Abre el expediente → pestaña Declaraciones.
2. Pulsa **Solicitud de modificación** sobre la declaración con MRN.
3. Indica el motivo y los campos a cambiar.
4. LUCI genera un nuevo XML AEAT de tipo «modificación» referenciando el MRN original.
5. **Enviar a AEAT**: si AEAT acepta, asigna nuevo MRN para la modificación; el original queda referenciado.

> No todas las modificaciones son aceptadas. AEAT puede rechazar si la mercancía ya tiene levante físico. Consulta normativa CAU art. 173.

---

## Monitor AEAT — vigilar tus envíos

LUCI tiene una pantalla dedicada para vigilar declaraciones recientes:

**Sidebar → AEAT e Integraciones → Monitor AEAT**

![Monitor AEAT](../img/aeat-monitor.png)

Muestra:
- **Declaraciones tracked** — las que has enviado en últimos 30 días, con su estado actual (esperando / aceptada / rechazada / canal X).
- **Estado del servicio AEAT** — si AEAT PRE/PROD está respondiendo o caído.
- **Alertas pendientes** — requerimientos, plazos próximos.
- **Auto-refresh cada 60 s** — sin necesidad de F5.
- **Botón Predecir Canal** (con LUCI IA) — antes de enviar, prueba a predecir el canal.

---

## Caso real

[Caso real: colchones Turquía → MRN verde aceptado por AEAT PRE](../06-casos-reales.md#1-h1-colchones-turquia).

Tras 4 iteraciones de error AEAT (casilla 18 longitud, doc 7007 formato, A00 ausente, declarante undefined), LUCI generó el XML correcto y AEAT respondió con `MRN: 26ES00280130001TT1`, canal verde, levante automático. Tiempo total desde el primer click «Enviar» hasta MRN: **47 segundos**.

---

[← Manifiesto CSV](manifiesto-csv-masivo.md) · [Siguiente: Responder requerimiento →](responder-requerimiento.md)
