/**
 * Tests de la pantalla de contingentes arancelarios.
 *
 * LA BATERIA ANTERIOR FIJABA EL BUG
 * ---------------------------------
 * Los mocks reproducian el catalogo cableado del backend: `09.1234` "Carne de
 * vacuno" con `agreement: 'Acuerdo UE-Mercosur'`, `duty.savings: 0.10` y
 * `volume.total`. Ninguno de esos numeros de orden existe en la base de la
 * Comision, EU-MERCOSUR no esta en vigor y el tipo dentro del contingente no lo
 * publica el sistema de contingentes. Habia incluso un test que comprobaba que
 * la pantalla pintara "5000.00 EUR" de ahorro, es decir, fijaba la cifra
 * inventada. Cuando el mock inventa un campo, el test deja de proteger justo
 * donde esta el bug.
 *
 * Lo que se comprueba ahora es que la pantalla no afirme lo que no sabe: que el
 * saldo va fechado, que "no se puede comparar" no se pinta como "agotado", que
 * no aparece ninguna cifra de ahorro y que un catalogo vacio no se lee como que
 * la UE no tiene contingentes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuotaManager from './QuotaManager'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

import api from '../../services/api'
import toast from 'react-hot-toast'

const URL_OFICIAL = 'https://ec.europa.eu/taxation_customs/dds2/taric/quota_consultation.jsp'

/** Contingente 090006 de 2026, con las cifras que publica QUOTA. */
const contingente = (extra = {}) => ({
  quotaId: 'Q090006',
  orderNumber: '090006',
  origins: 'ERGA OMNES',
  period: { start: '2026-01-01', end: '2026-12-31' },
  volume: {
    initial: { amount: 33496000, unit: 'Kilogram' },
    balance: { amount: 27624751.299, unit: 'Kilogram' },
    used: 5871248.701,
    unit: 'Kilogram',
    utilizationPercent: 17.53,
    isLiveBalance: false,
    syncedAt: '2026-08-10T06:00:00.000Z',
    balanceAgeHours: 3,
    balanceStale: false,
    officialSource: URL_OFICIAL
  },
  available: true,
  unitMismatch: null,
  critical: false,
  criticalSource: 'taric',
  exhaustionDate: null,
  originVerified: false,
  recommendation: 'Indicar el numero de orden en la declaracion y comprobar el saldo en la fuente oficial',
  warnings: [
    'Comprobar el saldo en el sistema oficial de contingentes antes de declarar: un contingente de reparto simultaneo (FCFS) puede agotarse en horas.',
    'Verificar la elegibilidad por origen y las condiciones del contingente en la consulta oficial.'
  ],
  ...extra
})

const respuestaBusqueda = (quotas, extra = {}) => ({
  data: {
    success: true,
    data: {
      found: quotas.length > 0,
      count: quotas.length,
      year: 2026,
      source: 'catalogo_oficial_sincronizado',
      officialSource: URL_OFICIAL,
      quotas,
      ...extra
    }
  }
})

const respuestaListado = (quotas, extra = {}) => ({
  data: {
    success: true,
    data: {
      count: quotas.length,
      total: 1125,
      page: 1,
      limit: 25,
      year: 2026,
      synced: true,
      lastSyncAt: '2026-08-10T06:00:00.000Z',
      officialSource: URL_OFICIAL,
      quotas,
      ...extra
    }
  }
})

const buscar = async (taric = '0302410000', cantidad = '1000') => {
  render(<QuotaManager />)
  fireEvent.change(screen.getByPlaceholderText('ej. 0302410000 (arenques)'), { target: { value: taric } })
  fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: cantidad } })
  fireEvent.click(screen.getByRole('button', { name: /Consultar contingentes/i }))
}

const irAPestana = (nombre) => {
  render(<QuotaManager />)
  fireEvent.click(screen.getByRole('button', { name: nombre }))
}

