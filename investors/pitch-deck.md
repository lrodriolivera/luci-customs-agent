# PITCH DECK - LUCI Customs Agent
## STRIX AI SL | Pre-Seed Round | Marzo 2026

---

# SLIDE 1: PORTADA

**LUCI**
*Inteligencia Artificial para Aduanas*

La primera plataforma que automatiza declaraciones aduaneras con IA
y las envia directamente a la Agencia Tributaria

Pre-Seed Round: 150-300K EUR

STRIX AI SL | strixai.es | aduanas.strixai.es

---

# SLIDE 2: EL PROBLEMA

**Gestionar aduanas en Espana es lento, caro y manual**

- Un agente aduanero tarda **15-30 minutos** por declaracion
- Buscar codigos TARIC manualmente entre **15.000+ partidas** es propenso a errores
- Un error de clasificacion puede costar **miles de euros** en aranceles duplicados o sanciones
- El software actual (Portic, SIECA) tiene **interfaces de los anos 90** sin IA
- **15.000 empresas** importadoras/exportadoras en Espana dependen de este proceso

> "Cada declaracion incorrecta cuesta entre 500 y 5.000 EUR en sobrecostes.
> Multiplicado por miles de operaciones al ano, es un problema de millones."

---

# SLIDE 3: LA SOLUCION

**LUCI automatiza el ciclo aduanero completo con IA**

1. **Clasificacion inteligente**: IA identifica el codigo TARIC correcto entre 15.000+ partidas en segundos
2. **Calculo automatico**: Aranceles, IVA, anti-dumping, regimenes especiales para 195 paises
3. **Generacion de declaraciones**: H1, H7, AES, ENS, NCTS - XML validado contra schemas AEAT
4. **Envio directo a AEAT**: Firmado digitalmente, con certificado FNMT real
5. **Asistente IA 24/7**: Experto en normativa aduanera (CAU, TARIC, regimenes)

**De 30 minutos a 2 minutos por declaracion**

---

# SLIDE 4: DEMO / PRODUCTO

**Plataforma en produccion: aduanas.strixai.es**

[Screenshot: Dashboard principal con KPIs]
[Screenshot: Clasificacion TARIC con arbol interactivo]
[Screenshot: Declaracion H1 generada + envio a AEAT]
[Screenshot: Respuesta AEAT con MRN real]

- 67+ componentes frontend
- Portal de clientes integrado
- Generacion automatica de PDF (DUA oficial)
- Dashboard de canales de inspeccion (verde/naranja/rojo)

---

# SLIDE 5: TRACCION Y VALIDACION TECNICA

**4 de 6 builders aceptados por la AEAT en entorno PRE**

| Declaracion | Estado | Prueba |
|-------------|--------|--------|
| H1 - Importacion estandar | ACEPTADO - MRN real | Canal verde (levante inmediato) |
| H7 - E-commerce (<150 EUR) | ACEPTADO - MRN real | Con garantia real |
| AES - Exportacion | ACEPTADO - MRN real | Canal verde |
| ENS - Seguridad entrada | ACEPTADO - 30+ MRN | Multiples envios exitosos |
| NCTS - Transito | Schema validado | Pendiente datos de prueba |
| PUE ROHS - Inspecciones | Pendiente | Requiere H1 con ROHS previo |

- **47 rondas de testing** con la AEAT (3-4 Marzo 2026)
- Relacion directa con DIT/AEAT (Jose Antonio, Atencion al Usuario)
- Certificado FNMT vigente hasta Octubre 2027
- 10 suites de tests E2E automatizados

**Segundo producto validado**: POC completada para 300dec (gestiona 300 declaraciones/mes para Correos de Espana) - stack serverless AWS desplegado

---

# SLIDE 6: MERCADO

**TAM / SAM / SOM**

```
TAM (Total Addressable Market):
  15.000 empresas import/export en Espana x 300 EUR/mes avg
  = 54M EUR/ano

SAM (Serviceable Available Market):
  5.000 empresas con >10 declaraciones/mes (target ideal)
  = 18M EUR/ano

SOM (Serviceable Obtainable Market - 3 anos):
  500 empresas (10% SAM) x 216 EUR ARPU
  = 1.3M EUR/ano
```

