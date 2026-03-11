# Email 2: Solicitud de Acceso al Entorno BTO

**Para**: Nationale Helpdesk Douane - Software Developer Support
**Via**: Portal nh.douane.nl (tras registro) o tel. (088) 156 66 55
**CC**: luis.rodriguez@strixai.es

---

**Subject**: Request for BTO Test Environment Access - STRIX AI SL - DMS 4.0 & DECO Testing

Dear Dutch Customs Support Centre for Software Developers,

Following our registration as a software developer (see previous communication), we would like to request access to the BTO (Build to Order) test environment for testing our customs declaration software with DMS 4.0 and DECO.

## What we need to test

### 1. DECO (E-commerce H7 declarations)
- Submit H7 super-reduced dataset declarations for low-value consignments (≤150 EUR)
- Test IOSS (Import One Stop Shop) integration
- Test batch submission (multiple declarations per file)
- Validate response parsing and MRN generation

### 2. DMS 4.0 (Standard import declarations)
- Submit H1 import declarations
- Test correction workflow (declarant-corrects model)
- Test Container Release Message (CVB) integration for Rotterdam/Schiphol
- Validate NXXXX code handling

### 3. Digipoort communication
- Test mutual TLS with PKIoverheid certificate
- Test SOAP message submission and response handling
- Validate error code handling

## Technical readiness

We have already implemented:
- DECO H7 XML builder aligned with Annex B UCC column H7
- DMS 4.0 H1 XML builder aligned with EUCDM
- Digipoort SOAP client with PKIoverheid support
- Complete NL customs office codes (16 offices)
- NL document type codes (NXXXX format)
- Response parser for DMS/DECO/Digipoort formats
- Simulation mode for development (generates simulated MRN in NL format)

## Company details

- **Company**: STRIX AI SL (Spain)
- **EORI**: ESB22477020
- **Software name**: LUCI Customs Agent
- **Contact**: Luis Rodriguez (luis.rodriguez@strixai.es)

## Questions

1. Can a Spanish company (with EU EORI) access the BTO test environment?
2. Do we need a PKIoverheid test certificate, or can we use our Spanish FNMT certificate for BTO testing?
3. Is there a specific version of the MIG we should target for DECO?
4. What is the typical timeline for BTO access approval?

Thank you for your support.

Kind regards,

Luis Rodriguez
STRIX AI SL
luis.rodriguez@strixai.es
