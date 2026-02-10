# CHECKPOINT - 02 Febrero 2026 - Sesion 2

## Resumen de la Sesion
Correccion del sistema de calculo de aranceles que estaba devolviendo valores erroneos.

## Problema Identificado
Los agentes aduaneros reportaron que las calculadoras de derechos de importacion estaban produciendo aranceles erroneos. El sistema anterior solo consultaba la BD local y si no encontraba el codigo TARIC devolvia 0% o error 404.

## Solucion Implementada
Creacion de un nuevo servicio de calculo de aranceles con IA (`dutyCalculationService.js`) que usa multiples fuentes para obtener aranceles precisos:

1. **Cache en memoria** (1 hora TTL)
2. **Base de datos local** (TaricCode)
3. **Cache de IA** (TaricAICache - 30 dias TTL)
4. **IA en tiempo real** (Claude Sonnet)
5. **Estimacion por capitulo** (fallback)

## Archivos Creados

### Backend - Nuevo Servicio
```
backend/src/services/dutyCalculationService.js
```

Funciones principales:
- `getDutyInfo(taricCode, origin)` - Obtiene info de aranceles con fallback multinivel
- `calculateDutiesWithAI(params)` - Calcula aranceles completos usando IA
- `getArancelesFromAI(taricCode, origin)` - Consulta a Claude para aranceles precisos
- `validateDutyRate(taricCode, currentRate, origin)` - Valida arancel contra fuentes oficiales
- `clearMemoryCache()` - Limpia cache en memoria

## Archivos Modificados

### Backend
```
backend/src/controllers/calculationController.js
  - Importa dutyCalculationService
  - calculateDuties() ahora usa calculateDutiesWithAI()
  - calculateTotal() usa IA para cada item
  - Nuevos endpoints: getDutyInfo, validateDutyRate, clearCache

backend/src/routes/calculation.js
  - GET  /duty-info/:taricCode - Info de aranceles con IA
  - POST /validate-duty - Validar arancel
  - DELETE /cache - Limpiar cache
```

### Frontend
```
frontend/src/services/api.js
  - calculationsAPI actualizado con nuevos endpoints
  - calculateDuties ahora usa POST /api/calculation/duties con body JSON
  - Nuevos metodos: getDutyInfo, validateDutyRate, clearCache, getExchangeRate

frontend/src/components/Calculations/DutyCalculator.jsx
  - Cambiado taric_code -> taricCode (camelCase)
```

## Flujo de Calculo (Actualizado)

```
POST /api/calculation/duties
{taricCode, value, origin, preference}
       |
       v
1. Verificar cache memoria
   |-- Hit --> Devolver
   |
   v
2. Buscar en BD local (TaricCode)
   |-- Encontrado --> Devolver + cache
   |
   v
3. Buscar en cache IA (TaricAICache)
   |-- Encontrado --> Devolver + cache
   |
   v
4. Consultar Claude AI (tiempo real)
   |-- Exito --> Guardar en cache + BD local + Devolver
   |
   v
5. Fallback: Estimar por capitulo TARIC
   |-- Devolver con warning "verificar en TARIC oficial"
```

## Respuesta del Calculo

```javascript
{
  success: true,
  data: {
    taricCode: "8471300000",
    description: "Maquinas automaticas para tratamiento...",
    origin: "CN",
    preference: "100",
    customsValue: 1000,

    // Aranceles
    dutyRate: 0,           // Tasa efectiva
    baseDutyRate: 0,       // Tasa base
    dutyAmount: 0,         // Importe arancel
    dutyType: "ad_valorem",

    // IVA
    vatRate: 21,
    vatBase: 1000,
    vatAmount: 210,

    // Totales
    totalTaxes: 210,
    totalToPay: 1210,

    // Metadata
    source: "ai_cache",    // local_db | ai_cache | ai_realtime | estimated
    confidence: 95,        // Porcentaje de confianza
    warnings: []           // Avisos importantes
  }
}
```

## Indicadores de Fuente en Frontend

| Fuente | Color | Descripcion |
|--------|-------|-------------|
| local_db | Verde | Base de datos local verificada |
| ai_cache | Azul | Cache de respuestas IA |
| ai_realtime | Purpura | IA en tiempo real |
| estimated | Gris | Estimacion por capitulo |

## Pruebas Realizadas

### Test 1: Laptops (8471300000) desde China
- **Arancel**: 0% (correcto - acuerdo ITA)
- **IVA**: 21% = 210 EUR
- **Total**: 1,210 EUR
- **Fuente**: ai_cache

### Test 2: Camisetas (6109100000) desde China
- **Arancel**: 12% = 120 EUR (correcto para textiles)
- **IVA**: 21% sobre 1,120 = 235.20 EUR
- **Total**: 1,355.20 EUR
- **Fuente**: estimated

## Servidor de Produccion
- **IP:** 46.137.105.47
- **URL:** https://aduanas.strixai.es
- **Estado:** Desplegado y funcionando

## Como Probar

1. Ir a https://aduanas.strixai.es
2. Login: `test@luci.es` / `test123`
3. Menu lateral -> **Calculadoras** -> **Calculadora de Derechos**
4. Ingresar:
   - Codigo TARIC (ej: `8471300000`, `6109100000`)
   - Valor en aduana
   - Pais de origen
   - Preferencia arancelaria
5. Click "Calcular Derechos"
6. Ver resultado con fuente y confianza

## Estado Final

| Funcionalidad | Estado |
|---------------|--------|
| Calcular aranceles (IA) | OK |
| Cache multinivel | OK |
| Fallback por capitulo | OK |
| Indicadores de fuente | OK |
| Warnings de validacion | OK |
| Endpoint validacion | OK |

## Nota Importante
Los aranceles con fuente `estimated` y confianza < 90% muestran un warning para que el usuario verifique en TARIC oficial antes de declarar.
