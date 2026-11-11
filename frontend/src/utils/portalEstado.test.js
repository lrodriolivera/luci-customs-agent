import { describe, test, expect } from 'vitest'
import { pasoDelPortal, progresoDelPortal, documentosPendientes, documentosParaElCliente } from './portalEstado'

const doc = (documentType, required, received) => ({ documentType, documentName: documentType, required, received })
const CHECKLIST = [
  doc('commercial_invoice', true, true), doc('packing_list', true, true), doc('bill_of_lading', true, true),
  doc('dispatch_authorization', true, false), doc('eur1', false, false), doc('certificate_origin', false, true)
]

describe('portalEstado (UAT 11/Nov/2026)', () => {
  test.each([
    ['pending_documents', 'PENDING_DOCS', 10],
    ['documents_incomplete', 'PENDING_DOCS', 10],
    ['documents_received', 'DOCS_RECEIVED', 30],
    ['validating_documents', 'VALIDATING', 50],
    ['ready_for_declaration', 'PROCESSING', 70],
    ['declaration_draft', 'PROCESSING', 70],
    ['declaration_submitted', 'SUBMITTED', 90],
    ['green_channel', 'SUBMITTED', 90],
    ['levante', 'SUBMITTED', 90],
    ['completed', 'COMPLETED', 100]
  ])('el estado real «%s» es el paso %s (%i %%)', (status, paso, progreso) => {
    expect(pasoDelPortal({ status })).toBe(paso)
    expect(progresoDelPortal({ status })).toBe(progreso)
  })

  test('un estado que no se reconoce (cancelado, vacio) no marca ningun paso', () => {
    expect(pasoDelPortal({ status: 'cancelled' })).toBeNull()
    expect(pasoDelPortal(undefined)).toBeNull()
    expect(progresoDelPortal({ status: 'cancelled' })).toBe(0)
  })

  test('un borrador con documentos obligatorios pendientes esta esperando documentos', () => {
    expect(pasoDelPortal({ status: 'draft', documentChecklist: CHECKLIST })).toBe('PENDING_DOCS')
  })

  test('si ya no falta ningun obligatorio deja de «esperar documentos» aunque el estado interno no haya avanzado', () => {
    const completo = CHECKLIST.map((d) => ({ ...d, received: true }))
    expect(pasoDelPortal({ status: 'draft', documentChecklist: completo })).toBe('DOCS_RECEIVED')
    expect(progresoDelPortal({ status: 'pending_documents', documentChecklist: completo })).toBe(30)
  })

  test('sin checklist un borrador sigue esperando documentos', () => {
    expect(pasoDelPortal({ status: 'draft', documentChecklist: [] })).toBe('PENDING_DOCS')
  })

  test('pendientes: solo los obligatorios sin entregar', () => {
    expect(documentosPendientes({ documentChecklist: CHECKLIST }).map((d) => d.documentType)).toEqual(['dispatch_authorization'])
    expect(documentosPendientes({})).toEqual([])
  })

  test('al cliente se le enseñan los obligatorios y los ya entregados, no los opcionales sin entregar', () => {
    expect(documentosParaElCliente({ documentChecklist: CHECKLIST }).map((d) => d.documentType))
      .toEqual(['commercial_invoice', 'packing_list', 'bill_of_lading', 'dispatch_authorization', 'certificate_origin'])
  })
})
