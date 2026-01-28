import React, { useState, useEffect } from 'react'
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

// Transport mode configuration
const transportModes = [
  { value: 'ROAD', label: 'Carretera', icon: TruckIcon, color: '#4CAF50', deadline: '1 hora' },
  { value: 'RAIL', label: 'Ferrocarril', icon: RailIcon, color: '#FF9800', deadline: '2 horas' },
  { value: 'AIR', label: 'Aereo', icon: AirIcon, color: '#2196F3', deadline: '4 horas' },
  { value: 'SEA', label: 'Maritimo', icon: SeaIcon, color: '#00BCD4', deadline: '24 horas' }
]

// Spanish entry customs offices
const entryOffices = [
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
        if (!formData.transportMode) newErrors['transportMode'] = 'Modo de transporte requerido'
        if (!formData.entryOffice.code) newErrors['entryOffice.code'] = 'Aduana de entrada requerida'
        if (!formData.entryOffice.expectedArrival) newErrors['entryOffice.expectedArrival'] = 'Fecha de llegada requerida'
        break
      case 1: // Carrier
        if (!formData.carrier.eori) newErrors['carrier.eori'] = 'EORI del transportista requerido'
        break
      case 2: // Consignment
        if (!formData.consignment.referenceNumber) newErrors['consignment.referenceNumber'] = 'Numero de conocimiento requerido'
        if (!formData.consignment.grossMass) newErrors['consignment.grossMass'] = 'Peso bruto requerido'
        break
      case 3: // Goods
        if (!formData.isGroupage && formData.goods.length === 0) {
          newErrors['goods'] = 'Se requiere al menos una partida'
        }
        if (formData.isGroupage && formData.houseConsignments.length === 0) {
          newErrors['houseConsignments'] = 'Se requiere al menos un envio house'
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

      if (declarationId) {
        response = await ensAPI.update(declarationId, formData)
      } else {
        response = await ensAPI.create(formData)
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
      setErrors({ general: error.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const filteredOffices = entryOffices.filter(o => o.modes.includes(formData.transportMode))

  const steps = [
    'Transporte',
    'Transportista',
    'Envio',
    'Mercancias',
    'Revision'
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
          {declarationId ? 'Editar Declaracion ENS' : 'Nueva Declaracion ENS'}
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
                Modo de Transporte
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
                            Plazo: {mode.deadline}
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
                    label="Aduana de Entrada"
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
                label="Fecha/Hora Llegada Prevista"
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
                Datos del Transportista
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="EORI Transportista"
                value={formData.carrier.eori}
                onChange={(e) => handleFieldChange('carrier.eori', e.target.value.toUpperCase())}
                required
                error={!!errors['carrier.eori']}
                helperText={errors['carrier.eori'] || 'Formato: ES + NIF (ej: ESA12345678)'}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre/Razon Social"
                value={formData.carrier.name}
                onChange={(e) => handleFieldChange('carrier.name', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Direccion
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Calle"
                value={formData.carrier.address.street}
                onChange={(e) => handleFieldChange('carrier.address.street', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Ciudad"
                value={formData.carrier.address.city}
                onChange={(e) => handleFieldChange('carrier.address.city', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Codigo Postal"
                value={formData.carrier.address.postcode}
                onChange={(e) => handleFieldChange('carrier.address.postcode', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Pais"
                value={formData.carrier.address.country}
                onChange={(e) => handleFieldChange('carrier.address.country', e.target.value.toUpperCase())}
                inputProps={{ maxLength: 2 }}
                helperText="Codigo ISO (ej: ES)"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Medio de Transporte
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Tipo"
                value={formData.transportMeans.type}
                onChange={(e) => handleFieldChange('transportMeans.type', e.target.value)}
              >
                <MenuItem value="truck">Camion</MenuItem>
                <MenuItem value="trailer">Remolque</MenuItem>
                <MenuItem value="container">Contenedor</MenuItem>
                <MenuItem value="wagon">Vagon</MenuItem>
                <MenuItem value="aircraft">Aeronave</MenuItem>
                <MenuItem value="vessel">Buque</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Identificacion (Matricula/IMO)"
                value={formData.transportMeans.identification}
                onChange={(e) => handleFieldChange('transportMeans.identification', e.target.value.toUpperCase())}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Nacionalidad"
                value={formData.transportMeans.nationality}
                onChange={(e) => handleFieldChange('transportMeans.nationality', e.target.value.toUpperCase())}
                inputProps={{ maxLength: 2 }}
                helperText="Codigo ISO"
              />
            </Grid>
          </Grid>
        )}

        {/* Step 2: Consignment */}
        {activeStep === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Datos del Envio
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Numero de Conocimiento (B/L / CMR)"
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
                label="Numero de Contenedor"
                value={formData.consignment.containerNumber}
                onChange={(e) => handleFieldChange('consignment.containerNumber', e.target.value.toUpperCase())}
                helperText="Formato ISO 6346 (ej: MSKU1234567)"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Numero de Precinto"
                value={formData.consignment.sealNumber}
                onChange={(e) => handleFieldChange('consignment.sealNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Peso Bruto (kg)"
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
                label="Numero de Bultos"
                value={formData.consignment.numberOfPackages}
                onChange={(e) => handleFieldChange('consignment.numberOfPackages', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Descripcion General de la Mercancia"
                value={formData.consignment.goodsDescription}
                onChange={(e) => handleFieldChange('consignment.goodsDescription', e.target.value)}
              />
            </Grid>

            {/* Consignor */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Expedidor (Consignor)
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="EORI Expedidor"
                value={formData.consignor.eori}
                onChange={(e) => handleFieldChange('consignor.eori', e.target.value.toUpperCase())}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre Expedidor"
                value={formData.consignor.name}
                onChange={(e) => handleFieldChange('consignor.name', e.target.value)}
              />
            </Grid>

            {/* Consignee */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Destinatario (Consignee)
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="EORI Destinatario"
                value={formData.consignee.eori}
                onChange={(e) => handleFieldChange('consignee.eori', e.target.value.toUpperCase())}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre Destinatario"
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
                  Partidas de Mercancia
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isGroupage}
                      onChange={(e) => handleFieldChange('isGroupage', e.target.checked)}
                    />
                  }
                  label="Grupaje (multiples envios house)"
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
                          Partida {item.itemNumber}
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
                            label="Descripcion"
                            value={item.description}
                            onChange={(e) => handleGoodsItemChange(index, 'description', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Codigo TARIC"
                            value={item.taricCode}
                            onChange={(e) => handleGoodsItemChange(index, 'taricCode', e.target.value)}
                            inputProps={{ maxLength: 10 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Pais Origen"
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
                            label="Peso Bruto (kg)"
                            value={item.grossMass}
                            onChange={(e) => handleGoodsItemChange(index, 'grossMass', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Peso Neto (kg)"
                            value={item.netMass}
                            onChange={(e) => handleGoodsItemChange(index, 'netMass', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Bultos"
                            value={item.numberOfPackages}
                            onChange={(e) => handleGoodsItemChange(index, 'numberOfPackages', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Tipo Embalaje"
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
                    Agregar Partida
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
                          Envio House {index + 1}
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
                            label="Referencia House B/L"
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
                            label="EORI Destinatario"
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
                            label="Nombre Destinatario"
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
                    Agregar Envio House
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
                Revision de la Declaracion
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
                {validating ? 'Validando...' : 'Validar Declaracion'}
              </Button>
            </Grid>

            {validationResult && (
              <Grid item xs={12}>
                <Alert severity={validationResult.isValid ? 'success' : 'warning'}>
                  {validationResult.isValid
                    ? 'La declaracion es valida y puede ser enviada a AEAT'
                    : `Se encontraron ${validationResult.errors?.length || 0} errores y ${validationResult.warnings?.length || 0} advertencias`}
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
                    <Typography variant="subtitle2">Sugerencias LUCI:</Typography>
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
                  Transporte
                </Typography>
                <Typography variant="body2">
                  Modo: {transportModes.find(m => m.value === formData.transportMode)?.label}
                </Typography>
                <Typography variant="body2">
                  Aduana: {formData.entryOffice.code} - {formData.entryOffice.name}
                </Typography>
                <Typography variant="body2">
                  Llegada: {formData.entryOffice.expectedArrival ? new Date(formData.entryOffice.expectedArrival).toLocaleString('es-ES') : '-'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Transportista
                </Typography>
                <Typography variant="body2">
                  EORI: {formData.carrier.eori || '-'}
                </Typography>
                <Typography variant="body2">
                  Nombre: {formData.carrier.name || '-'}
                </Typography>
                <Typography variant="body2">
                  Vehiculo: {formData.transportMeans.identification || '-'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Envio
                </Typography>
                <Typography variant="body2">
                  Conocimiento: {formData.consignment.referenceNumber || '-'}
                </Typography>
                <Typography variant="body2">
                  Contenedor: {formData.consignment.containerNumber || '-'}
                </Typography>
                <Typography variant="body2">
                  Peso: {formData.consignment.grossMass} kg
                </Typography>
                <Typography variant="body2">
                  Bultos: {formData.consignment.numberOfPackages || '-'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Mercancias
                </Typography>
                <Typography variant="body2">
                  Tipo: {formData.isGroupage ? 'Grupaje' : 'Directo'}
                </Typography>
                <Typography variant="body2">
                  {formData.isGroupage
                    ? `Envios House: ${formData.houseConsignments.length}`
                    : `Partidas: ${formData.goods.length}`}
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
          Anterior
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
                Guardar Borrador
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SendIcon />}
                onClick={() => handleSave(true)}
                disabled={saving || (validationResult && !validationResult.isValid)}
              >
                Guardar y Enviar a AEAT
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NextIcon />}
            >
              Siguiente
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default ENSDeclarationForm