describe('QuotaManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('renderiza las tres pestanas sin consultar nada', () => {
      render(<QuotaManager />)

      expect(screen.getByText('quotaManager.title')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Buscar Contingentes' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Catálogo Oficial' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Contingentes Críticos' })).toBeInTheDocument()
      expect(api.get).not.toHaveBeenCalled()
    })

    it('no pide el valor aduanero, porque no puede calcular el ahorro', () => {
      // El campo anterior alimentaba un "Ahorro Estimado" sobre un tipo cableado
      // a 0,00: el tipo dentro del contingente esta en la medida de TARIC.
      render(<QuotaManager />)

      expect(screen.queryByPlaceholderText('50000.00')).not.toBeInTheDocument()
      expect(screen.queryByText(/Ahorro Estimado/i)).not.toBeInTheDocument()
      expect(screen.getByText(/no calcula el ahorro/i)).toBeInTheDocument()
    })

    it('advierte de que por debajo de 6 digitos no se busca', () => {
      render(<QuotaManager />)

      expect(screen.getByText(/Mínimo 6 dígitos/i)).toBeInTheDocument()
    })
  })

  describe('Consulta del catálogo', () => {
    it('envia el codigo, el origen, la cantidad y la unidad', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente()]))

      await buscar()

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/quotas/check-availability', {
          taricCode: '0302410000',
          originCountry: 'AR',
          quantity: 1000,
          unit: 'kg'
        })
      })
    })

    it('muestra el saldo con la fecha en que se consulto y enlaza a la fuente', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente()]))

      await buscar()

      await screen.findByText('090006')
      expect(screen.getByText(/Saldo consultado el/i)).toBeInTheDocument()
      const enlace = screen.getByRole('link', { name: /Consultar el saldo oficial/i })
      expect(enlace).toHaveAttribute('href', URL_OFICIAL)
      expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'))
      // El aviso de FCFS acompana siempre al saldo.
      expect(screen.getAllByText(/puede agotarse en horas/i).length).toBeGreaterThan(0)
    })

    it('avisa cuando el saldo mostrado ya esta caducado', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente({
        volume: { ...contingente().volume, balanceStale: true, balanceAgeHours: 72 }
      })]))

      await buscar()

      expect(await screen.findByText(/ya no sirve para decidir/i)).toBeInTheDocument()
    })

    it('dice que el saldo no tiene fecha en vez de presentarlo como actual', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente({
        volume: { ...contingente().volume, syncedAt: null, balanceStale: true }
      })]))

      await buscar()

      expect(await screen.findByText(/no tiene fecha de consulta registrada/i)).toBeInTheDocument()
    })

    it('no pinta "agotado" cuando lo que pasa es que no se puede comparar', async () => {
      // 090101 publica el saldo en EURO: comparar 1.000 kg con 1.964.263 EURO no
      // se puede, y `available: null` no es `false`.
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente({
        orderNumber: '090101',
        available: null,
        unitMismatch: 'La cantidad se pidio en kg y el saldo se publica en EURO: no se compara.',
        volume: {
          ...contingente().volume,
          initial: { amount: 2432000, unit: 'EURO' },
          balance: { amount: 1964263.541, unit: 'EURO' },
          unit: 'EURO'
        }
      })]))

      await buscar()

      expect(await screen.findByText('Saldo sin comprobar')).toBeInTheDocument()
      expect(screen.queryByText('Saldo insuficiente')).not.toBeInTheDocument()
      expect(screen.getByText(/se publica en EURO/i)).toBeInTheDocument()
    })

    it('distingue el saldo insuficiente del que no se ha comprobado', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente({
        available: false,
        recommendation: 'Saldo publicado insuficiente para la cantidad solicitada - comprobar en la fuente oficial'
      })]))

      await buscar()

      expect(await screen.findByText('Saldo insuficiente')).toBeInTheDocument()
      expect(screen.getByText(/insuficiente para la cantidad solicitada/i)).toBeInTheDocument()
    })

    it('no muestra ninguna cifra de ahorro ni tipos arancelarios', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente()]))

      await buscar()

      await screen.findByText('090006')
      expect(screen.queryByText(/Ahorro Estimado/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/EUR/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Arancel en contingente/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Arancel normal/i)).not.toBeInTheDocument()
    })

    it('traslada el aviso de que la elegibilidad por origen no esta resuelta', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente()]))

      await buscar()

      expect(await screen.findByText(/elegibilidad por origen/i)).toBeInTheDocument()
    })

    it('avisa de criticidad sin ofrecer una reserva que no existe', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente({ critical: true })]))

      await buscar()

      expect(await screen.findByText(/TARIC marca este contingente como crítico/i)).toBeInTheDocument()
      // La version anterior decia "Solicite reserva con urgencia": no hay reserva,
      // el cupo lo atribuye la aduana al aceptar la declaracion.
      expect(screen.queryByText(/[Ss]olicite reserva/i)).not.toBeInTheDocument()
    })

    it('muestra la fecha de agotamiento solo cuando la fuente la publica', async () => {
      api.post.mockResolvedValueOnce(respuestaBusqueda([contingente({ exhaustionDate: '2026-03-14' })]))

      await buscar()

      expect(await screen.findByText(/Fecha de agotamiento publicada: 2026-03-14/)).toBeInTheDocument()
    })

    it('sin resultados no afirma que se aplique el NMF', async () => {
      // "No hay contingente" seria una afirmacion sobre la realidad; lo que se
      // sabe es que el catalogo sincronizado no lo tiene.
      api.post.mockResolvedValueOnce(respuestaBusqueda([]))

      await buscar('8517120000', '100')

      expect(await screen.findByText(/catálogo oficial sincronizado no tiene contingente/i)).toBeInTheDocument()
      expect(screen.queryByText(/Se aplicará el arancel NMF/i)).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /consulta oficial de contingentes/i })).toHaveAttribute('href', URL_OFICIAL)
    })

    it('exige TARIC, origen y cantidad antes de consultar', async () => {
      render(<QuotaManager />)

      fireEvent.click(screen.getByRole('button', { name: /Consultar contingentes/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Complete TARIC, país de origen y cantidad')
      })
      expect(api.post).not.toHaveBeenCalled()
    })

    it('un fallo de red no se presenta como ausencia de contingente', async () => {
      api.post.mockRejectedValueOnce(new Error('Network timeout'))

      await buscar()

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al consultar contingentes')
      })
      expect(screen.queryByText(/no tiene contingente/i)).not.toBeInTheDocument()
    })

    it('propaga el mensaje de error del servidor', async () => {
      api.post.mockResolvedValueOnce({ data: { success: false, error: 'El código TARIC debe tener al menos 6 dígitos' } })

      await buscar('0302')

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('El código TARIC debe tener al menos 6 dígitos')
      })
    })
  })

  describe('Catálogo oficial', () => {
    it('pide la primera pagina acotada y muestra el total de la fuente', async () => {
      api.get.mockResolvedValueOnce(respuestaListado([contingente()]))

      irAPestana('Catálogo Oficial')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/list?page=1&limit=25')
      })
      // El total viaja para que 25 filas no se lean como el catalogo entero.
      // `toLocaleString('es-ES')` no agrupa los millares de 4 cifras: 1125, no 1.125.
      expect(await screen.findByText(/1125 contingentes en el catálogo/)).toBeInTheDocument()
      expect(screen.getByText(/Página 1 de 45/)).toBeInTheDocument()
    })

    it('un catalogo vacio se declara sin sincronizar, no sin contingentes', async () => {
      api.get.mockResolvedValueOnce(respuestaListado([], { total: 0, synced: false, lastSyncAt: null }))

      irAPestana('Catálogo Oficial')

      expect(await screen.findByText(/está sin sincronizar/i)).toBeInTheDocument()
      expect(screen.getByText(/no significa que no existan/i)).toBeInTheDocument()
    })

    it('marca el saldo caducado en la tabla', async () => {
      api.get.mockResolvedValueOnce(respuestaListado([contingente({
        volume: { ...contingente().volume, balanceStale: true }
      })]))

      irAPestana('Catálogo Oficial')

      expect(await screen.findByText('saldo caducado')).toBeInTheDocument()
    })

    it('no dibuja una barra de consumo cuando la fuente no da el porcentaje', async () => {
      api.get.mockResolvedValueOnce(respuestaListado([contingente({
        volume: { ...contingente().volume, utilizationPercent: null }
      })]))

      irAPestana('Catálogo Oficial')

      expect(await screen.findByText('sin dato')).toBeInTheDocument()
    })

    it('no muestra columna de acuerdo comercial', async () => {
      // La fuente no clasifica los contingentes por acuerdo y los que se
      // mostraban (CETA, EU-MERCOSUR) estaban inventados.
      api.get.mockResolvedValueOnce(respuestaListado([contingente()]))

      irAPestana('Catálogo Oficial')

      await screen.findByText('090006')
      expect(screen.queryByText(/MERCOSUR|CETA|Acuerdo UE/i)).not.toBeInTheDocument()
    })

    it('avisa por toast cuando el listado falla', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'))

      irAPestana('Catálogo Oficial')

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar contingentes')
      })
    })
  })

  describe('Contingentes críticos', () => {
    it('presenta la criticidad de TARIC aunque el consumo sea bajo', async () => {
      // Un contingente critico al 17,53%: la criticidad no es funcion del
      // porcentaje, la declara la Comision. Deducirla de >90% dejaba pasar
      // precisamente los que se agotan en horas.
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { count: 1, criticalSource: 'taric', quotas: [contingente({ critical: true })] }
        }
      })

      irAPestana('Contingentes Críticos')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/quotas/critical')
      })
      expect(await screen.findByText('Orden 090006')).toBeInTheDocument()
      expect(screen.getByText('17.53% consumido')).toBeInTheDocument()
    })

    it('avisa cuando el tope deja criticos fuera de la lista', async () => {
      // El catalogo real de 2026 tiene 291 criticos y el endpoint devuelve 200:
      // sin este aviso, la pestana se lee como "hay 200 criticos".
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            count: 1,
            totalCritical: 291,
            truncated: true,
            limit: 200,
            quotas: [contingente({ critical: true })]
          }
        }
      })

      irAPestana('Contingentes Críticos')

      expect(await screen.findByText(/291/)).toBeInTheDocument()
      expect(screen.getByText(/se muestran los 200/i)).toBeInTheDocument()
    })

    it('no pone el aviso de truncado cuando caben todos', async () => {
      api.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { count: 1, totalCritical: 1, truncated: false, limit: 200, quotas: [contingente({ critical: true })] }
        }
      })

      irAPestana('Contingentes Críticos')

      await screen.findByText('Orden 090006')
      expect(screen.queryByText(/se muestran los/i)).not.toBeInTheDocument()
    })

    it('dice que no se puede reservar cupo', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, data: { count: 1, quotas: [contingente({ critical: true })] } }
      })

      irAPestana('Contingentes Críticos')

      expect(await screen.findByText(/atribución la hace la aduana/i)).toBeInTheDocument()
    })

    it('no inventa una fecha de agotamiento cuando la fuente no la da', async () => {
      api.get.mockResolvedValueOnce({
        data: { success: true, data: { count: 1, quotas: [contingente({ critical: true, exhaustionDate: null })] } }
      })

      irAPestana('Contingentes Críticos')

      expect(await screen.findByText('no publicada')).toBeInTheDocument()
    })

    it('sin criticos aclara que es lo de la ultima sincronizacion', async () => {
      api.get.mockResolvedValueOnce({ data: { success: true, data: { count: 0, quotas: [] } } })

      irAPestana('Contingentes Críticos')

      expect(await screen.findByText(/Ningún contingente del catálogo está marcado como crítico/i)).toBeInTheDocument()
      expect(screen.getByText(/no una comprobación en vivo/i)).toBeInTheDocument()
    })

    it('avisa por toast cuando la consulta de criticos falla', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'))

      irAPestana('Contingentes Críticos')

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Error al cargar contingentes críticos')
      })
    })
  })
})
