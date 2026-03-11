# EXECUTIVE SUMMARY
## LUCI Customs Agent - STRIX AI SL
**Ronda Pre-Seed | 150.000 - 300.000 EUR | Marzo 2026**

---

## 1. OPORTUNIDAD

La gestion aduanera en Espana es un mercado de 54M EUR/ano donde 15.000 empresas importadoras y exportadoras dependen de software legacy sin inteligencia artificial. Cada declaracion aduanera requiere 15-30 minutos de trabajo manual: buscar codigos TARIC entre 15.000 partidas, calcular aranceles, generar XML y enviarlo a la AEAT. Un error de clasificacion puede costar entre 500 y 5.000 EUR en sanciones o aranceles duplicados.

LUCI transforma este proceso de 30 minutos a 2 minutos, automatizando el ciclo completo con IA generativa y envio directo a la Agencia Tributaria.

## 2. PRODUCTO

LUCI es una plataforma SaaS de gestion aduanera que integra:

- **Clasificacion TARIC con IA** (Claude/Anthropic): identifica el codigo arancelario correcto entre 15.000+ partidas en segundos, con cache progresivo que mejora con cada uso
- **Calculo automatico de aranceles**: IVA, anti-dumping, regimenes especiales para 195 paises con tarifas estacionales
- **Generacion de declaraciones**: 6 tipos (H1 importacion, H7 e-commerce, AES exportacion, ENS seguridad, NCTS transito, PUE inspecciones) en XML validado contra schemas oficiales
- **Envio directo a AEAT**: Firmado digitalmente con certificado FNMT, comunicacion SOAP con web services oficiales
- **Asistente IA 24/7**: Experto en normativa aduanera (CAU, TARIC, regimenes) disponible desde cualquier pantalla

La plataforma esta desplegada en produccion en aduanas.strixai.es con 67+ componentes frontend, 40+ servicios backend y 25+ endpoints API.

## 3. VALIDACION

El producto ha sido validado directamente con la Agencia Tributaria Espanola:

- **4 de 6 builders de declaraciones aceptados** en el entorno PRE de la AEAT, con MRN (Movement Reference Number) reales emitidos
- **47 rondas de testing** realizadas los dias 3-4 de Marzo de 2026
- **Relacion directa con el DIT** (Departamento de Informatica Tributaria) a traves de Jose Antonio en Atencion al Usuario
- **Certificado FNMT** real vigente hasta Octubre de 2027
- **10 suites de tests E2E** automatizados con Cypress, documentados con videos y screenshots

Adicionalmente, se ha completado una POC para 300dec (operador que gestiona 300 declaraciones/mes para Correos de Espana), desplegada en AWS con stack serverless, validando la versatilidad de la tecnologia core.

## 4. MODELO DE NEGOCIO

SaaS B2B con tres planes de suscripcion:

| Plan | Precio | Margen bruto |
|------|--------|-------------|
| Professional | 149 EUR/mes | 93% |
| Business | 749 EUR/mes | 92% |
| Enterprise | Desde 799 EUR/mes | 92% |

El coste variable por usuario es de aproximadamente 10 EUR/mes (7 EUR en IA + 3 EUR en infraestructura), lo que genera margenes excepcionales para un SaaS. Con un CAC organico estimado de 20 EUR y un LTV a 12 meses de 2.160 EUR, el ratio LTV/CAC de 108x indica unit economics de primer nivel.

El break-even se alcanza con un solo cliente Professional (149 EUR - 31 EUR de costes = 118 EUR de beneficio mensual).

## 5. MERCADO Y COMPETENCIA

**Mercado objetivo**:
- TAM: 54M EUR/ano (15.000 empresas en Espana)
- SAM: 18M EUR/ano (5.000 empresas con >10 declaraciones/mes)
- Expansion europea: 600M EUR/ano (TARIC es comun en toda la UE)

**Competidores actuales**:
- **Portic** (200-500 EUR/mes): Integracion AEAT legacy pero sin IA
- **Customs4Trade** (300-800 EUR/mes): IA limitada, integracion parcial
- **TariffTel** (enterprise): Solo clasificacion, sin declaraciones ni envio

LUCI es la unica plataforma que combina IA generativa, envio real validado a AEAT y gestion completa del ciclo aduanero. La integracion con AEAT (certificados, builders XML, schemas XSD) requiere 6-12 meses de replicar, creando una barrera de entrada significativa.

## 6. PROYECCIONES FINANCIERAS

| Plazo | Clientes pago | MRR | ARR |
|-------|:------------:|----:|----:|
| 6 meses | 10 | 2.090 EUR | 25.080 EUR |
| 12 meses | 45 | 9.705 EUR | 116.460 EUR |
| 24 meses | 150 | 32.350 EUR | 388.200 EUR |

Beneficio acumulado a 24 meses: ~190.000 EUR.
Supuestos conservadores: 15% crecimiento mensual organico, 5% churn.

## 7. LA RONDA

**Importe**: 150.000 - 300.000 EUR
**Valoracion**: 1.0 - 1.5M EUR pre-money
**Instrumento**: Equity directo o SAFE
**Equity**: 15-25%

**Uso de fondos**:
- 60% Equipo (1 senior dev full-time + 1 comercial part-time)
- 25% Go-to-market (ads, eventos, onboarding)
- 10% Infraestructura (AWS scaling, MongoDB Atlas)
- 5% Legal y admin

**Runway**: 18-24 meses
**Milestone principal**: 50 clientes de pago, 10.000 EUR MRR, preparacion Serie A

## 8. EQUIPO

**STRIX AI SL** (NIF: B22477020, EORI: ESB22477020), constituida en 2025 con sede en Espana.

El equipo fundador combina expertise tecnico full-stack (React, Node.js, MongoDB, AWS, Claude API) con conocimiento profundo del sector aduanero espanol y relacion directa con la AEAT. El producto actual (+67.500 lineas de codigo) ha sido desarrollado integramente por el equipo.

## 9. POR QUE INVERTIR AHORA

1. **Producto validado**: 4/6 builders aceptados por la AEAT, con MRN reales
2. **Ventana de oportunidad**: 6-12 meses antes de que competidores integren IA
3. **Unit economics excepcionales**: 93% margen bruto, LTV/CAC 108x
4. **Mercado regulado = switching costs altos**: Una vez configurado, el cliente permanece
5. **Expansion natural a Europa**: Mismo TARIC, adaptar builders por pais
6. **Bajo riesgo financiero**: Break-even con 1 solo cliente, infraestructura ~21 EUR/mes

---

**Contacto**: strixai.es | aduanas.strixai.es
