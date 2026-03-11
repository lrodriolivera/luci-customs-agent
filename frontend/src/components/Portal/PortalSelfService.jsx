/**
 * Portal Self-Service Component
 * Phase 6.7: Portal Cliente Avanzado
 * Allows clients to create new expeditions without agent assistance
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Truck,
  Ship,
  Plane,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Building,
  Mail,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import { portalAPI } from '../../services/api';

const PortalSelfService = ({ organizationId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const OPERATION_TYPES = [
    { id: 'import', name: t('portal.operationImport'), icon: Package, description: t('portal.operationImportDesc') },
    { id: 'export', name: t('portal.operationExport'), icon: Truck, description: t('portal.operationExportDesc') },
    { id: 'transit', name: t('portal.operationTransit'), icon: Ship, description: t('portal.operationTransitDesc') }
  ];

  const TRANSPORT_MODES = [
    { id: 'maritime', name: t('portal.transportMaritime'), icon: Ship },
    { id: 'air', name: t('portal.transportAir'), icon: Plane },
    { id: 'road', name: t('portal.transportRoad'), icon: Truck }
  ];

  const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Operation type
    operationType: '',
    transportMode: 'maritime',

    // Step 2: Client info
    client: {
      companyName: '',
      taxId: '',
      eoriNumber: '',
      contactName: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        postalCode: '',
        country: 'ES'
      }
    },

    // Step 3: Operation details
    operation: {
      originCountry: '',
      destinationCountry: 'ES',
      incoterm: 'CIF',
      notes: ''
    },

    // Step 4: Goods
    goods: [
      {
        description: '',
        quantity: 1,
        unit: 'KG',
        value: 0,
        currency: 'EUR',
        originCountry: ''
      }
    ]
  });

  const updateFormData = (section, field, value) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const updateGood = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      goods: prev.goods.map((good, i) =>
        i === index ? { ...good, [field]: value } : good
      )
    }));
  };

  const addGood = () => {
    setFormData(prev => ({
      ...prev,
      goods: [
        ...prev.goods,
        {
          description: '',
          quantity: 1,
          unit: 'KG',
          value: 0,
          currency: 'EUR',
          originCountry: formData.operation.originCountry
        }
      ]
    }));
  };

  const removeGood = (index) => {
    if (formData.goods.length > 1) {
      setFormData(prev => ({
        ...prev,
        goods: prev.goods.filter((_, i) => i !== index)
      }));
    }
  };

  const validateStep = (stepNum) => {
    switch (stepNum) {
      case 1:
        return !!formData.operationType;
      case 2:
        return !!(
          formData.client.companyName &&
          formData.client.email &&
          formData.client.contactName
        );
      case 3:
        return !!formData.operation.originCountry;
      case 4:
        return formData.goods.every(g => g.description && g.quantity > 0);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
      setError(null);
    } else {
      setError(t('portal.fillRequiredFields'));
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      setError(t('portal.fillRequiredFields'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await portalAPI.createExpedition({
        client: formData.client,
        operation: {
          operationType: formData.operationType,
          transportMode: formData.transportMode,
          ...formData.operation,
          goods: formData.goods
        },
        organizationId
      });

      setSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.error || t('portal.errorCreatingExpedition'));
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('portal.expeditionCreated')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('portal.expeditionCreatedDesc')}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">{t('portal.expeditionNumber')}</p>
            <p className="text-lg font-mono font-bold text-blue-600">
              {success.expeditionId}
            </p>
          </div>

          <a
            href={success.portalUrl}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('portal.accessPortal')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </a>

          <p className="text-sm text-gray-500 mt-4">
            {t('portal.savePortalLink')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s < step
                    ? 'bg-green-500 text-white'
                    : s === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s < step ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-full h-1 mx-2 ${
                    s < step ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  style={{ width: '80px' }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>{t('portal.stepOperation')}</span>
          <span>{t('portal.stepCompany')}</span>
          <span>{t('portal.stepDetails')}</span>
          <span>{t('portal.stepGoods')}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Step 1: Operation Type */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('portal.selfServiceTitle')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('portal.selfServiceDesc')}
            </p>

            <div className="grid gap-4 mb-6">
              {OPERATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => updateFormData(null, 'operationType', type.id)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.operationType === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <type.icon className={`w-6 h-6 mr-3 ${
                      formData.operationType === type.id ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="font-semibold text-gray-900">{type.name}</p>
                      <p className="text-sm text-gray-500">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">{t('portal.transportMode')}</h3>
            <div className="flex gap-4">
              {TRANSPORT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => updateFormData(null, 'transportMode', mode.id)}
                  className={`flex-1 p-3 border-2 rounded-lg text-center transition-all ${
                    formData.transportMode === mode.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <mode.icon className={`w-6 h-6 mx-auto mb-1 ${
                    formData.transportMode === mode.id ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <span className="text-sm font-medium">{mode.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Client Info */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('portal.companyData')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('portal.companyDataDesc')}
            </p>

            <div className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building className="inline w-4 h-4 mr-1" />
                    {t('portal.companyNameLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.client.companyName}
                    onChange={(e) => updateFormData('client', 'companyName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('portal.companyNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('portal.nifCif')}
                  </label>
                  <input
                    type="text"
                    value={formData.client.taxId}
                    onChange={(e) => updateFormData('client', 'taxId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="B12345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('portal.eoriNumber')}
                </label>
                <input
                  type="text"
                  value={formData.client.eoriNumber}
                  onChange={(e) => updateFormData('client', 'eoriNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ESB12345678"
                />
              </div>

              <hr className="my-2" />

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('portal.contactPerson')}
                  </label>
                  <input
                    type="text"
                    value={formData.client.contactName}
                    onChange={(e) => updateFormData('client', 'contactName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('portal.contactPersonPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="inline w-4 h-4 mr-1" />
                    {t('portal.emailLabel')}
                  </label>
                  <input
                    type="email"
                    value={formData.client.email}
                    onChange={(e) => updateFormData('client', 'email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('portal.emailPlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="inline w-4 h-4 mr-1" />
                  {t('common.phone')}
                </label>
                <input
                  type="tel"
                  value={formData.client.phone}
                  onChange={(e) => updateFormData('client', 'phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('portal.phonePlaceholder')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Operation Details */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('portal.operationDetails')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('portal.operationDetailsDesc')}
            </p>

            <div className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    {t('portal.originCountry')}
                  </label>
                  <input
                    type="text"
                    value={formData.operation.originCountry}
                    onChange={(e) => updateFormData('operation', 'originCountry', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="CN"
                    maxLength={2}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('portal.isoCodeHint')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('portal.destinationCountry')}
                  </label>
                  <input
                    type="text"
                    value={formData.operation.destinationCountry}
                    onChange={(e) => updateFormData('operation', 'destinationCountry', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ES"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('portal.incoterm')}
                </label>
                <select
                  value={formData.operation.incoterm}
                  onChange={(e) => updateFormData('operation', 'incoterm', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {INCOTERMS.map(inc => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="inline w-4 h-4 mr-1" />
                  {t('portal.additionalNotes')}
                </label>
                <textarea
                  value={formData.operation.notes}
                  onChange={(e) => updateFormData('operation', 'notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder={t('portal.additionalNotesPlaceholder')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Goods */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('portal.goodsTitle')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('portal.goodsDesc')}
            </p>

            <div className="space-y-4">
              {formData.goods.map((good, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-gray-700">
                      {t('portal.goodItem')} {index + 1}
                    </span>
                    {formData.goods.length > 1 && (
                      <button
                        onClick={() => removeGood(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('portal.goodDescription')}
                      </label>
                      <input
                        type="text"
                        value={good.description}
                        onChange={(e) => updateGood(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('portal.goodDescPlaceholder')}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('portal.quantity')}
                        </label>
                        <input
                          type="number"
                          value={good.quantity}
                          onChange={(e) => updateGood(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('portal.unit')}
                        </label>
                        <select
                          value={good.unit}
                          onChange={(e) => updateGood(index, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="KG">KG</option>
                          <option value="PCS">{t('portal.unitPcs')}</option>
                          <option value="CTN">{t('portal.unitCtn')}</option>
                          <option value="PLT">{t('portal.unitPlt')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('portal.valueEur')}
                        </label>
                        <input
                          type="number"
                          value={good.value}
                          onChange={(e) => updateGood(index, 'value', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addGood}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('portal.addGood')}
              </button>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.previous')}
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!validateStep(step)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {t('common.next')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !validateStep(4)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('portal.creating')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t('portal.createExpedition')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalSelfService;
