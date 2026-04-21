# LUCI Customs Agent - Analisis de Costos y Modelo de Negocio
**Fecha**: 11 de Febrero 2026
**Empresa**: STRIX AI SL (B22477020)

---

## 1. COSTOS DE OPERACION MENSUALES

### 1.1 Infraestructura AWS (actual)

| Concepto | Especificacion | Costo/mes |
|----------|---------------|-----------|
| EC2 t3.micro (actual) | 2 vCPU, 1GB RAM, Linux | ~9 EUR |
| EBS Storage 25GB | gp3 SSD | ~2 EUR |
| Data Transfer | ~50GB/mes estimado | ~4 EUR |
| **Subtotal AWS actual** | | **~15 EUR/mes** |

### 1.2 API de IA (Anthropic Claude)

La plataforma usa 23 llamadas con Opus y 16 con Sonnet en el codigo. Estimacion por usuario activo:

| Operacion | Modelo | Tokens aprox/llamada | Llamadas/usuario/mes | Costo/usuario/mes |
|-----------|--------|---------------------|---------------------|-------------------|
| Clasificacion TARIC | Sonnet 4.5 | ~2K in / ~1K out | 15 | 0.31 EUR |
| Generacion H1/AES/ENS | Opus 4.5 | ~3K in / ~2K out | 8 | 0.52 EUR |
| Chat asistente | Sonnet 4.5 | ~1.5K in / ~0.5K out | 20 | 0.24 EUR |
| Analisis riesgo/canal | Opus 4.5 | ~2K in / ~1K out | 5 | 0.19 EUR |
| Respuestas requerimientos | Opus 4.5 | ~3K in / ~2K out | 3 | 0.20 EUR |
| **Total IA por usuario** | | | **~51 llamadas** | **~1.46 EUR/mes** |

**Nota**: Con Prompt Caching de Anthropic (90% ahorro en reads), el costo real puede bajar a ~0.80 EUR/usuario/mes.

### 1.3 Otros servicios

| Concepto | Costo/mes |
|----------|-----------|
| Dominio strixai.es | ~1 EUR (12 EUR/ano) |
| SSL Let's Encrypt | 0 EUR (gratuito) |
| MongoDB (local en EC2) | 0 EUR (incluido) |
| Stripe comision (2.9% + 0.25 EUR) | Variable por transaccion |
| Email transaccional (futuro) | ~5-15 EUR (SendGrid/SES) |
| **Subtotal otros** | **~6 EUR/mes fijo** |

### 1.4 Resumen costos fijos

| Concepto | 0 usuarios | 10 usuarios | 50 usuarios | 200 usuarios |
|----------|-----------|-------------|-------------|--------------|
| AWS infra | 15 EUR | 15 EUR | 45 EUR* | 120 EUR** |
| IA (Anthropic) | 0 EUR | 15 EUR | 73 EUR | 292 EUR |
| Otros fijos | 6 EUR | 6 EUR | 16 EUR | 25 EUR |
| **TOTAL** | **21 EUR** | **36 EUR** | **134 EUR** | **437 EUR** |

*Con 50 usuarios: upgrade a t3.small (2 vCPU, 2GB) ~18 EUR + RDS ~27 EUR
**Con 200 usuarios: t3.medium (2 vCPU, 4GB) ~36 EUR + RDS ~55 EUR + ElastiCache ~29 EUR

---

## 2. PLANES Y PRECIOS

### 2.1 Estructura de planes propuesta

| Plan | Precio/mes | Declaraciones/mes | Usuarios | Funcionalidades |
|------|-----------|-------------------|----------|-----------------|
| **Starter** | 0 EUR | 5 | 1 | Clasificacion TARIC, calculo aranceles, chat basico |
| **Professional** | 149 EUR | 50 | 5 | Todo Starter + H1/H7/AES/NCTS/ENS, envio AEAT, PDF, portal cliente |
| **Business** | 349 EUR | 200 | 15 | Todo Pro + PUE/SOIVRE, API publica, analytics, workflows |
| **Enterprise** | Custom (desde 799 EUR) | Ilimitadas | Ilimitados | Todo Business + SLA, soporte dedicado, integraciones custom |

