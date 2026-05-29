# 8. FAQ y soporte

[← Volver al índice](README.md)

> Las preguntas más frecuentes con respuestas concisas. Si no encuentras la tuya, escribe a `soporte@strixai.es`.

---

## Acceso y cuentas

### He olvidado mi contraseña

Pide a un administrador que pulse **Restablecer contraseña** en `/admin → Usuarios`. Recibirás una contraseña temporal por email; cámbiala al primer login.

### No veo algunas pantallas en el sidebar

Tu rol no tiene permiso. Los roles disponibles:

- **Admin** — todo.
- **Supervisor** — todo excepto gestión de usuarios y configuración tenant.
- **Agent** — operaciones, declaraciones, cálculo y consultas.
- **Viewer** — solo lectura.

Pide a un admin que te asigne el rol adecuado.

### ¿Puedo acceder desde el móvil?

LUCI es responsive — funciona en móvil/tablet. Pero para flujos largos (H1 directo con 60 campos) es mucho más cómodo desde escritorio.

---

## Expedientes

### El campo TARIC me marca rojo «no encontrado»

Probablemente:
- Has tecleado solo 8 dígitos (es CN, no TARIC). LUCI espera 10 dígitos.
- Has incluido espacios o guiones (`8471 30 00 00`). Solo dígitos.
- El TARIC está mal recordado. Usa la sugerencia IA con la descripción del producto.

### LUCI no me deja crear expediente

Posibles causas:
- Tu rol es `viewer`. Necesitas `agent` o superior.
- Tienes el campo «EORI importador» mal formateado (debe ser `ES + NIF` para España).
- El NIF/EORI no existe en la BD AEAT — verifícalo con tu cliente.

### He creado un expediente y no aparece en la lista

Refresca la página (Ctrl+R). Si sigue sin verse:
- Comprueba el filtro «Estado» — quizá lo creaste como DRAFT y tienes filtro «Solo enviados».
- El expediente puede pertenecer a otro tenant (si tienes multi-tenant, cambia desde tu menú de usuario).

---

## Declaraciones

### ¿Diferencia entre H1 y H7?

| | H1 | H7 |
|---|---|---|
| Valor | > 150 € (o cualquier valor con control) | ≤ 150 € e-commerce |
| Campos | 60 | 25 |
| Carácter | B2B / cualquier | B2C |

