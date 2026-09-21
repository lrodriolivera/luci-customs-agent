# Política de retención y supresión de datos

**Responsable del tratamiento (por cuenta del cliente):** STRIX AI PIONEER SOLUTIONS, S.L. — CIF B22477020
**Ámbito:** LUCI Customs Agent y sistemas derivados desarrollados por STRIX AI
**Versión:** 1.0 — 15 de agosto de 2026
**Revisión:** anual, o ante cambio normativo que afecte a los plazos

---

## 1. Objeto

Este documento fija **cuánto tiempo se conserva cada categoría de dato**, **qué ocurre al vencer el plazo** y **quién puede alterarlo**. Existe por tres motivos:

1. El RGPD (art. 5.1.e) exige que los datos personales no se conserven más tiempo del necesario, y que ese plazo esté determinado y sea demostrable.
2. La normativa aduanera obliga a lo contrario en ciertos casos: conservar durante años aunque el interesado pida el borrado.
3. Sin un documento que arbitre entre ambas, cada decisión de borrado se toma sobre la marcha y termina siendo inconsistente.

El criterio que resuelve el conflicto está en la sección 4.

---

## 2. Plazos de retención

Los plazos marcados **[implementado]** están aplicados en código y se ejecutan sin intervención. Los marcados **[por proyecto]** se fijan en el análisis inicial de cada desarrollo, porque dependen de la normativa sectorial del cliente.

### 2.1 Datos operativos y documentales

| Categoría | Plazo | Al vencer | Estado |
|---|---|---|---|
| Expediciones y declaraciones aduaneras | 4 años desde el cierre del ejercicio | Anonimización, no borrado | [por proyecto] |
| Documentos justificativos asociados a una declaración | Igual que la declaración que soportan | Se eliminan con ella | [por proyecto] |
| Certificados de firma (`.p12` / `.pfx`) | Mientras el titular sea cliente activo | Borrado seguro al cese | [implementado] |
| Solicitudes PUE y tránsitos | Igual que la declaración asociada | Anonimización | [por proyecto] |

> **Sobre el plazo aduanero.** El Código Aduanero de la Unión (Reglamento UE 952/2013, art. 51) obliga a conservar los documentos de la declaración **al menos 3 años**. La normativa fiscal española eleva el plazo de prescripción a **4 años** (Ley 58/2003, art. 66), y determinados regímenes especiales exigen más. Aplicamos 4 años como base y lo elevamos cuando el régimen del cliente lo requiera. Para un cliente sujeto a normativa chilena, el plazo se fija según el Código Tributario y la Ordenanza de Aduanas aplicables, y se documenta en el anexo del proyecto.

### 2.2 Datos de cuenta e identidad

| Categoría | Plazo | Al vencer | Estado |
|---|---|---|---|
| Cuenta de usuario activa | Mientras dure la relación | — | — |
| Cuenta dada de baja por el titular | Anonimización **inmediata** | Correo y nombre sustituidos; contraseña inutilizada | [implementado] |
| Identificadores fiscales (NIF, EORI) | Cifrados en reposo mientras se conserven | Se eliminan con el registro que los contiene | [implementado] |
| Cuentas inactivas sin baja expresa | 24 meses sin acceso | Aviso al titular; anonimización a los 30 días sin respuesta | [por proyecto] |

La baja de cuenta **no borra la fila**: sustituye el correo por una dirección no resoluble, el nombre por una etiqueta genérica, vacía el perfil y los permisos, y reemplaza la contraseña por un valor aleatorio que ninguna credencial puede reproducir. El registro queda desvinculado de la persona pero mantiene la integridad referencial de las declaraciones que ya se presentaron ante la Administración.

### 2.3 Registros técnicos y de auditoría

| Categoría | Plazo | Al vencer | Estado |
|---|---|---|---|
| Registro de auditoría (accesos y cambios) | 4 años | Exportación a almacenamiento frío y purga | [ver 2.4] |
| Ejecuciones de flujos de trabajo | 90 días | Borrado automático | [implementado] |
| Historial de búsquedas arancelarias | 12 meses | Borrado automático | [implementado] |
| Caché de clasificación asistida por IA | 30 días sin uso | Borrado automático | [implementado] |
| Claves de API | Según fecha de caducidad asignada | Borrado automático | [implementado] |
| Supresiones de correo (rebotes y bajas) | Según caducidad del registro | Borrado automático | [implementado] |
| Registros de aplicación (logs) | 90 días | Rotación y borrado | [por proyecto] |

Los borrados automáticos se ejecutan mediante índices TTL de la base de datos: no dependen de que alguien lance un proceso ni de que un servidor esté encendido a una hora concreta.

### 2.4 Excepción del registro de auditoría

El registro de auditoría es **append-only por diseño**: la aplicación rechaza activamente cualquier intento de modificarlo o borrarlo, incluido el suyo propio. Esto es deliberado — un registro que la propia aplicación puede borrar no sirve como prueba ante un incidente.

En consecuencia, **su purga no puede ejecutarse por la vía ordinaria**. Al cumplirse el plazo de 4 años, la depuración se realiza mediante procedimiento administrativo documentado, con estas condiciones:

- La ejecuta una persona con credencial de administración de base de datos, nunca la aplicación.
- Se exporta previamente el tramo a purgar a almacenamiento cifrado de solo lectura.
- La propia operación de purga se registra: qué rango se depuró, quién lo autorizó y cuándo.

**Estado actual:** procedimiento definido, ejecución pendiente de la primera aplicación real (ningún registro ha alcanzado los 4 años). El primer vencimiento previsto es en 2029.

### 2.5 Copias de seguridad

