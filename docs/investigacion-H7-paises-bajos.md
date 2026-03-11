# Investigacion: Implementacion H7 para Paises Bajos en LUCI

**Fecha**: 11 de Marzo de 2026
**Objetivo**: Analizar los procedimientos y normativas aduaneras de Paises Bajos equivalentes al H7 de España (AEAT) y definir el plan de implementacion en LUCI Customs Agent.

---

## 1. Contexto: H7 en España vs Paises Bajos

### H7 en España (AEAT) - Lo que ya tenemos

| Aspecto | España (AEAT) |
|---------|---------------|
| Sistema | AEAT / VUA (Ventanilla Unica Aduanera) |
| Protocolo | SOAP/XML via web services con certificado FNMT |
| Dataset | Columna H7 Anexo B UCC - dataset super-reducido |
| Ambito | Importaciones ≤150 EUR, exentas de derechos de aduana |
| Builder | `h7XmlBuilder.js` - XML especifico AEAT |
| Estado | **ACEPTADO** en PRE con MRN 26ES002801300011Z6 |

### H7 en Paises Bajos (Douane) - Lo que necesitamos

| Aspecto | Paises Bajos (Douane) |
|---------|----------------------|
| Sistema | **DECO** (Douane E-Commerce) para H7 low-value |
| Sistema full | **DMS 4.0** (Douane-aangiften Management Systeem) para H1 importacion normal |
| Protocolo | XML via **Digipoort** (pasarela electronica gobierno holandes) |
| Dataset | Columna H7 Anexo B UCC - mismo dataset EU que España |
| Ambito | Importaciones ≤150 EUR (mismo que España) |
| Certificado | PKIoverheid certificate (equivalente al FNMT español) |
| Estado actual | AGS reemplazado por DMS desde Julio 2024 |

---

## 2. Sistemas Aduaneros de Paises Bajos

### 2.1. DMS 4.0 (Douane-aangiften Management Systeem)

**Que es**: El sistema principal de declaraciones aduaneras de Paises Bajos. Reemplazo del antiguo AGS (Aangiftesysteem). Operativo desde Julio 2024.

**Equivalencia con España**:
- DMS 4.0 = equivalente a AEAT/VUA para importacion/exportacion normal
- Soporta declaraciones H1 (import completo), H2-H6 y exportacion

**Cambios clave vs AGS**:
- Mensajes EDIFACT reemplazados por **XML**
- Estructura de datos alineada con **Anexo B del UCC** (EU Customs Data Model)
- Documentos deben desglosarse por tipo (transporte, adicionales, autorizaciones, previos, soporte) - ya no se usa Vak44 como resumen
- Codigos nacionales cambiados de 9XXXX a NXXXX
- El declarante debe corregir errores el mismo (antes lo hacia Aduanas)
- Nuevo campo: "pais de origen preferencial"

### 2.2. DECO (Douane E-Commerce)

**Que es**: Sistema especifico para declaraciones e-commerce de bajo valor (≤150 EUR). Lanzado el 1 de Julio de 2021. **Este es el equivalente directo al H7 de AEAT**.

**Caracteristicas**:
- Dataset super-reducido H7 (columna H7, Anexo B UCC)
- Menos elementos que DMS/AGS
- Maximo 10.000 mensajes por archivo
- Tamaño maximo 14 MB por archivo
- Procesamiento optimo: 3.000-5.000 mensajes por archivo
- Soporte IOSS (Import One Stop Shop) para IVA

**Cuando usar DECO**:
- Envios e-commerce desde fuera de la UE
- Valor intrinseco ≤150 EUR
- Exentos de derechos de aduana (Art. 23/25 DRR)
- NO para: mercancias prohibidas/restringidas, muestras comerciales, mercancias devueltas

**Cuando usar DMS 4.0**:
- Importaciones normales (H1) sin limite de valor
- Mercancias con restricciones
- Declaraciones completas o simplificadas

### 2.3. VENUE (Obsoleto)

Sistema anterior para e-commerce simplificado. **Reemplazado por DECO** desde Diciembre 2023. Ya no esta en servicio.

