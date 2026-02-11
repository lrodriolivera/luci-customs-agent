# Conexion con Servicios Web AEAT - LUCI Customs Agent

## Estado: LISTO PARA PRODUCCION

> **IMPORTANTE**: El registro de direcciones IP ante la AEAT fue **ELIMINADO**.
> Solo se necesita certificado electronico cualificado para autenticacion SSL mutua.

## Certificado Digital Configurado

| Campo | Valor |
|-------|-------|
| **Titular** | JENIFER ROMERO (70073780W) |
| **Empresa** | Stock Logistic S.L. (B22477020) |
| **EORI** | ESB22477020000 |
| **Tipo** | FNMT_PF (Persona Fisica como representante) |
| **Valido hasta** | 14/10/2027 (611 dias restantes) |
| **Estado** | Importado y verificado - Firma XAdES OK |

## Entornos AEAT

### Pruebas (PRE)
- **URL Base**: `https://prewww2.aeat.es`
- **Uso**: Desarrollo y testing

### Produccion
- **URL Base**: `https://www2.agenciatributaria.gob.es`
- **Uso**: Envio real de declaraciones

## Requisitos (todos cumplidos)

- [x] Certificado electronico cualificado
- [x] Firma XAdES-EPES (RSA-SHA256)
- [x] Conectividad SSL mutua verificada
- [x] Cliente SOAP implementado
- [x] XMLs validados contra esquemas XSD
- [x] Simulacion completa probada
- [ ] Test en entorno PRE con declaracion real
- [ ] Primer envio a produccion

## Servicios Web Disponibles

| Servicio | Path | Estado |
|----------|------|--------|
| H1 Importacion | `/wlpl/ADUA-JDIT/ws/PresDecAduana` | Implementado |
| H1 Consulta | `/wlpl/ADUA-JDIT/ws/ConsultaDeclarac` | Implementado |
| AES Exportacion | `/wlpl/ADUA-JDIT/ws/PresDecExportacion` | Implementado |
| Anulacion | `/wlpl/ADUA-JDIT/ws/AnulacionDeclara` | Implementado |
| H7 Bajo Valor | `/wlpl/ADUA-JDIT/ws/BajoValorH7` | Implementado |
| ENS/ICS2 | `/wlpl/ADUA-JDIT/ws/ENS_ICS2` | Implementado |
| NCTS Transito | `/wlpl/ADUA-JDIT/ws/TransitoNCTS` | Implementado |

## Protocolo de Comunicacion

- **Protocolo**: SOAP sobre HTTPS con SSL mutua (TLS 1.2/1.3)
- **Autenticacion**: Certificado electronico en handshake SSL
- **Firma**: XAdES-EPES segun politica AEAT (`urn:oid:2.16.724.1.3.1.1.2.1.9`)
- **Formato mensajes**: XML segun esquemas EUCDM
- **NO se requiere**: Registro de IP, permisos especiales, whitelisting

## Documentacion Tecnica AEAT

- [Guias tecnicas DUA](https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas/presentacion-dua.html)
- [AES Exportacion](https://sede.agenciatributaria.gob.es/Sede/aduanas/entrada-salida-mercancias/exportacion/sistema-electronico-exportacion-aes-p1.html)
- [H7 Bajo Valor](https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas/declaracion-aduanera-importacion-bajo-valor-h7.html)
- [Portal Desarrolladores](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html)
