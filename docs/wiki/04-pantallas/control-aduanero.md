# Pantallas — Control aduanero

[← Pantallas](README.md) · [Índice general](../README.md)

> Donde gestionas la **interacción con AEAT** una vez la mercancía está bajo control: inspecciones, plazos, comunicaciones formales, consultas oficiales.

---

## Inspecciones

Ver detalle en [Pantallas → Operaciones → Inspecciones](operaciones.md#inspecciones). El acceso desde **Control aduanero** muestra la misma pantalla con foco en las inspecciones programadas o en curso.

---

## Plazos

Ver detalle en [Pantallas → Operaciones → Plazos](operaciones.md#plazos). Lo importante:

- **Calendario unificado** de fechas límite cruzadas (requerimientos / inspecciones / recursos / garantías).
- 18 vencidos / 8 pendientes en este tenant.
- Filtros por categoría, estado, rango fechas.
- Modal Crear / Extender un plazo (manual o por prórroga AEAT).

---

## Comunicaciones

Ver detalle en [Pantallas → Operaciones → Comunicaciones](operaciones.md#comunicaciones). Datos clave:

- 3 tabs: Dashboard / Todas / Recursos.
- 12 tipos de comunicación, 13 estados.
- 4 stats cards: Pendientes 2 / Vencidas 3 / Esperando respuesta 3 / Recursos activos 8.
- 15 comunicaciones totales agrupadas en 4 categorías (Coordinación / Recursos / Solicitudes / Respuestas).

---

## Consultas ADDS-JDIT

**Ruta**: `/queries`

![Consultas ADDS](../img/consultas-adds.png)

### Para qué sirve

Hacer **consultas oficiales** al servicio AEAT ADDS-JDIT (Administración de Datos para el Despacho — Junta Inspección Tributaria). Útil para resolver dudas de un MRN ajeno, verificar EORI de un proveedor, localizar un contenedor.

### 6 servicios disponibles

| Servicio | Qué consulta | Inputs |
|---|---|---|
| **MRN** | Estado de cualquier declaración por su MRN | MRN |
| **Container** | Tránsitos / movimientos asociados a un contenedor | Número contenedor (BIC) |
| **EORI** | Datos de un operador económico | Número EORI |
| **Sumaria** | Sumarias asociadas a un movimiento | Referencia sumaria |
| **Garantía** | Estado de una garantía | GRN |
| **Histórico** | Tu historial de consultas | filtros fecha + tipo |

### Cómo se usa

1. Selecciona el tipo de consulta (radio buttons arriba).
2. Rellena el input.
3. Pulsa **Consultar**.
4. LUCI envía SOAP firmado al servicio ADDS y devuelve la respuesta estructurada.

### Caso real

Consulta MRN: input `26ES00280130001TT1` → 2 resultados en 272ms (estado declaración + canal + levante).

### Bug histórico (corregido)

> En versiones anteriores TODAS las consultas devolvían HTTP 500 por dos bugs encadenados:
> 1. `pre('save')` en Mongoose corría tras la validación `required: true` → `queryId` siempre fallaba. Fix: cambiar a `pre('validate')`.
> 2. `metadata.environment` enum solo aceptaba `['sandbox','production']` pero el `.env` real usa `AEAT_ENVIRONMENT=test`. Fix: ampliar enum.

---

## Atajos útiles

- Desde Inspecciones → click sobre MRN → te lleva al expediente y tab Documentos para aportar lo que pida el inspector.
- Desde Plazos → click sobre un requerimiento → te lleva a [Responder requerimiento](../03-flujos-diarios/responder-requerimiento.md).
- Desde Comunicaciones → enviar nueva → puedes adjuntar docs del expediente directamente.
- Desde Consultas → si el MRN consultado es tuyo → te lleva al expediente.

---

[← Cálculo y normativa](calculo-normativa.md) · [Siguiente: Regímenes →](regimenes.md)
