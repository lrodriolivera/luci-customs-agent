import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AeatSumariaLinks from './AeatSumariaLinks'
import { AEAT_SUMMARY_LINKS, AEAT_SUMMARY_LINK_IDS } from '../../utils/enlacesAeat'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))

const linkById = (id) => AEAT_SUMMARY_LINKS.find((link) => link.id === id)

describe('AeatSumariaLinks', () => {
  test('muestra los tres enlaces de la Sede de la AEAT con href y rel seguros', () => {
    render(<AeatSumariaLinks expedition={{ transportMode: 'maritime' }} />)

    AEAT_SUMMARY_LINKS.forEach((link) => {
      const anchor = screen.getByRole('link', { name: link.titleKey })
      expect(anchor).toHaveAttribute('href', link.url)
      expect(anchor).toHaveAttribute('target', '_blank')
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  test('avisa de que estos enlaces piden el certificado digital del agente', () => {
    render(<AeatSumariaLinks expedition={{ transportMode: 'maritime' }} />)

    expect(screen.getByText('aeatSumariaLinks.certificateWarning')).toBeInTheDocument()
  })

  test('en un expediente maritimo destaca el enlace de maritimo sin ocultar los demas', () => {
    render(<AeatSumariaLinks expedition={{ transportMode: 'maritime' }} />)

    const maritimeItem = screen.getByRole('link', { name: linkById(AEAT_SUMMARY_LINK_IDS.MARITIME).titleKey }).closest('li')
    const g4Item = screen.getByRole('link', { name: linkById(AEAT_SUMMARY_LINK_IDS.G4).titleKey }).closest('li')

    expect(maritimeItem).toHaveTextContent('aeatSumariaLinks.highlighted')
    expect(g4Item).not.toHaveTextContent('aeatSumariaLinks.highlighted')
    // El resto de enlaces siguen visibles, solo no estan destacados.
    expect(screen.getByRole('link', { name: linkById(AEAT_SUMMARY_LINK_IDS.G4).titleKey })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: linkById(AEAT_SUMMARY_LINK_IDS.EXPORT).titleKey })).toBeInTheDocument()
  })

  test('en un expediente aereo destaca el enlace G4', () => {
    render(<AeatSumariaLinks expedition={{ transportMode: 'air' }} />)

    const g4Item = screen.getByRole('link', { name: linkById(AEAT_SUMMARY_LINK_IDS.G4).titleKey }).closest('li')
    expect(g4Item).toHaveTextContent('aeatSumariaLinks.highlighted')
  })

  test('en un expediente terrestre tambien destaca el enlace G4', () => {
    render(<AeatSumariaLinks expedition={{ transportMode: 'road' }} />)

    const g4Item = screen.getByRole('link', { name: linkById(AEAT_SUMMARY_LINK_IDS.G4).titleKey }).closest('li')
    expect(g4Item).toHaveTextContent('aeatSumariaLinks.highlighted')
  })

  test('sin modo de transporte conocido no destaca ningun enlace', () => {
    render(<AeatSumariaLinks expedition={{}} />)

    AEAT_SUMMARY_LINKS.forEach((link) => {
      const item = screen.getByRole('link', { name: link.titleKey }).closest('li')
      expect(item).not.toHaveTextContent('aeatSumariaLinks.highlighted')
    })
  })
})
