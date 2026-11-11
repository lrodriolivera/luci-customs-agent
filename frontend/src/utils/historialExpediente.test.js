import { describe, it, expect } from 'vitest'
import { textoEvento } from './historialExpediente'
import es from '../i18n/locales/es.json'

// `t` con las traducciones reales en castellano.
const t = (clave, opciones = {}) => {
  const valor = clave.split('.').reduce((nodo, parte) => nodo?.[parte], es)
  return typeof valor === 'string' ? valor : opciones.defaultValue
}

describe('textoEvento', () => {
  it('traduce la clave interna de la acción', () => {
    expect(textoEvento({ action: 'document_uploaded' }, t)).toBe('Documento subido')
    expect(textoEvento({ action: 'h1_generated', description: 'H1 generado' }, t)).toBe('Declaración H1 generada')
  })

  it('usa la descripción guardada cuando la acción no tiene traducción', () => {
    expect(textoEvento({ action: 'accion_nueva', description: 'Algo ocurrió' }, t)).toBe('Algo ocurrió')
  })

  it('sin traducción ni descripción escribe la clave como frase, sin guiones bajos', () => {
    expect(textoEvento({ action: 'accion_muy_nueva' }, t)).toBe('Accion muy nueva')
  })

  it('no falla con un evento vacío', () => {
    expect(textoEvento({}, t)).toBe('')
    expect(textoEvento(undefined, t)).toBe('')
  })

  it('todas las acciones que escribe el backend en el expediente tienen texto', () => {
    const acciones = ['expedition_created', 'document_uploaded', 'document_read', 'document_data_applied', 'document_deleted',
      'h1_generated', 'declaration_submitted', 'declaration_submitted_aeat', 'portal_link_sent', 'chat_message',
      'paraduanero_controls_created', 'ai_analysis', 'channel_assigned', 'taric_updated', 'aes_generated', 'status_change',
      'requirement_received']
    for (const accion of acciones) {
      expect(textoEvento({ action: accion }, t)).not.toMatch(/_/)
      expect(es.expeditions.timelineAction[accion]).toBeTruthy()
    }
  })
})
