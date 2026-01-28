import React, { useState, useRef } from 'react'
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
  'consignorEORI',
  'consignorName',
  'consigneeEORI',
  'consigneeName'
]

const ENSBatchUpload = ({ open, onClose, onSuccess }) => {
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

  const steps = ['Cargar Archivo', 'Validar Datos', 'Procesar']

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
        throw new Error('El archivo debe tener al menos una fila de datos ademas del encabezado')
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
      }
    }
  }

  const validateData = async (data) => {
    const results = data.map(item => {
      const errors = []
      const warnings = []
      const dec = item.declaration

      // Required field validations
      if (!dec.transportMode) {
        errors.push('Modo de transporte requerido')
      } else if (!['ROAD', 'RAIL', 'AIR', 'SEA'].includes(dec.transportMode)) {
        errors.push('Modo de transporte invalido (ROAD, RAIL, AIR, SEA)')
      }

      if (!dec.entryOffice.code) {
        errors.push('Codigo de aduana requerido')
      } else if (!/^ES\d{6}$/.test(dec.entryOffice.code)) {
        warnings.push('Formato de codigo de aduana puede ser incorrecto')
      }

      if (!dec.entryOffice.expectedArrival) {
        errors.push('Fecha de llegada requerida')
      }

      if (!dec.carrier.eori) {
        errors.push('EORI del transportista requerido')
      } else if (!/^[A-Z]{2}\w{1,15}$/.test(dec.carrier.eori)) {
        warnings.push('Formato EORI puede ser incorrecto')
      }

      if (!dec.consignment.referenceNumber) {
        errors.push('Numero de conocimiento (B/L) requerido')
      }

      if (!dec.consignment.grossMass || dec.consignment.grossMass <= 0) {
        errors.push('Peso bruto debe ser mayor que 0')
      }

      // Container validation if present
      if (dec.consignment.containerNumber && !/^[A-Z]{4}\d{7}$/i.test(dec.consignment.containerNumber)) {
        warnings.push('Formato de contenedor puede ser incorrecto (ISO 6346)')
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
        setProcessResults(response.data.data)

        // Update parsed data with results
        const updatedData = [...parsedData]
        response.data.data.results?.forEach((result, index) => {
          const originalIndex = selectedRows[index]
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
      'ROAD;ES001101;2025-01-25;08:00;ESA12345678;Transportes Demo SL;1234ABC;ES;BLEXAMPLE001;MSKU1234567;SEAL001;15000;100;Mercancias varias;ESB87654321;Exportador Demo;ESC11111111;Importador Demo'
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
      pending: { color: 'default', label: 'Pendiente' },
      valid: { color: 'success', label: 'Valido' },
      warning: { color: 'warning', label: 'Advertencias' },
      error: { color: 'error', label: 'Errores' },
      processed: { color: 'success', label: 'Procesado' },
      process_error: { color: 'error', label: 'Error al procesar' }
    }
    const config = configs[status] || configs.pending
    return <Chip size="small" color={config.color} label={config.label} />
  }

  const validCount = parsedData.filter(d => d.status === 'valid' || d.status === 'warning').length
  const errorCount = parsedData.filter(d => d.status === 'error').length

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Importacion Masiva de Declaraciones ENS
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
                    Arrastre un archivo CSV o haga clic para seleccionar
                  </Typography>
                  <Typography color="textSecondary">
                    Formato: CSV con separador punto y coma (;)
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
                Descargar Plantilla CSV
              </Button>
            </Box>

            <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                Columnas requeridas:
              </Typography>
              <Typography variant="body2">
                transportMode, entryOfficeCode, expectedArrivalDate, expectedArrivalTime,
                carrierEORI, carrierName, billOfLading, grossMass
              </Typography>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Columnas opcionales:
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
              <Grid item xs={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary">Total</Typography>
                    <Typography variant="h4">{parsedData.length}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="success.main">Validos</Typography>
                    <Typography variant="h4" color="success.main">
                      {parsedData.filter(d => d.status === 'valid').length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="warning.main">Advertencias</Typography>
                    <Typography variant="h4" color="warning.main">
                      {parsedData.filter(d => d.status === 'warning').length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="error.main">Errores</Typography>
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
                    <TableCell>Modo</TableCell>
                    <TableCell>Aduana</TableCell>
                    <TableCell>Transportista</TableCell>
                    <TableCell>Conocimiento</TableCell>
                    <TableCell>Contenedor</TableCell>
                    <TableCell>Peso (kg)</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Detalles</TableCell>
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
                label="Enviar automaticamente a AEAT despues de crear"
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
                  Procesando declaraciones...
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
                    Procesamiento completado
                  </Typography>
                  <Typography variant="body2">
                    {processResults.successful || 0} de {processResults.total || 0} declaraciones procesadas correctamente
                  </Typography>
                  {processResults.failed > 0 && (
                    <Typography variant="body2" color="error">
                      {processResults.failed} declaraciones con errores
                    </Typography>
                  )}
                </Alert>

                {/* Results Table */}
                {processResults.results && (
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>Referencia</TableCell>
                          <TableCell>MRN</TableCell>
                          <TableCell>Estado</TableCell>
                          <TableCell>Mensaje</TableCell>
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
                                <Chip size="small" color="success" icon={<CheckIcon />} label="Exito" />
                              ) : (
                                <Chip size="small" color="error" icon={<ErrorIcon />} label="Error" />
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
          <Button onClick={handleClose}>Cancelar</Button>
        )}
        {activeStep === 1 && (
          <>
            <Button onClick={handleReset}>
              Cargar otro archivo
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleProcess}
              disabled={validCount === 0 || selectedRows.length === 0}
            >
              Procesar {selectedRows.filter(i => parsedData[i]?.status !== 'error').length} declaraciones
            </Button>
          </>
        )}
        {activeStep === 2 && !processing && (
          <>
            <Button onClick={handleReset}>
              Nueva importacion
            </Button>
            <Button variant="contained" onClick={handleClose}>
              Cerrar
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ENSBatchUpload