### 2.2 Justificacion de precios

**Comparativa mercado** (agentes aduaneros software en Espana):
- Portic/Integra2: 200-500 EUR/mes
- Customs4Trade: 300-800 EUR/mes
- Desaduanaje manual: 50-150 EUR por declaracion
- Un agente aduanero cobra: 80-200 EUR por DUA

**Valor por declaracion**:
- Plan Professional (149 EUR / 50 declaraciones) = **2.98 EUR/declaracion**
- Un agente cobra 80-200 EUR por declaracion manual
- **Ahorro del 96-98%** para el cliente

### 2.3 Margen por plan

| Plan | Precio | Costo IA/mes | Costo infra proporcional | **Margen bruto** | **Margen %** |
|------|--------|-------------|-------------------------|-----------------|-------------|
| Starter | 0 EUR | ~1 EUR | ~1 EUR | -2 EUR | N/A (lead gen) |
| Professional | 149 EUR | ~7 EUR | ~3 EUR | **139 EUR** | **93%** |
| Business | 349 EUR | ~22 EUR | ~5 EUR | **322 EUR** | **92%** |
| Enterprise | 799 EUR | ~50 EUR | ~10 EUR | **739 EUR** | **92%** |

---

## 3. ESCALADO DE INFRAESTRUCTURA

### 3.1 Umbrales de crecimiento

| Usuarios | Infra necesaria | Costo AWS/mes | Accion |
|----------|----------------|---------------|--------|
| 1-20 | t3.micro + MongoDB local | ~15 EUR | Estado actual |
| 20-50 | t3.small + MongoDB local | ~20 EUR | Upgrade instance |
| 50-100 | t3.medium + MongoDB Atlas M10 | ~85 EUR | Separar DB |
| 100-300 | t3.large + Atlas M20 + Redis | ~180 EUR | Cache + DB dedicada |
| 300-500 | 2x t3.large + ALB + Atlas M30 | ~400 EUR | Load balancer, HA |
| 500+ | ECS/EKS + Atlas M40 + CDN | ~800 EUR+ | Contenedores, auto-scaling |

### 3.2 Cuellos de botella actuales

1. **RAM** (914MB total, 468MB usada) - El cuello mas inmediato. Con 20+ usuarios concurrentes se necesita upgrade
2. **MongoDB local** - Sin replica set, single point of failure. Migrar a Atlas con 50+ usuarios
3. **Single process** - PM2 en fork mode. Pasar a cluster mode con t3.small+

---

## 4. PUNTO DE EQUILIBRIO (Break-even)

### 4.1 Costos fijos mensuales base

| Concepto | Costo |
|----------|-------|
| AWS (t3.micro) | 15 EUR |
| Dominio + SSL | 1 EUR |
| Email (SES) | 5 EUR |
| Anthropic API (base) | 0 EUR (pay per use) |
| **Total fijo** | **~21 EUR/mes** |

### 4.2 Escenarios de break-even

**Escenario A: Solo Professional (149 EUR)**
- Costo variable por cliente: ~10 EUR (IA + infra proporcional)
- Margen por cliente: 139 EUR
- **Break-even: 1 cliente Professional** (139 EUR > 21 EUR fijos)

**Escenario B: Mix realista**
- 80% Starter (gratis), 15% Professional, 5% Business
- Con 100 usuarios totales: 15 Pro (2,235 EUR) + 5 Business (1,745 EUR) = 3,980 EUR
- Costos: AWS ~85 EUR + IA ~146 EUR + fijos ~21 EUR = ~252 EUR
- **Utilidad: ~3,728 EUR/mes con 100 usuarios**

**Escenario C: Minimo viable**
- 1 Professional + gastos operativos = 149 - 31 = **118 EUR utilidad**
- **Con 1 solo cliente de pago ya hay utilidad**

