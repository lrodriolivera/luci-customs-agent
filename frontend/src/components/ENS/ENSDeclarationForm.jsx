import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box, Typography, Paper, Grid, Button, TextField, MenuItem,
  Stepper, Step, StepLabel, StepContent, Card, CardContent,
  IconButton, Divider, Alert, CircularProgress, Autocomplete,
  FormControlLabel, Checkbox, Chip, Tooltip
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  LocalShipping as TruckIcon,
  DirectionsRailway as RailIcon,
  Flight as AirIcon,
  DirectionsBoat as SeaIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { ensAPI } from '../../services/api'

// Transport mode configuration (labels resolved at render time via t())
const getTransportModes = (t) => [
  { value: 'ROAD', label: t('ens.road'), icon: TruckIcon, color: '#4CAF50', deadline: t('ens.oneHour') },
  { value: 'RAIL', label: t('ens.rail'), icon: RailIcon, color: '#FF9800', deadline: t('ens.twoHours') },
  { value: 'AIR', label: t('ens.air'), icon: AirIcon, color: '#2196F3', deadline: t('ens.fourHours') },
  { value: 'SEA', label: t('ens.maritime'), icon: SeaIcon, color: '#00BCD4', deadline: t('ens.twentyFourHours') }
]

// Spanish entry customs offices
const entryOffices = [
  { code: 'ES009999', name: 'PRE Pruebas Peninsula', modes: ['SEA', 'ROAD', 'RAIL', 'AIR'] },
  { code: 'ES009998', name: 'PRE Pruebas Canarias', modes: ['SEA', 'ROAD', 'RAIL', 'AIR'] },
  { code: 'ES002801', name: 'Algeciras', modes: ['SEA', 'ROAD'] },
  { code: 'ES000801', name: 'Barcelona', modes: ['SEA', 'ROAD', 'RAIL', 'AIR'] },
  { code: 'ES002101', name: 'Bilbao', modes: ['SEA', 'ROAD'] },
  { code: 'ES001501', name: 'Madrid-Barajas', modes: ['AIR', 'ROAD'] },
  { code: 'ES004601', name: 'Valencia', modes: ['SEA', 'ROAD', 'RAIL'] },
  { code: 'ES001101', name: 'La Junquera', modes: ['ROAD', 'RAIL'] },
  { code: 'ES001102', name: 'Irun', modes: ['ROAD', 'RAIL'] },
  { code: 'ES003501', name: 'Las Palmas', modes: ['SEA', 'AIR'] },
  { code: 'ES003801', name: 'Tenerife', modes: ['SEA', 'AIR'] },
  { code: 'ES002901', name: 'Malaga', modes: ['SEA', 'AIR', 'ROAD'] },
  { code: 'ES004101', name: 'Sevilla', modes: ['SEA', 'ROAD'] },
  { code: 'ES003001', name: 'Vigo', modes: ['SEA', 'ROAD'] }
]

// Empty goods item template
const emptyGoodsItem = {
  itemNumber: 1,
  description: '',
  taricCode: '',
  grossMass: '',
  netMass: '',
  numberOfPackages: '',
  packageType: '',
  marks: '',
  countryOfOrigin: ''
}

// Empty house consignment template
const emptyHouseConsignment = {
  referenceNumber: '',
  consignee: {
    eori: '',
    name: '',
    address: { street: '', city: '', postcode: '', country: '' }
  },
  consignor: {
    eori: '',
    name: '',
    address: { street: '', city: '', postcode: '', country: '' }
  },
  goods: [{ ...emptyGoodsItem }]
}