### 2.4. Digipoort

**Que es**: La pasarela electronica del gobierno holandes para comunicacion empresa-gobierno.

**Equivalencia**: Es el equivalente al sistema de web services de AEAT, pero centralizado para todos los organismos gubernamentales holandeses.

**Requisitos**:
- Certificado **PKIoverheid** (emitido por Trust Service Providers autorizados)
- El certificado se usa para: identificacion, firma y cifrado
- Digipoort verifica el "sobre electronico" y enruta al organismo correcto

---

## 3. Comparativa Tecnica: AEAT vs Douane

| Caracteristica | España (AEAT) | Paises Bajos (Douane) |
|---------------|---------------|----------------------|
| **Sistema H7** | AEAT/VUA | DECO |
| **Sistema H1** | AEAT/VUA | DMS 4.0 |
| **Protocolo** | SOAP 1.2 / XML | XML via Digipoort |
| **Certificado** | FNMT (persona fisica/juridica) | PKIoverheid |
| **Formato mensaje** | XML con XSD propio AEAT | XML alineado con EUCDM |
| **Dataset H7** | Columna H7 Anexo B UCC | Columna H7 Anexo B UCC (**identico**) |
| **Entorno test** | PRE (prewww1.aeat.es) | BTO (Build to Order test environment) |
| **Soporte dev** | DIT AEAT (Jose Antonio) | NH.douane.nl (National Helpdesk) |
| **EORI** | Obligatorio | Obligatorio |
| **IVA e-commerce** | IOSS opcional | IOSS opcional |
| **Respuesta errores** | AEAT corrige o rechaza | Declarante debe corregir el mismo |
| **MIG docs** | Documentacion AEAT interna | nh.douane.nl (publico) |

### Dato clave: El dataset H7 es IDENTICO en toda la EU

El Anexo B del UCC define un dataset comun para H7 en **todos** los estados miembros. La diferencia esta en:
1. **El sistema receptor** (AEAT vs DECO/DMS)
2. **El protocolo de comunicacion** (SOAP AEAT vs Digipoort XML)
3. **El certificado** (FNMT vs PKIoverheid)
4. **Los codigos nacionales** (algunos difieren entre paises)

---

## 4. Requisitos para Implementar Paises Bajos en LUCI

### 4.1. Certificado Digital

| Requisito | Detalle |
|-----------|---------|
| Tipo | Certificado PKIoverheid (servidor o personal) |
| Emisores | KPN, Digidentity, QuoVadis (Trust Service Providers NL) |
| Coste | ~150-300 EUR/año |
| Uso | Autenticacion, firma, cifrado en Digipoort |
| Formato | .p12 / .pfx (igual que FNMT) |

**Accion**: El cliente de Paises Bajos necesita obtener su propio certificado PKIoverheid. Nosotros lo configuramos en LUCI igual que el certificado FNMT.

### 4.2. EORI

El cliente necesita un numero EORI holands (formato: NL + numero). Si ya opera en la UE puede que tenga uno.

### 4.3. Registro en Digipoort

- Registrar la empresa como usuario de Digipoort
- Configurar el certificado PKIoverheid
- Solicitar acceso al entorno BTO para testing

### 4.4. Acceso al Entorno de Test (BTO)

| Entorno | URL | Equivalente España |
|---------|-----|-------------------|
| BTO (test) | Proporcionado por nh.douane.nl | PRE AEAT |
| Produccion | Via Digipoort | Produccion AEAT |

---

## 5. Plan de Implementacion Tecnica

### Fase 1: Arquitectura Multi-Pais (1-2 semanas)

**Objetivo**: Refactorizar LUCI para soportar multiples paises sin duplicar codigo.

#### 1.1. Modelo de datos
```javascript
// Añadir al modelo Tenant
{
  country: { type: String, enum: ['ES', 'NL', 'BE', ...], default: 'ES' },
  customsConfig: {
    system: String,        // 'AEAT' | 'DMS' | 'DECO' | 'PLDA'
    environment: String,   // 'test' | 'production'
    certificatePath: String,
    certificatePassword: String,
    eoriNumber: String,
    endpoints: {
      declaration: String,
      query: String,
      amendment: String
    }
  }
}
```

