import React, { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Stepper, Step, StepLabel, TextField, MenuItem,
  Grid, Paper, IconButton, Divider, Alert, Chip, Autocomplete,
  FormControlLabel, Checkbox, CircularProgress
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Save as SaveIcon,
  Send as SendIcon
} from '@mui/icons-material'
import { pueAPI } from '../../services/api'

// Steps
const steps = ['Tipo y Operador', 'Mercancias', 'Transporte', 'Documentos', 'Revision']

// Transport modes
const transportModes = [
  { value: 'ROAD', label: 'Carretera' },
  { value: 'RAIL', label: 'Ferrocarril' },
  { value: 'AIR', label: 'Aereo' },
  { value: 'SEA', label: 'Maritimo' },
  { value: 'MULTIMODAL', label: 'Multimodal' }
]

// Document types
const documentTypes = [
  { value: 'DECLARATION_CONFORMITY', label: 'Declaracion de Conformidad UE' },
  { value: 'CERTIFICATE_CE', label: 'Certificado CE' },
  { value: 'CERTIFICATE_ROHS', label: 'Certificado RoHS' },
  { value: 'CERTIFICATE_REACH', label: 'Certificado REACH' },
  { value: 'TEST_REPORT', label: 'Informe de Ensayo' },
  { value: 'TECHNICAL_FILE', label: 'Documentacion Tecnica' },
  { value: 'INVOICE', label: 'Factura Comercial' },
  { value: 'PACKING_LIST', label: 'Lista de Empaque' },
  { value: 'TRANSPORT_DOC', label: 'Documento de Transporte' },
  { value: 'POWER_OF_ATTORNEY', label: 'Poder de Representacion' },
  { value: 'MANUFACTURER_AUTH', label: 'Autorizacion Fabricante' },
  { value: 'LABEL_SAMPLE', label: 'Muestra de Etiquetado' },
  { value: 'PRODUCT_IMAGE', label: 'Imagen del Producto' },
  { value: 'OTHER', label: 'Otro' }
]

const emptyGoodsItem = {
  description: '',
  taricCode: '',
  quantity: 1,
  unitOfMeasure: 'PCE',
  grossMass: 0,
  netMass: 0,
  statisticalValue: 0,
  countryOfOrigin: '',
  brand: '',
  model: '',
  manufacturer: { name: '', country: '' },
  certifications: []
}

