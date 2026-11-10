import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, ChevronUpIcon, EyeIcon } from '@heroicons/react/24/outline'
import { formatearImporte } from '../../utils/importe'

// Codigos del H1 que el agente necesita leer sin consultar una tabla.
const REPRESENTATION_KEYS = { 1: 'representationNone', 2: 'representationDirect', 3: 'representationIndirect' }
const TRANSPORT_MODE_KEYS = {
  1: 'modeSea', 2: 'modeRail', 3: 'modeRoad', 4: 'modeAir', 5: 'modePost', 7: 'modeFixed', 8: 'modeInlandWater', 9: 'modeOwn'
}

const isEmpty = (value) => value === undefined || value === null || value === ''

const joinParts = (...parts) => parts.filter((p) => !isEmpty(p)).join(', ')

const formatMass = (value) => (isEmpty(value) ? value : `${Number(value).toLocaleString('es-ES')} kg`)

/** Un dato del H1. Si falta, se marca: es justo lo que el agente busca al revisar. */
function Field({ label, value, missingLabel }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      {isEmpty(value)
        ? <dd className="text-sm font-medium text-amber-700">{missingLabel}</dd>
        : <dd className="text-sm font-medium text-gray-900 break-words">{value}</dd>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-200 pt-3">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      {children}
    </section>
  )
}

/**
 * Vista previa en pantalla del H1 generado, casilla a casilla, para que el
 * agente lo revise antes de presentarlo sin descargar el PDF ni leer el XML.
 * Solo muestra lo que hay en `h1Data`: no calcula ni completa nada.
 *
 * @param {{ h1Data: object | null | undefined }} props
 */
