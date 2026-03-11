# SOLICITUD ENISA - Borrador Completo
## STRIX AI SL - LUCI Customs Agent
## Linea: ENISA Jovenes Emprendedores / ENISA Emprendedores

---

## DATOS DE LA EMPRESA

- **Razon social**: STRIX AI SL
- **NIF**: B22477020
- **EORI**: ESB22477020
- **Domicilio social**: [Completar direccion fiscal]
- **Fecha constitucion**: 2025
- **CNAE principal**: 6201 - Actividades de programacion informatica
- **CNAE secundario**: 6311 - Proceso de datos, hosting
- **Web**: strixai.es
- **Producto**: aduanas.strixai.es
- **Numero de empleados**: [Completar]
- **Capital social**: [Completar]

### Representante legal
- **Nombre**: Jenifer Romero
- **NIF**: 70073780W
- **Cargo**: [Completar - Administradora unica / CEO]

---

## LINEA RECOMENDADA

### Opcion A: ENISA Jovenes Emprendedores
- **Importe**: 25.000 - 75.000 EUR
- **Requisito**: Socios mayoritarios menores de 40 anos
- **Plazo amortizacion**: hasta 7 anos (2 carencia)
- **Tipo interes**: Euribor + diferencial (3-6%)
- **Garantias**: Ninguna personal, solo viabilidad del proyecto

### Opcion B: ENISA Emprendedores
- **Importe**: 25.000 - 300.000 EUR
- **Requisito**: Empresa < 24 meses desde constitucion
- **Mismo tipo de prestamo participativo

### Recomendacion: Solicitar 75.000 EUR (maximo Jovenes Emprendedores)
Si los socios cumplen edad < 40, esta linea es mas facil de obtener.

---

## 1. RESUMEN EJECUTIVO DEL PROYECTO

### Descripcion del negocio

LUCI es una plataforma SaaS (Software as a Service) de gestion aduanera que utiliza inteligencia artificial para automatizar el ciclo completo de declaraciones aduaneras en Espana: clasificacion arancelaria, calculo de derechos e impuestos, generacion de declaraciones XML y envio electronico directo a la Agencia Tributaria (AEAT).

La plataforma resuelve un problema critico para las 15.000 empresas importadoras y exportadoras espanolas: la gestion aduanera manual consume 15-30 minutos por declaracion, con un coste de 80-200 EUR por operacion y un alto riesgo de errores de clasificacion que generan sanciones de 500-5.000 EUR. LUCI reduce este proceso a 2 minutos con un coste de 2.98 EUR por declaracion.

### Innovacion tecnologica

1. **Clasificacion arancelaria con IA generativa**: Utilizamos modelos de lenguaje avanzados (Claude de Anthropic) para identificar el codigo TARIC correcto entre mas de 15.000 partidas, con cache progresivo que mejora con cada consulta.

2. **Generacion automatica de XML aduanero**: 6 builders especializados que generan declaraciones XML validadas contra los schemas XSD oficiales de la AEAT (H1 importacion, H7 e-commerce, AES exportacion, ENS seguridad, NCTS transito, PUE inspecciones).

3. **Integracion directa con AEAT**: Comunicacion SOAP con los web services oficiales de la Agencia Tributaria, incluyendo firma digital XAdES-4 con certificado FNMT. Ya hemos obtenido 4 de 6 tipos de declaracion aceptados en el entorno de pruebas PRE de la AEAT, con MRN (Movement Reference Number) reales emitidos.

### Diferenciacion

Somos la unica plataforma que combina inteligencia artificial generativa, envio real validado a la AEAT y gestion completa del ciclo aduanero en una sola solucion. Los competidores actuales (Portic, Customs4Trade, TariffTel) ofrecen soluciones parciales, sin IA o sin integracion directa con la Agencia Tributaria.

---

## 2. EQUIPO

### Fundadores
[Completar con CV de cada fundador. ENISA valora especialmente:]
- Formacion academica relevante
- Experiencia previa en el sector o en tecnologia
- Complementariedad del equipo (tecnico + negocio)
- Dedicacion a tiempo completo al proyecto

### Equipo tecnico actual
- Capacidades full-stack: React, Node.js, MongoDB, AWS
- Integracion con APIs de IA (Anthropic Claude)
- Conocimiento profundo de la normativa aduanera (CAU, TARIC)
- Relacion directa con el DIT de la AEAT (Departamento de Informatica Tributaria)
- +67.500 lineas de codigo desarrolladas
- 2 productos desplegados en produccion (LUCI + POC para 300dec/Correos)

### Plan de contratacion (con fondos ENISA)
- 1 Senior Developer full-time (contribucion directa al desarrollo del producto)
- 1 Comercial/Customer Success part-time (captacion y retencion de clientes)

---

## 3. ANALISIS DE MERCADO

### Mercado objetivo

El sector aduanero espanol esta formado por:
- 15.000 empresas importadoras y exportadoras activas
- ~800 agentes y representantes aduaneros registrados
- ~200 transitarios con operaciones de despacho aduanero
- Crecimiento anual del comercio exterior espanol: 5-7%

### Tamano de mercado

