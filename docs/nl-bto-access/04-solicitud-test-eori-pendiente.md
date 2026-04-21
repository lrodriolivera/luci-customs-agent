# NL - Solicitud Test EORI y acceso BTO/VTS-D

**Fecha:** 18/Mar/2026
**Estado:** PENDIENTE - Enviar via webformulario servicedesk

---

## Contexto

Douane NL ya no acepta solicitudes por email directo (desde 1/Ene/2025).
Todas las solicitudes deben ir por el webformulario:
`https://nh.douane.nl/softwareontwikkelaars/vraag-aan-de-servicedesk/`

**IMPORTANTE:** El formulario de EORI real (`nh.douane.nl/eori-nummer-aanvragen/`) NO es lo que necesitamos.
STRIX AI ya tiene EORI europeo (ESB22477020) valido en toda la UE.
Lo que necesitamos es un **test EORI para BTO** (entorno de pruebas).

---

## Datos para el formulario de servicedesk

| Campo | Valor |
|-------|-------|
| Nombre | Luis Rodriguez |
| Empresa | STRIX AI SL |
| Email | luis.rodriguez@strixai.es |
| Proceso | Marcar: DECO, DMS, NCTS |
| Pregunta sobre instalaciones de prueba? | Si |

### Texto para el campo "La pregunta" (max 800 caracteres):

```
Ref: sw-aanmelding-00000652 / gebruikersnaam: luisrodriguez

Wij ontwikkelen LUCI Customs Agent (EORI: ESB22477020) en willen graag aanvragen:

1) Test EORI-nummer voor de BTO
2) Toegang tot de BTO (DMS, DECO, NCTS)
3) Toegang tot de VTS-D

Onze software genereert XML-berichten conform MIG DMS 1.30 en MIG DECO 2.0. Wij hebben beide MIG-pakketten gedownload en onze berichten succesvol gevalideerd tegen de officiele XSD-schema's. Wij zijn klaar om te testen zodra wij de benodigde toegang en het test EORI-nummer ontvangen.

Contactpersoon: Luis Rodriguez, luis.rodriguez@strixai.es, +34 614 814 140

Met vriendelijke groet, Luis Rodriguez - STRIX AI SL
```

---

## Lo que pedimos (resumen)

1. **Test EORI-nummer** - Numero EORI ficticio para enviar declaraciones en BTO
2. **Acceso BTO** - Bedrijven Test Omgeving (entorno test, 24/7, max 100 msg/hora)
3. **Acceso VTS-D** - Validatie Test Service Douane (https://vtsd.belastingdienst.nl)

## Estado actual NL

- Portal NHD: acceso concedido (luisrodriguez)
- MIG descargados: DMS 1.30 (39 archivos) + DECO 2.0 (37 archivos)
- XML builders: reescritos y validados contra XSD oficiales (PASSED)
- Status query, amendment, cancellation: implementados
- Desplegado en servidor: OK
- Contacto Douane: Sophie Eikelenboom (sc.eikelenboom@douane.nl)
