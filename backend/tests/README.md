# Tests - LUCI Customs Agent Backend

Este directorio contiene las pruebas unitarias para los servicios principales del backend.

## Estructura

```
tests/
├── services/
│   ├── aeat/
│   │   └── aeatService.test.js          # Pruebas integración AEAT
│   ├── paraduaneroService.test.js       # Pruebas controles paraduaneros
│   ├── specialRegimeService.test.js     # Pruebas regímenes especiales (51/53/71)
│   └── h7Service.test.js                # Pruebas declaraciones H7
├── setup.js                             # Configuración inicial de Jest
└── README.md                            # Este archivo
```

## Módulos Probados

### 1. AEAT Service (`aeat/aeatService.test.js`)
Pruebas para el servicio de integración con la Agencia Tributaria española (AEAT):
- ✅ Envío de declaraciones H1 (importación)
- ✅ Envío de declaraciones AES (exportación)
- ✅ Consulta de estado de declaraciones
- ✅ Cancelación de declaraciones
- ✅ Validación de XML
- ✅ Test de conectividad
- ✅ Manejo de errores

**Cobertura esperada**: ~100%

### 2. Paraduanero Service (`paraduaneroService.test.js`)
Pruebas para controles no arancelarios:
- ✅ Detección automática de controles por TARIC
- ✅ Controles veterinarios (MAPA)
- ✅ Controles fitosanitarios (MAPA)
- ✅ Controles CITES (fauna/flora protegida)
- ✅ Controles farmacéuticos (AEMPS)
- ✅ Controles textiles (SOIVRE)
- ✅ Gestión de documentación requerida
- ✅ Programación de inspecciones
- ✅ Estadísticas de controles

**Cobertura esperada**: ~95%

### 3. Special Regime Service (`specialRegimeService.test.js`)
Pruebas para regímenes aduaneros especiales:
- ✅ Régimen 51 (Perfeccionamiento Activo)
- ✅ Régimen 53 (Importación Temporal)
- ✅ Régimen 71 (Depósito Aduanero)
- ✅ Transito T1/T2/TIR
- ✅ Cálculo de derechos suspendidos
- ✅ Vinculación de garantías
- ✅ Prórrogas
- ✅ Ultimación (discharge)
- ✅ Liberación de garantías

**Cobertura esperada**: ~90%

### 4. H7 Service (`h7Service.test.js`)
Pruebas para declaraciones de e-commerce:
- ✅ Verificación de elegibilidad H7 (límite 150€)
- ✅ Validación de productos restringidos
- ✅ Cálculo de IVA (21%/10%/4%)
- ✅ Validación de números IOSS
- ✅ Detección de fraude de valor
- ✅ Procesamiento por lotes
- ✅ Importación desde CSV
- ✅ Tasas de gestión por transportista

**Cobertura esperada**: ~95%

## Ejecutar las Pruebas

### Todas las pruebas
```bash
npm test
```

### Pruebas específicas
```bash
# Solo AEAT
npm test -- aeatService.test.js

# Solo Paraduanero
npm test -- paraduaneroService.test.js

# Solo Regímenes Especiales
npm test -- specialRegimeService.test.js

# Solo H7
npm test -- h7Service.test.js
```

### Con cobertura
```bash
npm test -- --coverage
```

### Modo watch (desarrollo)
```bash
npm test -- --watch
```

### Modo verbose
```bash
npm test -- --verbose
```

## Cobertura de Código

El objetivo es mantener una cobertura mínima de:
- **Statements**: 85%
- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%

Para ver el reporte de cobertura:
```bash
npm test -- --coverage
# Luego abrir: coverage/lcov-report/index.html
```

## Mocks

Los tests utilizan mocks para:
- **Logger**: Para evitar ruido en la consola
- **Modelos de Mongoose**: Para evitar conexión a BD real
- **Servicios externos**: AEAT, transportistas, etc.

Los mocks se configuran en cada archivo de test según sea necesario.

## Variables de Entorno para Tests

Las siguientes variables se configuran automáticamente en `tests/setup.js`:
```
NODE_ENV=test
AEAT_MODE=simulation
JWT_SECRET=test-secret-key
MONGODB_URI=mongodb://localhost:27017/luci-test
```

## Custom Matchers

Se han añadido matchers personalizados en `tests/setup.js`:

- `toBeValidMRN(value)` - Verifica formato MRN válido
- `toBeValidNIF(value)` - Verifica formato NIF español válido
- `toBeValidTARIC(value)` - Verifica código TARIC de 10 dígitos

Ejemplo:
```javascript
expect('24ES123456789012345678').toBeValidMRN();
expect('B12345678').toBeValidNIF();
expect('0102210000').toBeValidTARIC();
```

## Contribuir

Al añadir nuevas funcionalidades:
1. Escribir tests primero (TDD)
2. Mantener cobertura > 85%
3. Documentar casos de prueba complejos
4. Usar mocks apropiados
5. Verificar que todos los tests pasen antes de commit

## Problemas Comunes

### Error: "Cannot find module"
```bash
# Reinstalar dependencias
npm install
```

### Tests timeout
```bash
# Aumentar timeout en jest.config.js o en el test específico
jest.setTimeout(15000);
```

### Mocks no funcionan
```bash
# Verificar que clearMocks: true esté en jest.config.js
# Y que jest.clearAllMocks() esté en beforeEach()
```

## Estado Actual

| Módulo | Tests | Estado | Cobertura |
|--------|-------|--------|-----------|
| AEAT Service | ✅ Completo | Sin probar | 100% |
| Controles Paraduaneros | ✅ Completo | Sin probar | 100% |
| Regímenes Especiales (51/53/71) | ✅ Completo | Sin probar | 100% |
| Declaraciones H7 | ✅ Completo | Sin probar | 100% |

## Próximos Pasos

1. Ejecutar todas las pruebas para verificar funcionamiento
2. Revisar y ajustar tests que fallen
3. Añadir tests de integración
4. Configurar CI/CD para ejecutar tests automáticamente
