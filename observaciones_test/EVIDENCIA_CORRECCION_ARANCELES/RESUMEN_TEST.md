# Evidencia Correccion Aranceles - Test End-to-End

**Fecha:** 2026-03-23 11:06 UTC-3
**Entorno:** Produccion (https://aduanas.strixai.es)
**Tester:** API test automatizado contra produccion AWS

---

## Problema reportado

Los 5 codigos TARIC reportados por testers mostraban **0% arancel** cuando debian tener tasas MFN reales.

**Causa raiz:** La descarga inicial de codigos TARIC (UK Trade Tariff API) solo trajo descripciones, no tasas arancelarias. El campo `duties.thirdCountry` quedaba en 0 por defecto.

## Solucion aplicada

1. Script `downloadEUDutyRates.js` creado para descargar tasas MFN reales desde el **EU TARIC oficial** (ec.europa.eu/taxation_customs/dds2/taric)
2. **16,093 codigos** actualizados con tasas reales (11,742 con arancel > 0%)
3. Deploy realizado en AWS produccion

## Resultados Test

| # | TARIC | Producto | Antes | Ahora | Esperado | Estado |
|---|-------|----------|-------|-------|----------|--------|
| 1 | 9505900000 | Articulos navideños | 0% | **2.7%** | 2.7% | PASS |
| 2 | 8301600090 | Cerraduras partes | 0% | **2.7%** | 2.7% | PASS |
| 3 | 3926909790 | Articulos plastico | 0% | **6.5%** | 6.5% | PASS |
| 4 | 3824999699 | Productos quimicos | 0% | **6.5%** | 6.5% | PASS |
| 5 | 4408909500 | Chapas madera >1mm | 0% | **4.0%** | 4.0% | PASS |

## Detalle por codigo

### ERROR 1 - TARIC 9505900000 (Articulos navideños)
- Valor aduanero: 1000 EUR | Origen: CN
- Arancel MFN: **2.7%** → 27.00 EUR
- IVA 21% sobre 1027 EUR → 215.67 EUR
- **Total a pagar: 1,242.67 EUR**
- Fuente: local_db | Confianza: 95%

### ERROR 2 - TARIC 8301600090 (Cerraduras partes)
- Valor aduanero: 1000 EUR | Origen: CN
- Arancel MFN: **2.7%** → 27.00 EUR
- IVA 21% sobre 1027 EUR → 215.67 EUR
- **Total a pagar: 1,242.67 EUR**
- Fuente: local_db | Confianza: 95%

### ERROR 3 - TARIC 3926909790 (Articulos plastico)
- Valor aduanero: 1000 EUR | Origen: CN
- Arancel MFN: **6.5%** → 65.00 EUR
- IVA 21% sobre 1065 EUR → 223.65 EUR
- **Total a pagar: 1,288.65 EUR**
- Fuente: local_db | Confianza: 95%

### ERROR 4 - TARIC 3824999699 (Productos quimicos)
- Valor aduanero: 1000 EUR | Origen: CN
- Arancel MFN: **6.5%** → 65.00 EUR
- IVA 21% sobre 1065 EUR → 223.65 EUR
- **Total a pagar: 1,288.65 EUR**
- Fuente: local_db | Confianza: 95%

### ERROR 5 - TARIC 4408909500 (Chapas madera >1mm)
- Valor aduanero: 1000 EUR | Origen: CN
- Arancel MFN: **4.0%** → 40.00 EUR
- IVA 21% sobre 1040 EUR → 218.40 EUR
- **Total a pagar: 1,258.40 EUR**
- Fuente: local_db | Confianza: 95%

## Archivos de evidencia

- `CORREGIDO_1_9505900000.json` - Respuesta API completa
- `CORREGIDO_2_8301600090.json` - Respuesta API completa
- `CORREGIDO_3_3926909790.json` - Respuesta API completa
- `CORREGIDO_4_3824999699.json` - Respuesta API completa
- `CORREGIDO_5_4408909500.json` - Respuesta API completa

## Fuente de datos arancelarios

- **EU TARIC oficial**: https://ec.europa.eu/taxation_customs/dds2/taric/
- Fecha de referencia: 23/03/2026
- Metodo: Scraping measures.jsp + measures_details.jsp (Third country duty)