**Expansion europea (post Serie A)**:
- Portugal, Francia, Italia, Alemania
- Mismo TARIC (EU-wide), builders XML por pais
- TAM europeo: ~600M EUR/ano (28 paises)

---

# SLIDE 7: MODELO DE NEGOCIO

**SaaS con margenes del 93%**

| Plan | Precio/mes | Declaraciones | Target |
|------|-----------|---------------|--------|
| **Professional** | 149 EUR | 50 | Agentes aduaneros pequenos, importadores |
| **Business** | 749 EUR | 200 | Transitarios medianos, operadores logisticos |
| **Enterprise** | Desde 799 EUR | Ilimitadas | Grandes operadores, Correos, Amazon sellers |

**Coste por usuario**: ~10 EUR/mes (IA ~7 EUR + infra ~3 EUR)
**Margen bruto**: 93% (Professional) / 92% (Business)

**Comparativa**:
- LUCI Professional: **2.98 EUR por declaracion**
- Agente aduanero manual: **80-200 EUR por declaracion**
- Ahorro para el cliente: **96-98%**

---

# SLIDE 8: UNIT ECONOMICS

**Metricas que importan**

| Metrica | Valor |
|---------|-------|
| **ARPU** (avg revenue per user) | 216 EUR/mes |
| **Margen bruto** | 93% |
| **CAC** (coste adquisicion, organico) | ~20 EUR |
| **LTV** (12 meses) | 2.160 EUR |
| **LTV/CAC** | **108x** |
| **Payback period** | < 1 mes |
| **Break-even** | 1 cliente Professional |
| **Churn estimado** | 5% mensual |

**Coste operativo mensual sin clientes**: 21 EUR
**Con 1 solo cliente Professional**: 118 EUR de beneficio

---

# SLIDE 9: PROYECCIONES FINANCIERAS (24 MESES)

| Mes | Clientes pago | MRR | Costes | Beneficio |
|-----|:------------:|----:|-------:|----------:|
| **3** | 3 | 647 EUR | 55 EUR | 592 EUR |
| **6** | 10 | 2.090 EUR | 115 EUR | 1.975 EUR |
| **12** | 45 | 9.705 EUR | 350 EUR | 9.355 EUR |
| **18** | 90 | 19.410 EUR | 650 EUR | 18.760 EUR |
| **24** | 150 | 32.350 EUR | 1.100 EUR | 31.250 EUR |

**A 12 meses**: ARR de 116.460 EUR
**A 24 meses**: ARR de 388.200 EUR
**Beneficio acumulado 24 meses**: ~190.000 EUR

Supuestos: 15% crecimiento mensual orgánico (12 primeros meses), 8% despues.
Churn 5% Professional, 3% Business.

---

# SLIDE 10: COMPETENCIA

```
                        INTEGRACION AEAT REAL
                              ^
                              |
                   Portic     |     LUCI <<<
                   (legacy)   |     (IA + envio real)
                              |
    SIN IA -------------------|------------------- CON IA
                              |
                   SIECA      |     TariffTel
                   (manual)   |     (solo clasificacion)
                              |
                        SIN INTEGRACION
```

**Nadie combina las 3 cosas**: IA generativa + envio real AEAT + gestion completa

| | Portic | Customs4Trade | TariffTel | **LUCI** |
|---|:---:|:---:|:---:|:---:|
| Clasificacion IA | - | Limitada | Si | **Si (Claude)** |
| Envio directo AEAT | Si (legacy) | Parcial | - | **Si (validado)** |
| Calculo aranceles | Basico | Si | - | **Si (195 paises)** |
| Asistente IA 24/7 | - | - | - | **Si** |
| Precio/mes | 200-500 | 300-800 | Enterprise | **149-749** |

---

# SLIDE 11: VENTAJA COMPETITIVA (MOAT)

**6-12 meses de ventaja replicable**