---

## 5. PROYECCION DE CRECIMIENTO (24 meses)

### 5.1 Supuestos

- Mercado objetivo: ~15,000 empresas importadoras/exportadoras en Espana
- Conversion Starter->Pro: 15% (despues de 30 dias)
- Churn mensual: 5% Pro, 3% Business
- Crecimiento organico: 15% mes-a-mes (primeros 12 meses), 8% despues
- Marketing: boca a boca + LinkedIn + cold emails

### 5.2 Proyeccion

| Mes | Usuarios total | Starter | Pro (149 EUR) | Business (349 EUR) | Ingreso/mes | Costos/mes | **Utilidad/mes** |
|-----|---------------|---------|---------------|--------------------|-----------:|----------:|-----------------:|
| 1 | 5 | 4 | 1 | 0 | 149 | 30 | **119** |
| 3 | 15 | 12 | 2 | 1 | 647 | 55 | **592** |
| 6 | 40 | 30 | 7 | 3 | 2,090 | 115 | **1,975** |
| 9 | 80 | 58 | 15 | 7 | 4,678 | 200 | **4,478** |
| 12 | 150 | 105 | 30 | 15 | 9,705 | 350 | **9,355** |
| 18 | 300 | 210 | 60 | 30 | 19,410 | 650 | **18,760** |
| 24 | 500 | 350 | 100 | 50 | 32,350 | 1,100 | **31,250** |

### 5.3 Metricas clave a 12 meses

| Metrica | Valor |
|---------|-------|
| MRR (Monthly Recurring Revenue) | 9,705 EUR |
| ARR (Annual Recurring Revenue) | 116,460 EUR |
| Usuarios de pago | 45 |
| ARPU (Average Revenue Per User) | 216 EUR |
| Margen bruto | ~96% |
| CAC estimado (organico) | ~20 EUR |
| LTV (12 meses avg) | ~2,160 EUR |
| LTV/CAC ratio | 108x |

### 5.4 Metricas clave a 24 meses

| Metrica | Valor |
|---------|-------|
| MRR | 32,350 EUR |
| ARR | 388,200 EUR |
| Usuarios de pago | 150 |
| Utilidad acumulada 24 meses | ~190,000 EUR |

---

## 6. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Costos IA suben | Media | Alto | Migrar a Haiku para tareas simples, implementar caching agresivo |
| AEAT cambia formato XML | Alta | Medio | Monitorear novedades AEAT, builders modulares |
| Competencia con IA | Media | Medio | Diferenciacion por integracion real AEAT (no solo clasificacion) |
| Regulacion cambia (CAU) | Alta | Bajo | Ya implementado H1 (nuevo formato CAU) |
| Churn alto | Media | Alto | Onboarding asistido, soporte rapido, features exclusivos |

---

## 7. RECOMENDACIONES INMEDIATAS

### Prioridad 1: Primeros 3 clientes (Mes 1-2)
1. Conseguir alta EORI en PRE para demos funcionales
2. Crear demo grabada con expediente real
3. Contactar 3-5 transitarios/agentes de aduanas de Zaragoza
4. Ofrecer 3 meses gratis Professional a los primeros 3 clientes

### Prioridad 2: Optimizar costos IA (Mes 2-3)
1. Migrar clasificacion TARIC y chat a **Haiku 4.5** ($1/$5 vs $3/$15) - ahorro 67%
2. Implementar Prompt Caching - ahorro 90% en inputs repetidos
3. Usar Batch API para operaciones no urgentes - ahorro 50%
4. Meta: bajar costo IA de ~1.46 EUR a ~0.30 EUR por usuario/mes

### Prioridad 3: Escalar infra (Mes 3-6)
1. Upgrade a t3.small cuando haya 20 usuarios
2. Migrar MongoDB a Atlas cuando haya 50 usuarios
3. Implementar PM2 cluster mode
