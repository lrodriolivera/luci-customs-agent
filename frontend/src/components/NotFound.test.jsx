import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound'

// t(key) devuelve la propia clave: basta para verificar que el componente renderiza
// sin depender del bundle de traducciones real.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('<NotFound />', () => {
  test('renderiza el 404 y los dos enlaces de navegación', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('notFound.title')).toBeInTheDocument()

    const dashboard = screen.getByText('notFound.goToDashboard')
    expect(dashboard.closest('a')).toHaveAttribute('href', '/')

    const home = screen.getByText('notFound.home')
    expect(home.closest('a')).toHaveAttribute('href', '/landing')
  })
})