| Segmento | Calculo | Valor anual |
|----------|---------|-------------|
| TAM (Total) | 15.000 empresas x 300 EUR/mes | 54M EUR |
| SAM (Accesible) | 5.000 empresas con >10 declaraciones/mes | 18M EUR |
| SOM (Obtainable, 3 anos) | 500 empresas (10% SAM) x 216 EUR ARPU | 1.3M EUR |

### Tendencias favorables
1. **Digitalizacion obligatoria**: La UE implemento el nuevo Codigo Aduanero de la Union (CAU) que exige tramitacion electronica
2. **Crecimiento del e-commerce transfronterizo**: H7 (declaraciones de bajo valor <150 EUR) creciendo un 15-20% anual
3. **IA en RegTech**: La aplicacion de inteligencia artificial a sectores regulados esta en fase temprana, con oportunidad de primer mover
4. **Escasez de agentes aduaneros**: Profesion envejecida, dificultad para reclutar jovenes, necesidad de automatizacion

### Competencia

| Competidor | Precio/mes | IA | Envio AEAT | Debilidad |
|-----------|-----------|-----|-----------|-----------|
| Portic | 200-500 EUR | No | Si (legacy) | Interfaz antigua, sin IA |
| Customs4Trade | 300-800 EUR | Limitada | Parcial | Caro, sin clasificacion automatica |
| TariffTel | Enterprise | Si (basica) | No | Solo clasificacion, no declaraciones |
| **LUCI** | 149-749 EUR | Si (Claude) | Si (validado) | Pre-revenue |

---

## 4. MODELO DE NEGOCIO Y PLAN FINANCIERO

### Modelo de ingresos

SaaS B2B con suscripcion mensual:

| Plan | Precio/mes | Target | Declaraciones |
|------|-----------|--------|---------------|
| Professional | 149 EUR | Agentes pequenos, importadores | 50/mes |
| Business | 749 EUR | Transitarios, operadores logisticos | 200/mes |
| Enterprise | Desde 799 EUR | Grandes operadores | Ilimitadas |

### Estructura de costes

| Concepto | Coste mensual | Detalle |
|----------|--------------|---------|
| Infraestructura AWS | 15 EUR | EC2 t3.micro + EBS + transferencia |
| IA (Anthropic) | ~7 EUR/usuario | 51 llamadas/mes a modelos Claude |
| Dominio + SSL | 1 EUR | strixai.es + Let's Encrypt |
| Stripe comisiones | 2.9% + 0.25 EUR | Por transaccion |
| **Total fijo (0 usuarios)** | **21 EUR** | |
| **Coste variable por usuario** | **~10 EUR** | IA + infra proporcional |

### Margen por plan

| Plan | Precio | Coste | Margen bruto |
|------|--------|-------|-------------|
| Professional | 149 EUR | ~10 EUR | 93% |
| Business | 749 EUR | ~27 EUR | 96% |
| Enterprise | 799+ EUR | ~60 EUR | 92% |

### Proyeccion de ingresos (24 meses)

| Periodo | Clientes pago | MRR | ARR | Beneficio/mes |
|---------|:------------:|----:|----:|:------------:|
| Mes 6 | 10 | 2.090 EUR | 25.080 EUR | 1.975 EUR |
| Mes 12 | 45 | 9.705 EUR | 116.460 EUR | 9.355 EUR |
| Mes 18 | 90 | 19.410 EUR | 232.920 EUR | 18.760 EUR |
| Mes 24 | 150 | 32.350 EUR | 388.200 EUR | 31.250 EUR |

### Break-even
- Con 1 solo cliente Professional: 149 EUR ingreso - 31 EUR coste = 118 EUR beneficio
- Break-even financiero: mes 1 desde el primer cliente

### Unit economics

| Metrica | Valor |
|---------|-------|
| ARPU | 216 EUR/mes |
| CAC (organico) | ~20 EUR |
| LTV (12 meses) | 2.160 EUR |
| LTV/CAC | 108x |
| Payback period | < 1 mes |
| Margen bruto medio | 93% |

---

## 5. USO DE LOS FONDOS ENISA

### Importe solicitado: 75.000 EUR

| Partida | Importe | % | Detalle |
|---------|---------|---|---------|
| Contratacion Senior Developer | 42.000 EUR | 56% | Full-time 12 meses (3.500 EUR/mes bruto) |
| Marketing y captacion | 15.000 EUR | 20% | LinkedIn Ads, eventos, cold outreach, onboarding |
| Infraestructura tecnologica | 10.000 EUR | 13% | Upgrade AWS, MongoDB Atlas, Sentry, CI/CD |
| Legal y compliance | 5.000 EUR | 7% | GDPR, ToS, registro de marca, asesoria |
| Fondo de contingencia | 3.000 EUR | 4% | Imprevistos |

### Hitos a alcanzar con estos fondos

1. **Mes 3**: Plataforma lista para lanzamiento publico (registro, GDPR, Stripe live)
2. **Mes 6**: 10 clientes de pago, 2.000 EUR MRR
3. **Mes 9**: 30 clientes de pago, 6.000 EUR MRR, 6/6 builders AEAT completos
4. **Mes 12**: 50 clientes de pago, 10.000 EUR MRR, preparacion para ronda de inversion adicional

