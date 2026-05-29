# 7. Atajos y trucos

[← Volver al índice](README.md)

> Trucos para ir más rápido, evitar errores comunes y aprovechar funciones que no son obvias a primera vista.

---

## Productividad pura

### 1. Crea siempre el expediente primero

El flujo desde expediente desbloquea automatismos que el formulario directo no tiene:
- Auto-relleno de campos comunes en H1/H7/AES.
- Validación cruzada (peso vs cantidad, valor vs TARIC).
- Sugerencia de docs faltantes.
- Cálculo automático de tributos.

### 2. Pre-valida antes de enviar a AEAT

Antes de pulsar **Enviar a AEAT**, ejecuta SIEMPRE estos 3 pasos:

1. [Predecir canal](05-asistente-luci-ia.md#2-prediccion-de-circuito-verdenaranjarojo-amarillo) — ahorra sorpresas.
2. [Análisis de fraude](05-asistente-luci-ia.md#3-deteccion-de-fraude) — flag temprano.
3. [Inconsistencies](05-asistente-luci-ia.md#4-analisis-de-expediente-con-luci) — caza errores antes que AEAT.

### 3. Usa manifiestos masivos siempre que puedas

Para volúmenes ≥ 5 envíos, el flujo CSV + IA + lote es 10-50× más rápido. [Detalle](03-flujos-diarios/manifiesto-csv-masivo.md).

### 4. Cachea TARIC frecuentes

Si manejas 20-30 productos repetidamente, créate una **tabla de referencia personal** con sus TARIC + características:
- Capítulo / partida.
- TARIC final.
- Tipo MFN.
- Acuerdos preferenciales aplicables.
- IIEE si aplica.

LUCI no tiene aún la pantalla «Mis productos favoritos», pero puedes:
- Guardar plantillas de H1 → tu próxima H1 prerrellena ya el TARIC, peso típico, etc.
- Usar el campo **Referencia interna** del expediente con un código mnemónico (ej. `COLCHON-TR-2M`).

---

## Filtros y búsqueda

### Búsqueda libre en Expedientes

El campo de búsqueda en `/expeditions` busca simultáneamente en:
- ID expediente
- NIF / EORI importador
- Razón social
- MRN
- Descripción mercancía
- Referencia interna

### Filtros combinados

Puedes combinar múltiples filtros: estado **+** tipo **+** rango fechas **+** búsqueda libre. Cada filtro reduce el resultado.

### Exportar la lista filtrada

Botón **Exportar CSV** descarga exactamente lo que ves en pantalla (con tus filtros aplicados). Útil para informes a cliente.

---

## URLs directas

LUCI tiene URLs estables. Puedes guardar marcadores:

| Acción | URL |
|---|---|
| Lista expedientes | `/expeditions` |
| Detalle de expediente concreto | `/expeditions/{id}` |
| Nuevo H1 directo | `/declarations/h1/new` |
| Importar CSV H7 | `/h7/import` |
| Calculadora derechos | `/calculator` |
| Monitor AEAT | `/aeat/monitor` |
| Configuración | `/settings` |

---

## Selector de idioma

Esquina superior derecha. 7 idiomas:

🇪🇸 ES · 🏴 CA · 🏴 VA · 🇬🇧 EN · 🇫🇷 FR · 🇮🇹 IT · 🇵🇹 PT

El idioma elegido se guarda en tu sesión. Útil:
- ES para uso normal.
- EN si tu cliente final habla inglés y quieres compartirle pantalla.
- CA / VA si operas en zona catalano-valenciana.

---

## Atajos del teclado

LUCI no tiene atajos custom todavía, pero estos del navegador funcionan:

| Combinación | Acción |
|---|---|
| `Ctrl+F` | Buscar en la página actual |
| `Ctrl+R` | Recargar (LUCI usa cache local — no perderás el formulario) |
| `Ctrl+W` | Cerrar pestaña |
| `F11` | Pantalla completa (más espacio para tablas grandes) |
| `Ctrl++` / `Ctrl+-` | Zoom in/out |

---

## Recordatorios automáticos

En **Configuración → Notificaciones**, activa:

- **Email Alerts** — para canal naranja/rojo y rechazos AEAT.
- **Recordatorios Plazos** — emails a 5/2/1 día y 4 horas del vencimiento.
- **Notificaciones Canal** — push inmediato al asignar canal.
- **Reporte Semanal** — resumen lunes con KPIs del tenant.

Cada uno se activa/desactiva con un toggle.

---

## Trucos avanzados

### 1. Predecir canal en lote

En `/aeat/monitor` puedes predecir el canal de **todas** tus declaraciones DRAFT antes de enviarlas. Así anticipas qué carga de inspección esperar mañana.

### 2. Comparar dos TARIC

Dile al asistente: «Compara TARIC 9404211000 con 9404219000» y te enseña una tabla con las diferencias (descripción, MFN, IVA, IIEE).

### 3. Auto-respuesta a notificaciones AEAT

Si te llega un requerimiento estándar (aporte de factura, aclaración valor), pulsa **Generar respuesta con IA** y obtienes un borrador profesional en 30s. Solo te falta firmar.

### 4. Cache offline ligero

Las pantallas de **Calculadora**, **Preferencias**, **Normativa** funcionan parcialmente sin conexión: la última vez que las cargaste, los datos quedan en cache local del navegador. Útil si la conexión es lenta.

### 5. Revisión cruzada con el asistente

Cuando tengas un MRN problemático o un caso difícil, abre el chat y di:

> *«Estoy con el expediente EXP-2026-XYZ123. Tengo un canal naranja por requerimiento documental. ¿Qué documentos suelen pedir AEAT en esta situación con TARIC 9404 origen TR?»*

LUCI te da una lista priorizada basada en el histórico real del tenant.

---

## Métricas a vigilar

Como agente, mira semanalmente:

| Métrica | Dónde | Objetivo |
|---|---|---|
| **Tasa error declaraciones** | Analytics → Cumplimiento | < 2% |
| **% canal verde** | Analytics → Visión General | > 70% |
| **% requerimientos respondidos en plazo** | Plazos | > 95% |
| **Garantías al > 80%** | Garantías | 0 |
| **Brecha entre derechos calculados y pagados** | Analytics IA Insights | < 5% |

Si alguna se aleja del objetivo, [pídele a LUCI un informe ejecutivo](05-asistente-luci-ia.md#7-insights-de-analytics-y-bi).

---

## Errores que NO debes cometer

❌ Enviar a AEAT sin haber revisado los avisos amarillos de LUCI.
❌ Aceptar el TARIC sugerido por IA sin leer la confianza (si < 70%, valida manualmente).
❌ Subir un certificado FNMT y olvidarte de comprobar la fecha de vencimiento.
❌ Responder un requerimiento el último día, sin tiempo de revisión.
❌ Crear H7 individual cuando tienes un manifiesto.
❌ Olvidar el certificado origen en preferencias arancelarias (luego AEAT cobra MFN y es más caro).

---

## Cosas que no se ven a primera vista

🔍 El **timeline** del expediente registra TODO lo que pasa: creación, docs, declaración, MRN, requerimientos, comunicaciones. Si te preguntan qué pasó hace 3 semanas, busca aquí primero.

🔍 El asistente IA **recuerda el contexto** de tu navegación. Si abres un MRN y luego le preguntas «¿está en plazo?», entiende a qué te refieres.

🔍 Las **alertas del Dashboard** son interactivas. Click sobre cualquier alerta → te lleva al expediente afectado.

🔍 El botón **+ Crear PUE asociada** desde una H1 con MRN → wizard PUE prerrellenado con todos los datos del importador, mercancía, etc.

🔍 En **Garantías**, una barra cerca del 100% es un riesgo: las próximas declaraciones podrán ser rechazadas. Activa la alerta al 80% en notificaciones.

---

[← 06. Casos reales](06-casos-reales.md) · [Índice](README.md) · [Siguiente: 08. FAQ →](08-faq-soporte.md)