#### 1.2. Refactorizar servicio AEAT en servicio generico
```
backend/src/services/customs/
  ├── customsServiceFactory.js    // Factory que devuelve el servicio segun pais
  ├── baseCustomsService.js       // Clase abstracta con interfaz comun
  ├── spain/
  │   ├── aeatService.js          // Servicio actual AEAT (refactorizado)
  │   ├── h1XmlBuilder.js         // Builder H1 España (existente)
  │   ├── h7XmlBuilder.js         // Builder H7 España (existente)
  │   ├── aesXmlBuilder.js        // Builder AES España (existente)
  │   └── ensXmlBuilder.js        // Builder ENS España (existente)
  ├── netherlands/
  │   ├── dmsService.js           // Servicio DMS 4.0
  │   ├── decoService.js          // Servicio DECO (H7 low-value)
  │   ├── dmsH1XmlBuilder.js      // Builder H1 Paises Bajos
  │   ├── decoH7XmlBuilder.js     // Builder H7 DECO
  │   └── digipoortClient.js      // Cliente Digipoort (equivalente a aeatClient)
  └── common/
      ├── uccDataMapper.js        // Mapeo datos EU comunes (Anexo B)
      └── euValidation.js         // Validaciones UCC comunes
```

#### 1.3. Interfaz comun (baseCustomsService.js)
```javascript
class BaseCustomsService {
  async submitDeclaration(expedition, declarationType) {}
  async queryDeclarationStatus(mrn) {}
  async amendDeclaration(mrn, data) {}
  async cancelDeclaration(mrn) {}
  async validateXml(xml, schema) {}
  getEndpoints() {}
  getCertificate() {}
}
```

### Fase 2: Implementar DECO H7 (2-3 semanas)

**Objetivo**: Builder XML para DECO + comunicacion con Digipoort.

#### 2.1. Builder DECO H7 (decoH7XmlBuilder.js)

El dataset H7 es el mismo Anexo B UCC que usamos en España, pero el formato XML es diferente (DMS vs AEAT):

**Datos H7 requeridos (super-reducido)**:
| # | Data Element | Descripcion |
|---|-------------|-------------|
| 1 | Declaration type | IM + procedure code |
| 2 | Country of dispatch | Pais de envio |
| 3 | Items | Numero de partidas |
| 4 | Declarant | EORI declarante |
| 5 | Exporter | Nombre/direccion exportador |
| 6 | Importer/Buyer | EORI importador |
| 7 | Customs value | Valor intrinseco (≤150 EUR) |
| 8 | Currency | Moneda |
| 9 | Commodity code | 6 digitos HS (no 10 como H1) |
| 10 | Description | Descripcion mercancias |
| 11 | Gross mass | Peso bruto |
| 12 | Number of packages | Numero de bultos |
| 13 | Transport document | Documento de transporte |
| 14 | IOSS number | Numero IOSS (si aplica) |
| 15 | Unique consignment reference | Referencia unica |

**Diferencias con H7 España**:
- Formato XML diferente (namespace DMS vs AEAT)
- Codigos nacionales NL diferentes (NXXXX vs 9XXXX en AGS)
- Documentos desglosados por tipo (no Vak44)
- Campo adicional "preferential country of origin"

#### 2.2. Cliente Digipoort (digipoortClient.js)

```javascript
class DigipoortClient {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.certificate = config.certificatePath;  // PKIoverheid .p12
    this.password = config.certificatePassword;
  }

  async sendDeclaration(xml) {
    // Similar a aeatClient pero con protocolo Digipoort
    // Headers: Content-Type: text/xml
    // Auth: PKIoverheid certificate (mutual TLS)
    // Subject field: DMS4.NL (identifier)
  }

  async getResponse(messageId) {
    // Polling respuestas de Aduanas NL
  }
}
```

#### 2.3. Mapeo de datos (uccDataMapper.js)

