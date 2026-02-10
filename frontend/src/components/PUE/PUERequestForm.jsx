import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Stepper, Step, StepLabel, TextField, MenuItem,
  Grid, Paper, IconButton, Divider, Alert, Chip, Autocomplete,
  FormControlLabel, Checkbox, CircularProgress, Radio, RadioGroup,
  FormControl, FormLabel, Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { pueAPI } from '../../services/api'

// All steps definition
const ALL_STEPS = [
  { key: 'mrn', label: 'MRN y Partida' },
  { key: 'datos', label: 'Datos Solicitud' },
  { key: 'specs', label: 'Especificidades y Centro' },
  { key: 'certs', label: 'Certificados y RII' },
  { key: 'docs', label: 'Documentacion' },
  { key: 'review', label: 'Revision' }
]

// Document types for upload
const documentTypeOptions = [
  { value: 'DECLARATION_CONFORMITY', label: 'Declaracion de Conformidad UE' },
  { value: 'CERTIFICATE_CE', label: 'Certificado CE' },
  { value: 'CERTIFICATE_ROHS', label: 'Certificado RoHS' },
  { value: 'CERTIFICATE_REACH', label: 'Certificado REACH' },
  { value: 'TEST_REPORT', label: 'Informe de Ensayo' },
  { value: 'TECHNICAL_FILE', label: 'Documentacion Tecnica' },
  { value: 'INVOICE', label: 'Factura Comercial' },
  { value: 'PACKING_LIST', label: 'Lista de Empaque' },
  { value: 'TRANSPORT_DOC', label: 'Documento de Transporte' },
  { value: 'OTHER', label: 'Otro' }
]

