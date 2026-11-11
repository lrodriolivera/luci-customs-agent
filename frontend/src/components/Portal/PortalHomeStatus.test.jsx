import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import PortalHome from './PortalHome'
import PortalStatus from './PortalStatus'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && Object.prototype.hasOwnProperty.call(opts, 'defaultValue') ? `${key}|${opts.defaultValue}` : key)
  })
}))

// Lo que devuelve GET /api/portal/:token para el expediente de la UAT del
// 11/Nov/2026: factura, packing list y BL subidos; falta la autorizacion.
const expedition = {
  expeditionId: 'EXP-2026-2C409C67', operationType: 'import', transportMode: 'maritime', status: 'draft',
  client: { companyName: 'Distribuciones SL' },
  incoterm: { code: 'FOB', place: 'Shanghai' },
  documentChecklist: [
    { documentType: 'commercial_invoice', documentName: 'Factura Comercial', required: true, received: true },
    { documentType: 'packing_list', documentName: 'Packing List', required: true, received: true },
    { documentType: 'dispatch_authorization', documentName: 'Autorizacion de Despacho', required: true, received: false },
    { documentType: 'bill_of_lading', documentName: 'Bill of Lading (BL)', required: true, received: true },
    { documentType: 'eur1', documentName: 'EUR.1', required: false, received: false }
  ],
  goods: [{ description: 'Portatiles' }],
  timeline: [{ action: 'document_uploaded', description: 'Documento subido', timestamp: '2026-11-11T12:00:00Z' }],
  createdAt: '2026-11-11T10:00:00Z'
}

const montar = (Pantalla, exp = expedition) => render(
  <MemoryRouter initialEntries={['/portal/tok']}>
    <Routes>
      <Route path="/portal/:token" element={<Outlet context={{ expedition: exp, token: 'tok' }} />}>
        <Route index element={<Pantalla />} />
      </Route>
    </Routes>
  </MemoryRouter>
)

describe('PortalHome', () => {
  test('«Documentos requeridos» muestra por su nombre solo lo que falta', () => {
    montar(PortalHome)

    expect(screen.getByText('Autorizacion de Despacho')).toBeInTheDocument()
    expect(screen.queryByText('Factura Comercial')).not.toBeInTheDocument()
    expect(screen.queryByText('EUR.1')).not.toBeInTheDocument()
    expect(screen.getAllByText('common.pending')).toHaveLength(1)
  })

  test('el estado real del expediente tiene mensaje y progreso (ya no «desconocido» y 0 %)', () => {
    montar(PortalHome)

    expect(screen.getByText('portal.waitingDocs')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.queryByText('portal.unknownStatus')).not.toBeInTheDocument()
  })

  test('sin nada pendiente lo dice y el expediente deja de esperar documentos', () => {
    const completo = { ...expedition, documentChecklist: expedition.documentChecklist.map((d) => ({ ...d, received: true })) }
    montar(PortalHome, completo)

    expect(screen.getByText('portal.noPendingDocs')).toBeInTheDocument()
    expect(screen.getByText('portal.docsReceived')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })
})

describe('PortalStatus', () => {
  test('cuenta los documentos y muestra la ultima actualizacion que envia el portal', () => {
    montar(PortalStatus, {
      ...expedition,
      documents: [{ type: 'commercial_invoice' }, { type: 'packing_list' }, { type: 'bill_of_lading' }],
      updatedAt: '2026-11-11T12:00:00Z'
    })

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getAllByText('11/11/2026')).toHaveLength(2)
  })

  test('no se rompe con el incoterm como objeto y lo pinta como texto', () => {
    montar(PortalStatus)

    expect(screen.getByText('FOB Shanghai')).toBeInTheDocument()
    expect(screen.getByText('portal.statusTitle')).toBeInTheDocument()
  })

  test('marca el paso del estado real y traduce los eventos del historial', () => {
    montar(PortalStatus, { ...expedition, status: 'ready_for_declaration' })

    // El paso actual sale en la cabecera y en la lista de pasos.
    expect(screen.getAllByText('portal.stepDeclaration')).toHaveLength(2)
    expect(screen.getByText('expeditions.timelineAction.document_uploaded|Documento subido')).toBeInTheDocument()
  })

  test('un estado que no se reconoce no rompe la pantalla ni marca pasos', () => {
    montar(PortalStatus, { ...expedition, status: 'cancelled', incoterm: undefined })

    expect(screen.getByText('portal.unknown')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
