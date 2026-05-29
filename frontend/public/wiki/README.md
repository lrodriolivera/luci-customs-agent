# Manual del Agente Aduanero — LUCI

> **LUCI Customs Agent** es la plataforma que utilizas todos los días para gestionar expedientes aduaneros, presentar declaraciones a la AEAT y resolver requerimientos. Esta wiki está pensada para que cualquier agente — con o sin experiencia técnica — pueda sacarle el máximo partido.

---

## Cómo usar este manual

- **Si es tu primer día** → empieza por [01. Empezando](01-empezando.md)
- **Si necesitas repasar un término** → consulta el [02. Glosario aduanero](02-glosario-aduanero.md)
- **Si quieres aprender un flujo concreto** → mira [03. Flujos diarios](03-flujos-diarios/)
- **Si te has perdido en una pantalla** → busca en [04. Pantallas](04-pantallas/)
- **Si quieres saber qué puede hacer la IA por ti** → [05. Asistente LUCI e IA](05-asistente-luci-ia.md)

---

## Índice

### Conceptos básicos

1. [Empezando con LUCI](01-empezando.md) — login, recorrido inicial, sidebar, idiomas.
2. [Glosario aduanero rápido](02-glosario-aduanero.md) — DUA, MRN, EORI, TARIC, circuitos, CAU.

### Tu día a día

3. **[Flujos diarios](03-flujos-diarios/)** — el «cómo hago X»
   - [Crear un expediente](03-flujos-diarios/crear-expediente.md)
   - [Declarar una H1 de importación](03-flujos-diarios/declarar-h1-importacion.md)
   - [Declarar una H7 de e-commerce](03-flujos-diarios/declarar-h7-ecommerce.md)
   - [Procesar un manifiesto CSV masivo](03-flujos-diarios/manifiesto-csv-masivo.md)
   - [Enviar a AEAT y obtener un MRN](03-flujos-diarios/enviar-aeat-y-mrn.md)
   - [Responder un requerimiento](03-flujos-diarios/responder-requerimiento.md)
   - [Calcular derechos arancelarios](03-flujos-diarios/calcular-derechos.md)

### Pantalla por pantalla

4. **[Pantallas de LUCI](04-pantallas/)** — qué hace cada pestaña
   - [Operaciones](04-pantallas/operaciones.md) — Dashboard, Expedientes, Circuitos, Requerimientos
   - [Declaraciones](04-pantallas/declaraciones.md) — H1, H7, AES, ENS, NCTS, PUE
   - [Cálculo y normativa](04-pantallas/calculo-normativa.md) — TARIC, derechos, preferencias, IIEE, contingentes, normativa
   - [Control aduanero](04-pantallas/control-aduanero.md) — Inspecciones, plazos, comunicaciones, consultas ADDS
   - [Regímenes aduaneros](04-pantallas/regimenes.md) — especiales, garantías, OEA, tránsitos
   - [AEAT e integraciones](04-pantallas/aeat-integraciones.md) — certificados FNMT, monitor, NL, integraciones
   - [Administración](04-pantallas/administracion.md) — Analytics, ML Insights, Settings, Admin

### Inteligencia artificial

5. [Asistente LUCI e IA](05-asistente-luci-ia.md) — chat, clasificación TARIC, predicción de circuito, detección de fraude, redacción de respuestas.

### Referencia

6. [Casos reales](06-casos-reales.md) — 4 MRN reales obtenidos en pruebas, paso a paso.
7. [Atajos y trucos](07-atajos-y-trucos.md) — filtros, búsqueda, productividad.
8. [FAQ y soporte](08-faq-soporte.md) — errores comunes y cuándo escalar.

---

## Datos del entorno

| | |
|---|---|
| **URL plataforma** | `https://aduanas.strixai.es` |
| **Cliente** | STRIX AI SL (NIF B22477020 — EORI ESB22477020) |
| **AEAT entorno actual** | PRE (pre-producción) — `prewww1.aeat.es` |
| **Idiomas disponibles** | Español, Catalán, Valencià, English, Français, Italiano, Português |
| **Soporte** | `soporte@strixai.es` |

> **Aviso:** estás en entorno de **pre-producción AEAT**. Las declaraciones que envíes son técnicamente reales (firma electrónica con certificado FNMT, mTLS, MRN auténtico) pero **no producen liberación aduanera real de mercancía** ni cobros — sirven como ensayo de la integración. Cuando STRIX migre a producción, el flujo será idéntico.

---

## Convenciones de este manual

- **Negrita** → nombre exacto de un botón, una pestaña o un campo.
- `Monoespaciada` → código TARIC, MRN, NIF, EORI o URL.
- > Bloques tipo cita → notas, advertencias, recordatorios legales.
- 🟢 🟠 🔴 🟡 → circuitos verde / naranja / rojo / amarillo.

---

*Última actualización: 5 de mayo de 2026 · Versión 1.0*