const PUERequestForm = ({ open, onClose, onSuccess, initialType, editData }) => {
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validation, setValidation] = useState(null)
  const [pueTypes, setPueTypes] = useState([])
  const [soivreOffices, setSoivreOffices] = useState([])
  const [requiredDocuments, setRequiredDocuments] = useState([])

  const [formData, setFormData] = useState({
    pueType: initialType || '',
    pueSubtype: '',
    operator: {
      name: '',
      eori: '',
      nif: '',
      address: {
        streetAndNumber: '',
        city: '',
        postalCode: '',
        province: '',
        country: 'ES'
      },
      contactPerson: '',
      phone: '',
      email: ''
    },
    manufacturer: {
      name: '',
      country: '',
      registrationNumber: ''
    },
    soivreOffice: { code: '', name: '', province: '' },
    customsOffice: { code: '', name: '' },
    goods: [{ ...emptyGoodsItem, sequenceNumber: 1 }],
    transport: {
      mode: 'ROAD',
      documentType: 'CMR',
      documentNumber: '',
      containerNumber: '',
      vehicleRegistration: '',
      expectedArrivalDate: ''
    },
    attachedDocuments: [],
    priority: 'normal',
    declarationMRN: ''
  })

  useEffect(() => {
    if (open) {
      loadPueTypes()
      loadSoivreOffices()
      if (editData) {
        setFormData(editData)
      }
    }
  }, [open])

  useEffect(() => {
    if (formData.pueType) {
      loadRequiredDocuments(formData.pueType)
    }
  }, [formData.pueType])

  const loadPueTypes = async () => {
    try {
      const response = await pueAPI.getTypes()
      if (response.data.success) {
        setPueTypes(response.data.data)
      }
    } catch (err) {
      console.error('Error loading PUE types:', err)
    }
  }

  const loadSoivreOffices = async () => {
    try {
      const response = await pueAPI.getSoivreOffices()
      if (response.data.success) {
        setSoivreOffices(response.data.data)
      }
    } catch (err) {
      console.error('Error loading SOIVRE offices:', err)
    }
  }

  const loadRequiredDocuments = async (type) => {
    try {
      const response = await pueAPI.getRequiredDocuments(type)
      if (response.data.success) {
        setRequiredDocuments(response.data.data)
      }
    } catch (err) {
      console.error('Error loading required documents:', err)
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
  }

  const handleGoodsChange = (index, field, value) => {
    setFormData(prev => {
      const newGoods = [...prev.goods]
      newGoods[index] = { ...newGoods[index], [field]: value }
      return { ...prev, goods: newGoods }
    })
  }

  const handleAddGoods = () => {
    setFormData(prev => ({
      ...prev,
      goods: [...prev.goods, { ...emptyGoodsItem, sequenceNumber: prev.goods.length + 1 }]
    }))
  }

  const handleRemoveGoods = (index) => {
    if (formData.goods.length <= 1) return
    setFormData(prev => ({
      ...prev,
      goods: prev.goods.filter((_, i) => i !== index).map((g, i) => ({ ...g, sequenceNumber: i + 1 }))
    }))
  }

  const handleAddDocument = () => {
    setFormData(prev => ({
      ...prev,
      attachedDocuments: [...prev.attachedDocuments, { type: '', name: '', documentNumber: '', url: '' }]
    }))
  }

  const handleDocumentChange = (index, field, value) => {
    setFormData(prev => {
      const newDocs = [...prev.attachedDocuments]
      newDocs[index] = { ...newDocs[index], [field]: value }
      return { ...prev, attachedDocuments: newDocs }
    })
  }

  const handleRemoveDocument = (index) => {
    setFormData(prev => ({
      ...prev,
      attachedDocuments: prev.attachedDocuments.filter((_, i) => i !== index)
    }))
  }

  const validateStep = async () => {
    try {
      const response = await pueAPI.validate(formData)
      setValidation(response.data.data)
      return response.data.data.valid
    } catch (err) {
      console.error('Validation error:', err)
      return false
    }
  }

  const handleNext = async () => {
    if (activeStep === steps.length - 2) {
      await validateStep()
    }
    setActiveStep(prev => prev + 1)
  }

  const handleBack = () => {
    setActiveStep(prev => prev - 1)
  }

  const handleSave = async (submit = false) => {
    try {
      setLoading(true)
      setError(null)

      const response = editData
        ? await pueAPI.update(editData._id, formData)
        : await pueAPI.create(formData)

      if (response.data.success) {
        if (submit) {
          await pueAPI.submit(response.data.data._id)
        }
        onSuccess(response.data.data)
      } else {
        setError(response.data.error || 'Error al guardar')
      }
    } catch (err) {
      console.error('Error saving:', err)
      setError(err.response?.data?.error || 'Error al guardar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderTypeAndOperator()
      case 1:
        return renderGoods()
      case 2:
        return renderTransport()
      case 3:
        return renderDocuments()
      case 4:
        return renderReview()
      default:
        return null
    }
  }

  const renderTypeAndOperator = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Tipo de Control PUE
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          select
          required
          label="Tipo PUE"
          value={formData.pueType}
          onChange={(e) => handleFieldChange('pueType', e.target.value)}
        >
          {pueTypes.map(type => (
            <MenuItem key={type.code} value={type.code}>
              <Box>
                <Typography variant="body2" fontWeight={500}>{type.name}</Typography>
                <Typography variant="caption" color="textSecondary">{type.fullName}</Typography>
              </Box>
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          select
          label="Subtipo"
          value={formData.pueSubtype}
          onChange={(e) => handleFieldChange('pueSubtype', e.target.value)}
          disabled={!formData.pueType}
        >
          <MenuItem value="">Sin especificar</MenuItem>
          {pueTypes.find(t => t.code === formData.pueType)?.subtypes?.map(sub => (
            <MenuItem key={sub} value={sub}>{sub.replace(/_/g, ' ')}</MenuItem>
          ))}
        </TextField>
      </Grid>

      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Datos del Operador
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          required
          label="Nombre/Razon Social"
          value={formData.operator.name}
          onChange={(e) => handleFieldChange('operator.name', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="EORI"
          value={formData.operator.eori}
          onChange={(e) => handleFieldChange('operator.eori', e.target.value)}
          placeholder="ES12345678A"
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="NIF/CIF"
          value={formData.operator.nif}
          onChange={(e) => handleFieldChange('operator.nif', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Direccion"
          value={formData.operator.address.streetAndNumber}
          onChange={(e) => handleFieldChange('operator.address.streetAndNumber', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="Ciudad"
          value={formData.operator.address.city}
          onChange={(e) => handleFieldChange('operator.address.city', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="Codigo Postal"
          value={formData.operator.address.postalCode}
          onChange={(e) => handleFieldChange('operator.address.postalCode', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Persona de Contacto"
          value={formData.operator.contactPerson}
          onChange={(e) => handleFieldChange('operator.contactPerson', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Telefono"
          value={formData.operator.phone}
          onChange={(e) => handleFieldChange('operator.phone', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.operator.email}
          onChange={(e) => handleFieldChange('operator.email', e.target.value)}
        />
      </Grid>

      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Oficina SOIVRE
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <Autocomplete
          options={soivreOffices}
          getOptionLabel={(opt) => `${opt.code} - ${opt.name}`}
          value={soivreOffices.find(o => o.code === formData.soivreOffice.code) || null}
          onChange={(_, value) => handleFieldChange('soivreOffice', value || { code: '', name: '', province: '' })}
          renderInput={(params) => <TextField {...params} label="Oficina SOIVRE" />}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Codigo Aduana (opcional)"
          value={formData.customsOffice.code}
          onChange={(e) => handleFieldChange('customsOffice.code', e.target.value)}
          placeholder="ES002801"
        />
      </Grid>
    </Grid>
  )

  const renderGoods = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Mercancias ({formData.goods.length})
        </Typography>
        <Button startIcon={<AddIcon />} onClick={handleAddGoods}>
          Agregar Mercancia
        </Button>
      </Box>

      {formData.goods.map((item, index) => (
        <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2">Mercancia {index + 1}</Typography>
            {formData.goods.length > 1 && (
              <IconButton size="small" color="error" onClick={() => handleRemoveGoods(index)}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                required
                size="small"
                label="Descripcion"
                value={item.description}
                onChange={(e) => handleGoodsChange(index, 'description', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                required
                size="small"
                label="Codigo TARIC"
                value={item.taricCode}
                onChange={(e) => handleGoodsChange(index, 'taricCode', e.target.value)}
                placeholder="8517120000"
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Cantidad"
                value={item.quantity}
                onChange={(e) => handleGoodsChange(index, 'quantity', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                select
                label="Unidad"
                value={item.unitOfMeasure}
                onChange={(e) => handleGoodsChange(index, 'unitOfMeasure', e.target.value)}
              >
                <MenuItem value="PCE">Piezas</MenuItem>
                <MenuItem value="KGM">Kg</MenuItem>
                <MenuItem value="TNE">Toneladas</MenuItem>
                <MenuItem value="SET">Sets</MenuItem>
                <MenuItem value="PAR">Pares</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Peso Bruto (kg)"
                value={item.grossMass}
                onChange={(e) => handleGoodsChange(index, 'grossMass', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Peso Neto (kg)"
                value={item.netMass}
                onChange={(e) => handleGoodsChange(index, 'netMass', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Valor EUR"
                value={item.statisticalValue}
                onChange={(e) => handleGoodsChange(index, 'statisticalValue', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Pais Origen"
                value={item.countryOfOrigin}
                onChange={(e) => handleGoodsChange(index, 'countryOfOrigin', e.target.value.toUpperCase())}
                inputProps={{ maxLength: 2 }}
                placeholder="CN"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Marca"
                value={item.brand}
                onChange={(e) => handleGoodsChange(index, 'brand', e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Modelo"
                value={item.model}
                onChange={(e) => handleGoodsChange(index, 'model', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Fabricante"
                value={item.manufacturer?.name || ''}
                onChange={(e) => handleGoodsChange(index, 'manufacturer', { ...item.manufacturer, name: e.target.value })}
              />
            </Grid>
          </Grid>
        </Paper>
      ))}
    </Box>
  )

  const renderTransport = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Datos de Transporte
        </Typography>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          select
          required
          label="Modo de Transporte"
          value={formData.transport.mode}
          onChange={(e) => handleFieldChange('transport.mode', e.target.value)}
        >
          {transportModes.map(mode => (
            <MenuItem key={mode.value} value={mode.value}>{mode.label}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          select
          label="Tipo Documento"
          value={formData.transport.documentType}
          onChange={(e) => handleFieldChange('transport.documentType', e.target.value)}
        >
          <MenuItem value="CMR">CMR</MenuItem>
          <MenuItem value="BL">B/L</MenuItem>
          <MenuItem value="AWB">AWB</MenuItem>
          <MenuItem value="CIM">CIM</MenuItem>
          <MenuItem value="TIR">TIR</MenuItem>
          <MenuItem value="OTHER">Otro</MenuItem>
        </TextField>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Numero Documento"
          value={formData.transport.documentNumber}
          onChange={(e) => handleFieldChange('transport.documentNumber', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Numero Contenedor"
          value={formData.transport.containerNumber}
          onChange={(e) => handleFieldChange('transport.containerNumber', e.target.value)}
          placeholder="ABCD1234567"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Matricula Vehiculo"
          value={formData.transport.vehicleRegistration}
          onChange={(e) => handleFieldChange('transport.vehicleRegistration', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          type="date"
          label="Fecha Llegada Prevista"
          value={formData.transport.expectedArrivalDate}
          onChange={(e) => handleFieldChange('transport.expectedArrivalDate', e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Referencia de Declaracion (opcional)
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="MRN Declaracion Aduanera"
          value={formData.declarationMRN}
          onChange={(e) => handleFieldChange('declarationMRN', e.target.value)}
          placeholder="24ES..."
        />
      </Grid>
    </Grid>
  )

  const renderDocuments = () => (
    <Box>
      {requiredDocuments.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Documentos requeridos para {formData.pueType}:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {requiredDocuments.map(doc => (
              <Chip
                key={doc.code}
                label={doc.name}
                size="small"
                color={doc.required ? 'primary' : 'default'}
                variant={doc.required ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Documentos Adjuntos ({formData.attachedDocuments.length})
        </Typography>
        <Button startIcon={<AddIcon />} onClick={handleAddDocument}>
          Agregar Documento
        </Button>
      </Box>

      {formData.attachedDocuments.map((doc, index) => (
        <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Tipo"
                value={doc.type}
                onChange={(e) => handleDocumentChange(index, 'type', e.target.value)}
              >
                {documentTypes.map(dt => (
                  <MenuItem key={dt.value} value={dt.value}>{dt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Nombre/Descripcion"
                value={doc.name}
                onChange={(e) => handleDocumentChange(index, 'name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Numero/Referencia"
                value={doc.documentNumber}
                onChange={(e) => handleDocumentChange(index, 'documentNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <IconButton color="error" onClick={() => handleRemoveDocument(index)}>
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Paper>
      ))}

      {formData.attachedDocuments.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">
            No hay documentos adjuntos. Puede agregarlos ahora o despues.
          </Typography>
        </Paper>
      )}
    </Box>
  )

  const renderReview = () => (
    <Box>
      {validation && !validation.valid && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Errores de validacion:</Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validation.errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {validation?.warnings?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Advertencias:</Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validation.warnings.map((warn, i) => (
              <li key={i}>{warn.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>Tipo de Control</Typography>
            <Typography variant="body1" fontWeight={500}>{formData.pueType}</Typography>
            {formData.pueSubtype && <Typography variant="body2">{formData.pueSubtype}</Typography>}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>Operador</Typography>
            <Typography variant="body1" fontWeight={500}>{formData.operator.name}</Typography>
            <Typography variant="body2">{formData.operator.eori || formData.operator.nif}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>Mercancias</Typography>
            <Typography variant="body1">{formData.goods.length} items</Typography>
            <Typography variant="body2">
              Peso: {formData.goods.reduce((sum, g) => sum + (g.grossMass || 0), 0).toFixed(2)} kg
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>Transporte</Typography>
            <Typography variant="body1">{transportModes.find(m => m.value === formData.transport.mode)?.label}</Typography>
            <Typography variant="body2">{formData.transport.documentNumber}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>Documentos</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.attachedDocuments.length > 0 ? (
                formData.attachedDocuments.map((doc, i) => (
                  <Chip key={i} label={doc.name || doc.type} size="small" />
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">Sin documentos adjuntos</Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editData ? 'Editar Solicitud PUE' : 'Nueva Solicitud PUE'}
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button startIcon={<BackIcon />} onClick={handleBack}>
            Anterior
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" endIcon={<NextIcon />} onClick={handleNext}>
            Siguiente
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => handleSave(false)}
              disabled={loading}
            >
              Guardar Borrador
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={() => handleSave(true)}
              disabled={loading || (validation && !validation.valid)}
            >
              Guardar y Enviar
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default PUERequestForm
