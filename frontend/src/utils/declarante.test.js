import { describe, test, expect } from 'vitest'
import { declaranteDe } from './declarante'

describe('declaranteDe', () => {
  test('en representación indirecta muestra la agencia (representative) como declarante', () => {
    const representative = { companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'indirect' }
    const client = { companyName: 'Importador SA', eori: 'ESX99999999' }

    const declarante = declaranteDe({ representative, client })

    expect(declarante).toEqual({ companyName: 'Agencia SL', eori: 'ESB22477020', isSelf: false })
  })

  test('en representación directa tambien muestra la agencia como declarante', () => {
    const representative = { companyName: 'Agencia SL', eori: 'ESB22477020', representationType: 'direct' }
    const client = { companyName: 'Importador SA', eori: 'ESX99999999' }

    const declarante = declaranteDe({ representative, client })

    expect(declarante.companyName).toBe('Agencia SL')
    expect(declarante.isSelf).toBe(false)
  })

  test('sin representative pero con el tenant con el mismo EORI que el cliente, es autodespacho', () => {
    const client = { companyName: 'Importador SA', eori: 'ESB22477020' }
    const tenant = { name: 'Importador SA', businessInfo: { eori: 'ESB22477020' } }

    const declarante = declaranteDe({ representative: undefined, client, tenant })

    expect(declarante).toEqual({ companyName: 'Importador SA', eori: 'ESB22477020', isSelf: true })
  })

  test('el representative con el mismo NIF que el cliente tambien cuenta como autodespacho', () => {
    const representative = { companyName: 'Importador SA', nif: 'B22477020' }
    const client = { companyName: 'Importador SA', eori: 'ESB22477020' }

    const declarante = declaranteDe({ representative, client })

    expect(declarante.isSelf).toBe(true)
    expect(declarante.companyName).toBe('Importador SA')
  })

  test('sin ningun dato devuelve vacio sin lanzar', () => {
    expect(declaranteDe({})).toEqual({ companyName: '', eori: '', isSelf: false })
    expect(declaranteDe()).toEqual({ companyName: '', eori: '', isSelf: false })
  })

  test('usa el nif del representative si no tiene eori (EORI = ES + nif)', () => {
    const representative = { companyName: 'Agencia SL', nif: '22477020' }
    const client = { companyName: 'Importador SA', eori: 'ESX99999999' }

    const declarante = declaranteDe({ representative, client })

    expect(declarante.eori).toBe('ES22477020')
  })
})
