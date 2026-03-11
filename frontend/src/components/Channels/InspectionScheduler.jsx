import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { requirementsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

// Ubicaciones predefinidas de recintos aduaneros
const CUSTOMS_LOCATIONS = [
  { code: 'ESBCN01', name: 'Puerto de Barcelona - Terminal BEST', address: 'Muelle Prat, s/n, 08039 Barcelona' },
  { code: 'ESBCN02', name: 'Puerto de Barcelona - APM Terminals', address: 'Muelle Sur, 08039 Barcelona' },
  { code: 'ESVAL01', name: 'Puerto de Valencia - MSC Terminal', address: 'Muelle de Levante, 46024 Valencia' },
  { code: 'ESVAL02', name: 'Puerto de Valencia - APM Terminals', address: 'Muelle Principe Felipe, 46024 Valencia' },
  { code: 'ESALG01', name: 'Puerto de Algeciras - TTI', address: 'Muelle Juan Carlos I, 11207 Algeciras' },
  { code: 'ESBIO01', name: 'Puerto de Bilbao', address: 'Muelle AZ, 48980 Santurce' },
  { code: 'ESMAD01', name: 'Aeropuerto Madrid-Barajas - Centro de Carga', address: 'Ctra. de la Muñoza, 28042 Madrid' },
  { code: 'ESBCN03', name: 'Aeropuerto Barcelona-El Prat - Centro de Carga', address: 'El Prat de Llobregat, 08820 Barcelona' },
  { code: 'ZAL01', name: 'ZAL Barcelona', address: 'Av. Ports d\'Europa, 08040 Barcelona' },
  { code: 'CUSTOM', name: 'Otra ubicacion...', address: '' }
]

// Horarios disponibles para inspecciones
const AVAILABLE_TIMES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00',
  '15:00', '15:30', '16:00', '16:30', '17:00'
]

export default function InspectionScheduler({ requirementId, currentInspection, onScheduled, onClose }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    scheduledDate: currentInspection?.scheduledDate?.split('T')[0] || '',
    scheduledTime: currentInspection?.scheduledTime || '',
    locationCode: currentInspection?.location?.code || '',
    customLocation: {
      name: '',
      address: ''
    },
    inspectorName: currentInspection?.inspectorName || '',
    inspectorId: currentInspection?.inspectorId || '',
    inspectorPhone: currentInspection?.inspectorPhone || '',
    inspectorEmail: currentInspection?.inspectorEmail || ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.startsWith('customLocation.')) {
      const field = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        customLocation: {
          ...prev.customLocation,
          [field]: value
        }
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validaciones
    if (!formData.scheduledDate) {
      toast.error(t('channels.selectDateError'))
      return
    }
    if (!formData.scheduledTime) {
      toast.error(t('channels.selectTimeError'))
      return
    }
    if (!formData.locationCode) {
      toast.error(t('channels.selectLocationError'))
      return
    }

    // Validar fecha no sea pasada
    const selectedDate = new Date(formData.scheduledDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      toast.error(t('channels.pastDateError'))
      return
    }

    setLoading(true)
    try {
      // Preparar datos de ubicacion
      let location
      if (formData.locationCode === 'CUSTOM') {
        location = {
          code: 'CUSTOM',
          name: formData.customLocation.name,
          address: formData.customLocation.address,
          type: 'other'
        }
      } else {
        const selectedLocation = CUSTOMS_LOCATIONS.find(l => l.code === formData.locationCode)
        location = {
          code: selectedLocation.code,
          name: selectedLocation.name,
          address: selectedLocation.address,
          type: selectedLocation.code.startsWith('ES') ?
            (selectedLocation.code.includes('MAD') || selectedLocation.code.includes('BCN03') ? 'airport' : 'port')
            : 'warehouse'
        }
      }

      const response = await requirementsAPI.scheduleInspection(requirementId, {
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        location,
        inspectorName: formData.inspectorName || null,
        inspectorId: formData.inspectorId || null,
        inspectorPhone: formData.inspectorPhone || null,
        inspectorEmail: formData.inspectorEmail || null
      })

      if (response.data?.success) {
        toast.success(t('channels.inspectionScheduled'))
        onScheduled?.(response.data.data)
      } else {
        toast.error(response.data?.message || t('channels.inspectionScheduleError'))
      }
    } catch (error) {
      console.error('Error scheduling inspection:', error)
      toast.error(error.response?.data?.message || t('channels.inspectionScheduleError'))
    } finally {
      setLoading(false)
    }
  }

  const selectedLocation = CUSTOMS_LOCATIONS.find(l => l.code === formData.locationCode)

  // Calcular fecha minima (hoy)
  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <CalendarDaysIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('channels.scheduleTitle')}</h2>
              <p className="text-sm text-gray-600">{t('channels.scheduleSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Fecha y Hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
                {t('channels.inspectionDateLabel')} *
              </label>
              <input
                type="date"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                min={minDate}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ClockIcon className="h-4 w-4 inline mr-1" />
                {t('channels.inspectionTimeLabel')} *
              </label>
              <select
                name="scheduledTime"
                value={formData.scheduledTime}
                onChange={handleChange}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">{t('channels.selectTime')}</option>
                {AVAILABLE_TIMES.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ubicacion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPinIcon className="h-4 w-4 inline mr-1" />
              {t('channels.locationLabel')} *
            </label>
            <select
              name="locationCode"
              value={formData.locationCode}
              onChange={handleChange}
              required
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">{t('channels.selectLocation')}</option>
              {CUSTOMS_LOCATIONS.map(loc => (
                <option key={loc.code} value={loc.code}>{loc.name}</option>
              ))}
            </select>

            {selectedLocation && selectedLocation.code !== 'CUSTOM' && (
              <p className="mt-1 text-sm text-gray-500">{selectedLocation.address}</p>
            )}

            {formData.locationCode === 'CUSTOM' && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{t('channels.customLocationName')}</label>
                  <input
                    type="text"
                    name="customLocation.name"
                    value={formData.customLocation.name}
                    onChange={handleChange}
                    placeholder="Ej: Almacen fiscal XYZ"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{t('channels.customLocationAddress')}</label>
                  <input
                    type="text"
                    name="customLocation.address"
                    value={formData.customLocation.address}
                    onChange={handleChange}
                    placeholder="Calle, numero, codigo postal, ciudad"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Datos del Inspector (Opcionales) */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {t('channels.inspectorData')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <UserIcon className="h-4 w-4 inline mr-1" />
                  {t('common.name')}
                </label>
                <input
                  type="text"
                  name="inspectorName"
                  value={formData.inspectorName}
                  onChange={handleChange}
                  placeholder="Nombre del inspector"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t('channels.inspectorIdLabel')}</label>
                <input
                  type="text"
                  name="inspectorId"
                  value={formData.inspectorId}
                  onChange={handleChange}
                  placeholder="Ej: INS-12345"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <PhoneIcon className="h-4 w-4 inline mr-1" />
                  {t('common.phone')}
                </label>
                <input
                  type="tel"
                  name="inspectorPhone"
                  value={formData.inspectorPhone}
                  onChange={handleChange}
                  placeholder="+34 600 000 000"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <EnvelopeIcon className="h-4 w-4 inline mr-1" />
                  {t('common.email')}
                </label>
                <input
                  type="email"
                  name="inspectorEmail"
                  value={formData.inspectorEmail}
                  onChange={handleChange}
                  placeholder="inspector@aeat.es"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>{t('channels.importantNote')}</strong> {t('channels.inspectionNote')}
            </p>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('channels.scheduling')}
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  {t('channels.confirmSchedule')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