Detalle: [Glosario → Tipos declaración](02-glosario-aduanero.md#tipos-de-declaracion).

### AEAT me ha rechazado con código `1180`

Significa «NIF declarante no autorizado». Causas posibles:
- Tu EORI no está dado de alta para ese tipo de declaración (típico en H7 si pides H1).
- Tu certificado FNMT no coincide con el EORI declarante.

Soluciones: contactar AEAT para alta del operador, o usar un EORI que sí esté autorizado.

### He generado el XML pero no se envía

Comprueba en el [Monitor AEAT](04-pantallas/aeat-integraciones.md#monitor-aeat) si el servicio está online. Si está caído (raro), reintenta en 5-15 min. Si LUCI no logra firmar, mira el certificado FNMT en `/aeat/certificates`.

### Mi H7 ha tenido MRN simulado en vez de real

En entorno PRE actual, AEAT rechaza H7 de algunos NIF declarantes. LUCI cae a un fallback simulado. **En producción real funcionará** (si tu EORI está autorizado).

---

## TARIC y aranceles

### ¿Cómo sé si mi TARIC es correcto?

Tres formas:
1. **TARIC EU oficial**: <https://taric-europa.ec.europa.eu>.
2. **Asistente LUCI**: «Verifícame TARIC 9404211000 para colchones espuma».
3. **Calculadora LUCI**: introduce el código y verifica que la descripción y el cap. tienen sentido.

### ¿Por qué LUCI me sugiere un TARIC distinto al que yo había clasificado manualmente?

LUCI propone basándose en el modelo entrenado con histórico de clasificaciones. Si la confianza es alta (> 90%), normalmente la IA tiene razón. Pero si tienes información que la IA no (composición exacta, uso específico no obvio), tu clasificación puede ser correcta.

**Mejor**: pulsa «Ver alternativas» en el resultado IA. Si tu código aparece en TOP-3, probablemente es válido. Si no aparece, vale la pena revisarlo.

### ¿Por qué me cobran MFN si tengo certificado origen?

Probablemente:
- Olvidaste poner el código de preferencia en casilla 36.
- El certificado origen aportado no se ha vinculado a la declaración.
- El acuerdo preferencial no aplica para ese país-TARIC concreto (ej. ITA solo para algunas TICs).

Comprueba en [Preferencias arancelarias](04-pantallas/calculo-normativa.md#calculadora-de-preferencias-arancelarias).

---

## Inteligencia artificial

### ¿LUCI envía mis datos a OpenAI/terceros?

No. LUCI usa Claude (Anthropic) y modelos propietarios. La integración pasa por API directa con cifrado en tránsito y reposo. PII sensible (nombres, NIF, direcciones) viaja cifrada AES-256-GCM.

### El asistente me responde cosas raras o no entiende mi pregunta

- Reformula con más contexto («en mi expediente EXP-X… qué hago para…»).
- Asegúrate de estar en el idioma correcto (selector arriba).
- Si el problema persiste, ese caso es valioso → reporta a soporte para mejorar el modelo.

### La predicción de canal me dice ROJO con 80% confianza, pero la mercancía es totalmente normal

Posibles factores:
- Origen alto riesgo (CN, IR, KP, RU, BY, AF, IQ, LY, SY, YE).
- TARIC sensible (armas, explosivos, sustancias controladas).
- Operador con histórico de incidencias.
- Valor anormalmente bajo respecto al mercado.

Aún así, la predicción es **probabilística** — no determinista. Puedes proceder; AEAT decide al final. Si tienes documentación sólida, no te preocupes.

---

## Comunicaciones AEAT

### ¿Tengo que responder TODAS las comunicaciones AEAT?

Las que tengan **plazo asignado**, sí (se ven en `/deadlines`). Las informativas no requieren respuesta.

### He respondido un requerimiento pero AEAT pide más

Es normal. AEAT puede pedir aclaraciones adicionales hasta resolver. La cuenta atrás se reinicia con cada nuevo requerimiento. Entre ellos, sigue tu trabajo normal.

### ¿Puedo recurrir un canal rojo?

Una vez asignado, no se puede cambiar. Pero si tras inspección AEAT no encuentra problema, devolverá el resultado «sin incidencias» y la próxima vez con el mismo perfil de operación es más probable canal verde.

Si la inspección revela una **liquidación complementaria** (pagar más derechos), sí puedes recurrir mediante:
- Recurso de reposición (15 días).
- Reclamación económico-administrativa (1 mes).

LUCI te ayuda a redactar estos en `/communications → Recursos`.

---

## Errores técnicos

### «Algo salió mal» — error boundary

Recargar página (Ctrl+R) suele resolver. Si persiste, captura URL + hora + qué estabas haciendo y reporta a soporte.

### LUCI dice «Sin verificar» en el Monitor AEAT

Significa que la declaración fue enviada pero AEAT no ha respondido aún (o LUCI no ha consultado el estado). Pulsa el botón Refresh por fila para forzar consulta a AEAT.

### El cálculo de derechos da un valor que no me cuadra

Comprueba:
- TARIC correcto (10 dígitos exactos).
- Origen correcto (puede haber preferencia que no se está aplicando).
- Valor declarado en EUR (si era USD, ¿conversión correcta?).
- Si tienes contingente disponible — LUCI lo aplica solo si lo solicitas explícitamente (casilla 36).

---

## Volúmenes y rendimiento

### ¿Cuántas declaraciones por hora puedo procesar?

Sin manifiesto: ~6-10 H1 / hora trabajando solo, ~12-20 H7 / hora.

Con manifiesto CSV: 100-200 H7 en 5-10 minutos (incluyendo IA + envío AEAT en lote).

### ¿Hay límite de uso de IA?

Muchos prompts al asistente, sí — para evitar abuso. Si llegas al límite, espera 5 minutos. Para uso intensivo, contacta soporte.

### El Dashboard tarda mucho en cargar

Los KPIs llaman a IA (Claude analiza tus datos). 30-60 segundos es normal en primera carga; después se cachea en Redis durante 5 minutos.

---

## Cuándo escalar a soporte

| Situación | A quién |
|---|---|
| Bug LUCI («Algo salió mal», pantalla rota, función que no responde) | `soporte@strixai.es` con captura + URL + hora |
| Duda funcional aduanera (no es bug) | Asistente LUCI + esta wiki |
| AEAT me da error que no entiendo | Asistente LUCI: «Explícame el error AEAT código 1180» |
| Mi certificado FNMT no se valida | `soporte@strixai.es` urgente — bloquea envíos |
| Cambio en mi rol/permisos | Tu administrador del tenant (no a soporte) |
| Solicitar nueva integración con sistema externo | `soporte@strixai.es` con caso de uso |

---

## Datos de contacto

| | |
|---|---|
| **Soporte general** | <soporte@strixai.es> |
| **Comercial** | <rodrigo.godoy@strixai.es> |
| **Tech Lead** | <luis.rodriguez@strixai.es> |
| **CEO / Representante legal** | <jenifer.romero@strixai.es> |
| **Plataforma** | <https://aduanas.strixai.es> |

Horario de soporte: L-V 9:00-18:00 CET. Incidencias críticas (caída, no se puede declarar): respuesta < 2 h.

---

## Última recomendación

LUCI mejora con el uso. Si encuentras un flujo que sería útil automatizar, una pantalla que te falta o un error frecuente, **dilo**. La hoja de ruta del producto está abierta a feedback de los agentes que lo usan a diario.

---

[← 07. Atajos y trucos](07-atajos-y-trucos.md) · [Volver al índice](README.md)
