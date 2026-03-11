# Email Template - Cliente Paises Bajos

**Para:** [Cliente NL]
**De:** STRIX AI SL
**Asunto:** LUCI Customs Agent - Configuracion para Paises Bajos (DMS/DECO)
**Fecha borrador:** 11/03/2026

---

Estimado/a [nombre],

Le escribimos desde STRIX AI SL para presentarle nuestra plataforma **LUCI Customs Agent**, una solucion de gestion aduanera multi-pais basada en inteligencia artificial que ya esta operativa en Espana con la AEAT (Agencia Tributaria) y que hemos ampliado para operar en Paises Bajos.

## Lo que ya tenemos listo para Paises Bajos

Hemos completado la integracion con los sistemas aduaneros holandeses y disponemos de:

- **DECO H7** - Declaraciones de bajo valor (e-commerce hasta 150 EUR) con todos los elementos del Anexo B del UCC
- **DMS 4.0 H1** - Importacion completa segun EUCDM (European Union Customs Data Model)
- **Batch DECO** - Procesamiento masivo de hasta 10.000 declaraciones por archivo
- **CVB (Container Release Message)** - Para importaciones maritimas
- **Flujo de correcciones** - Adaptado al modelo holandes donde el declarante corrige directamente
- **Panel NL** - Con estado del sistema en tiempo real y correcciones pendientes

Ya estamos registrados en el entorno de pruebas BTO de la aduana holandesa (nh.douane.nl, ticket sw-aanmelding-00000652).

## Lo que necesitamos de ustedes para configurar su cuenta

Para poner en marcha su integracion, necesitariamos los siguientes datos:

### Obligatorios
1. **Certificado PKIoverheid (.p12)** - Es el certificado digital requerido por la aduana holandesa. Se obtiene a traves de proveedores autorizados:
   - [KPN](https://certificaat.kpn.com/)
   - [Digidentity](https://www.digidentity.eu/)
   - [QuoVadis](https://www.quovadisglobal.nl/)

   Si ya disponen de uno para operar con la aduana, nos valdria ese mismo.

2. **Numero EORI holandes** - Formato NL + 9 digitos (ej: NL123456789)

### Para optimizar la configuracion
3. **Aduana(s) principal(es) donde operan** - Rotterdam, Schiphol, Amsterdam u otra
4. **Tipo de operaciones**:
   - Solo H7 (e-commerce con valor hasta 150 EUR)
   - H1 (importacion completa)
   - Ambas
5. **Si trabajan con CVB** (Container Release Message) para importaciones maritimas
6. **Volumen aproximado** de declaraciones al mes

## Proximos pasos

1. Una vez tengamos su certificado PKIoverheid y numero EORI, podemos configurar las pruebas en el entorno BTO (pruebas) de la aduana holandesa
2. Realizamos pruebas conjuntas para validar que todo funciona con sus datos reales
3. Paso a produccion

## Referencia: Resultados en Espana

Como referencia, en Espana ya tenemos operativos los siguientes servicios con la AEAT, todos validados y aceptados en su entorno de pruebas:
- H1 (importacion)
- H7 (bajo valor)
- AES (exportacion)
- ENS (declaracion sumaria de entrada)

Estariamos encantados de organizar una **demo online** para mostrarle la plataforma en funcionamiento, tanto el flujo espanol como el holandes. Podemos adaptarnos a su horario.

Quedamos a su disposicion para cualquier consulta.

Un cordial saludo,

Jenifer Romero
STRIX AI SL
NIF: B22477020 / EORI: ESB22477020
Web: https://aduanas.strixai.es
