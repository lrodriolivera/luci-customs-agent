import React from 'react'
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MedidasOficialesTaric from './MedidasOficialesTaric'

const partida = (measures, extra = {}) => ({
  itemNumber: 1, taricCode: '0201100000', originCountry: 'BR', source: { mes: '2026-11' }, measures, ...extra
})
const veterinario = {
  tipo: '410', nombre: 'Control veterinario', baseLegal: 'Regulation 0632/21', prohibicion: false,
  ambito: { codigo: '0201000000', origen: '1008', origenNombre: 'All third countries' },
  condiciones: [{
    grupo: 'B',
    certificados: [{ codigo: 'N853', descripcion: 'Documento Sanitario Común de Entrada' }, { codigo: 'Y170', descripcion: null }],
    exenciones: [], impideSinCertificado: true
  }]
}

describe('<MedidasOficialesTaric />', () => {
  test('sin partidas consultadas no muestra nada', () => {
    const { container } = render(<MedidasOficialesTaric partidas={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('muestra la medida, su base legal y los certificados entre los que elegir', () => {
    render(<MedidasOficialesTaric partidas={[partida([veterinario])]} />)

    expect(screen.getByText('Control veterinario')).toBeInTheDocument()
    expect(screen.getByText(/Regulation 0632\/21/)).toBeInTheDocument()
    expect(screen.getByText('Declarar uno de estos documentos en la casilla 44:')).toBeInTheDocument()
    expect(screen.getByText('N853')).toBeInTheDocument()
    expect(screen.getByText(/Documento Sanitario Común de Entrada/)).toBeInTheDocument()
    expect(screen.getByText('Y170')).toBeInTheDocument()
    expect(screen.getByText(/Partida 1 · 0201100000 · origen BR/)).toBeInTheDocument()
    expect(screen.getByText(/Datos de la Comisión Europea, 2026-11/)).toBeInTheDocument()
  })

  test('una prohibición se avisa como tal', () => {
    const prohibicion = { tipo: '277', nombre: 'Prohibición de importación', baseLegal: 'Regulation 0936/15', prohibicion: true, condiciones: [] }
    render(<MedidasOficialesTaric partidas={[partida([prohibicion], { originCountry: 'KP' })]} />)

    expect(screen.getByText('La importación está prohibida para este origen.')).toBeInTheDocument()
  })

  test('una exención por cantidad se indica', () => {
    const residuos = {
      ...veterinario, tipo: '755', nombre: 'Control de importación de residuos',
      condiciones: [{ grupo: 'E', certificados: [{ codigo: 'C672', descripcion: 'Documento de residuos' }], exenciones: [{ cantidad: 20, unidad: 'KGM' }] }]
    }
    render(<MedidasOficialesTaric partidas={[partida([residuos])]} />)

    expect(screen.getByText('Declarar en la casilla 44:')).toBeInTheDocument()
    expect(screen.getByText('Exento hasta 20 KGM.')).toBeInTheDocument()
  })

  test('si ninguna partida tiene medidas lo dice', () => {
    render(<MedidasOficialesTaric partidas={[partida([])]} />)

    expect(screen.getByText('El TARIC no aplica medidas de control a estas partidas.')).toBeInTheDocument()
  })

  test('una medida de sanciones se marca y hay un aviso general', () => {
    const sancion = {
      tipo: '762', nombre: 'Control de importación', baseLegal: 'Regulation 0833/14', prohibicion: false, condiciones: [],
      sancion: { pais: 'Rusia', norma: 'Reglamento (UE) n.º 833/2014' }
    }
    render(<MedidasOficialesTaric partidas={[partida([sancion], { originCountry: 'RU' })]} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Hay partidas afectadas por sanciones de la UE')
    expect(screen.getByText('Sanciones de la UE · Rusia · Reglamento (UE) n.º 833/2014')).toBeInTheDocument()
  })

  test('sin sanciones no hay aviso', () => {
    render(<MedidasOficialesTaric partidas={[partida([veterinario])]} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('avisa del posible doble uso aunque la partida no tenga medidas de control', () => {
    render(<MedidasOficialesTaric partidas={[partida([], { taricCode: '8471300000', originCountry: 'CN', dualUse: [{ categoria: '4A001', nota: 'DU216' }, { categoria: '5A002', nota: 'DU229' }] })]} />)

    expect(screen.getByText('Posible producto de doble uso (Reglamento (UE) 2021/821)')).toBeInTheDocument()
    expect(screen.getByText('4A001')).toBeInTheDocument()
    expect(screen.getByText('5A002')).toBeInTheDocument()
    expect(screen.queryByText('El TARIC no aplica medidas de control a estas partidas.')).not.toBeInTheDocument()
  })

  test('cada categoría de doble uso lleva el encabezado oficial del anexo I y la fuente enlazada', () => {
    const dualUse = [
      { categoria: '5A002', nota: 'DU229', articulo: '5A002', descripcion: 'Sistemas, equipos y componentes destinados a la "seguridad de la información", según se indica:' },
      { categoria: '0A001a', nota: 'DU583', articulo: '0A001', descripcion: null }
    ]
    const dualUseSource = { fecha: '2026-09-21', enlace: 'https://publications.europa.eu/resource/celex/02021R0821-20260921' }
    render(<MedidasOficialesTaric partidas={[partida([], { taricCode: '8471300000', originCountry: 'CN', dualUse, dualUseSource })]} />)

    expect(screen.getByText(/Sistemas, equipos y componentes destinados a la "seguridad de la información"/)).toBeInTheDocument()
    expect(screen.getByText('0A001a')).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: /21\/09\/2026/ })
    expect(enlace).toHaveAttribute('href', dualUseSource.enlace)
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  test('el origen de la medida se muestra con el nombre que llega (ya en español)', () => {
    const medida = { ...veterinario, ambito: { ...veterinario.ambito, origenNombre: 'Todos los terceros países' } }
    render(<MedidasOficialesTaric partidas={[partida([medida])]} />)

    expect(screen.getByText(/Regulation 0632\/21 · Todos los terceros países/)).toBeInTheDocument()
  })
})
