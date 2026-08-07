import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Grid, Chip, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, IconButton, Tooltip, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem
} from '@mui/material'
import {
  Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot
} from '@mui/lab'
import {
  ArrowBack as BackIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  Assignment as DocIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Event as EventIcon,
  CheckCircle as ApproveIcon,
  Schedule as ScheduleIcon,
  Science as LabIcon
} from '@mui/icons-material'
import { pueAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../common/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'

// Status configuration
const statusConfig = {
  draft: { color: 'default', label: 'Borrador', icon: '📝' },
  validated: { color: 'info', label: 'Validada', icon: '✓' },
  submitted: { color: 'primary', label: 'Enviada', icon: '📤' },
  registered: { color: 'secondary', label: 'Registrada', icon: '📋' },
  pending_documents: { color: 'warning', label: 'Pend. Documentos', icon: '📄' },
  pending_inspection: { color: 'warning', label: 'Pend. Inspeccion', icon: '🔍' },
  inspection_scheduled: { color: 'info', label: 'Insp. Programada', icon: '📅' },
  in_inspection: { color: 'info', label: 'En Inspeccion', icon: '🔎' },
  pending_lab: { color: 'warning', label: 'Pend. Laboratorio', icon: '🧪' },
  approved: { color: 'success', label: 'Aprobada', icon: '✅' },
  approved_conditions: { color: 'success', label: 'Aprob. Condiciones', icon: '☑️' },
  rejected: { color: 'error', label: 'Rechazada', icon: '❌' },
  cancelled: { color: 'default', label: 'Cancelada', icon: '🚫' },
  expired: { color: 'error', label: 'Caducada', icon: '⏰' }
}

const PUERequestDetail = () => {
  const { t } = useTranslation()
  const { confirm, dialogProps } = useConfirm()
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)
  const [inspectionData, setInspectionData] = useState({
    date: '',
    time: '',
    location: '',
    type: 'fisica',
    inspector: { name: '', id: '' }
  })
  const [resultData, setResultData] = useState({
    result: '',
    notes: '',
    findings: []
  })

  useEffect(() => {
    loadRequest()
  }, [id])

  const loadRequest = async () => {
    try {
      setLoading(true)
      const response = await pueAPI.get(id)
      if (response.data.success) {
        setRequest(response.data.data)
      }
    } catch (err) {
      console.error('Error loading request:', err)
      setError('Error cargando la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!await confirm({ message: '¿Está seguro de enviar esta solicitud?' })) return

    try {
      setActionLoading(true)
      const response = await pueAPI.submit(id)
      if (response.data.success) {
        loadRequest()
      }
    } catch (err) {
      console.error('Error submitting:', err)
      alert('Error al enviar la solicitud')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    const reason = window.prompt('Motivo de cancelacion:')
    if (!reason) return

    try {
      setActionLoading(true)
      const response = await pueAPI.cancel(id, reason)
      if (response.data.success) {
        loadRequest()
      }
    } catch (err) {
      console.error('Error cancelling:', err)
      alert('Error al cancelar')
    } finally {
      setActionLoading(false)
    }
  }

  const handleScheduleInspection = async () => {
    try {
      setActionLoading(true)
      const response = await pueAPI.scheduleInspection(id, inspectionData)
      if (response.data.success) {
        setScheduleDialogOpen(false)
        loadRequest()
      }
    } catch (err) {
      console.error('Error scheduling inspection:', err)
      alert('Error al programar inspeccion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRecordResult = async () => {
    try {
      setActionLoading(true)
      const response = await pueAPI.recordInspectionResult(id, resultData)
      if (response.data.success) {
        setResultDialogOpen(false)
        loadRequest()
      }
    } catch (err) {
      console.error('Error recording result:', err)
      alert('Error al registrar resultado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleQueryStatus = async () => {
    try {
      setActionLoading(true)
      const response = await pueAPI.queryStatus(id)
      alert(`Estado: ${response.data.data.currentStatus}\nUltima actualizacion: ${response.data.data.lastUpdate}`)
    } catch (err) {
      console.error('Error querying status:', err)
      alert('Error consultando estado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadXML = async () => {
    try {
      const response = await pueAPI.getXML(id)
      const blob = new Blob([response.data], { type: 'application/xml' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${request.reference}.xml`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading XML:', err)
      alert('Error descargando XML')
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/pue')} sx={{ mt: 2 }}>
          Volver a Lista
        </Button>
      </Box>
    )
  }

  if (!request) return null

  const statusCfg = statusConfig[request.status] || {}

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/pue')} sx={{ mb: 1 }}>
            Volver
          </Button>
          <Typography variant="h5" fontWeight={600}>
            {request.reference}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {request.pueReference && `PUE: ${request.pueReference}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label={statusCfg.label || request.status}
            color={statusCfg.color || 'default'}
            sx={{ fontSize: '1rem', py: 2 }}
          />
        </Box>
      </Box>

      {/* Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {request.status === 'draft' && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleSubmit}
              disabled={actionLoading}
            >
              Enviar a AEAT
            </Button>
          )}
          {['pending_inspection'].includes(request.status) && (
            <Button
              variant="contained"
              color="info"
              startIcon={<ScheduleIcon />}
              onClick={() => setScheduleDialogOpen(true)}
            >
              Programar Inspeccion
            </Button>
          )}
          {['inspection_scheduled', 'in_inspection'].includes(request.status) && (
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => setResultDialogOpen(true)}
            >
              Registrar Resultado
            </Button>
          )}
          {request.pueReference && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleQueryStatus}
              disabled={actionLoading}
            >
              Consultar Estado
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadXML}
          >
            Descargar XML
          </Button>
          {['draft', 'validated', 'submitted', 'registered'].includes(request.status) && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
          )}
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Main Info */}
        <Grid item xs={12} md={8}>
          {/* Type and Operator */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Informacion General</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="textSecondary">Tipo PUE</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {request.pueType} {request.pueSubtype && `- ${request.pueSubtype}`}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="textSecondary">Oficina SOIVRE</Typography>
                <Typography variant="body1">
                  {request.soivreOffice?.name || request.soivreOffice?.code || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="textSecondary">Plazo</Typography>
                <Typography variant="body1">
                  {formatDate(request.deadline)}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>Operador</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body1" fontWeight={500}>{request.operator?.name}</Typography>
                <Typography variant="body2">{request.operator?.eori || request.operator?.nif}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2">{request.operator?.address?.streetAndNumber}</Typography>
                <Typography variant="body2">
                  {request.operator?.address?.postalCode} {request.operator?.address?.city}
                </Typography>
              </Grid>
            </Grid>

            {/* Phase 5: MRN + Clave Zeta + Flow Type */}
            {request.declarationMRN && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Declaracion Vinculada</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="textSecondary">MRN / Partida</Typography>
                    <Typography variant="body1" fontWeight={500}>{request.mrnPartida || request.declarationMRN}</Typography>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Typography variant="caption" color="textSecondary">Clave Zeta</Typography>
                    <Typography variant="body1">{request.claveZeta || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="caption" color="textSecondary">Flujo</Typography>
                    <Box>
                      <Chip
                        label={request.flowType === 'ROHS_RAEE' ? 'ROHS/RAEE' : request.flowType === 'SOIVRE' ? 'SOIVRE' : '-'}
                        color={request.flowType === 'ROHS_RAEE' ? 'warning' : 'primary'}
                        size="small"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="caption" color="textSecondary">Email Contacto</Typography>
                    <Typography variant="body2">{request.contactEmail || '-'}</Typography>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Phase 5: CodCice + CodPi */}
            {(request.codCice?.code || request.codPi?.code) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Centro e Inspeccion SOIVRE</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">CodCice (Centro)</Typography>
                    <Typography variant="body2">{request.codCice?.code} - {request.codCice?.name}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">CodPi (Punto Inspeccion)</Typography>
                    <Typography variant="body2">{request.codPi?.code} - {request.codPi?.name}</Typography>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Phase 5: Especificidades */}
            {request.specificities?.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Especificidades</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {request.specificities.map(code => (
                    <Chip key={code} label={code} size="small" variant="outlined" />
                  ))}
                </Box>
              </>
            )}

            {/* Phase 5: Certificados y RII */}
            {(request.certificates?.rohs || request.certificates?.raee || request.certificates?.com) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Certificados Solicitados</Typography>
                <Grid container spacing={2}>
                  {request.certificates?.com && (
                    <Grid item xs={4}>
                      <Typography variant="caption" color="textSecondary">COM</Typography>
                      <Typography variant="body2">{request.certificates.com}</Typography>
                    </Grid>
                  )}
                  {request.certificates?.rohs && (
                    <Grid item xs={4}>
                      <Typography variant="caption" color="textSecondary">ROHS</Typography>
                      <Typography variant="body2">{request.certificates.rohs}</Typography>
                    </Grid>
                  )}
                  {request.certificates?.raee && (
                    <Grid item xs={4}>
                      <Typography variant="caption" color="textSecondary">RAEE</Typography>
                      <Typography variant="body2">{request.certificates.raee}</Typography>
                    </Grid>
                  )}
                </Grid>
              </>
            )}

            {/* Phase 5: RII Numbers */}
            {(request.riiNumbers?.raee || request.riiNumbers?.pya) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Numeros RII</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary">RII RAEE</Typography>
                    <Typography variant="body2">{request.riiNumbers?.raee || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary">RII PyA</Typography>
                    <Typography variant="body2">{request.riiNumbers?.pya || '-'}</Typography>
                  </Grid>
                </Grid>
              </>
            )}
          </Paper>

          {/* Goods */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Mercancias ({request.goods?.length || 0})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Descripcion</TableCell>
                    <TableCell>TARIC</TableCell>
                    <TableCell>Cantidad</TableCell>
                    <TableCell>Peso</TableCell>
                    <TableCell>Origen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {request.goods?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.sequenceNumber || idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.description}</Typography>
                        {item.brand && (
                          <Typography variant="caption" color="textSecondary">
                            {item.brand} {item.model}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{item.taricCode}</TableCell>
                      <TableCell>{item.quantity} {item.unitOfMeasure}</TableCell>
                      <TableCell>{item.grossMass} kg</TableCell>
                      <TableCell>{item.countryOfOrigin || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2, display: 'flex', gap: 3 }}>
              <Box>
                <Typography variant="caption" color="textSecondary">Total Peso Bruto</Typography>
                <Typography variant="body1" fontWeight={500}>{request.totals?.grossMass?.toFixed(2)} kg</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">Total Bultos</Typography>
                <Typography variant="body1" fontWeight={500}>{request.totals?.packages || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">Valor Estadistico</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {request.totals?.statisticalValue ? `${request.totals.statisticalValue.toFixed(2)} EUR` : '-'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Transport */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Transporte</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="textSecondary">Modo</Typography>
                <Typography variant="body1">{request.transport?.mode}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="textSecondary">Documento</Typography>
                <Typography variant="body1">
                  {request.transport?.documentType} {request.transport?.documentNumber}
                </Typography>
              </Grid>
              {request.transport?.containerNumber && (
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="textSecondary">Contenedor</Typography>
                  <Typography variant="body1">{request.transport.containerNumber}</Typography>
                </Grid>
              )}
              {request.transport?.vehicleRegistration && (
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="textSecondary">Vehiculo</Typography>
                  <Typography variant="body1">{request.transport.vehicleRegistration}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Inspection */}
          {request.inspection && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Inspeccion</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="textSecondary">Fecha Programada</Typography>
                  <Typography variant="body1">{request.inspection.scheduledDate} {request.inspection.scheduledTime}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="textSecondary">Tipo</Typography>
                  <Typography variant="body1">{request.inspection.type}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="textSecondary">Ubicacion</Typography>
                  <Typography variant="body1">{request.inspection.location || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="textSecondary">Resultado</Typography>
                  <Chip
                    size="small"
                    label={request.inspection.result || 'Pendiente'}
                    color={
                      request.inspection.result === 'favorable' ? 'success' :
                      request.inspection.result === 'unfavorable' ? 'error' : 'default'
                    }
                  />
                </Grid>
              </Grid>
              {request.inspection.resultNotes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="textSecondary">Notas</Typography>
                  <Typography variant="body2">{request.inspection.resultNotes}</Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* Certificate */}
          {request.issuedCertificate && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Certificado Emitido</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Numero</Typography>
                  <Typography variant="body1" fontWeight={500}>{request.issuedCertificate.number}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Fecha Emision</Typography>
                  <Typography variant="body1">{formatDate(request.issuedCertificate.issuedAt)}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography variant="caption" color="textSecondary">Validez</Typography>
                  <Typography variant="body1">{formatDate(request.issuedCertificate.validUntil)}</Typography>
                </Grid>
              </Grid>
            </Paper>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Timeline */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Historial</Typography>
            <Timeline position="left" sx={{ p: 0 }}>
              {request.statusHistory?.slice().reverse().map((history, idx) => {
                const cfg = statusConfig[history.status] || {}
                return (
                  <TimelineItem key={idx}>
                    <TimelineSeparator>
                      <TimelineDot color={statusConfig[history.status]?.dotColor || (statusConfig[history.status]?.color === 'default' ? 'grey' : statusConfig[history.status]?.color) || 'grey'} />
                      {idx < request.statusHistory.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="body2" fontWeight={500}>
                        {cfg.label || history.status}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatDate(history.timestamp)}
                      </Typography>
                      {history.reason && (
                        <Typography variant="caption" display="block">
                          {history.reason}
                        </Typography>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                )
              })}
            </Timeline>
          </Paper>

          {/* Documents */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Documentos</Typography>
            {request.attachedDocuments?.length > 0 ? (
              request.attachedDocuments.map((doc, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #eee' }}>
                  <DocIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{doc.name || doc.type}</Typography>
                    {doc.documentNumber && (
                      <Typography variant="caption" color="textSecondary">{doc.documentNumber}</Typography>
                    )}
                  </Box>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="textSecondary">Sin documentos</Typography>
            )}
          </Paper>

          {/* Required Documents */}
          {request.requiredDocuments?.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Documentos Requeridos</Typography>
              {request.requiredDocuments.map((doc, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                  <Chip
                    size="small"
                    label={doc.provided ? 'OK' : 'Pendiente'}
                    color={doc.provided ? 'success' : 'warning'}
                    sx={{ mr: 1, minWidth: 70 }}
                  />
                  <Typography variant="body2">{doc.name}</Typography>
                </Box>
              ))}
            </Paper>
          )}

          {/* AEAT/SOIVRE Response */}
          {(request.aeatResponse || request.soivreResponse) && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Respuesta AEAT/SOIVRE</Typography>
              {request.aeatResponse && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="textSecondary">Codigo AEAT</Typography>
                  <Typography variant="body2">{request.aeatResponse.code}</Typography>
                  <Typography variant="body2">{request.aeatResponse.message}</Typography>
                </Box>
              )}
              {request.soivreResponse && (
                <Box>
                  <Typography variant="caption" color="textSecondary">Codigo SOIVRE</Typography>
                  <Typography variant="body2">{request.soivreResponse.code}</Typography>
                  <Typography variant="body2">{request.soivreResponse.message}</Typography>
                </Box>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Schedule Inspection Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Programar Inspeccion</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="date"
                label="Fecha"
                value={inspectionData.date}
                onChange={(e) => setInspectionData(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="time"
                label="Hora"
                value={inspectionData.time}
                onChange={(e) => setInspectionData(prev => ({ ...prev, time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Ubicacion"
                value={inspectionData.location}
                onChange={(e) => setInspectionData(prev => ({ ...prev, location: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Tipo de Inspeccion"
                value={inspectionData.type}
                onChange={(e) => setInspectionData(prev => ({ ...prev, type: e.target.value }))}
              >
                <MenuItem value="documental">Documental</MenuItem>
                <MenuItem value="fisica">Fisica</MenuItem>
                <MenuItem value="laboratorio">Laboratorio</MenuItem>
                <MenuItem value="mixta">Mixta</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Nombre Inspector"
                value={inspectionData.inspector.name}
                onChange={(e) => setInspectionData(prev => ({
                  ...prev,
                  inspector: { ...prev.inspector, name: e.target.value }
                }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleScheduleInspection} disabled={actionLoading}>
            Programar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Result Dialog */}
      <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar Resultado de Inspeccion</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Resultado"
                value={resultData.result}
                onChange={(e) => setResultData(prev => ({ ...prev, result: e.target.value }))}
              >
                <MenuItem value="favorable">Favorable</MenuItem>
                <MenuItem value="favorable_with_conditions">Favorable con Condiciones</MenuItem>
                <MenuItem value="unfavorable">Desfavorable</MenuItem>
                <MenuItem value="cancelled">Cancelada</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notas / Observaciones"
                value={resultData.notes}
                onChange={(e) => setResultData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color={resultData.result === 'favorable' ? 'success' : resultData.result === 'unfavorable' ? 'error' : 'primary'}
            onClick={handleRecordResult}
            disabled={actionLoading || !resultData.result}
          >
            Registrar
          </Button>
        </DialogActions>
      </Dialog>
    <ConfirmDialog {...dialogProps} />
    </Box>
  )
}

export default PUERequestDetail
