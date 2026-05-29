# Procesar un manifiesto CSV masivo

[← Flujos diarios](README.md) · [Índice](../README.md)

> Cuando un courier (DHL, UPS, AirGo Express, Correos Express…) te manda un Excel/CSV con 30, 50 o 200 envíos, no los hagas uno a uno. Sube el manifiesto y LUCI los procesa todos en bloque.

---

## Antes de empezar

- El archivo CSV / XLSX del courier.
- Tener decidido si el manifiesto es **H7** (paquetería express ≤ 150 €) o **H1** (envíos de mayor valor o B2B).
- Tu EORI dado de alta para el tipo de declaración.

---

## Estructura mínima del CSV

LUCI espera estos **campos por columna** (admite variaciones de nombre, hace mapping automático):

| Columna | Tipo | Obligatorio |
|---|---|---|
| `tracking` o `referencia` | string | ✓ |
| `descripcion` | string | ✓ |
| `taric` | 10 dígitos | recomendado (si falta, IA lo predice) |
| `pais_origen` | ISO-2 | ✓ |
| `peso` | kg | ✓ |
| `cantidad` | número | ✓ |
| `valor` | EUR | ✓ |
| `moneda` | ISO-3 (`EUR`/`USD`) | si valor no es EUR |
| `destinatario_nombre` | string | ✓ |
| `destinatario_nif` | string | recomendado |
| `destinatario_direccion` | string | ✓ |
| `destinatario_pais` | ISO-2 | ✓ |
| `vendedor_nombre` | string | ✓ |
| `vendedor_ioss` | string | si aplica |
| `factura_numero` | string | ✓ |
| `factura_fecha` | YYYY-MM-DD | ✓ |

> Si no estás seguro del formato, puedes **descargar la plantilla** desde **Declaraciones → H7 → Importar manifiesto → Descargar plantilla CSV**.

---

## Pasos

### 1. Ir al importador de manifiestos

Sidebar → **Declaraciones → H7** → botón **Importar manifiesto** (icono ⬆).

![H7 manifiesto subido](../img/dashboard.png)

### 2. Subir el CSV

Arrastra el archivo o pulsa **Seleccionar archivo**. LUCI:
- Detecta el separador (coma, punto y coma, tab).
- Detecta el encoding (UTF-8, ISO-8859-1).
- Mapea las columnas automáticamente; si no reconoce alguna, te pide que la asocies manualmente.

### 3. Vista previa

LUCI muestra una tabla con las primeras 10 filas. Verás:
- **Filas válidas** (verdes) — listas para procesar.
- **Filas con avisos** (amarillas) — falta TARIC u otro dato no crítico. LUCI las puede completar.
- **Filas con errores** (rojas) — falta dato obligatorio. Edita o descarta.

### 4. Clasificación TARIC con IA

Para las filas sin TARIC, pulsa **Clasificar con IA**. Para cada descripción, LUCI propone:
- Top 3 códigos TARIC más probables.
- Confianza (alta / media / baja).
- Tiempo total ~10s por 30 filas.

Revisa las propuestas. Si la IA acierta, **Aplicar**. Si tiene baja confianza (<30%), **Revisar manualmente** y tú lo decides.

### 5. Predicción de circuito (opcional)

Antes de declarar a AEAT, puedes pulsar **Predecir circuitos** para que el modelo ML te diga qué porcentaje de envíos caerá en cada canal:

- 70% verde
- 17% naranja
- 5% rojo
- 4% amarillo
- 4% otros

Útil para anticipar carga de trabajo de inspección.

### 6. Crear las H7 en bloque

Pulsa **Crear declaraciones**. LUCI crea una H7 por cada fila válida en estado `DRAFT`. Aparecerán en el listado **Declaraciones → H7** con tu prefijo de manifiesto (ej. `LUCI-MOK-001` a `LUCI-MOK-030`).

### 7. Enviar a AEAT en lote

Selecciona las que quieres enviar (checkbox) → botón **Enviar selección a AEAT**. LUCI las envía en paralelo (5 a la vez para no saturar).

Para cada una, verás:
- 🟢 OK + MRN obtenido
- 🟠 Error AEAT + código
- ⏱ Pendiente (todavía procesando)

> Si alguna falla por dato concreto (ej. EORI destinatario inválido), corrígela individualmente y reenvía.

---

## Si algo falla

| Problema | Causa | Solución |
|---|---|---|
| LUCI no detecta las columnas | El header tiene nombres no estándar | Edita el CSV (`tracking,descripcion,taric,...`) o haz mapping manual en el wizard |
| 50% filas con TARIC «baja confianza» | Descripciones genéricas («producto», «artículo») | Pide al courier descripción mejor; si no es posible, marca esas H7 como manuales y revisa una por una |
| AEAT rechaza la mitad por NIF declarante | Tu EORI no autoriza H7 todavía | Solicita alta — entretanto, LUCI cae a MRN simulado en PRE |
| Duplicados | Subiste dos veces el mismo CSV | LUCI detecta por hash + tracking; te pregunta si reemplazar |
| El CSV está en xlsx con varias hojas | Solo procesa la primera | Guarda como CSV o asegúrate de que la hoja correcta es la primera |

---

## Caso real

[Caso real: H7 manifiesto bufanda lana → MRN verde](../06-casos-reales.md#3-h7-bufanda-manifiesto) — 5 envíos procesados en 1 m 30 s, IA clasifica todos a TARIC `6117100090` correctamente, todos canal verde con levante automático.

---

[← H7 e-commerce](declarar-h7-ecommerce.md) · [Siguiente: Enviar a AEAT →](enviar-aeat-y-mrn.md)
