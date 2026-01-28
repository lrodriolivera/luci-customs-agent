import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Grid, Button, Chip, Card, CardContent,
  IconButton, Divider, Alert, CircularProgress, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  List, ListItem, ListItemText, ListItemIcon, Tooltip
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  LocalShipping as TruckIcon,
  DirectionsRailway as RailIcon,
  Flight as AirIcon,
  DirectionsBoat as SeaIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Assignment as DocumentIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  FlightLand as ArrivalIcon,
  Description as XMLIcon,
  History as HistoryIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { ensAPI } from '../../services/api'

// Transport mode configuration
const transportModeConfig = {
  ROAD: { icon: TruckIcon, color: '#4CAF50', label: 'Carretera' },
  RAIL: { icon: RailIcon, color: '#FF9800', label: 'Ferrocarril' },
  AIR: { icon: AirIcon, color: '#2196F3', label: 'Aereo' },
  SEA: { icon: SeaIcon, color: '#00BCD4', label: 'Maritimo' }
}

// Status configuration
const statusConfig = {
  draft: { color: 'default', label: 'Borrador', icon: EditIcon },
  validated: { color: 'info', label: 'Validada', icon: SuccessIcon },
  submitted: { color: 'primary', label: 'Enviada', icon: SendIcon },
  accepted: { color: 'success', label: 'Aceptada', icon: SuccessIcon },
  rejected: { color: 'error', label: 'Rechazada', icon: ErrorIcon },
  amendment_pending: { color: 'warning', label: 'Rectificacion Pendiente', icon: ScheduleIcon },
  amended: { color: 'info', label: 'Rectificada', icon: EditIcon },
  arrived: { color: 'secondary', label: 'Llegada Notificada', icon: ArrivalIcon },
  released: { color: 'success', label: 'Levantada', icon: SuccessIcon },
  dnl: { color: 'error', label: 'DNL', icon: WarningIcon },
  cancelled: { color: 'default', label: 'Anulada', icon: CancelIcon }
}

// Risk status configuration
const riskConfig = {
  PENDING: { color: 'default', label: 'Pendiente', severity: 'info' },
  ACK: { color: 'success', label: 'Aceptada', severity: 'success' },
  HOLD: { color: 'warning', label: 'Retenida', severity: 'warning' },
  DNL: { color: 'error', label: 'No Cargar', severity: 'error' },
  CLEARED: { color: 'success', label: 'Despachada', severity: 'success' }
}

const ENSDeclarationDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [declaration, setDeclaration] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [arrivalDialogOpen, setArrivalDialogOpen] = useState(false)
  const [arrivalData, setArrivalData] = useState({
    arrivalDate: '',
    actualArrivalTime: '',
    remarks: ''
  })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadDeclaration()
  }, [id])

  const loadDeclaration = async () => {
    try {
      setLoading(true)
      const response = await ensAPI.get(id)
      if (response.data.success) {
        setDeclaration(response.data.data)
      }
    } catch (error) {
      console.error('Error loading declaration:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!window.confirm('Esta seguro de enviar esta declaracion a AEAT?')) return

    try {
      setActionLoading(true)
      const response = await ensAPI.submit(id)
      if (response.data.success) {
        loadDeclaration()
      }
    } catch (error) {
      console.error('Error submitting:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    try {
      setActionLoading(true)
      const response = await ensAPI.cancel(id, cancelReason)
      if (response.data.success) {
        setCancelDialogOpen(false)
        setCancelReason('')
        loadDeclaration()
      }
    } catch (error) {
      console.error('Error cancelling:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleNotifyArrival = async () => {
    try {
      setActionLoading(true)
      const response = await ensAPI.notifyArrival(id, arrivalData)
      if (response.data.success) {
        setArrivalDialogOpen(false)
        setArrivalData({ arrivalDate: '', actualArrivalTime: '', remarks: '' })
        loadDeclaration()
      }
    } catch (error) {
      console.error('Error notifying arrival:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadXML = async () => {
    try {
      const response = await ensAPI.getXML(id)
      const blob = new Blob([response.data], { type: 'application/xml' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ENS_${declaration.reference}.xml`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading XML:', error)
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

  const renderTransportModeIcon = (mode) => {
    const config = transportModeConfig[mode]
    if (!config) return null
    const IconComponent = config.icon
    return <IconComponent style={{ color: config.color, fontSize: 32 }} />
  }

  const renderStatusChip = (status) => {
    const config = statusConfig[status] || { color: 'default', label: status }
    return <Chip color={config.color} label={config.label} />
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!declaration) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Declaracion no encontrada</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/ens')} sx={{ mt: 2 }}>
          Volver a la lista
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/ens')} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {declaration.reference}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              {renderTransportModeIcon(declaration.transportMode)}
              <Typography variant="body1" color="textSecondary">
                {transportModeConfig[declaration.transportMode]?.label}
              </Typography>
              {renderStatusChip(declaration.status)}
              {declaration.mrn && (
                <Chip
                  variant="outlined"
                  label={`MRN: ${declaration.mrn}`}
                  size="small"
                />
              )}
            </Box>
          </Box>
        </Box>
        <Box>
          {declaration.status === 'draft' && (
            <>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/ens/${id}/edit`)}
                sx={{ mr: 1 }}
              >
                Editar
              </Button>
              <Button
                variant="contained"
                startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
                onClick={handleSubmit}
                disabled={actionLoading}
              >
                Enviar a AEAT
              </Button>
            </>
          )}
          {['accepted', 'released'].includes(declaration.status) && (
            <>
              <Button
                variant="outlined"
                startIcon={<ArrivalIcon />}
                onClick={() => setArrivalDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Notificar Llegada
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setCancelDialogOpen(true)}
              >
                Anular
              </Button>
            </>
          )}
          {declaration.generatedXML && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadXML}
              sx={{ ml: 1 }}
            >
              Descargar XML
            </Button>
          )}
        </Box>
      </Box>

      {/* Risk Alert */}
      {declaration.riskAssessment?.status && declaration.riskAssessment.status !== 'PENDING' && (
        <Alert
          severity={riskConfig[declaration.riskAssessment.status]?.severity || 'info'}
          sx={{ mb: 3 }}
          icon={declaration.riskAssessment.doNotLoadList ? <WarningIcon /> : undefined}
        >
          <Typography variant="subtitle2">
            Analisis de Riesgo: {riskConfig[declaration.riskAssessment.status]?.label}
          </Typography>
          {declaration.riskAssessment.doNotLoadList && (
            <Typography variant="body2">
              <strong>DNL EMITIDO:</strong> {declaration.riskAssessment.dnlReason || 'Mercancia retenida. No proceder a la carga.'}
            </Typography>
          )}
          {declaration.riskAssessment.controlDecisions?.length > 0 && (
            <Typography variant="body2">
              Decisiones de control: {declaration.riskAssessment.controlDecisions.map(d => d.code).join(', ')}
            </Typography>
          )}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="General" />
          <Tab label="Transportista" />
          <Tab label="Envio" />
          <Tab label="Mercancias" />
          <Tab label="Documentos" />
          <Tab label="Historial" />
        </Tabs>
      </Paper>

      {/* Tab 0: General */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informacion General
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Referencia</Typography>
                    <Typography variant="body1">{declaration.reference}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">LRN</Typography>
                    <Typography variant="body1">{declaration.lrn || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">MRN</Typography>
                    <Typography variant="body1" fontFamily="monospace">{declaration.mrn || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Tipo</Typography>
                    <Typography variant="body1">{declaration.declarationType || 'ENS'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Creada</Typography>
                    <Typography variant="body1">{formatDate(declaration.createdAt)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Actualizada</Typography>
                    <Typography variant="body1">{formatDate(declaration.updatedAt)}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Aduana de Entrada
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Codigo</Typography>
                    <Typography variant="body1">{declaration.entryOffice?.code}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Nombre</Typography>
                    <Typography variant="body1">{declaration.entryOffice?.name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">Llegada Prevista</Typography>
                    <Typography variant="body1">{formatDate(declaration.entryOffice?.expectedArrival)}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {declaration.riskAssessment && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Analisis de Riesgo
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Estado</Typography>
                      <Chip
                        color={riskConfig[declaration.riskAssessment.status]?.color || 'default'}
                        label={riskConfig[declaration.riskAssessment.status]?.label || declaration.riskAssessment.status}
                      />
                    </Grid>
                    {declaration.riskAssessment.riskScore !== undefined && (
                      <Grid item xs={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Puntuacion</Typography>
                        <Typography variant="h5">{declaration.riskAssessment.riskScore}/100</Typography>
                      </Grid>
                    )}
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">DNL</Typography>
                      <Typography variant="body1">
                        {declaration.riskAssessment.doNotLoadList ? 'SI' : 'NO'}
                      </Typography>
                    </Grid>
                    {declaration.riskAssessment.evaluatedAt && (
                      <Grid item xs={6} md={3}>
                        <Typography variant="body2" color="textSecondary">Evaluado</Typography>
                        <Typography variant="body1">{formatDate(declaration.riskAssessment.evaluatedAt)}</Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {declaration.aeatResponse && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Respuesta AEAT
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Codigo</Typography>
                      <Typography variant="body1">{declaration.aeatResponse.code || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Fecha</Typography>
                      <Typography variant="body1">{formatDate(declaration.aeatResponse.timestamp)}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">Mensaje</Typography>
                      <Typography variant="body1">{declaration.aeatResponse.message || '-'}</Typography>
                    </Grid>
                    {declaration.aeatResponse.errors?.length > 0 && (
                      <Grid item xs={12}>
                        <Alert severity="error">
                          {declaration.aeatResponse.errors.map((err, i) => (
                            <Typography key={i} variant="body2">
                              {err.code}: {err.message}
                            </Typography>
                          ))}
                        </Alert>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Tab 1: Carrier */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Datos del Transportista
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">EORI</Typography>
                    <Typography variant="body1" fontFamily="monospace">{declaration.carrier?.eori || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">Nombre</Typography>
                    <Typography variant="body1">{declaration.carrier?.name || '-'}</Typography>
                  </Grid>
                  {declaration.carrier?.address && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">Direccion</Typography>
                      <Typography variant="body1">
                        {[
                          declaration.carrier.address.street,
                          declaration.carrier.address.city,
                          declaration.carrier.address.postcode,
                          declaration.carrier.address.country
                        ].filter(Boolean).join(', ') || '-'}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Medio de Transporte
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Tipo</Typography>
                    <Typography variant="body1">{declaration.transportMeans?.type || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Identificacion</Typography>
                    <Typography variant="body1">{declaration.transportMeans?.identification || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Nacionalidad</Typography>
                    <Typography variant="body1">{declaration.transportMeans?.nationality || '-'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Consignment */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Datos del Envio
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Conocimiento</Typography>
                    <Typography variant="body1">{declaration.consignment?.referenceNumber || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Contenedor</Typography>
                    <Typography variant="body1" fontFamily="monospace">{declaration.consignment?.containerNumber || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Precinto</Typography>
                    <Typography variant="body1">{declaration.consignment?.sealNumber || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Peso Bruto</Typography>
                    <Typography variant="body1">{declaration.consignment?.grossMass ? `${declaration.consignment.grossMass} kg` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Bultos</Typography>
                    <Typography variant="body1">{declaration.consignment?.numberOfPackages || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">Descripcion</Typography>
                    <Typography variant="body1">{declaration.consignment?.goodsDescription || '-'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Expedidor (Consignor)
                </Typography>
                <Typography variant="body2" color="textSecondary">EORI</Typography>
                <Typography variant="body1">{declaration.consignor?.eori || '-'}</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Nombre</Typography>
                <Typography variant="body1">{declaration.consignor?.name || '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Destinatario (Consignee)
                </Typography>
                <Typography variant="body2" color="textSecondary">EORI</Typography>
                <Typography variant="body1">{declaration.consignee?.eori || '-'}</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Nombre</Typography>
                <Typography variant="body1">{declaration.consignee?.name || '-'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 3: Goods */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          {/* House Consignments (Groupage) */}
          {declaration.houseConsignments?.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Envios House (Grupaje)
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>Referencia</TableCell>
                          <TableCell>Destinatario</TableCell>
                          <TableCell>EORI</TableCell>
                          <TableCell>Partidas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {declaration.houseConsignments.map((house, index) => (
                          <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{house.referenceNumber}</TableCell>
                            <TableCell>{house.consignee?.name || '-'}</TableCell>
                            <TableCell>{house.consignee?.eori || '-'}</TableCell>
                            <TableCell>{house.goods?.length || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Direct Goods Items */}
          {declaration.goods?.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Partidas de Mercancia
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>Descripcion</TableCell>
                          <TableCell>TARIC</TableCell>
                          <TableCell>Origen</TableCell>
                          <TableCell>Peso Bruto</TableCell>
                          <TableCell>Bultos</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {declaration.goods.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.itemNumber || index + 1}</TableCell>
                            <TableCell>{item.description || '-'}</TableCell>
                            <TableCell>{item.taricCode || '-'}</TableCell>
                            <TableCell>{item.countryOfOrigin || '-'}</TableCell>
                            <TableCell>{item.grossMass ? `${item.grossMass} kg` : '-'}</TableCell>
                            <TableCell>{item.numberOfPackages || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Totals */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Totales
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">Peso Total</Typography>
                    <Typography variant="h5">{declaration.totals?.grossMass || declaration.consignment?.grossMass || 0} kg</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">Bultos</Typography>
                    <Typography variant="h5">{declaration.totals?.numberOfPackages || declaration.consignment?.numberOfPackages || 0}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">Partidas</Typography>
                    <Typography variant="h5">{declaration.totals?.numberOfItems || declaration.goods?.length || 0}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 4: Documents */}
      {activeTab === 4 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Documentos Adjuntos
            </Typography>
            {declaration.documents?.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Numero</TableCell>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {declaration.documents.map((doc, index) => (
                      <TableRow key={index}>
                        <TableCell>{doc.type}</TableCell>
                        <TableCell>{doc.documentNumber || '-'}</TableCell>
                        <TableCell>{doc.name || '-'}</TableCell>
                        <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
                        <TableCell>
                          {doc.url && (
                            <IconButton size="small" href={doc.url} target="_blank">
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="textSecondary">No hay documentos adjuntos</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: History */}
      {activeTab === 5 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Historial de Estados
            </Typography>
            {declaration.statusHistory?.length > 0 ? (
              <Box sx={{ pl: 2 }}>
                {declaration.statusHistory.map((history, index) => {
                  const config = statusConfig[history.status] || { color: 'default', label: history.status, icon: InfoIcon }
                  const IconComponent = config.icon
                  return (
                    <Box key={index} sx={{ display: 'flex', mb: 2 }}>
                      <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: `${config.color}.light`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2
                      }}>
                        <IconComponent color={config.color} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">{config.label}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {formatDate(history.timestamp)}
                        </Typography>
                        {history.reason && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {history.reason}
                          </Typography>
                        )}
                        {history.performedBy && (
                          <Typography variant="caption" color="textSecondary">
                            Por: {history.performedBy}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            ) : (
              <Typography color="textSecondary">No hay historial disponible</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Anular Declaracion ENS</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Esta accion anulara la declaracion ENS. Por favor, indique el motivo:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Motivo de anulacion"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={!cancelReason.trim() || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
          >
            Anular Declaracion
          </Button>
        </DialogActions>
      </Dialog>

      {/* Arrival Dialog */}
      <Dialog open={arrivalDialogOpen} onClose={() => setArrivalDialogOpen(false)}>
        <DialogTitle>Notificar Llegada</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Notifique la llegada de la mercancia a la aduana de entrada:
          </Typography>
          <TextField
            fullWidth
            type="date"
            label="Fecha de Llegada"
            value={arrivalData.arrivalDate}
            onChange={(e) => setArrivalData(prev => ({ ...prev, arrivalDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="time"
            label="Hora de Llegada"
            value={arrivalData.actualArrivalTime}
            onChange={(e) => setArrivalData(prev => ({ ...prev, actualArrivalTime: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Observaciones"
            value={arrivalData.remarks}
            onChange={(e) => setArrivalData(prev => ({ ...prev, remarks: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArrivalDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleNotifyArrival}
            disabled={!arrivalData.arrivalDate || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <ArrivalIcon />}
          >
            Notificar Llegada
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ENSDeclarationDetail
