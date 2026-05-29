# 1. Empezando con LUCI

[← Volver al índice](README.md)

---

## ¿Qué es LUCI?

LUCI (acrónimo de **L**ogística **U**niversal **C**ustoms **I**ntelligence) es una plataforma web que reúne en un único sitio todo lo que un agente de aduanas necesita en su día a día:

- **Expedientes**: ficha completa de cada operación, desde la llegada de la mercancía hasta el levante.
- **Declaraciones AEAT**: formularios H1 (importación), H7 (e-commerce bajo valor), AES (exportación), NCTS (tránsito), ENS (entrada sumaria), PUE (control SOIVRE/ROHS).
- **Cálculo de derechos**: arancel, IVA, impuestos especiales y preferencias arancelarias contra la base TARIC EU oficial (21.946 códigos cargados).
- **Inteligencia artificial**: asistente conversacional, clasificación TARIC automática, predicción del circuito (verde / naranja / rojo) **antes** de enviar a AEAT, detección de fraude, redacción asistida de respuestas a notificaciones.
- **Integraciones**: AEAT (Agencia Tributaria), VUA (Ventanilla Única Aduanera), TRACES NT (control sanitario UE), NCTS Phase 5 (tránsito UE).

---

## Acceso a la plataforma

| | |
|---|---|
| **URL** | <https://aduanas.strixai.es> |
| **Email** | el que te haya facilitado tu administrador (típicamente `nombre@empresa.es`) |
| **Contraseña** | la que recibiste por email — cámbiala en tu primer acceso desde *Tu perfil* |

> Si has olvidado tu contraseña, pide a un administrador que pulse **Restablecer contraseña** desde el [Panel de Administración → Usuarios](04-pantallas/administracion.md). Recibirás una contraseña temporal por email.

---

## Tu primer recorrido

Cuando entras por primera vez, lo que ves en pantalla es esto:

![Dashboard inicial](img/dashboard.png)

### El sidebar de la izquierda — tu mapa

Es la columna oscura siempre visible. Está organizada en 7 grupos lógicos. **Pulsa una sola vez para abrir el grupo y ver los enlaces hijos:**

| Grupo | Qué incluye | Cuándo lo usas |
|---|---|---|
| **Operaciones** | Dashboard, Expedientes, Circuitos, Requerimientos, Inspecciones, Comunicaciones, Plazos, Garantías | Tu zona principal — lo que tocas todos los días |
| **Declaraciones** | H1, H7, AES, ENS, NCTS, PUE | Para presentar formalmente algo a AEAT |
| **Cálculo y normativa** | Calculadora derechos, Preferencias, Motor reglas, IIEE/SILICIE, Contingentes, Normativa, Clasificación TARIC | Cuando necesitas saber cuánto se paga o qué reglas aplican |
| **Control aduanero** | Inspecciones, Plazos, Comunicaciones, Consultas ADDS | Cuando AEAT te pregunta o te exige algo |
| **Regímenes** | Especiales (IP, TA, CW, T1/T2), Garantías, OEA, Tránsitos NCTS | Operaciones que no son simple importación/exportación |
| **AEAT e Integraciones** | Certificados AEAT, Monitor AEAT, Aduanas NL, Integraciones | Configurar tus llaves digitales y vigilar el estado |
| **Administración** | Analytics y BI, ML Insights, Configuración, Admin Panel | Solo si eres administrador del tenant |

### La cabecera

Arriba de todo, siempre visible:

- **Selector de idioma** (bandera + código): pulsa para cambiar entre 🇪🇸 ES, 🏴 CA, 🏴 VA, 🇬🇧 EN, 🇫🇷 FR, 🇮🇹 IT, 🇵🇹 PT.
- **«Powered by Strix AI»**: indicación del proveedor; sin función operativa.

### El asistente flotante

Abajo a la izquierda hay un cuadro azul que dice **«Asistente LUCI · IA»**. Es un chatbot que entiende preguntas en lenguaje natural sobre cualquier expediente, código TARIC, normativa o procedimiento. Más detalles en [05. Asistente LUCI](05-asistente-luci-ia.md).

---

## El Dashboard — qué te dice de un vistazo

El Dashboard es la primera página que se abre. Resume el estado del tenant en cuatro tarjetas grandes:

- **Total expediciones** (ej. 111) — todos los expedientes activos del tenant.
- **Activos** (ej. 41) — los que aún no han sido cerrados.
- **Verde** (ej. 48) — los que ya han recibido levante automático.
- **Inspeccionar** (ej. 22) — los que esperan inspección física, documental o aforo.

Más abajo verás:

- **Acciones rápidas**: 4 botones (Clasificación, Calculadora, PUE SOIVRE, Declaraciones) que te llevan directo al flujo correspondiente.
- **Alertas** con tu badge de severidad (info / aviso / error). Si hay un MRN inminente o una garantía próxima a expirar, lo verás aquí.
- **Expediciones recientes** con su MRN, importador y badge de canal.
- **Cards informativas**: códigos TARIC en BD, capítulos CAU, idiomas soportados.

---

## Cambiar de idioma

Pulsa la bandera 🇪🇸 ES en la esquina superior derecha y elige otro idioma. Toda la interfaz se traduce al instante (incluido el asistente IA, los emails que envíes y los formularios). El idioma elegido queda guardado para tu sesión.

---

## Cerrar sesión

Esquina inferior izquierda del sidebar: **Cerrar sesión**. Tu JWT se invalida; tendrás que volver a introducir tu contraseña la próxima vez.

---

## Tu siguiente paso

- Si quieres aprender a **crear tu primer expediente paso a paso** → [03. Flujos diarios → Crear expediente](03-flujos-diarios/crear-expediente.md).
- Si te asaltan dudas con la jerga (`MRN`, `EORI`, `H7`…) → [02. Glosario aduanero](02-glosario-aduanero.md).

---

[← Índice](README.md) · [Siguiente: 02. Glosario →](02-glosario-aduanero.md)
