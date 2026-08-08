import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box, Typography, Paper, Grid, Button, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, LinearProgress, Chip, Checkbox,
  FormControlLabel, IconButton, Tooltip, Stepper, Step, StepLabel
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  TableChart as ExcelIcon
} from '@mui/icons-material'
import { ensAPI } from '../../services/api'

// CSV Template columns
const CSV_TEMPLATE_COLUMNS = [
  'transportMode',
  'entryOfficeCode',
  'expectedArrivalDate',
  'expectedArrivalTime',
  'carrierEORI',
  'carrierName',
  'transportIdentification',
  'transportNationality',
  'billOfLading',
  'containerNumber',
  'sealNumber',
  'grossMass',
  'numberOfPackages',
  'goodsDescription',
  'commodityCode',
  'consignorEORI',
  'consignorName',
  'consigneeEORI',
  'consigneeName'
]

/** Fecha de ejemplo para la plantilla: 30 días por delante, en formato ISO corto. */
const ejemploFechaLlegada = () => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().substring(0, 10)
}

// Estados que el backend considera exito al procesar un lote.
const BATCH_OK = ['created', 'submitted', 'accepted']

/**
 * Normaliza la respuesta de POST /api/ens/batch a la forma que pinta la tabla.
 * El backend devuelve `declarations` con `status`; se acepta tambien `results`
 * con `success` por compatibilidad con respuestas antiguas.
 */
const normalizeBatchResults = (data) => {
  const filas = data?.declarations || data?.results || []
  return filas.map((fila) => ({
    ...fila,
    success: fila.success !== undefined ? fila.success : BATCH_OK.includes(fila.status),
    message: fila.message
      || (fila.errors?.length ? fila.errors.map(e => e.message || e.code || String(e)).join('; ') : undefined)
      || fila.error
      || fila.status
  }))
}

