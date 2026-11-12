import { describe, test, expect } from 'vitest'
import { infoCanal } from './canalAeat'

describe('circuito de la AEAT en pantalla', () => {
  test('cada circuito tiene su etiqueta y su estado', () => {
    expect(infoCanal('green').etiqueta).toBe('expeditions.greenChannelFull')
    expect(infoCanal('orange').estado).toBe('expeditions.pendingDocReview')
    expect(infoCanal('red').estado).toBe('expeditions.pendingPhysicalInspection')
  })

  test('el amarillo no es rojo: está pendiente de certificados', () => {
    expect(infoCanal('yellow')).toMatchObject({ etiqueta: 'expeditions.yellowChannelFull', estado: 'expeditions.pendingCertificates' })
    expect(infoCanal('yellow').clase).not.toContain('red')
  })

  test('sin circuito asignado no se supone ninguno', () => {
    for (const canal of [undefined, null, '', 'otro']) {
      expect(infoCanal(canal)).toMatchObject({ etiqueta: 'expeditions.noChannelFull', estado: 'expeditions.noChannelYet' })
    }
  })
})