const PUERequestForm = ({ open, onClose, onSuccess, initialType, editData }) => {
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [validation, setValidation] = useState(null)

  // Catalogs
  const [catalogs, setCatalogs] = useState(null)
  const [inspectionPoints, setInspectionPoints] = useState([])

  // MRN lookup state
  const [mrnLoading, setMrnLoading] = useState(false)
  const [mrnResult, setMrnResult] = useState(null)

  // RII validation state
  const [riiLoading, setRiiLoading] = useState(false)
  const [riiResult, setRiiResult] = useState(null)

  // Form data
  const [formData, setFormData] = useState({
    pueType: initialType || 'ROHS',
    pueSubtype: '',
    // Step 0: MRN
    declarationMRN: '',
    claveZeta: '',
    mrnPartida: '',
    flowType: '',
    // Step 1: Datos
    operationType: 'ALTA',
    documentTypePue: 'DUA',
    referenciaDocucice: '',
    declarationTypeSoivre: 'EXPEDIENTE_NUEVO',
    duaPrecedente: '',
    soivrePrecedente: '',
    contactEmail: '',
    // Step 2: Especificidades y Centro
    specificities: [],
    codCice: null,
    codPi: null,
    codigoSoivreProducto: '',
    merchandiseUnit: '',
    merchandiseQuantity: '',
    // Step 3: Certificados y RII
    certificates: { com: '', rohs: '', raee: '' },
    riiNumbers: { raee: '', pya: '' },
    // Step 4: Documentos
    attachedDocuments: [],
    // Auto-fill
    h1AutoFill: null,
    // Legacy fields
    operator: { name: '', eori: '', nif: '', address: { streetAndNumber: '', city: '', postalCode: '', province: '', country: 'ES' }, contactPerson: '', phone: '', email: '' },
    goods: [{ sequenceNumber: 1, description: '', taricCode: '', quantity: 1, unitOfMeasure: 'PCE', grossMass: 0, netMass: 0, statisticalValue: 0, countryOfOrigin: '' }],
    soivreOffice: { code: '', name: '', province: '' },
    customsOffice: { code: '', name: '' },
    priority: 'normal'
  })

  // Determine visible steps based on flowType
  const visibleSteps = useMemo(() => {
    if (formData.flowType === 'ROHS_RAEE') {
      return ALL_STEPS.filter(s => s.key !== 'docs') // Hide documents step
    }
    return ALL_STEPS
  }, [formData.flowType])

  // Load catalogs on open
  useEffect(() => {
    if (open) {
      loadCatalogs()
      if (editData) {
        setFormData(prev => ({ ...prev, ...editData }))
      }
    }
  }, [open])

  // Load inspection points when center changes
  useEffect(() => {
    if (formData.codCice?.code) {
      loadInspectionPoints(formData.codCice.code)
    }
  }, [formData.codCice?.code])

  const loadCatalogs = async () => {
    try {
      const response = await pueAPI.getCatalogs()
      if (response.data.success) {
        setCatalogs(response.data.data)
      }
    } catch (err) {
      console.error('Error loading catalogs:', err)
    }
  }

  const loadInspectionPoints = async (centerCode) => {
    try {
      const response = await pueAPI.getInspectionPoints(centerCode)
      if (response.data.success) {
        setInspectionPoints(response.data.data)
      }
    } catch (err) {
      console.error('Error loading inspection points:', err)
    }
  }

  const handleFieldChange = (path, value) => {
    setFormData(prev => {
      const newData = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let current = newData
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newData
    })
  }

  // === MRN LOOKUP ===
  const handleMRNLookup = async () => {
    if (!formData.declarationMRN || !formData.claveZeta) {
      setError('Debe introducir MRN y Clave Zeta')
      return
    }

    setMrnLoading(true)
    setError(null)
    setMrnResult(null)

    try {
      const response = await pueAPI.lookupMRN(formData.declarationMRN, formData.claveZeta)

      if (response.data.success) {
        const data = response.data.data
        setMrnResult(data)

        // Auto-fill form data
        setFormData(prev => ({
          ...prev,
          mrnPartida: data.mrnPartida,
          claveZeta: data.claveZeta,
          flowType: data.suggestedFlow,
          h1AutoFill: data.h1AutoFill,
          operator: {
            ...prev.operator,
            name: data.h1AutoFill.importerName || prev.operator.name,
            nif: data.h1AutoFill.importerNif || prev.operator.nif,
            eori: data.h1AutoFill.importerEori || prev.operator.eori
          },
          goods: [{
            sequenceNumber: 1,
            description: data.h1AutoFill.goodsDescription || '',
            taricCode: data.h1AutoFill.taricCode || '',
            quantity: data.h1AutoFill.quantity || 1,
            unitOfMeasure: data.h1AutoFill.unit || 'KGM',
            countryOfOrigin: data.h1AutoFill.origin || '',
            grossMass: 0,
            netMass: 0,
            statisticalValue: 0
          }]
        }))

        setSuccess(`Datos cargados desde declaracion ${data.declarationMRN}, partida ${data.claveZeta}`)
      } else {
        setError(response.data.error || 'Error buscando MRN')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error conectando con el servidor')
    } finally {
      setMrnLoading(false)
    }
  }

  // === RII VALIDATION ===
  const handleValidateRII = async () => {
    const nif = formData.h1AutoFill?.importerNif || formData.operator?.nif
    if (!nif) {
      setError('No se encontro NIF/CIF del importador para validar RII')
      return
    }

    setRiiLoading(true)
    setRiiResult(null)

    try {
      const response = await pueAPI.validateRII(nif)
      if (response.data.success) {
        const data = response.data.data
        setRiiResult(data)

        if (data.found) {
          setFormData(prev => ({
            ...prev,
            riiNumbers: {
              raee: data.riiRaee || '',
              pya: data.riiPya || ''
            }
          }))
        }
      }
    } catch (err) {
      setRiiResult({ found: false, message: 'Error consultando RII' })
    } finally {
      setRiiLoading(false)
    }
  }

  // === DOCUMENTS ===
  const handleAddDocument = () => {
    setFormData(prev => ({
      ...prev,
      attachedDocuments: [...prev.attachedDocuments, { type: '', name: '', documentNumber: '' }]
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

  // === NAVIGATION ===
  const handleNext = () => {
    setError(null)
    setSuccess(null)
    const currentIdx = visibleSteps.findIndex((_, i) => i === activeStep)
    if (currentIdx < visibleSteps.length - 1) {
      setActiveStep(currentIdx + 1)
    }
  }

  const handleBack = () => {
    setError(null)
    setSuccess(null)
    if (activeStep > 0) {
      setActiveStep(activeStep - 1)
    }
  }

  // === SAVE ===
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
      setError(err.response?.data?.error || 'Error al guardar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // RENDER STEPS
  // ==========================================

  const renderCurrentStep = () => {
    const step = visibleSteps[activeStep]
    if (!step) return null
    switch (step.key) {
      case 'mrn': return renderStepMRN()
      case 'datos': return renderStepDatos()
      case 'specs': return renderStepEspecificidades()
      case 'certs': return renderStepCertificados()
      case 'docs': return renderStepDocumentos()
      case 'review': return renderStepRevision()
      default: return null
    }
  }

  // --- STEP 0: MRN y Partida ---
  const renderStepMRN = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Alert severity="info" sx={{ mb: 1 }}>
          Introduzca el MRN de la declaracion aduanera (H1/AES) y la Clave Zeta de la partida
          para cargar automaticamente los datos de la declaracion.
        </Alert>
      </Grid>

      <Grid item xs={12} md={7}>
        <TextField
          fullWidth
          required
          label="MRN (Numero de Referencia de Movimiento)"
          value={formData.declarationMRN}
          onChange={(e) => handleFieldChange('declarationMRN', e.target.value)}
          placeholder="24ES..."
          helperText="Numero MRN de la declaracion H1, AES o Transito"
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          required
          label="Clave Zeta (Partida)"
          value={formData.claveZeta}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 5)
            handleFieldChange('claveZeta', val)
          }}
          placeholder="00001"
          helperText="5 digitos (ej. 00001)"
          inputProps={{ maxLength: 5 }}
        />
      </Grid>
      <Grid item xs={12} md={2}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleMRNLookup}
          disabled={mrnLoading || !formData.declarationMRN || !formData.claveZeta}
          startIcon={mrnLoading ? <CircularProgress size={20} /> : <SearchIcon />}
          sx={{ height: 56 }}
        >
          Buscar
        </Button>
      </Grid>

      {/* Auto-fill preview */}
      {mrnResult && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50', borderColor: 'success.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckIcon color="success" />
              <Typography variant="subtitle1" fontWeight={600} color="success.main">
                Datos cargados desde declaracion
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="textSecondary">Importador</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {mrnResult.h1AutoFill?.importerName || '-'}
                </Typography>
                <Typography variant="caption">NIF: {mrnResult.h1AutoFill?.importerNif || '-'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="textSecondary">Mercancia</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {mrnResult.h1AutoFill?.goodsDescription || '-'}
                </Typography>
                <Typography variant="caption">TARIC: {mrnResult.h1AutoFill?.taricCode || '-'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="textSecondary">Flujo sugerido</Typography>
                <Chip
                  label={mrnResult.suggestedFlow === 'ROHS_RAEE' ? 'ROHS/RAEE (Simplificado)' : 'SOIVRE (Completo)'}
                  color={mrnResult.suggestedFlow === 'ROHS_RAEE' ? 'warning' : 'primary'}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      )}

      {/* Flow Type Selection */}
      <Grid item xs={12}>
        <Divider sx={{ my: 1 }} />
        <FormControl required>
          <FormLabel sx={{ fontWeight: 600, mb: 1 }}>Tipo de Flujo</FormLabel>
          <RadioGroup
            row
            value={formData.flowType}
            onChange={(e) => handleFieldChange('flowType', e.target.value)}
          >
            <FormControlLabel
              value="SOIVRE"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>SOIVRE (Calidad)</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Formulario completo con documentacion obligatoria
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="ROHS_RAEE"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>ROHS/RAEE (Electricos)</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Formulario simplificado sin documentacion
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </Grid>
    </Grid>
  )

  // --- STEP 1: Datos de la Solicitud ---
  const renderStepDatos = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          select
          required
          label="Operacion"
          value={formData.operationType}
          onChange={(e) => handleFieldChange('operationType', e.target.value)}
        >
          {(catalogs?.operationTypes || []).map(t => (
            <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          select
          label="Tipo Documento"
          value={formData.documentTypePue}
          onChange={(e) => handleFieldChange('documentTypePue', e.target.value)}
        >
          {(catalogs?.documentTypes || []).map(t => (
            <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          select
          label="Tipo Declaracion"
          value={formData.declarationTypeSoivre}
          onChange={(e) => handleFieldChange('declarationTypeSoivre', e.target.value)}
        >
          {(catalogs?.declarationTypes || []).map(t => (
            <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
          ))}
        </TextField>
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Referencia / Docucice 1"
          value={formData.referenciaDocucice}
          onChange={(e) => handleFieldChange('referenciaDocucice', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          required
          label="Correo electronico de contacto"
          type="email"
          value={formData.contactEmail}
          onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
          placeholder="usuario@empresa.es"
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="DUA Precedente"
          value={formData.duaPrecedente}
          onChange={(e) => handleFieldChange('duaPrecedente', e.target.value)}
          helperText="Referencia DUA anterior si aplica"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Id. SOIVRE precedente"
          value={formData.soivrePrecedente}
          onChange={(e) => handleFieldChange('soivrePrecedente', e.target.value)}
          helperText="Numero de solicitud SOIVRE anterior si aplica"
        />
      </Grid>

      {/* Operator info (auto-filled but editable) */}
      <Grid item xs={12}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Datos del Operador {formData.h1AutoFill ? '(auto-rellenado)' : ''}
        </Typography>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          required
          label="Nombre/Razon Social"
          value={formData.operator.name}
          onChange={(e) => handleFieldChange('operator.name', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="NIF/CIF"
          value={formData.operator.nif}
          onChange={(e) => handleFieldChange('operator.nif', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="EORI"
          value={formData.operator.eori}
          onChange={(e) => handleFieldChange('operator.eori', e.target.value)}
          placeholder="ES12345678A"
        />
      </Grid>
    </Grid>
  )

  // --- STEP 2: Especificidades y Centro ---
  const renderStepEspecificidades = () => {
    const specificityOptions = formData.flowType === 'ROHS_RAEE'
      ? (catalogs?.rohsRaeeSpecificities || [])
      : (catalogs?.soivreSpecificities || [])

    return (
      <Grid container spacing={3}>
        {/* Specificities multi-select */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Especificidades {formData.flowType === 'ROHS_RAEE' ? '(ROHS/RAEE)' : '(SOIVRE)'}
          </Typography>
          <Autocomplete
            multiple
            options={specificityOptions}
            getOptionLabel={(opt) => opt.label}
            value={specificityOptions.filter(s => formData.specificities.includes(s.code))}
            onChange={(_, vals) => handleFieldChange('specificities', vals.map(v => v.code))}
            disableCloseOnSelect
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox checked={selected} sx={{ mr: 1 }} size="small" />
                {option.label}
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Seleccionar especificidades" placeholder="Buscar..." />
            )}
            renderTags={(values, getTagProps) =>
              values.map((option, index) => (
                <Chip {...getTagProps({ index })} key={option.code} label={option.label} size="small" />
              ))
            }
          />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Centro e Inspeccion SOIVRE
          </Typography>
        </Grid>

        {/* CodCice - Centro SOIVRE */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            options={catalogs?.centers || []}
            getOptionLabel={(opt) => `${opt.code} - ${opt.name}`}
            value={formData.codCice}
            onChange={(_, val) => {
              handleFieldChange('codCice', val)
              handleFieldChange('codPi', null)
              setInspectionPoints([])
            }}
            renderInput={(params) => (
              <TextField {...params} required label="CodCice (Centro del S.I. SOIVRE)" />
            )}
            isOptionEqualToValue={(opt, val) => opt?.code === val?.code}
          />
        </Grid>

        {/* CodPi - Punto de Inspeccion */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            options={inspectionPoints}
            getOptionLabel={(opt) => `${opt.code} - ${opt.name} (${opt.type})`}
            value={formData.codPi}
            onChange={(_, val) => handleFieldChange('codPi', val)}
            disabled={!formData.codCice}
            renderInput={(params) => (
              <TextField {...params} required label="CodPi (Punto de inspeccion SOIVRE)" helperText={!formData.codCice ? 'Seleccione primero el centro SOIVRE' : ''} />
            )}
            isOptionEqualToValue={(opt, val) => opt?.code === val?.code}
          />
        </Grid>

        {/* SOIVRE Product Code */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Codigo SOIVRE Producto"
            value={formData.codigoSoivreProducto}
            onChange={(e) => handleFieldChange('codigoSoivreProducto', e.target.value)}
          />
        </Grid>

        {/* Merchandise units */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            select
            required
            label="Unidades de Mercancia"
            value={formData.merchandiseUnit}
            onChange={(e) => handleFieldChange('merchandiseUnit', e.target.value)}
          >
            <MenuItem value="">Seleccionar...</MenuItem>
            {(catalogs?.merchandiseUnits || []).map(u => (
              <MenuItem key={u.code} value={u.code}>{u.label}</MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* Quantity */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            required
            type="number"
            label="Cantidad de mercancia"
            value={formData.merchandiseQuantity}
            onChange={(e) => handleFieldChange('merchandiseQuantity', e.target.value)}
            inputProps={{ min: 0 }}
          />
        </Grid>

        {/* TARIC code display for SOIVRE flow */}
        {formData.flowType === 'SOIVRE' && (
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Partida Arancelaria
            </Typography>
            <TextField
              fullWidth
              label="Codigo TARIC"
              value={formData.goods[0]?.taricCode || ''}
              onChange={(e) => {
                const newGoods = [...formData.goods]
                if (newGoods[0]) newGoods[0].taricCode = e.target.value
                handleFieldChange('goods', newGoods)
              }}
              helperText="Partida arancelaria de la mercancia"
            />
          </Grid>
        )}
      </Grid>
    )
  }

  // --- STEP 3: Certificados y RII ---
  const renderStepCertificados = () => {
    const certOptions = catalogs?.certificateTypes || {}
    const nif = formData.h1AutoFill?.importerNif || formData.operator?.nif

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Certificados Solicitados
          </Typography>
        </Grid>

        {/* COM Certificate */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            select
            label="Certificado solicitado (COM)"
            value={formData.certificates.com}
            onChange={(e) => handleFieldChange('certificates.com', e.target.value)}
          >
            <MenuItem value="">No aplica</MenuItem>
            {(certOptions.COM || []).map(c => (
              <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* ROHS Certificate */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            select
            label="Certificado solicitado (ROHS)"
            value={formData.certificates.rohs}
            onChange={(e) => handleFieldChange('certificates.rohs', e.target.value)}
          >
            <MenuItem value="">No aplica</MenuItem>
            {(certOptions.ROHS || []).map(c => (
              <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* RAEE Certificate */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            select
            label="Certificado solicitado (RAEE)"
            value={formData.certificates.raee}
            onChange={(e) => handleFieldChange('certificates.raee', e.target.value)}
          >
            <MenuItem value="">No aplica</MenuItem>
            {(certOptions.RAEE || []).map(c => (
              <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
            ))}
          </TextField>
        </Grid>

        {/* RII Validation */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Validacion RII (Registro Integrado Industrial)
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Para solicitudes SOIVRE de aparatos electricos o ROHS/RAEE, es obligatorio incluir
            los numeros de registro RII RAEE y RII PyA asociados al CIF del importador.
          </Typography>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              label="NIF/CIF del importador"
              value={nif || ''}
              disabled
            />
            <Button
              variant="contained"
              onClick={handleValidateRII}
              disabled={!nif || riiLoading}
              startIcon={riiLoading ? <CircularProgress size={20} /> : <SearchIcon />}
              sx={{ minWidth: 140, height: 56 }}
            >
              Validar RII
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Numero RII RAEE"
            value={formData.riiNumbers.raee}
            onChange={(e) => handleFieldChange('riiNumbers.raee', e.target.value)}
            helperText="Registro de aparatos electricos y electronicos"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Numero RII PyA"
            value={formData.riiNumbers.pya}
            onChange={(e) => handleFieldChange('riiNumbers.pya', e.target.value)}
            helperText="Registro de pilas y acumuladores"
          />
        </Grid>

        {/* RII Validation Result */}
        {riiResult && (
          <Grid item xs={12}>
            {riiResult.found ? (
              <Alert severity="success" icon={<CheckIcon />}>
                <Typography variant="subtitle2">{riiResult.message}</Typography>
                <Typography variant="body2">
                  Estado: {riiResult.status} | Fecha registro: {riiResult.registrationDate}
                </Typography>
              </Alert>
            ) : (
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="subtitle2">{riiResult.message}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Enlaces para tramitar registro:
                </Typography>
                <Typography variant="caption" component="div">
                  RII RAEE: industria.serviciosmin.gob.es/RII_aee/
                </Typography>
                <Typography variant="caption" component="div">
                  RII PyA: industria.serviciosmin.gob.es/RII_PYA/
                </Typography>
              </Alert>
            )}
          </Grid>
        )}
      </Grid>
    )
  }

  // --- STEP 4: Documentacion (SOIVRE only) ---
  const renderStepDocumentos = () => (
    <Box>
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">Documentacion obligatoria para flujo SOIVRE</Typography>
        <Typography variant="body2">
          El inspector NO firmara la solicitud sin documentacion adjunta.
          Debe adjuntar al menos un documento.
        </Typography>
      </Alert>

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
                {documentTypeOptions.map(dt => (
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
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderColor: 'error.main' }}>
          <WarningIcon color="error" sx={{ fontSize: 40, mb: 1 }} />
          <Typography color="error" fontWeight={500}>
            Sin documentos adjuntos. Debe agregar al menos un documento para flujo SOIVRE.
          </Typography>
        </Paper>
      )}
    </Box>
  )

  // --- STEP 5: Revision ---
  const renderStepRevision = () => {
    const isSOIVRE = formData.flowType === 'SOIVRE'
    const missingDocs = isSOIVRE && formData.attachedDocuments.length === 0
    const missingCerts = formData.flowType === 'ROHS_RAEE' && !formData.certificates.rohs && !formData.certificates.raee

    return (
      <Box>
        {(missingDocs || missingCerts) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2">Errores de validacion:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {missingDocs && <li>Flujo SOIVRE requiere al menos un documento adjunto</li>}
              {missingCerts && <li>Debe seleccionar al menos un certificado ROHS o RAEE</li>}
              {!formData.contactEmail && <li>Correo electronico de contacto es obligatorio</li>}
              {!formData.codCice && <li>Centro SOIVRE (CodCice) es obligatorio</li>}
              {!formData.codPi && <li>Punto de inspeccion (CodPi) es obligatorio</li>}
            </ul>
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* MRN y Partida */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>MRN y Partida</Typography>
              <Typography variant="body1" fontWeight={500}>{formData.mrnPartida || '-'}</Typography>
              <Typography variant="body2">Clave Zeta: {formData.claveZeta || '-'}</Typography>
              <Chip
                label={formData.flowType === 'ROHS_RAEE' ? 'ROHS/RAEE' : 'SOIVRE'}
                color={formData.flowType === 'ROHS_RAEE' ? 'warning' : 'primary'}
                size="small"
                sx={{ mt: 1 }}
              />
            </Paper>
          </Grid>

          {/* Operador */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Operador</Typography>
              <Typography variant="body1" fontWeight={500}>{formData.operator.name || '-'}</Typography>
              <Typography variant="body2">NIF: {formData.operator.nif || '-'} | EORI: {formData.operator.eori || '-'}</Typography>
            </Paper>
          </Grid>

          {/* Datos solicitud */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Datos Solicitud</Typography>
              <Typography variant="body2">Operacion: {formData.operationType}</Typography>
              <Typography variant="body2">Tipo: {formData.declarationTypeSoivre}</Typography>
              <Typography variant="body2">Email: {formData.contactEmail || '-'}</Typography>
            </Paper>
          </Grid>

          {/* Centro */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Centro e Inspeccion</Typography>
              <Typography variant="body2">CodCice: {formData.codCice?.name || '-'}</Typography>
              <Typography variant="body2">CodPi: {formData.codPi?.name || '-'}</Typography>
              <Typography variant="body2">Unidades: {formData.merchandiseQuantity} {formData.merchandiseUnit}</Typography>
            </Paper>
          </Grid>

          {/* Especificidades */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Especificidades</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {formData.specificities.length > 0 ? (
                  formData.specificities.map(code => {
                    const opts = formData.flowType === 'ROHS_RAEE' ? catalogs?.rohsRaeeSpecificities : catalogs?.soivreSpecificities
                    const spec = (opts || []).find(s => s.code === code)
                    return <Chip key={code} label={spec?.label || code} size="small" />
                  })
                ) : (
                  <Typography variant="body2" color="textSecondary">Sin especificidades seleccionadas</Typography>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Certificados */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Certificados</Typography>
              {formData.certificates.com && <Typography variant="body2">COM: {formData.certificates.com}</Typography>}
              {formData.certificates.rohs && <Typography variant="body2">ROHS: {formData.certificates.rohs}</Typography>}
              {formData.certificates.raee && <Typography variant="body2">RAEE: {formData.certificates.raee}</Typography>}
              {!formData.certificates.com && !formData.certificates.rohs && !formData.certificates.raee && (
                <Typography variant="body2" color="textSecondary">Ninguno seleccionado</Typography>
              )}
            </Paper>
          </Grid>

          {/* RII */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>Numeros RII</Typography>
              <Typography variant="body2">RII RAEE: {formData.riiNumbers.raee || '-'}</Typography>
              <Typography variant="body2">RII PyA: {formData.riiNumbers.pya || '-'}</Typography>
            </Paper>
          </Grid>

          {/* Documentos (SOIVRE) */}
          {isSOIVRE && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderColor: missingDocs ? 'error.main' : undefined }}>
                <Typography variant="subtitle2" color={missingDocs ? 'error' : 'primary'} gutterBottom>
                  Documentos ({formData.attachedDocuments.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.attachedDocuments.length > 0 ? (
                    formData.attachedDocuments.map((doc, i) => (
                      <Chip key={i} label={doc.name || doc.type} size="small" />
                    ))
                  ) : (
                    <Typography variant="body2" color="error">Sin documentos - OBLIGATORIO para SOIVRE</Typography>
                  )}
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    )
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================
  const isLastStep = activeStep === visibleSteps.length - 1
  const canSubmit = formData.flowType && formData.contactEmail && formData.codCice && formData.codPi &&
    (formData.flowType !== 'SOIVRE' || formData.attachedDocuments.length > 0) &&
    (formData.flowType !== 'ROHS_RAEE' || formData.certificates.rohs || formData.certificates.raee)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editData ? 'Editar Solicitud PUE SOIVRE' : 'Nueva Solicitud PUE SOIVRE'}
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }} alternativeLabel>
          {visibleSteps.map((step, index) => (
            <Step key={step.key} completed={index < activeStep}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {renderCurrentStep()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button startIcon={<BackIcon />} onClick={handleBack}>
            Anterior
          </Button>
        )}
        {!isLastStep ? (
          <Button
            variant="contained"
            endIcon={<NextIcon />}
            onClick={handleNext}
            disabled={activeStep === 0 && !formData.flowType}
          >
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
              disabled={loading || !canSubmit}
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