const ENSDeclarationForm = ({ declarationId, onClose, onSuccess }) => {
  const { t } = useTranslation()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    // Step 1: Transport
    transportMode: 'ROAD',
    entryOffice: {
      code: '',
      name: '',
      expectedArrival: ''
    },

    // Step 2: Carrier & Transport Means
    carrier: {
      eori: '',
      name: '',
      address: {
        street: '',
        city: '',
        postcode: '',
        country: ''
      }
    },
    transportMeans: {
      type: '',
      identification: '',
      nationality: ''
    },

    // Step 3: Consignment
    consignment: {
      referenceNumber: '',
      containerNumber: '',
      sealNumber: '',
      grossMass: '',
      numberOfPackages: '',
      goodsDescription: ''
    },
    consignor: {
      eori: '',
      name: '',
      address: { street: '', city: '', postcode: '', country: '' }
    },
    consignee: {
      eori: '',
      name: '',
      address: { street: '', city: '', postcode: '', country: '' }
    },

    // Step 4: Goods Items
    isGroupage: false,
    houseConsignments: [],
    goods: [{ ...emptyGoodsItem }],

    // Step 5: Documents
    documents: []
  })

  // Load existing declaration if editing
  useEffect(() => {
    if (declarationId) {
      loadDeclaration()
    }
  }, [declarationId])

  const loadDeclaration = async () => {
    try {
      setLoading(true)
      const response = await ensAPI.get(declarationId)
      if (response.data.success) {
        const dec = response.data.data
        setFormData({
          transportMode: dec.transportMode || 'ROAD',
          entryOffice: dec.entryOffice || { code: '', name: '', expectedArrival: '' },
          carrier: dec.carrier || { eori: '', name: '', address: {} },
          transportMeans: dec.transportMeans || { type: '', identification: '', nationality: '' },
          consignment: dec.consignment || { referenceNumber: '', containerNumber: '', sealNumber: '', grossMass: '', numberOfPackages: '', goodsDescription: '' },
          consignor: dec.consignor || { eori: '', name: '', address: {} },
          consignee: dec.consignee || { eori: '', name: '', address: {} },
          isGroupage: (dec.houseConsignments?.length || 0) > 0,
          houseConsignments: dec.houseConsignments || [],
          goods: dec.goods?.length > 0 ? dec.goods : [{ ...emptyGoodsItem }],
          documents: dec.documents || []
        })
      }
    } catch (error) {
      console.error('Error loading declaration:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev }
      const keys = path.split('.')
      let current = newData
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newData
    })
    // Clear validation error for this field
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[path]
      return newErrors
    })
  }

  const handleEntryOfficeChange = (office) => {
    if (office) {
      setFormData(prev => ({
        ...prev,
        entryOffice: {
          ...prev.entryOffice,
          code: office.code,
          name: office.name
        }
      }))
    }
  }

  const handleAddGoodsItem = () => {
    setFormData(prev => ({
      ...prev,
      goods: [...prev.goods, { ...emptyGoodsItem, itemNumber: prev.goods.length + 1 }]
    }))
  }

  const handleRemoveGoodsItem = (index) => {
    setFormData(prev => ({
      ...prev,
      goods: prev.goods.filter((_, i) => i !== index).map((item, i) => ({ ...item, itemNumber: i + 1 }))
    }))
  }

  const handleGoodsItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      goods: prev.goods.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  const handleAddHouseConsignment = () => {
    setFormData(prev => ({
      ...prev,
      houseConsignments: [...prev.houseConsignments, { ...emptyHouseConsignment }]
    }))
  }

  const handleRemoveHouseConsignment = (index) => {
    setFormData(prev => ({
      ...prev,
      houseConsignments: prev.houseConsignments.filter((_, i) => i !== index)
    }))
  }

  const validateStep = (step) => {
    const newErrors = {}

    switch (step) {
      case 0: // Transport
        if (!formData.transportMode) newErrors['transportMode'] = t('ens.transportModeRequired')
        if (!formData.entryOffice.code) newErrors['entryOffice.code'] = t('ens.entryCustomsRequired')
        if (!formData.entryOffice.expectedArrival) newErrors['entryOffice.expectedArrival'] = t('ens.arrivalRequired')
        break
      case 1: // Carrier
        if (!formData.carrier.eori) newErrors['carrier.eori'] = t('ens.carrierEoriRequired')
        break
      case 2: // Consignment
        if (!formData.consignment.referenceNumber) newErrors['consignment.referenceNumber'] = t('ens.blRequired')
        if (!formData.consignment.grossMass) newErrors['consignment.grossMass'] = t('ens.grossWeightRequired')
        break
      case 3: // Goods
        if (!formData.isGroupage && formData.goods.length === 0) {
          newErrors['goods'] = t('ens.itemRequired')
        }
        if (formData.isGroupage && formData.houseConsignments.length === 0) {
          newErrors['houseConsignments'] = t('ens.houseRequired')
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    setActiveStep(prev => prev - 1)
  }

  const handleValidate = async () => {
    try {
      setValidating(true)
      const response = await ensAPI.validate(formData)
      setValidationResult(response.data.data)
    } catch (error) {
      console.error('Error validating:', error)
      setValidationResult({
        isValid: false,
        errors: [error.response?.data?.message || 'Error de validacion']
      })
    } finally {
      setValidating(false)
    }
  }

  const handleSave = async (submit = false) => {
    try {
      setSaving(true)
      let response

      // Guardar borrador permite validacion parcial
      const payload = { ...formData, allowDraft: !submit }

      if (declarationId) {
        response = await ensAPI.update(declarationId, payload)
      } else {
        response = await ensAPI.create(payload)
      }

      if (response.data.success) {
        if (submit && response.data.data._id) {
          // Submit to AEAT
          const submitResponse = await ensAPI.submit(response.data.data._id)
          if (submitResponse.data.success) {
            onSuccess && onSuccess(submitResponse.data.data)
          }
        } else {
          onSuccess && onSuccess(response.data.data)
        }
      }
    } catch (error) {
      console.error('Error saving declaration:', error)
      const errData = error.response?.data
      const detailedErrors = errData?.errors
      if (detailedErrors && Array.isArray(detailedErrors)) {
        // Mostrar errores especificos por campo
        const fieldErrors = {}
        detailedErrors.forEach(e => {
          if (e.field) fieldErrors[e.field] = e.message
        })
        fieldErrors.general = errData.message + ': ' + detailedErrors.map(e => e.message).join(' | ')
        setErrors(fieldErrors)
      } else {
        setErrors({ general: errData?.message || t('ens.errorSaving') })
      }
    } finally {
      setSaving(false)
    }
  }

  const transportModes = getTransportModes(t)
  const filteredOffices = entryOffices.filter(o => o.modes.includes(formData.transportMode))

  const steps = [
    t('ens.stepTransport'),
    t('ens.stepCarrier'),
    t('ens.stepShipment'),
    t('ens.stepGoods'),
    t('ens.stepReview')
  ]

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {declarationId ? t('ens.editTitle') : t('ens.newTitle')}
        </Typography>
      </Box>

      {errors.general && (
        <Alert severity="error" sx={{ mb: 3 }}>{errors.general}</Alert>
      )}

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Step 0: Transport */}
        {activeStep === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('ens.transportModeLabel')}
              </Typography>
              <Grid container spacing={2}>
                {transportModes.map((mode) => {
                  const IconComponent = mode.icon
                  return (
                    <Grid item xs={6} sm={3} key={mode.value}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: formData.transportMode === mode.value ? 2 : 1,
                          borderColor: formData.transportMode === mode.value ? mode.color : 'divider',
                          bgcolor: formData.transportMode === mode.value ? `${mode.color}10` : 'background.paper'
                        }}
                        onClick={() => handleFieldChange('transportMode', mode.value)}
                      >
                        <CardContent sx={{ textAlign: 'center' }}>
                          <IconComponent sx={{ fontSize: 48, color: mode.color, mb: 1 }} />
                          <Typography variant="subtitle1">{mode.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {t('ens.deadline')}: {mode.deadline}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )
                })}
              </Grid>
              {errors['transportMode'] && (
                <Typography color="error" variant="caption">{errors['transportMode']}</Typography>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                options={filteredOffices}
                getOptionLabel={(option) => `${option.code} - ${option.name}`}
                value={filteredOffices.find(o => o.code === formData.entryOffice.code) || null}
                onChange={(e, value) => handleEntryOfficeChange(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('ens.entryCustomsLabel')}
                    required
                    error={!!errors['entryOffice.code']}
                    helperText={errors['entryOffice.code']}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label={t('ens.expectedArrivalLabel')}
                value={formData.entryOffice.expectedArrival}
                onChange={(e) => handleFieldChange('entryOffice.expectedArrival', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                error={!!errors['entryOffice.expectedArrival']}
                helperText={errors['entryOffice.expectedArrival']}
              />
            </Grid>
          </Grid>
        )}

        {/* Step 1: Carrier */}
        {activeStep === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('ens.carrierData')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.eoriCarrier')}
                value={formData.carrier.eori}
                onChange={(e) => handleFieldChange('carrier.eori', e.target.value.toUpperCase())}
                required
                error={!!errors['carrier.eori']}
                helperText={errors['carrier.eori'] || t('ens.eoriFormat')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.companyName')}
                value={formData.carrier.name}
                onChange={(e) => handleFieldChange('carrier.name', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                {t('ens.addressLabel')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.street')}
                value={formData.carrier.address.street}
                onChange={(e) => handleFieldChange('carrier.address.street', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('common.city')}
                value={formData.carrier.address.city}
                onChange={(e) => handleFieldChange('carrier.address.city', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('common.postalCode')}
                value={formData.carrier.address.postcode}
                onChange={(e) => handleFieldChange('carrier.address.postcode', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('common.country')}
                value={formData.carrier.address.country}
                onChange={(e) => handleFieldChange('carrier.address.country', e.target.value.toUpperCase())}
                inputProps={{ maxLength: 2 }}
                helperText={t('ens.isoCodeHint')}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                {t('ens.transportMeans')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label={t('common.type')}
                value={formData.transportMeans.type}
                onChange={(e) => handleFieldChange('transportMeans.type', e.target.value)}
              >
                <MenuItem value="truck">{t('ens.truck')}</MenuItem>
                <MenuItem value="trailer">{t('ens.trailer')}</MenuItem>
                <MenuItem value="container">{t('ens.containerLabel')}</MenuItem>
                <MenuItem value="wagon">{t('ens.wagon')}</MenuItem>
                <MenuItem value="aircraft">{t('ens.aircraft')}</MenuItem>
                <MenuItem value="vessel">{t('ens.vessel')}</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('ens.identification')}
                value={formData.transportMeans.identification}
                onChange={(e) => handleFieldChange('transportMeans.identification', e.target.value.toUpperCase())}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('ens.nationality')}
                value={formData.transportMeans.nationality}
                onChange={(e) => handleFieldChange('transportMeans.nationality', e.target.value.toUpperCase())}
                inputProps={{ maxLength: 2 }}
                helperText={t('ens.isoCode')}
              />
            </Grid>
          </Grid>
        )}

        {/* Step 2: Consignment */}
        {activeStep === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('ens.shipmentData')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('ens.blNumber')}
                value={formData.consignment.referenceNumber}
                onChange={(e) => handleFieldChange('consignment.referenceNumber', e.target.value)}
                required
                error={!!errors['consignment.referenceNumber']}
                helperText={errors['consignment.referenceNumber']}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('ens.containerNumber')}
                value={formData.consignment.containerNumber}
                onChange={(e) => handleFieldChange('consignment.containerNumber', e.target.value.toUpperCase())}
                helperText={t('ens.containerFormat')}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('ens.sealNumber')}
                value={formData.consignment.sealNumber}
                onChange={(e) => handleFieldChange('consignment.sealNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label={t('ens.grossWeightKg')}
                value={formData.consignment.grossMass}
                onChange={(e) => handleFieldChange('consignment.grossMass', e.target.value)}
                required
                error={!!errors['consignment.grossMass']}
                helperText={errors['consignment.grossMass']}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label={t('ens.numberOfPackages')}
                value={formData.consignment.numberOfPackages}
                onChange={(e) => handleFieldChange('consignment.numberOfPackages', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('ens.goodsDescriptionLabel')}
                value={formData.consignment.goodsDescription}
                onChange={(e) => handleFieldChange('consignment.goodsDescription', e.target.value)}
              />
            </Grid>

            {/* Consignor */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                {t('ens.consignorLabel')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.eoriConsignor')}
                value={formData.consignor.eori}
                onChange={(e) => handleFieldChange('consignor.eori', e.target.value.toUpperCase())}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.nameConsignor')}
                value={formData.consignor.name}
                onChange={(e) => handleFieldChange('consignor.name', e.target.value)}
              />
            </Grid>

            {/* Consignee */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                {t('ens.consigneeLabel')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.eoriConsignee')}
                value={formData.consignee.eori}
                onChange={(e) => handleFieldChange('consignee.eori', e.target.value.toUpperCase())}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('ens.nameConsignee')}
                value={formData.consignee.name}
                onChange={(e) => handleFieldChange('consignee.name', e.target.value)}
              />
            </Grid>
          </Grid>
        )}

        {/* Step 3: Goods */}
        {activeStep === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {t('ens.goodsItems')}
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isGroupage}
                      onChange={(e) => handleFieldChange('isGroupage', e.target.checked)}
                    />
                  }
                  label={t('ens.groupageLabel')}
                />
              </Box>
            </Grid>

            {!formData.isGroupage ? (
              // Direct goods items
              <>
                {formData.goods.map((item, index) => (
                  <Grid item xs={12} key={index}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle2">
                          {t('ens.item')} {item.itemNumber}
                        </Typography>
                        {formData.goods.length > 1 && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveGoodsItem(index)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('common.description')}
                            value={item.description}
                            onChange={(e) => handleGoodsItemChange(index, 'description', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('ens.taricCode')}
                            value={item.taricCode}
                            onChange={(e) => handleGoodsItemChange(index, 'taricCode', e.target.value)}
                            inputProps={{ maxLength: 10 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('ens.countryOfOrigin')}
                            value={item.countryOfOrigin}
                            onChange={(e) => handleGoodsItemChange(index, 'countryOfOrigin', e.target.value.toUpperCase())}
                            inputProps={{ maxLength: 2 }}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label={t('ens.grossWeightKg')}
                            value={item.grossMass}
                            onChange={(e) => handleGoodsItemChange(index, 'grossMass', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label={t('ens.netWeightKg')}
                            value={item.netMass}
                            onChange={(e) => handleGoodsItemChange(index, 'netMass', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label={t('ens.packagesLabel')}
                            value={item.numberOfPackages}
                            onChange={(e) => handleGoodsItemChange(index, 'numberOfPackages', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('ens.packageType')}
                            value={item.packageType}
                            onChange={(e) => handleGoodsItemChange(index, 'packageType', e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddGoodsItem}
                  >
                    {t('ens.addItem')}
                  </Button>
                </Grid>
              </>
            ) : (
              // House consignments for groupage
              <>
                {formData.houseConsignments.map((house, index) => (
                  <Grid item xs={12} key={index}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle2">
                          {t('ens.houseShipment')} {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveHouseConsignment(index)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('ens.houseBlRef')}
                            value={house.referenceNumber}
                            onChange={(e) => {
                              const newHouses = [...formData.houseConsignments]
                              newHouses[index].referenceNumber = e.target.value
                              handleFieldChange('houseConsignments', newHouses)
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('ens.eoriConsignee')}
                            value={house.consignee.eori}
                            onChange={(e) => {
                              const newHouses = [...formData.houseConsignments]
                              newHouses[index].consignee.eori = e.target.value.toUpperCase()
                              handleFieldChange('houseConsignments', newHouses)
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label={t('ens.nameConsignee')}
                            value={house.consignee.name}
                            onChange={(e) => {
                              const newHouses = [...formData.houseConsignments]
                              newHouses[index].consignee.name = e.target.value
                              handleFieldChange('houseConsignments', newHouses)
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddHouseConsignment}
                  >
                    {t('ens.addHouseShipment')}
                  </Button>
                </Grid>
                {errors['houseConsignments'] && (
                  <Grid item xs={12}>
                    <Typography color="error" variant="caption">{errors['houseConsignments']}</Typography>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        )}

        {/* Step 4: Review */}
        {activeStep === 4 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('ens.reviewTitle')}
              </Typography>
            </Grid>

            {/* Validation */}
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={validating ? <CircularProgress size={20} /> : <InfoIcon />}
                onClick={handleValidate}
                disabled={validating}
              >
                {validating ? t('ens.validating') : t('ens.validateDeclaration')}
              </Button>
            </Grid>

            {validationResult && (
              <Grid item xs={12}>
                <Alert severity={validationResult.isValid ? 'success' : 'warning'}>
                  {validationResult.isValid
                    ? t('ens.declarationValid')
                    : t('ens.errorsAndWarnings', { errors: validationResult.errors?.length || 0, warnings: validationResult.warnings?.length || 0 })}
                </Alert>
                {validationResult.errors?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {validationResult.errors.map((err, i) => (
                      <Typography key={i} variant="body2" color="error">
                        - {err.message || err}
                      </Typography>
                    ))}
                  </Box>
                )}
                {validationResult.suggestions?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">{t('ens.luciSuggestions')}</Typography>
                    {validationResult.suggestions.map((sug, i) => (
                      <Typography key={i} variant="body2" color="textSecondary">
                        - {sug}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Grid>
            )}

            {/* Summary */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  {t('ens.summaryTransport')}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryMode')}: {transportModes.find(m => m.value === formData.transportMode)?.label}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryCustoms')}: {formData.entryOffice.code} - {formData.entryOffice.name}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryArrival')}: {formData.entryOffice.expectedArrival ? new Date(formData.entryOffice.expectedArrival).toLocaleString('es-ES') : '-'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  {t('ens.summaryCarrier')}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryEori')}: {formData.carrier.eori || '-'}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryName')}: {formData.carrier.name || '-'}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryVehicle')}: {formData.transportMeans.identification || '-'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  {t('ens.summaryShipment')}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryBl')}: {formData.consignment.referenceNumber || '-'}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryContainer')}: {formData.consignment.containerNumber || '-'}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryWeight')}: {formData.consignment.grossMass} kg
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryPackages')}: {formData.consignment.numberOfPackages || '-'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  {t('ens.summaryGoods')}
                </Typography>
                <Typography variant="body2">
                  {t('ens.summaryType')}: {formData.isGroupage ? t('ens.groupage') : t('ens.direct')}
                </Typography>
                <Typography variant="body2">
                  {formData.isGroupage
                    ? `${t('ens.houseShipments')}: ${formData.houseConsignments.length}`
                    : `${t('ens.items')}: ${formData.goods.length}`}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<BackIcon />}
        >
          {t('ens.previous')}
        </Button>
        <Box>
          {activeStep === steps.length - 1 ? (
            <>
              <Button
                variant="outlined"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={() => handleSave(false)}
                disabled={saving}
                sx={{ mr: 2 }}
              >
                {t('ens.saveDraft')}
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SendIcon />}
                onClick={() => handleSave(true)}
                disabled={saving || (validationResult && !validationResult.isValid)}
              >
                {t('ens.saveAndSend')}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NextIcon />}
            >
              {t('ens.next')}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default ENSDeclarationForm
