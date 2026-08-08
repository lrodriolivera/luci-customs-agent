import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import ConfirmDialog from '../common/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
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

const ENSDeclarationDetail = () => {
  const { t } = useTranslation()
  const { confirm, dialogProps } = useConfirm()
  const { id } = useParams()
  const navigate = useNavigate()

  // Transport mode configuration
  const transportModeConfig = {
    ROAD: { icon: TruckIcon, color: '#4CAF50', label: t('ens.road') },
    RAIL: { icon: RailIcon, color: '#FF9800', label: t('ens.rail') },
    AIR: { icon: AirIcon, color: '#2196F3', label: t('ens.air') },
    SEA: { icon: SeaIcon, color: '#00BCD4', label: t('ens.maritime') }
  }

  // Solo el ferrocarril (RAIL) se declara por el canal legacy AEAT (IE315). Marítimo,
  // aéreo y carretera requieren ICS2 (fase 4, 2026): AEAT rechaza esos modos por el legacy.
  const ICS2_MODES = ['SEA', 'AIR', 'ROAD']
  const requiresICS2 = (mode) => ICS2_MODES.includes(String(mode || '').toUpperCase())

  // Status configuration
  const statusConfig = {
    draft: { color: 'default', label: t('ens.statusDraft'), icon: EditIcon },
    validated: { color: 'info', label: t('ens.statusValidated'), icon: SuccessIcon },
    submitted: { color: 'primary', label: t('ens.statusSent'), icon: SendIcon },
    accepted: { color: 'success', label: t('ens.statusAccepted'), icon: SuccessIcon },
    rejected: { color: 'error', label: t('ens.statusRejected'), icon: ErrorIcon },
    amendment_pending: { color: 'warning', label: t('ens.statusAmendmentPending'), icon: ScheduleIcon },
    amended: { color: 'info', label: t('ens.statusAmended'), icon: EditIcon },
    arrived: { color: 'secondary', label: t('ens.statusArrivalNotified'), icon: ArrivalIcon },
    released: { color: 'success', label: t('ens.statusReleased'), icon: SuccessIcon },
    dnl: { color: 'error', label: t('ens.statusDnl'), icon: WarningIcon },
    cancelled: { color: 'default', label: t('ens.statusCancelled'), icon: CancelIcon }
  }

  // Risk status configuration
  const riskConfig = {
    PENDING: { color: 'default', label: t('ens.riskPending'), severity: 'info' },
    ACK: { color: 'success', label: t('ens.riskAccepted'), severity: 'success' },
    HOLD: { color: 'warning', label: t('ens.riskHeld'), severity: 'warning' },
    DNL: { color: 'error', label: t('ens.riskDoNotLoad'), severity: 'error' },
    CLEARED: { color: 'success', label: t('ens.riskCleared'), severity: 'success' }
  }

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
    if (!await confirm({ message: t('ens.confirmSend') })) return

    try {
      setActionLoading(true)
      const response = await ensAPI.submit(id)
      if (response.data.success) {
        const mrn = response.data.data?.mrn
        toast.success(mrn ? t('ens.sentWithMrn', { mrn }) : t('ens.sentOk', 'Declaración enviada a AEAT'))
        loadDeclaration()
      } else {
        toast.error(response.data.message || t('ens.submitError', 'Error al enviar a AEAT'))
      }
    } catch (error) {
      console.error('Error submitting:', error)
      // AEAT rechaza p. ej. ENS marítimas legacy (deben ir por ICS2): mostrar el motivo.
      toast.error(error.response?.data?.message || error.response?.data?.error || t('ens.submitError', 'Error al enviar a AEAT'))
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
        toast.success(t('ens.cancelledOk', 'Declaración anulada'))
        loadDeclaration()
      } else {
        toast.error(response.data.message || t('ens.cancelError', 'Error al anular'))
      }
    } catch (error) {
      console.error('Error cancelling:', error)
      toast.error(error.response?.data?.message || t('ens.cancelError', 'Error al anular'))
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
        toast.success(t('ens.arrivalNotifiedOk', 'Llegada notificada'))
        loadDeclaration()
      } else {
        toast.error(response.data.message || t('ens.arrivalError', 'Error al notificar llegada'))
      }
    } catch (error) {
      console.error('Error notifying arrival:', error)
      toast.error(error.response?.data?.message || t('ens.arrivalError', 'Error al notificar llegada'))
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
      toast.error(error.response?.data?.message || t('ens.xmlError', 'Error al descargar el XML'))
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
        <Alert severity="error">{t('ens.declarationNotFound')}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/ens')} sx={{ mt: 2 }}>
          {t('ens.backToList')}
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
                {t('common.edit')}
              </Button>
              {requiresICS2(declaration.transportMode) ? (
                <Tooltip title={t('ens.ics2Required', 'Este modo debe declararse mediante ICS2 (no por el canal AEAT actual)')}>
                  <span>
                    <Button
                      variant="contained"
                      startIcon={<SendIcon />}
                      disabled
                    >
                      {t('ens.sendToAeat')}
                    </Button>
                  </span>
                </Tooltip>
              ) : (
                <Button
                  variant="contained"
                  startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
                  onClick={handleSubmit}
                  disabled={actionLoading}
                >
                  {t('ens.sendToAeat')}
                </Button>
              )}
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
                {t('ens.notifyArrival')}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setCancelDialogOpen(true)}
              >
                {t('ens.cancel')}
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
              {t('ens.downloadXml')}
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
            {t('ens.riskAnalysisLabel')}: {riskConfig[declaration.riskAssessment.status]?.label}
          </Typography>
          {declaration.riskAssessment.doNotLoadList && (
            <Typography variant="body2">
              <strong>{t('ens.dnlIssuedAlert')}:</strong> {declaration.riskAssessment.dnlReason || t('ens.dnlDefaultMsg')}
            </Typography>
          )}
          {declaration.riskAssessment.controlDecisions?.length > 0 && (
            <Typography variant="body2">
              {t('ens.controlDecisions')}: {declaration.riskAssessment.controlDecisions.map(d => d.code).join(', ')}
            </Typography>
          )}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={t('ens.tabGeneral')} />
          <Tab label={t('ens.tabCarrier')} />
          <Tab label={t('ens.tabShipment')} />
          <Tab label={t('ens.tabGoods')} />
          <Tab label={t('ens.tabDocuments')} />
          <Tab label={t('ens.tabHistory')} />
        </Tabs>
      </Paper>

      {/* Tab 0: General */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('ens.generalInfo')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('ens.reference')}</Typography>
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
                    <Typography variant="body2" color="textSecondary">{t('common.type')}</Typography>
                    <Typography variant="body1">{declaration.declarationType || 'ENS'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('ens.created')}</Typography>
                    <Typography variant="body1">{formatDate(declaration.createdAt)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('ens.updated')}</Typography>
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
                  {t('ens.entryCustomsLabel')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('ens.code')}</Typography>
                    <Typography variant="body1">{declaration.entryOffice?.code}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('common.name')}</Typography>
                    <Typography variant="body1">{declaration.entryOffice?.name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">{t('ens.expectedArrival')}</Typography>
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
                    {t('ens.riskAnalysis')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">{t('common.status')}</Typography>
                      <Chip
                        color={riskConfig[declaration.riskAssessment.status]?.color || 'default'}
                        label={riskConfig[declaration.riskAssessment.status]?.label || declaration.riskAssessment.status}
                      />
                    </Grid>
                    {declaration.riskAssessment.riskScore !== undefined && (
                      <Grid item xs={6} md={3}>
                        <Typography variant="body2" color="textSecondary">{t('ens.score')}</Typography>
                        <Typography variant="h5">{declaration.riskAssessment.riskScore}/100</Typography>
                      </Grid>
                    )}
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">{t('ens.dnlLabel')}</Typography>
                      <Typography variant="body1">
                        {declaration.riskAssessment.doNotLoadList ? 'SI' : 'NO'}
                      </Typography>
                    </Grid>
                    {declaration.riskAssessment.evaluatedAt && (
                      <Grid item xs={6} md={3}>
                        <Typography variant="body2" color="textSecondary">{t('ens.evaluated')}</Typography>
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
                    {t('ens.aeatResponse')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">{t('ens.code')}</Typography>
                      <Typography variant="body1">{declaration.aeatResponse.code || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">{t('common.date')}</Typography>
                      <Typography variant="body1">{formatDate(declaration.aeatResponse.timestamp)}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">{t('ens.message')}</Typography>
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
                  {t('ens.carrierData')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">{t('ens.eoriLabel')}</Typography>
                    <Typography variant="body1" fontFamily="monospace">{declaration.carrier?.eori || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">{t('common.name')}</Typography>
                    <Typography variant="body1">{declaration.carrier?.name || '-'}</Typography>
                  </Grid>
                  {declaration.carrier?.address && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">{t('common.address')}</Typography>
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
                  {t('ens.transportMeans')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('common.type')}</Typography>
                    <Typography variant="body1">{declaration.transportMeans?.type || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('ens.identification')}</Typography>
                    <Typography variant="body1">{declaration.transportMeans?.identification || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">{t('ens.nationality')}</Typography>
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
                  {t('ens.shipmentData')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">{t('ens.billOfLading')}</Typography>
                    <Typography variant="body1">{declaration.consignment?.referenceNumber || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">{t('ens.container')}</Typography>
                    <Typography variant="body1" fontFamily="monospace">{declaration.consignment?.containerNumber || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">{t('ens.seal')}</Typography>
                    <Typography variant="body1">{declaration.consignment?.sealNumber || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">{t('ens.grossWeight')}</Typography>
                    <Typography variant="body1">{declaration.consignment?.grossMass ? `${declaration.consignment.grossMass} kg` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">{t('ens.packagesLabel')}</Typography>
                    <Typography variant="body1">{declaration.consignment?.numberOfPackages || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">{t('common.description')}</Typography>
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
                  {t('ens.consignorLabel')}
                </Typography>
                <Typography variant="body2" color="textSecondary">{t('ens.eoriLabel')}</Typography>
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
                  {t('ens.consigneeLabel')}
                </Typography>
                <Typography variant="body2" color="textSecondary">{t('ens.eoriLabel')}</Typography>
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
                    {t('ens.houseGroupage')}
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>{t('ens.reference')}</TableCell>
                          <TableCell>{t('ens.recipient')}</TableCell>
                          <TableCell>{t('ens.eoriLabel')}</TableCell>
                          <TableCell>{t('ens.items')}</TableCell>
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
                    {t('ens.goodsItems')}
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>{t('common.description')}</TableCell>
                          <TableCell>TARIC</TableCell>
                          <TableCell>{t('ens.countryOfOrigin')}</TableCell>
                          <TableCell>{t('ens.grossWeight')}</TableCell>
                          <TableCell>{t('ens.packagesLabel')}</TableCell>
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
                  {t('ens.totals')}
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">{t('ens.totalWeight')}</Typography>
                    <Typography variant="h5">{declaration.totals?.grossMass || declaration.consignment?.grossMass || 0} kg</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">{t('ens.packagesLabel')}</Typography>
                    <Typography variant="h5">{declaration.totals?.numberOfPackages || declaration.consignment?.numberOfPackages || 0}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">{t('ens.items')}</Typography>
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
              {t('ens.attachedDocuments')}
            </Typography>
            {declaration.documents?.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('common.type')}</TableCell>
                      <TableCell>{t('ens.number')}</TableCell>
                      <TableCell>{t('common.name')}</TableCell>
                      <TableCell>{t('common.date')}</TableCell>
                      <TableCell>{t('common.actions')}</TableCell>
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
              <Typography color="textSecondary">{t('ens.noDocuments')}</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: History */}
      {activeTab === 5 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('ens.statusHistory')}
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
                            {t('ens.performedBy')}: {history.performedBy}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            ) : (
              <Typography color="textSecondary">{t('ens.noHistory')}</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>{t('ens.cancelDeclaration')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('ens.cancelReason')}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('ens.cancelReasonLabel')}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={!cancelReason.trim() || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
          >
            {t('ens.cancelButton')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Arrival Dialog */}
      <Dialog open={arrivalDialogOpen} onClose={() => setArrivalDialogOpen(false)}>
        <DialogTitle>{t('ens.arrivalDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('ens.arrivalDialogDesc')}
          </Typography>
          <TextField
            fullWidth
            type="date"
            label={t('ens.arrivalDate')}
            value={arrivalData.arrivalDate}
            onChange={(e) => setArrivalData(prev => ({ ...prev, arrivalDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="time"
            label={t('ens.arrivalTime')}
            value={arrivalData.actualArrivalTime}
            onChange={(e) => setArrivalData(prev => ({ ...prev, actualArrivalTime: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label={t('ens.remarks')}
            value={arrivalData.remarks}
            onChange={(e) => setArrivalData(prev => ({ ...prev, remarks: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArrivalDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleNotifyArrival}
            disabled={!arrivalData.arrivalDate || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <ArrivalIcon />}
          >
            {t('ens.notifyArrival')}
          </Button>
        </DialogActions>
      </Dialog>
    <ConfirmDialog {...dialogProps} />
    </Box>
  )
}

export default ENSDeclarationDetail
