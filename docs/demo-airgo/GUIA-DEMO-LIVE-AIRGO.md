# LUCI - Demo Live para AIRGO EXPRESS

**Preparado por:** STRIX AI SL
**Fecha:** 17 de marzo de 2026
**Para:** Equipo AIRGO EXPRESS + Equipo STRIX AI

---

## Acceso a la plataforma

| | |
|---|---|
| **URL** | https://aduanas.strixai.es |
| **Navegador** | Chrome o Firefox actualizado |

### Usuarios AIRGO EXPRESS

| Email | Password | Rol |
|-------|----------|-----|
| bvillanueva@airgoexpress.com | AirgoDemo2026 | Administrador |
| mquintana@airgoexpress.com | AirgoDemo2026 | Administrador |
| jsendarrubias@airgoexpress.com | AirgoDemo2026 | Agente |
| marcomula@airgoexpress.com | AirgoDemo2026 | Agente |
| aarriaga@airgoexpress.com | AirgoDemo2026 | Agente |

### Usuarios STRIX AI (evaluacion interna)

| Email | Password | Rol |
|-------|----------|-----|
| jenifer.romero@airgoexpress.com | AirgoDemo2026 | Administrador |
| patricia@airgoexpress.com | AirgoDemo2026 | Administrador |

> Estos usuarios son independientes y acceden al tenant de AIRGO EXPRESS.

---

## Que es LUCI

LUCI es una plataforma de gestion aduanera con inteligencia artificial que automatiza el ciclo completo de declaraciones de importacion/exportacion ante la AEAT.

---

## Funcionalidades disponibles

### 1. Dashboard principal
- KPIs en tiempo real: declaraciones, canales, expediciones
- Grafico de actividad y distribucion por estado
- Modelo IA activo, estadisticas de uso
- Selector de pais (Espana / Paises Bajos)

### 2. Declaraciones H7 (Bajo Valor < 150 EUR)
- **Lista de H7**: Todas las declaraciones con estado, MRN, canal, importes
- **Crear H7 manual**: Formulario completo con datos remitente, destinatario, partidas, valor
- **Importar Manifiesto CSV**: Subir un CSV con multiples envios y crear H7 en lote
  - La IA clasifica automaticamente cada linea del manifiesto
  - Preview de resultados antes de crear las declaraciones
  - Creacion en batch con un click
- **Enviar a AEAT**: Cada H7 se puede enviar individualmente a la AEAT (entorno PRE de pruebas)
- **Detalle H7**: MRN, circuito (verde/naranja/rojo), cumplimiento normativo, XML preview
- **Normativa N337**: Documento previo G4 deposito temporal (obligatorio desde 9/Mar/2026)
- **Banner EU 2026/382**: Informacion sobre la supresion de franquicia 150 EUR (julio 2026)

### 3. Declaraciones H1 (Importacion General)
- Formulario completo H1 con todas las casillas
- Envio a AEAT con respuesta MRN
- Historial de envios

### 4. Exportaciones AES
- Declaraciones de exportacion
- Envio a AEAT PRE
- Seguimiento de levante

### 5. Expediciones
- Crear expediciones de envio con datos de origen/destino
- Asociar declaraciones a expediciones
- Seguimiento de estado

### 6. Panel de Canales
- Vision general de circuitos asignados por AEAT
- Verde (levante inmediato), Naranja (documentos), Rojo (inspeccion)
- Incluye H7 y declaraciones generales

### 7. Asistente IA
- Chat integrado con IA especializada en aduanas
- Clasificacion arancelaria asistida
- Consultas sobre normativa, codigos TARIC, procedimientos

### 8. Configuracion
- Datos del tenant (NIF, EORI, garantia)
- Gestion de usuarios
- Certificados digitales
- Multi-pais (ES + NL)

---

## Flujo recomendado para probar

### Prueba rapida (5 minutos)
1. **Login** con cualquier usuario de arriba
2. **Dashboard**: ver el estado general
3. **H7**: hacer click en alguna declaracion existente para ver el detalle
4. **IA**: abrir el chat y preguntar algo (ej: "Que codigo TARIC tiene un telefono movil?")

### Prueba completa - Importar manifiesto (10 minutos)
1. **H7 > Importar Manifiesto**: subir el CSV de ejemplo
2. **Preview**: ver como la IA clasifica automaticamente cada envio
3. **Crear en lote**: pulsar para crear todas las H7
4. **Enviar a AEAT**: seleccionar una H7 y enviarla
5. **Detalle**: ver el MRN asignado, circuito, cumplimiento normativo

### Prueba avanzada - Crear H7 manual (5 minutos)
1. **H7 > Nueva H7**
2. Rellenar datos: remitente, destinatario, partida, valor
3. **Enviar a AEAT** desde el detalle
4. Ver respuesta con MRN y canal

---

## Datos precargados

La plataforma tiene datos de ejemplo:

| Tipo | Cantidad | Detalle |
|------|:--------:|---------|
| Declaraciones H7 | 25+ | De manifiesto CSV (24 draft + 1 released con MRN) |
| H7 con N337 | 4 | Cumplimiento normativa 9/Mar/2026 |
| Expediciones | Varias | Diferentes estados |

### CSV de ejemplo para importar
Se puede descargar la plantilla directamente desde la plataforma (boton "Descargar plantilla" en la pantalla de importar manifiesto).

---

## Entorno

- **Conexion AEAT**: Entorno de pruebas PRE (pre-produccion de la Agencia Tributaria)
- **Certificado digital**: FNMT valido hasta octubre 2027
- **Datos**: Los NIFs y MRN son de prueba, no afectan declaraciones reales
- **Multi-pais**: Espana activo, Paises Bajos preparado

---

## Normativa implementada

| Normativa | Estado | Detalle |
|-----------|--------|---------|
| Cierre DSDT aereos (9/Mar/2026) | Activo | N337 obligatorio, G4 deposito temporal |
| Reg. (UE) 2026/382 | Preparado | Supresion franquicia 150 EUR, derecho fijo 3 EUR/art (julio 2026) |
| Desconsolidacion G4 restringida | Activo | Solo ubicaciones "Admite DSDT = Si" |

---

## Soporte

| Contacto | Email | Rol |
|----------|-------|-----|
| Rodrigo Godoy | rodrigo.godoy@strixai.es | Comercial |
| Luis Rodriguez | luis.rodriguez@strixai.es | Tecnico |
| Jenifer Romero | jenifer.romero@strixai.es | Representante |

---

*STRIX AI SL - NIF: B22477020 - Documento confidencial*