export default function H1Preview({ h1Data }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(true)

  if (!h1Data) return null

  const header = h1Data.declarationHeader || {}
  const shipment = h1Data.goodsShipment || {}
  const items = h1Data.goodsItems || []
  const valuation = h1Data.valuation || {}
  const duties = h1Data.dutyTaxFee || {}
  const transport = shipment.transportMeans || {}
  const currency = shipment.currency || valuation.invoiceCurrency || 'EUR'
  const missing = t('h1Preview.missing')

  const withCode = (code, keys) => {
    if (isEmpty(code)) return code
    const key = keys[code]
    return key ? `${code} — ${t(`h1Preview.${key}`)}` : String(code)
  }

  const party = (p) => (p ? joinParts(p.name, p.identificationNumber) : undefined)
  const address = (p) => (p?.address
    ? joinParts(p.address.streetAndNumber, p.address.postcode, p.address.city, p.address.country)
    : undefined)
  const duty = (d) => (d
    ? `${isEmpty(d.rate) ? '?' : d.rate} % × ${formatearImporte(d.baseAmount, 'EUR')} = ${formatearImporte(d.payableAmount, 'EUR')}`
    : undefined)

  const field = (labelKey, value) => (
    <Field label={t(`h1Preview.${labelKey}`)} value={value} missingLabel={missing} />
  )

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-medium text-gray-800">
          <EyeIcon className="w-5 h-5" />
          {t('h1Preview.title')}
        </span>
        {isOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-gray-500">{t('h1Preview.hint')}</p>

          <Section title={t('h1Preview.sectionDeclaration')}>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {field('lrn', header.lrn || h1Data.lrn)}
              {field('declarationType', joinParts(header.declarationType, header.additionalDeclarationType))}
              {field('officeLodgement', header.customsOfficeLodgement)}
              {field('officePresentation', header.customsOfficePresentation)}
              {field('officeEntry', header.customsOfficeEntry)}
              {field('totalPackages', header.totalPackages)}
              {field('totalGrossMass', formatMass(header.totalGrossMass))}
            </dl>
          </Section>

          <Section title={t('h1Preview.sectionParties')}>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {field('importer', party(header.importer))}
              {field('importerAddress', address(header.importer))}
              {field('declarant', party(header.declarant))}
              {field('representation', withCode(header.declarant?.representativeStatus, REPRESENTATION_KEYS))}
              {field('exporter', party(header.exporter))}
              {field('exporterAddress', address(header.exporter))}
            </dl>
          </Section>

          <Section title={t('h1Preview.sectionShipment')}>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {field('countryDispatch', shipment.countryOfDispatch)}
              {field('countryDestination', joinParts(shipment.countryOfDestination, shipment.regionOfDestination))}
              {field('modeAtBorder', withCode(transport.modeAtBorder, TRANSPORT_MODE_KEYS))}
              {field('modeInland', withCode(transport.modeInland, TRANSPORT_MODE_KEYS))}
              {field('transportIdentity', joinParts(transport.identityAtBorder, transport.nationality))}
              {field('transportDocument', joinParts(shipment.transportDocument?.type, shipment.transportDocument?.reference))}
              {field('containers', shipment.containerIndicator === '1' || shipment.containers?.length > 0
                ? (shipment.containers || []).map((c) => (typeof c === 'string' ? c : (c?.containerNumber || c?.number || ''))).filter(Boolean).join(', ') || t('h1Preview.containersYes')
                : t('h1Preview.containersNo'))}
              {field('goodsLocation', joinParts(shipment.goodsLocation?.typeOfLocation, shipment.goodsLocation?.qualifierOfIdentification, shipment.placeOfUnloading?.location))}
              {field('incoterm', joinParts(shipment.deliveryTerms?.code, shipment.deliveryTerms?.country))}
              {field('invoiceTotal', formatearImporte(shipment.totalInvoicedAmount, currency))}
              {field('exchangeRate', shipment.exchangeRate)}
              {field('freight', formatearImporte(shipment.transportCharges?.freightAmount, shipment.transportCharges?.freightCurrency || currency))}
              {field('insurance', formatearImporte(shipment.insuranceCharges?.insuranceAmount, shipment.insuranceCharges?.insuranceCurrency || currency))}
            </dl>
          </Section>

          <Section title={t('h1Preview.sectionItems', { count: items.length })}>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.itemNumber} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-800 mb-2">
                    {t('h1Preview.item', { number: item.itemNumber })}
                    {' · '}
                    <span className="font-mono">
                      {item.commodityCode?.taricCode || item.commodityCode?.combinedNomenclatureCode || missing}
                    </span>
                  </p>
                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2 md:col-span-4">
                      {field('description', item.goodsDescription || item.descriptionOfGoods)}
                    </div>
                    {field('procedure', joinParts(item.requestedProcedure, item.previousProcedure, item.additionalProcedure))}
                    {field('origin', item.countryOfOrigin)}
                    {field('preference', item.preference)}
                    {field('packages', joinParts(item.packaging?.numberOfPackages, item.packaging?.typeOfPackages, item.packaging?.shippingMarks))}
                    {field('grossMass', formatMass(item.grossMass))}
                    {field('netMass', formatMass(item.netMass))}
                    {field('itemInvoiceValue', formatearImporte(item.invoiceValue, currency))}
                    {field('customsValue', formatearImporte(item.customsValue, 'EUR'))}
                    {field('statisticalValue', formatearImporte(item.statisticalValue, 'EUR'))}
                    {field('documents', (item.supportingDocuments || [])
                      .map((d) => joinParts(d.type || d.code, d.reference || d.referenceNumber)).join(' · '))}
                  </dl>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('h1Preview.sectionDuties')}>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {field('valuationMethod', joinParts(valuation.valuationMethod, valuation.valuationMethodDescription))}
              {field('totalCustomsValue', formatearImporte(valuation.customsValue, 'EUR'))}
              {field('importDuty', duty(duties.importDuty))}
              {field('vat', duty(duties.vat))}
              {field('totalDuty', formatearImporte(duties.totalDuty, duties.totalDutyCurrency || 'EUR'))}
              {field('paymentMethod', joinParts(duties.paymentMethod, duties.paymentMethodDescription))}
              {field('guarantee', h1Data.guarantee?.guaranteeType)}
            </dl>
          </Section>
        </div>
      )}
    </div>
  )
}