const ENSBatchUpload = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const [activeStep, setActiveStep] = useState(0)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState([])
  const [validationResults, setValidationResults] = useState([])
  const [processing, setProcessing] = useState(false)
  const [processProgress, setProcessProgress] = useState(0)
  const [processResults, setProcessResults] = useState(null)
  const [autoSubmit, setAutoSubmit] = useState(false)
  const [selectedRows, setSelectedRows] = useState([])

  const steps = [t('ens.stepUpload'), t('ens.stepValidate'), t('ens.stepProcess')]

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseFile(selectedFile)
    }
  }

  const parseFile = async (file) => {
    setParsing(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        throw new Error(t('ens.fileMinRows'))
      }

      const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''))
      const data = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''))
        const row = {}

        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        // Transform to declaration format
        data.push({
          rowNumber: i,
          original: row,
          declaration: transformRowToDeclaration(row),
          status: 'pending',
          errors: [],
          warnings: []
        })
      }

      setParsedData(data)
      setSelectedRows(data.map((_, i) => i))
      setActiveStep(1)

      // Auto-validate
      validateData(data)
    } catch (error) {
      console.error('Error parsing file:', error)
      setParsedData([])
    } finally {
      setParsing(false)
    }
  }

  const transformRowToDeclaration = (row) => {
    return {
      transportMode: row.transportMode?.toUpperCase() || 'ROAD',
      entryOffice: {
        code: row.entryOfficeCode || '',
        expectedArrival: row.expectedArrivalDate && row.expectedArrivalTime
          ? `${row.expectedArrivalDate}T${row.expectedArrivalTime}`
          : row.expectedArrivalDate || ''
      },
      carrier: {
        eori: row.carrierEORI?.toUpperCase() || '',
        name: row.carrierName || ''
      },
      transportMeans: {
        identification: row.transportIdentification || '',
        nationality: row.transportNationality?.toUpperCase() || ''
      },
      consignment: {
        referenceNumber: row.billOfLading || '',
        containerNumber: row.containerNumber?.toUpperCase() || '',
        sealNumber: row.sealNumber || '',
        grossMass: parseFloat(row.grossMass) || 0,
        numberOfPackages: parseInt(row.numberOfPackages) || 0,
        goodsDescription: row.goodsDescription || ''
      },
      consignor: {
        eori: row.consignorEORI?.toUpperCase() || '',
        name: row.consignorName || ''
      },
      consignee: {
        eori: row.consigneeEORI?.toUpperCase() || '',
        name: row.consigneeName || ''
      },
      // El envío a AEAT exige al menos una partida de mercancía (ENS_GOODS_REQUIRED)
      // y el modelo exige commodityCode. NO se rellena con un valor inventado: AEAT
      // rechaza cualquier código ficticio con CC316A ("Combined Nomenclature is not
      // valid"), así que la fila sin código se marca como error en la validación.
      goods: row.goodsDescription || row.grossMass
        ? [{
            sequenceNumber: 1,
            commodityCode: row.commodityCode || '',
            description: row.goodsDescription || 'Mercancia general',
            grossMass: parseFloat(row.grossMass) || 0,
            numberOfPackages: parseInt(row.numberOfPackages) || 0
          }]
        : []
    }
  }

  const validateData = async (data) => {
    const results = data.map(item => {
      const errors = []
      const warnings = []
      const dec = item.declaration

      // Required field validations
      if (!dec.transportMode) {
        errors.push(t('ens.transportModeRequired'))
      } else if (!['ROAD', 'RAIL', 'AIR', 'SEA'].includes(dec.transportMode)) {
        errors.push(t('ens.transportModeInvalid'))
      }

      if (!dec.entryOffice.code) {
        errors.push(t('ens.customsCodeRequired'))
      } else if (!/^ES\d{6}$/.test(dec.entryOffice.code)) {
        warnings.push(t('ens.customsCodeFormat'))
      }

      if (!dec.entryOffice.expectedArrival) {
        errors.push(t('ens.arrivalRequired'))
      }

      if (!dec.carrier.eori) {
        errors.push(t('ens.carrierEoriRequired'))
      } else if (!/^[A-Z]{2}\w{1,15}$/.test(dec.carrier.eori)) {
        warnings.push(t('ens.eoriFormat2'))
      }

      if (!dec.consignment.referenceNumber) {
        errors.push(t('ens.blRequiredBatch'))
      }

      if (!dec.consignment.grossMass || dec.consignment.grossMass <= 0) {
        errors.push(t('ens.grossWeightPositive'))
      }

      // Sin código de mercancía real AEAT rechaza la ENS entera: es un error de la
      // fila, no algo que se pueda suplir con un relleno.
      const codigo = dec.goods?.[0]?.commodityCode
      if (dec.goods?.length && !codigo) {
        errors.push(t('ens.commodityCodeRequired', 'Código de mercancía (TARIC/HS) obligatorio'))
      } else if (codigo && !/^\d{6,10}$/.test(codigo)) {
        errors.push(t('ens.commodityCodeFormat', 'El código de mercancía debe tener entre 6 y 10 dígitos'))
      }

      // Container validation if present
      if (dec.consignment.containerNumber && !/^[A-Z]{4}\d{7}$/i.test(dec.consignment.containerNumber)) {
        warnings.push(t('ens.containerFormatWarn'))
      }

      return {
        ...item,
        status: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'valid'),
        errors,
        warnings
      }
    })

    setValidationResults(results)
    setParsedData(results)
  }

  const handleProcess = async () => {
    const rowsToProcess = parsedData.filter((_, i) => selectedRows.includes(i) && _.status !== 'error')

    if (rowsToProcess.length === 0) {
      return
    }

    setProcessing(true)
    setProcessProgress(0)
    setActiveStep(2)

    const declarations = rowsToProcess.map(r => r.declaration)

    try {
      const response = await ensAPI.processBatch(declarations, autoSubmit)

      if (response.data.success) {
        // El backend (ensService.processBatch) devuelve `declarations`, no `results`,
        // y el exito se expresa en `status` ('created'/'submitted' vs 'failed'/'error').
        const devueltas = normalizeBatchResults(response.data.data)
        setProcessResults({ ...response.data.data, results: devueltas })

        // Los indices de la respuesta siguen el orden de `rowsToProcess` (que excluye
        // las filas con error), no el de `selectedRows`: mapear por esas mismas filas.
        const indicesProcesados = parsedData
          .map((fila, i) => ({ fila, i }))
          .filter(({ fila, i }) => selectedRows.includes(i) && fila.status !== 'error')
          .map(({ i }) => i)

        const updatedData = [...parsedData]
        devueltas.forEach((result, index) => {
          const originalIndex = indicesProcesados[index]
          if (originalIndex !== undefined) {
            updatedData[originalIndex] = {
              ...updatedData[originalIndex],
              processResult: result,
              status: result.success ? 'processed' : 'process_error'
            }
          }
        })
        setParsedData(updatedData)
      }
    } catch (error) {
      console.error('Error processing batch:', error)
      setProcessResults({
        success: false,
        error: error.response?.data?.message || error.message
      })
    } finally {
      setProcessing(false)
      setProcessProgress(100)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_COLUMNS.join(';'),
      // Fecha de ejemplo SIEMPRE futura: validateForSubmission rechaza una llegada
      // pasada (ENS_ARRIVAL_DATE_PAST), y una plantilla con fecha fija caduca.
      // El código de mercancía es real (73181500, tornillos de hierro o acero).
      `ROAD;ES001101;${ejemploFechaLlegada()};08:00;ESA12345678;Transportes Demo SL;1234ABC;ES;BLEXAMPLE001;MSKU1234567;SEAL001;15000;100;Mercancias varias;73181500;ESB87654321;Exportador Demo;ESC11111111;Importador Demo`
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_ens_batch.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setActiveStep(0)
    setFile(null)
    setParsedData([])
    setValidationResults([])
    setProcessResults(null)
    setSelectedRows([])
    setProcessProgress(0)
  }

  const handleClose = () => {
    handleReset()
    onClose()
    if (processResults?.successful > 0) {
      onSuccess && onSuccess()
    }
  }

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedRows(parsedData.map((_, i) => i))
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (index) => {
    setSelectedRows(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const getStatusChip = (status) => {
    const configs = {
      pending: { color: 'default', label: t('ens.batchPending') },
      valid: { color: 'success', label: t('ens.batchValid') },
      warning: { color: 'warning', label: t('ens.batchWarnings') },
      error: { color: 'error', label: t('ens.batchErrors') },
      processed: { color: 'success', label: t('ens.batchProcessed') },
      process_error: { color: 'error', label: t('ens.batchProcessError') }
    }
    const config = configs[status] || configs.pending
    return <Chip size="small" color={config.color} label={config.label} />
  }

  const validCount = parsedData.filter(d => d.status === 'valid' || d.status === 'warning').length
  const errorCount = parsedData.filter(d => d.status === 'error').length

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {t('ens.batchTitle')}
      </DialogTitle>
      <DialogContent dividers>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Upload */}
        {activeStep === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv,.txt"
              style={{ display: 'none' }}
            />

            <Paper
              variant="outlined"
              sx={{
                p: 6,
                border: '2px dashed',
                borderColor: 'primary.main',
                bgcolor: 'primary.50',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.100' }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? (
                <CircularProgress />
              ) : (
                <>
                  <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    {t('ens.dragOrClick')}
                  </Typography>
                  <Typography color="textSecondary">
                    {t('ens.csvFormat')}
                  </Typography>
                </>
              )}
            </Paper>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
              >
                {t('ens.downloadTemplate')}
              </Button>
            </Box>

            <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('ens.requiredColumns')}
              </Typography>
              <Typography variant="body2">
                transportMode, entryOfficeCode, expectedArrivalDate, expectedArrivalTime,
                carrierEORI, carrierName, billOfLading, grossMass
              </Typography>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                {t('ens.optionalColumns')}
              </Typography>
              <Typography variant="body2">
                transportIdentification, transportNationality, containerNumber, sealNumber,
                numberOfPackages, goodsDescription, consignorEORI, consignorName,
                consigneeEORI, consigneeName
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Step 1: Validate */}
        {activeStep === 1 && (
          <Box>
            {/* Summary */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary">{t('common.total')}</Typography>
                    <Typography variant="h4">{parsedData.length}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="success.main">{t('ens.batchValid')}</Typography>
                    <Typography variant="h4" color="success.main">
                      {parsedData.filter(d => d.status === 'valid').length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="warning.main">{t('ens.batchWarnings')}</Typography>
                    <Typography variant="h4" color="warning.main">
                      {parsedData.filter(d => d.status === 'warning').length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="error.main">{t('ens.batchErrors')}</Typography>
                    <Typography variant="h4" color="error.main">{errorCount}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Data Table */}
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows.length === parsedData.length}
                        indeterminate={selectedRows.length > 0 && selectedRows.length < parsedData.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>#</TableCell>
                    <TableCell>{t('ens.mode')}</TableCell>
                    <TableCell>{t('ens.entryCustoms')}</TableCell>
                    <TableCell>{t('ens.carrier')}</TableCell>
                    <TableCell>{t('ens.billOfLading')}</TableCell>
                    <TableCell>{t('ens.container')}</TableCell>
                    <TableCell>{t('ens.batchWeight')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                    <TableCell>{t('common.details')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedData.map((row, index) => (
                    <TableRow
                      key={index}
                      hover
                      sx={{
                        bgcolor: row.status === 'error' ? 'error.50' :
                                 row.status === 'warning' ? 'warning.50' : undefined
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedRows.includes(index)}
                          onChange={() => handleSelectRow(index)}
                          disabled={row.status === 'error'}
                        />
                      </TableCell>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.declaration.transportMode}</TableCell>
                      <TableCell>{row.declaration.entryOffice.code}</TableCell>
                      <TableCell>{row.declaration.carrier.eori}</TableCell>
                      <TableCell>{row.declaration.consignment.referenceNumber}</TableCell>
                      <TableCell>{row.declaration.consignment.containerNumber || '-'}</TableCell>
                      <TableCell>{row.declaration.consignment.grossMass}</TableCell>
                      <TableCell>{getStatusChip(row.status)}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 && (
                          <Tooltip title={row.errors.join(', ')}>
                            <ErrorIcon color="error" fontSize="small" />
                          </Tooltip>
                        )}
                        {row.warnings.length > 0 && (
                          <Tooltip title={row.warnings.join(', ')}>
                            <WarningIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Options */}
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                  />
                }
                label={t('ens.autoSubmit')}
              />
            </Box>
          </Box>
        )}

        {/* Step 2: Process */}
        {activeStep === 2 && (
          <Box>
            {processing ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={64} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                  {t('ens.processingDeclarations')}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={processProgress}
                  sx={{ mt: 2, mx: 'auto', maxWidth: 400 }}
                />
              </Box>
            ) : processResults ? (
              <Box>
                <Alert
                  severity={processResults.successful > 0 ? 'success' : 'error'}
                  sx={{ mb: 3 }}
                >
                  <Typography variant="subtitle1">
                    {t('ens.processingComplete')}
                  </Typography>
                  <Typography variant="body2">
                    {t('ens.processedCount', { success: processResults.successful || 0, total: processResults.total || 0 })}
                  </Typography>
                  {processResults.failed > 0 && (
                    <Typography variant="body2" color="error">
                      {t('ens.failedCount', { count: processResults.failed })}
                    </Typography>
                  )}
                </Alert>

                {/* Results Table */}
                {processResults.results?.length > 0 && (
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>{t('ens.reference')}</TableCell>
                          <TableCell>{t('ens.mrnLabel')}</TableCell>
                          <TableCell>{t('common.status')}</TableCell>
                          <TableCell>{t('ens.message')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {processResults.results.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{result.reference || '-'}</TableCell>
                            <TableCell>{result.mrn || '-'}</TableCell>
                            <TableCell>
                              {result.success ? (
                                <Chip size="small" color="success" icon={<CheckIcon />} label={t('ens.success')} />
                              ) : (
                                <Chip size="small" color="error" icon={<ErrorIcon />} label={t('common.error')} />
                              )}
                            </TableCell>
                            <TableCell>
                              {result.message || result.error || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            ) : null}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {activeStep === 0 && (
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
        )}
        {activeStep === 1 && (
          <>
            <Button onClick={handleReset}>
              {t('ens.loadAnotherFile')}
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleProcess}
              disabled={validCount === 0 || selectedRows.length === 0}
            >
              {t('ens.processDeclarations', { count: selectedRows.filter(i => parsedData[i]?.status !== 'error').length })}
            </Button>
          </>
        )}
        {activeStep === 2 && !processing && (
          <>
            <Button onClick={handleReset}>
              {t('ens.newImport')}
            </Button>
            <Button variant="contained" onClick={handleClose}>
              {t('common.close')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ENSBatchUpload
