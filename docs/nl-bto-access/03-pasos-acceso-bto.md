# Pasos para Obtener Acceso BTO - Aduanas Paises Bajos

## Paso 1: Registrarse en nh.douane.nl (inmediato)

1. Ir a https://nh.douane.nl/softwareontwikkelaars/
2. Crear cuenta gratuita como desarrollador de software
3. Suscribirse al "Products and Services catalogue for Developers"
4. Esto da acceso a: MIGs, specs, BTO info, VTS

**Nota**: El portal esta mayormente en holandes. Usar Google Translate o contactar directamente.

## Paso 2: Descargar documentacion tecnica

Tras el registro, buscar y descargar:
- MIG DMS 4.0 (Message Implementation Guide)
- MIG DECO (E-commerce H7)
- XSD schemas para mensajes XML
- Codebook DMS (todos los codigos nacionales)
- Documentacion Digipoort (protocolo comunicacion)

## Paso 3: Solicitar acceso BTO

Opciones:
1. **Via portal nh.douane.nl** - Formulario en la seccion de desarrolladores
2. **Via telefono** - (088) 156 66 55 (horario NL)
3. **Via email** - Usar el email 01 como base

Enviar el email 01 (registro) primero, esperar confirmacion, luego enviar email 02 (BTO).

## Paso 4: Obtener certificado de test

Para el entorno BTO se necesita:
- Opcion A: Certificado PKIoverheid de test (solicitar al helpdesk)
- Opcion B: Preguntar si aceptan FNMT español para testing
- El cliente NL necesitara su propio PKIoverheid para produccion

## Paso 5: Configurar y testear

1. Configurar endpoints BTO en nuestro sistema
2. Ejecutar tests con las 81 pruebas unitarias ya creadas
3. Enviar primera declaracion H7 DECO de prueba
4. Validar respuestas con VTS (Validation Test Service)
5. Iterar hasta aceptacion completa

## Contactos utiles

| Quien | Contacto | Para que |
|-------|----------|---------|
| NHD Helpdesk | (088) 156 66 55 | Registro, BTO, soporte tecnico |
| NHD Web | https://nh.douane.nl | Portal desarrolladores |
| Douane.nl | https://www.douane.nl/en/contact/ | Info general aduanas NL |
| Belastingdienst | https://www.belastingdienst.nl/wps/wcm/connect/en/customs/ | Normativa |

## Timeline estimado

| Paso | Duracion |
|------|----------|
| Registro portal | 1-2 dias |
| Descarga MIGs/XSD | Mismo dia tras registro |
| Aprobacion BTO | 1-2 semanas |
| Certificado test | 1-2 semanas |
| Testing DECO H7 | 2-3 semanas |
| Testing DMS H1 | 2-3 semanas adicionales |
| **Total** | **5-8 semanas** |

## Pregunta importante: Empresa española con acceso NL

Segun la documentacion, cualquier empresa con EORI puede operar en NL. Pero el acceso al BTO como desarrollador de software puede requerir:
- Estar en la lista de desarrolladores reconocidos (https://www.belastingdienst.nl/.../overview_of_software_developers)
- Puede que necesitemos un partner holandes o registrarnos formalmente

**Accion recomendada**: Llamar al helpdesk primero para preguntar antes de enviar emails.