1. **Integracion AEAT validada**
   - 47 rondas de testing, 4 builders con MRN real
   - Certificado FNMT activo, relacion directa con DIT
   - Un competidor necesita 6-12 meses para replicarlo

2. **Motor regulatorio en codigo**
   - 6 builders XML con validacion XSD completa
   - Reglas CAU, TARIC, regimenes especiales embebidas
   - 40+ servicios backend especializados

3. **Efecto red de datos**
   - Cache progresivo de clasificaciones TARIC (70%+ hit rate)
   - Cada consulta mejora las siguientes
   - Base de 98 capitulos + 15.000 partidas en crecimiento

4. **Switching costs regulatorios**
   - Configuracion de certificados, aduanas, garantias
   - Historial de declaraciones no portable
   - Cumplimiento normativo integrado

---

# SLIDE 12: EQUIPO

**STRIX AI SL** (NIF: B22477020, constituida en 2025)

**[Nombre Fundador/a]** - CEO & Product
- Vision de producto y estrategia comercial
- Relacion directa con AEAT/DIT
- Conocimiento profundo del sector aduanero

**Equipo Tecnico**
- Full-stack: React, Node.js, MongoDB, AWS
- Integracion IA: Claude API, prompt engineering
- DevOps: AWS EC2, Nginx, PM2, CI/CD
- +25.000 lineas backend, +42.500 lineas frontend

**Con la ronda contratamos**:
- 1 Senior Developer (full-time, 12 meses)
- 1 Comercial/Customer Success (part-time, 6 meses)

**Advisors** (por incorporar):
- Agente aduanero senior (validacion de mercado)
- Inversor/mentor con exit en SaaS B2B

---

# SLIDE 13: ROADMAP

**2026**

| Q1 (Completado) | Q2 (En curso) | Q3 | Q4 |
|---|---|---|---|
| 4/6 builders AEAT aceptados | Registro + GDPR + Stripe live | 50 clientes de pago | 100 clientes |
| POC 300dec/Correos completada | Primeros 5 clientes beta | NCTS + PUE completados | API publica v2 |
| 10 suites E2E tests | Video demo + landing optimizada | Serie A prep | Expansion Portugal |
| Cypress + documentacion | ENISA + aceleradoras | 10K EUR MRR | Mobile app (PWA) |

**2027**
- Serie A (500K-1M EUR)
- Expansion: Portugal, Francia, Italia
- 500+ clientes, 30K+ EUR MRR
- Equipo de 8-10 personas

---

# SLIDE 14: LA RONDA

**Pre-Seed: 150.000 - 300.000 EUR**

| Concepto | Importe | % |
|----------|---------|---|
| Equipo (1 dev + 1 comercial) | 120.000 EUR | 60% |
| Go-to-market (ads, eventos, onboarding) | 50.000 EUR | 25% |
| Infraestructura (AWS, Atlas, tools) | 20.000 EUR | 10% |
| Legal y admin | 10.000 EUR | 5% |

**Valoracion pre-money**: 1.0 - 1.5M EUR
**Equity ofrecido**: 15-25%
**Runway**: 18-24 meses
**Instrumento**: Equity directo o nota convertible (SAFE)

**Milestones con estos fondos**:
- 50 clientes de pago (10K EUR MRR)
- 6/6 builders AEAT completos
- Preparacion y datos para Serie A
- Primer revenue de 300dec/Correos

---

# SLIDE 15: EL ASK

**Buscamos 150-300K EUR de inversores que aporten**:

1. **Capital** para contratar equipo y acelerar go-to-market
2. **Red de contactos** en logistica, aduanas o SaaS B2B
3. **Experiencia** escalando empresas SaaS en mercados regulados

**Por que ahora**:
- Producto funcionando con validacion real de AEAT
- Mercado de 54M EUR en Espana sin solucion IA
- Ventana de 6-12 meses antes de que otros integren IA
- Unit economics excepcionales (93% margen, LTV/CAC 108x)

**Siguiente paso**: Demo en vivo de 20 minutos

**Contacto**:
- Web: strixai.es
- Producto: aduanas.strixai.es
- Email: [email de contacto]
- LinkedIn: [perfil]

---
