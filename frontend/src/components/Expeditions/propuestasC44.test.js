import { describe, test, expect } from 'vitest'
import { propuestasC44 } from './propuestasC44'

const med = (codigo, docs, area = 'TODOS ERGA OMNES') => ({ codigo, areaGeografica: area, documentos: docs.map(([c, d]) => ({ codigo: c, descripcion: d })) })
// Medidas reales de 6302210089 (CN) y una preferencia de Vietnam, 16/11/2026.
const AEAT = { medidas: [
  med('103-APPL', []),
  med('107-LVC', [['C127', 'Identificador comercial'], ['Y081', 'No existe identificador']]),
  med('117-SUSSH', [['C990', 'Autorización destino final buques']]),
  med('800-Union', [['Y126', 'Ventas a distancia']]),
  med('142-PREF', [['N954', 'Certificado EUR.1']], 'VN Vietnam'),
  med('750-Organ', [['C644', 'Certificado de control ecológico']])
] }
const CERTIFICADOS = { partidas: [{ numero: 1, organismos: [{ organismo: 'SIF01', nombre: 'SOIVRE Mº Comercio', medidas: [{ medida: 'COM', documentos: ['1310', '1314'] }] }] }] }

describe('propuestasC44', () => {
  test('exige los certificados de la AEAT y los documentos de medidas que aplican a un H1', () => {
    const { exigidos } = propuestasC44(AEAT, { itemNumber: 1 }, CERTIFICADOS)
    expect(exigidos.map((d) => [d.tipo, d.motivo])).toEqual([['1310', 'aeatExige'], ['1314', 'aeatExige'], ['C644', 'medida']])
  })

  test('deja aparte, con su motivo, los condicionales que no aplican a un H1', () => {
    const { condicionales } = propuestasC44(AEAT, { itemNumber: 1 }, CERTIFICADOS)
    expect(condicionales.map((d) => [d.tipo, d.motivo])).toEqual([
      ['C127', 'soloH7'], ['Y081', 'soloH7'], ['Y126', 'soloH7'], ['N954', 'siPreferencia']
    ])
  })

  test('nunca propone autorizaciones (C990)', () => {
    const { exigidos, condicionales } = propuestasC44(AEAT, { itemNumber: 1 }, null)
    expect([...exigidos, ...condicionales].some((d) => d.tipo === 'C990')).toBe(false)
  })

  test('si la partida usa la preferencia, su prueba de origen pasa a exigida', () => {
    const { exigidos } = propuestasC44(AEAT, { itemNumber: 1, aeatTariff: { medidaArancel: '142-PREF' } }, null)
    expect(exigidos.map((d) => d.tipo)).toEqual(['N954', 'C644'])
  })

  test('no repite lo que ya está en la partida ni certificados de otras partidas', () => {
    const { exigidos } = propuestasC44(AEAT, { itemNumber: 2, documentosC44: [{ tipo: 'C644', referencia: 'X' }] }, CERTIFICADOS)
    expect(exigidos).toEqual([])
  })
})