| Categoría | Plazo | Estado |
|---|---|---|
| Copia diaria local | 30 días | [implementado] |
| Copia remota cifrada (S3) | 90 días para objetos; 30 días para versiones anteriores | [implementado] |

Las copias se conservan cifradas y con acceso público bloqueado.

**Efecto de una copia sobre una supresión.** Un dato borrado del sistema activo sigue existiendo en las copias hasta que estas caducan. No las alteramos para eliminarlo de forma selectiva: manipular una copia de seguridad la invalida como tal y rompe la garantía de recuperación. El compromiso operativo es el siguiente:

- La supresión surte efecto **inmediato** en el sistema activo.
- El dato desaparece de todas las copias en un **máximo de 90 días**.
- Durante ese intervalo, las copias no se consultan salvo para recuperación ante desastre, y si una restauración reintrodujera un dato suprimido, la supresión se reaplica como parte del procedimiento de restauración.

Este punto debe comunicarse al titular cuando ejerza su derecho de supresión: decirle que el borrado es instantáneo y completo sería inexacto.

---

## 3. Datos enviados a modelos de inteligencia artificial

| Categoría | Plazo | Estado |
|---|---|---|
| Contenido enviado al modelo | No se retiene fuera de nuestra infraestructura | [implementado] |
| Resultado de la inferencia | Igual que el registro al que se asocia | [implementado] |
| Caché de clasificación | 30 días sin uso | [implementado] |

La inferencia se ejecuta en Amazon Bedrock **dentro de nuestra propia cuenta de AWS**. El contenido no se destina al entrenamiento de modelos de terceros ni queda retenido por el proveedor del modelo.

Cuando el sistema trata datos personales de categoría especial —salud, entre otros— se aplica además depuración previa de identificadores antes de la llamada, y los registros de la plataforma de inferencia se cifran y se someten a un plazo de retención propio, nunca el que trae por defecto.

---

## 4. Cuando la obligación legal vence al derecho de supresión

Es el conflicto habitual y conviene tenerlo resuelto por escrito antes de que se plantee.

Si una persona solicita la supresión de sus datos y esos datos forman parte de una declaración ya presentada ante la Administración, **la declaración no se borra**. El RGPD lo prevé expresamente: el derecho de supresión no se aplica cuando el tratamiento es necesario para cumplir una obligación legal (art. 17.3.b).

Lo que sí hacemos:

1. **Anonimizar** el registro personal asociado — la persona deja de ser identificable a partir de él.
2. **Conservar** el documento aduanero, desvinculado de la identidad, durante el plazo legal.
3. **Informar** al titular de qué se ha suprimido, qué se conserva y por qué, citando el fundamento.
4. **Registrar** la solicitud y la respuesta en el registro de auditoría.

El resultado es que la persona desaparece de la base de datos como sujeto identificable, mientras el documento que la Administración puede requerir sigue existiendo.

---

## 5. Reparto de responsabilidades

Cuando STRIX AI desarrolla y opera un sistema para un cliente, el cliente es **responsable del tratamiento** y STRIX AI actúa como **encargado**. De ahí se deriva:

| Decisión | A quién corresponde |
|---|---|
| Qué datos se recogen y con qué finalidad | Cliente |
| Plazos de retención concretos del proyecto | Cliente, asesorado por STRIX AI |
| Aplicar técnicamente esos plazos | STRIX AI |
| Atender las solicitudes de los titulares | Cliente, con las herramientas que provee STRIX AI |
| Ejecutar la supresión cuando procede | STRIX AI, a instrucción del cliente |
| Notificar una brecha a la autoridad de control | Cliente; STRIX AI le notifica a él dentro de 24 horas desde la detección |

Los plazos de este documento son los **valores por defecto**. Un cliente puede fijar plazos distintos siempre que respeten los mínimos legales aplicables; el cambio se documenta en el anexo de su proyecto y prevalece sobre lo aquí establecido.

---

## 6. Verificación

Que la política exista no prueba que se aplique. Los mecanismos de comprobación son:

- **Los plazos automáticos son inspeccionables**: los índices TTL se consultan directamente en la base de datos y muestran el plazo real vigente, no el declarado.
- **El registro de auditoría deja rastro de las supresiones**: cada baja de cuenta y cada ejercicio de derechos queda anotado con fecha, actor y alcance.
- **Revisión anual**: se comprueba que los plazos del código siguen coincidiendo con los de este documento y con la normativa vigente. Cualquier divergencia se corrige en el código, no en el documento.

---

## 7. Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-08-15 | Versión inicial. Documenta los plazos ya implementados y fija los pendientes de concretar por proyecto. |

---

## Anexo — Correspondencia con el código

Para auditoría técnica, la relación entre cada plazo y su implementación:

| Plazo | Dónde está implementado |
|---|---|
| Flujos de trabajo, 90 días | `src/models/WorkflowExecution.js` — índice TTL |
| Búsquedas arancelarias, 12 meses | `src/models/TaricSearchHistory.js` — índice TTL |
| Caché de IA, 30 días sin uso | `src/models/TaricAICache.js` — índice TTL sobre último acceso |
| Claves de API, según caducidad | `src/models/ClientApiKey.js` — índice TTL |
| Supresiones de correo | `src/models/EmailSuppression.js` — índice TTL |
| Anonimización en baja de cuenta | `src/routes/gdpr.js` — `POST /delete-account` |
| Borrado lógico con conservación | `src/utils/softDelete.js` — aplicado a usuarios, expediciones y declaraciones |
| Registro append-only | `src/models/AuditLog.js` — bloqueo de update y delete |
| Cifrado de identificadores fiscales | `src/utils/piiCrypto.js` — AES-256-GCM |
| Copia local, 30 días | `backup-mongo.sh` — `RETENTION_DAYS=30` |