Dado que el dataset H7 es identico en toda la EU (Anexo B UCC), creamos un mapper comun:

```javascript
class UCCDataMapper {
  // Convierte expedicion LUCI → datos UCC H7 (pais-agnostico)
  static expeditionToH7Data(expedition) {
    return {
      declarationType: 'IM',
      countryOfDispatch: expedition.origin.country,
      declarant: { eori: expedition.declarant.eori },
      exporter: { name: expedition.exporter.name, address: ... },
      importer: { eori: expedition.importer.eori },
      customsValue: expedition.value,
      currency: expedition.currency || 'EUR',
      commodityCode: expedition.hsCode.substring(0, 6),  // 6 digitos para H7
      description: expedition.description,
      grossMass: expedition.weight,
      packages: expedition.packages,
      transportDocument: expedition.transportDoc,
      iossNumber: expedition.ioss || null
    };
  }
}

// Luego cada builder nacional convierte los datos UCC al formato XML local
// spain/h7XmlBuilder.js → XML AEAT
// netherlands/decoH7XmlBuilder.js → XML DECO/DMS
```

### Fase 3: Implementar DMS 4.0 H1 (2-3 semanas)

Para importaciones normales (valor >150 EUR o mercancias restringidas).

- Builder XML alineado con EUCDM
- Dataset H1 completo (Anexo B UCC)
- Gestion de correcciones (el declarante corrige, no Aduanas NL)
- Integracion con Container Release Message (CVB) para puertos holandeses

### Fase 4: Frontend Multi-Pais (1 semana)

- Selector de pais en configuracion de tenant
- Formularios adaptados segun pais (campos especificos NL)
- Dashboard con indicadores por pais
- Documentacion de ayuda contextual por pais

### Fase 5: Testing y Certificacion (2-3 semanas)

- Acceso al entorno BTO de Aduanas NL
- Tests de integracion DECO (H7)
- Tests de integracion DMS 4.0 (H1)
- Validacion con Aduanas NL (equivalente a las 47 rondas con AEAT)

---

## 6. Estimacion de Esfuerzo

| Fase | Tarea | Duracion | Dependencias |
|------|-------|----------|-------------|
| 1 | Arquitectura multi-pais | 1-2 semanas | Ninguna |
| 2 | DECO H7 builder + Digipoort | 2-3 semanas | Fase 1 + certificado PKIoverheid |
| 3 | DMS 4.0 H1 builder | 2-3 semanas | Fase 1 + MIG de nh.douane.nl |
| 4 | Frontend multi-pais | 1 semana | Fase 1 |
| 5 | Testing BTO | 2-3 semanas | Fases 2-3 + acceso BTO |
| **Total** | | **8-12 semanas** | |

---

## 7. Requisitos del Cliente

### Lo que el cliente debe proporcionar:

1. **Certificado PKIoverheid** (.p12 / .pfx) - obtener de KPN, Digidentity o QuoVadis
2. **Numero EORI holandes** (NLxxxxxxxxx)
3. **Acceso al entorno BTO** - solicitar en nh.douane.nl
4. **Autorizaciones aduaneras** vigentes en Paises Bajos
5. **Datos de la empresa**: KvK number (Camara de Comercio NL), direccion fiscal NL
6. **Representante aduanero NL** (si no operan directamente) o licencia AEO

### Lo que nosotros debemos obtener:

1. **Especificaciones MIG** (Message Implementation Guide) de DMS 4.0 y DECO desde nh.douane.nl
2. **XSD schemas** de los mensajes XML desde el portal de desarrolladores
3. **Credenciales de test** para el entorno BTO
4. **Documentacion de codigos nacionales NL** (NXXXX)

---

## 8. Ventaja Competitiva

### Propuesta de valor multi-pais:

Al implementar Paises Bajos, LUCI se convierte en una **plataforma multi-pais** con una propuesta unica:

| Aspecto | Competidores (MIC-CUST, Customs4trade, etc.) | LUCI |
|---------|---------------------------------------------|------|
| Precio | 500-5.000 EUR/mes | 149-749 EUR/mes |
| IA | No | Claude IA para clasificacion, chat, asistencia |
| Multi-pais | Si (pero caro y complejo) | Si (a precio accesible) |
| Setup | Semanas/meses | Horas (self-service) |
| e-Commerce H7 | Parcial | Completo (AEAT + DECO) |

### Paises siguientes (misma arquitectura):

Una vez implementada la arquitectura multi-pais, añadir nuevos paises es incremental:

| Pais | Sistema | Esfuerzo |
|------|---------|----------|
| Belgica | PLDA / IDMS | 3-4 semanas (similar a NL) |
| Alemania | ATLAS | 4-5 semanas |
| Francia | DELTA-G / DELTA-X | 4-5 semanas |
| Portugal | SDS / e-AMA | 3-4 semanas (idioma similar) |
| Italia | AIDA | 4-5 semanas |

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Retraso en obtener certificado PKIoverheid | Media | Alto | Iniciar tramite inmediatamente |
| Documentacion MIG solo en holandes | Alta | Medio | Usar traduccion + contacto NH helpdesk |
| Diferencias en validaciones NL vs ES | Media | Medio | Testing exhaustivo en BTO |
| Digipoort mas complejo que AEAT WS | Baja | Medio | Existe microservicio open-source de referencia |
| Cliente no tiene EORI | Baja | Alto | Verificar antes de empezar |

---

## 10. Proximos Pasos Inmediatos

1. **Contactar al cliente** para obtener: certificado PKIoverheid, EORI NL, datos empresa
2. **Descargar MIG y XSD** de nh.douane.nl (especificaciones DMS 4.0 y DECO)
3. **Solicitar acceso BTO** (entorno de test de Aduanas NL)
4. **Iniciar Fase 1**: Refactorizar arquitectura multi-pais en LUCI
5. **Estudio detallado del microservicio Digipoort** open-source (GitHub: beemsoft/digipoort-microservice)

---

## Fuentes

- [Dutch Customs - DMS System Info](https://www.douane.nl/en/themes/declaration-systems/system-information/declaration-system-dms/)
- [Dutch Customs - Software Developer Info](https://www.douane.nl/en/themes/declaration-systems/customs-development-of-digital-declaration-software/)
- [DECO - Declaration system for e-commerce](https://www.belastingdienst.nl/wps/wcm/connect/en/customs/content/declaration-in-deco)
- [DMS Migration FAQ](https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/customs/declaration-systems-dms-ags/from-ags-and-gspa-to-dms/what-will-change-for-you/)
- [EU Customs Data Model (EUCDM)](https://taxation-customs.ec.europa.eu/online-services/online-services-and-databases-customs/eu-customs-data-model-eucdm_en)
- [EU Low Value Consignments Guidance](https://taxation-customs.ec.europa.eu/customs/customs-procedures-import-and-export/customs-operations/customs-formalities-low-value-consignments_en)
- [Annex B H7 Matrix (PDF)](https://taxation-customs.ec.europa.eu/document/download/54db8812-e28c-4470-97e1-333b2e167fa2_en)
- [Digipoort Microservice (GitHub)](https://github.com/beemsoft/digipoort-microservice)
- [PwC - Dutch Customs Systems Change](https://www.pwc.nl/en/insights-and-publications/tax-news/vat/dutch-customs-is-changing-the-customs-declaration-systems.html)
- [DMS Roadmap (PDF)](https://nh.douane.nl/en/wp-content/uploads/sites/2/2022/12/ROADMAP-DMS-4.0_English.pdf)
- [Customs4trade - DECO](https://www.customs4trade.com/blog/deco-ecommerce-netherlands)
- [Customs4trade - Netherlands DMS](https://www.customs4trade.com/customs-changes/the-netherlands)
- [MIC-CUST - AEAT Spain](https://www.mic-cust.com/landingpages/global-implementations/solutions/customs-clearance-solution-for-aeat/)
- [Stream Software - DMS4](https://www.streamsoftware.eu/en/stories/customs-streamliner-dms4)