---

## 6. ESTADO ACTUAL DEL PROYECTO (TRACCION)

### Producto

- **Plataforma completa desplegada**: aduanas.strixai.es
- **67+ componentes frontend** (React + Tailwind) - 42.500 lineas
- **40+ servicios backend** (Node.js + Express + MongoDB) - 25.000 lineas
- **6 tipos de declaracion** soportados (H1, H7, AES, ENS, NCTS, PUE)
- **Integracion Stripe** completa (checkout, webhooks, Customer Portal)
- **Certificado digital FNMT** real configurado (vigente hasta Oct 2027)

### Validacion tecnica AEAT

- **4/6 builders aceptados** por la AEAT en entorno PRE (pruebas)
- **47 rondas de testing** con la Agencia Tributaria (Marzo 2026)
- **MRN reales emitidos**: H1, H7, AES, ENS
- **Relacion directa con DIT**: Contacto en Atencion al Usuario de AEAT
- **10 suites de tests E2E** automatizados con Cypress

### Segundo producto

- **POC para 300dec/Correos de Espana** completada (gestion de 300 declaraciones/mes)
- **Stack serverless AWS** (Lambda + DynamoDB + CloudFront) desplegado
- Valida la versatilidad de la tecnologia core para diferentes casos de uso

---

## 7. PLAN DE DEVOLUCION

### Escenario conservador (50% de las proyecciones)

Con 25 clientes de pago al mes 12 (mitad de la proyeccion):
- MRR: ~5.000 EUR
- Beneficio mensual: ~4.500 EUR
- Capacidad de devolucion: 1.500-2.000 EUR/mes a partir del mes 14

### Calendario propuesto

| Periodo | Concepto |
|---------|---------|
| Meses 1-24 | Periodo de carencia (sin amortizacion de principal) |
| Meses 25-84 | Amortizacion mensual (~1.250 EUR/mes x 60 meses) |
| Interes | Euribor + 3-6% (variable segun condiciones ENISA) |

### Fuentes de devolucion
1. **Cash flow operativo**: Margenes del 93% permiten autofinanciar la devolucion
2. **Ronda posterior**: Pre-Seed/Seed de 150-300K EUR planificada para mes 9-12
3. **Revenue del segundo producto** (300dec/Correos): Potencial contrato enterprise

---

## 8. DOCUMENTACION A ADJUNTAR

### Obligatoria (para ENISA)
- [ ] Escritura de constitucion de STRIX AI SL
- [ ] DNI/NIE del representante legal
- [ ] Certificado de estar al corriente con Hacienda
- [ ] Certificado de estar al corriente con Seguridad Social
- [ ] Cuentas anuales (o declaracion de empresa nueva si < 1 ano)
- [ ] Plan de empresa / Business Plan (este documento)
- [ ] Modelo financiero (proyecciones en Excel)
- [ ] CVs de los fundadores

### Recomendada (refuerza la solicitud)
- [ ] Demo del producto (video de 2:30 min)
- [ ] Informe de pruebas AEAT PRE (PDF existente)
- [ ] Screenshots de MRN reales emitidos por AEAT
- [ ] Cartas de intencion de clientes potenciales (si las hay)
- [ ] Pitch deck (PDF del HTML generado)

---

## COMO SOLICITAR

### Paso 1: Registro en ENISA
1. Ir a https://www.enisa.es
2. Crear cuenta de empresa
3. Seleccionar linea: "Jovenes Emprendedores" o "Emprendedores"

### Paso 2: Cumplimentar solicitud online
- Rellenar formulario con datos de este documento
- Subir documentacion obligatoria
- Adjuntar plan de empresa (PDF de este documento)

### Paso 3: Evaluacion
- ENISA evalua en 30-60 dias habiles
- Pueden pedir informacion adicional
- Comite de evaluacion: viabilidad tecnica + financiera + equipo

### Paso 4: Resolucion
- Si favorable: firma de contrato de prestamo participativo
- Desembolso en 1-2 semanas tras firma

### Contacto ENISA
- Web: enisa.es
- Email: info@enisa.es
- Telefono: 91 570 82 00

---

## TIPS PARA MAXIMIZAR PROBABILIDADES

1. **Equipo**: ENISA valora mucho la formacion y experiencia del equipo. Incluir titulaciones, experiencia laboral relevante y dedicacion al proyecto
2. **Innovacion**: Destacar la IA + integracion AEAT como innovacion tecnologica real, no solo incremental
3. **Traccion**: Los 4/6 builders AEAT aceptados son prueba tangible de que funciona. Incluir screenshots de MRN
4. **Mercado**: Cuantificar bien el TAM/SAM/SOM con fuentes (ICEX, Aduanas, INE)
5. **Finanzas**: Ser conservador en proyecciones. ENISA prefiere realismo a optimismo
6. **Devolucion**: Demostrar capacidad de pago con multiples escenarios
7. **Complementariedad**: Si pides ENISA + ronda privada, explicar como se complementan
