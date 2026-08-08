import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../common/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Box, Typography, Paper, Grid, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, IconButton, InputAdornment, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Alert,
  Tooltip, CircularProgress, LinearProgress
} from '@mui/material'
import {
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Send as SendIcon,
  LocalShipping as TruckIcon,
  DirectionsRailway as RailIcon,
  Flight as AirIcon,
  DirectionsBoat as SeaIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material'
import { ensAPI } from '../../services/api'
import ENSDeclarationForm from './ENSDeclarationForm'
import ENSBatchUpload from './ENSBatchUpload'

const ENSDeclarationList = () => {
  const { t } = useTranslation()
  const { confirm, dialogProps } = useConfirm()
  const navigate = useNavigate()

  // Transport mode icons and colors
  const transportModeConfig = {
    ROAD: { icon: TruckIcon, color: '#4CAF50', label: t('ens.road') },
    RAIL: { icon: RailIcon, color: '#FF9800', label: t('ens.rail') },
    AIR: { icon: AirIcon, color: '#2196F3', label: t('ens.air') },
    SEA: { icon: SeaIcon, color: '#00BCD4', label: t('ens.maritime') }
  }

  // Solo el ferrocarril (RAIL) se declara por el canal legacy AEAT (IE315). Maritimo,
  // aereo y carretera requieren ICS2 (fase 4, 2026): AEAT rechaza esos modos por el
  // legacy, asi que el envio se ofrece deshabilitado igual que en la ficha.
  const ICS2_MODES = ['SEA', 'AIR', 'ROAD']
  const requiresICS2 = (mode) => ICS2_MODES.includes(String(mode || '').toUpperCase())

  // Status configuration
  const statusConfig = {
    draft: { color: 'default', label: t('ens.statusDraft') },
    validated: { color: 'info', label: t('ens.statusValidated') },
    submitted: { color: 'primary', label: t('ens.statusSent') },
    accepted: { color: 'success', label: t('ens.statusAccepted') },
    rejected: { color: 'error', label: t('ens.statusRejected') },
    amendment_pending: { color: 'warning', label: t('ens.statusAmendmentPending') },
    amended: { color: 'info', label: t('ens.statusAmended') },
    arrived: { color: 'secondary', label: t('ens.statusArrivalNotified') },
    released: { color: 'success', label: t('ens.statusReleased') },
    dnl: { color: 'error', label: t('ens.statusDnl') },
    cancelled: { color: 'default', label: t('ens.statusCancelled') }
  }

  // Risk status configuration
  const riskConfig = {
    PENDING: { color: 'default', label: t('ens.riskPending') },
    ACK: { color: 'success', label: t('ens.riskAccepted') },
    HOLD: { color: 'warning', label: t('ens.riskHeld') },
    DNL: { color: 'error', label: t('ens.riskDoNotLoad') },
    CLEARED: { color: 'success', label: t('ens.riskCleared') }
  }
  const [declarations, setDeclarations] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 20,
    total: 0
  })
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    transportMode: '',
    startDate: '',
    endDate: ''
  })
  const [selectedTab, setSelectedTab] = useState(0)
  const [selectedDeclaration, setSelectedDeclaration] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [batchUploadOpen, setBatchUploadOpen] = useState(false)

  useEffect(() => {
    loadDeclarations()
    loadStats()
  }, [pagination.page, pagination.limit, filters])

  const loadDeclarations = async () => {
    try {
      setLoading(true)
      const response = await ensAPI.list({
        page: pagination.page + 1,
        limit: pagination.limit,
        ...filters
      })
      if (response.data.success) {
        setDeclarations(response.data.data)
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }))
      }
    } catch (error) {
      console.error('Error loading ENS declarations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await ensAPI.getStats()
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setPagination(prev => ({ ...prev, page: 0 }))
  }

  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleRowsPerPageChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      page: 0
    }))
  }

  const handleViewDeclaration = async (declaration) => {
    try {
      const response = await ensAPI.get(declaration._id)
      if (response.data.success) {
        setSelectedDeclaration(response.data.data)
        setDetailDialogOpen(true)
      }
    } catch (error) {
      console.error('Error loading declaration details:', error)
    }
  }

  const handleSubmitDeclaration = async (id) => {
    if (!await confirm({ message: t('ens.confirmSend') })) return

    try {
      const response = await ensAPI.submit(id)
      if (response.data.success) {
        // El envio es REAL contra AEAT: sin avisar del MRN el usuario no sabe si se
        // ha presentado la declaracion. Mismo criterio que en ENSDeclarationDetail.
        const mrn = response.data.data?.mrn
        toast.success(mrn ? t('ens.sentWithMrn', { mrn }) : t('ens.sentOk', 'Declaración enviada a AEAT'))
        loadDeclarations()
        loadStats()
      } else {
        toast.error(response.data.message || t('ens.submitError', 'Error al enviar a AEAT'))
      }
    } catch (error) {
      console.error('Error submitting declaration:', error)
      toast.error(error.response?.data?.message || error.response?.data?.error || t('ens.submitError', 'Error al enviar a AEAT'))
    }
  }

  const renderTransportModeIcon = (mode) => {
    const config = transportModeConfig[mode]
    if (!config) return null
    const IconComponent = config.icon
    return (
      <Tooltip title={config.label}>
        <IconComponent style={{ color: config.color }} />
      </Tooltip>
    )
  }

  const renderStatusChip = (status) => {
    const config = statusConfig[status] || { color: 'default', label: status }
    return <Chip size="small" color={config.color} label={config.label} />
  }

  const renderRiskChip = (riskStatus) => {
    const config = riskConfig[riskStatus] || { color: 'default', label: riskStatus }
    return <Chip size="small" variant="outlined" color={config.color} label={config.label} />
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {t('ens.title')}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            sx={{ mr: 1 }}
            onClick={() => setBatchUploadOpen(true)}
          >
            {t('ens.importBatch')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            {t('ens.new')}
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('ens.totalDeclarations')}
                </Typography>
                <Typography variant="h4">
                  {stats.totals?.declarations || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('ens.totalWeight')}
                </Typography>
                <Typography variant="h4">
                  {((stats.totals?.weight || 0) / 1000).toFixed(1)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('ens.totalPackages')}
                </Typography>
                <Typography variant="h4">
                  {stats.totals?.packages?.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('ens.byTransportMode')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {stats.byTransportMode?.map(tm => (
                    <Tooltip key={tm._id} title={`${transportModeConfig[tm._id]?.label}: ${tm.count}`}>
                      {renderTransportModeIcon(tm._id)}
                    </Tooltip>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('ens.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              select
              label={t('ens.statusFilter')}
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              select
              label={t('ens.transportModeFilter')}
              value={filters.transportMode}
              onChange={(e) => handleFilterChange('transportMode', e.target.value)}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {Object.entries(transportModeConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t('ens.arrivalFrom', 'Llegada desde')}
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t('ens.arrivalTo', 'Llegada hasta')}
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Declarations Table */}
      <Paper>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('ens.reference')}</TableCell>
                <TableCell>{t('ens.mode')}</TableCell>
                <TableCell>{t('ens.mrnLabel')}</TableCell>
                <TableCell>{t('ens.billOfLading')}</TableCell>
                <TableCell>{t('ens.container')}</TableCell>
                <TableCell>{t('ens.carrier')}</TableCell>
                <TableCell>{t('ens.entryCustoms')}</TableCell>
                <TableCell>{t('ens.expectedArrival')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell>{t('ens.risk')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {declarations.map((dec) => (
                <TableRow key={dec._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {dec.reference}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {dec.lrn}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {renderTransportModeIcon(dec.transportMode)}
                  </TableCell>
                  <TableCell>
                    {dec.mrn || '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dec.consignment?.referenceNumber || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {dec.consignment?.containerNumber || '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {dec.carrier?.name || dec.carrier?.eori || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {dec.entryOffice?.code || '-'}
                  </TableCell>
                  <TableCell>
                    {formatDate(dec.entryOffice?.expectedArrival)}
                  </TableCell>
                  <TableCell>
                    {renderStatusChip(dec.status)}
                  </TableCell>
                  <TableCell>
                    {dec.riskAssessment?.status && renderRiskChip(dec.riskAssessment.status)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.viewDetail')}>
                      <IconButton size="small" onClick={() => navigate(`/ens/${dec._id}`)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {dec.status === 'draft' && (
                      <>
                        <Tooltip title={t('common.edit')}>
                          <IconButton size="small" onClick={() => navigate(`/ens/${dec._id}/edit`)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={requiresICS2(dec.transportMode)
                          ? t('ens.ics2Required', 'Este modo debe declararse mediante ICS2 (no por el canal AEAT actual)')
                          : t('ens.sendToAeat')}>
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              aria-label={t('ens.sendToAeat')}
                              disabled={requiresICS2(dec.transportMode)}
                              onClick={() => handleSubmitDeclaration(dec._id)}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {declarations.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Typography color="textSecondary" sx={{ py: 4 }}>
                      {t('ens.noDeclarations')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage={t('ens.rowsPerPage')}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {t('ens.detailTitle')}: {selectedDeclaration?.reference}
        </DialogTitle>
        <DialogContent dividers>
          {selectedDeclaration && (
            <Grid container spacing={3}>
              {/* General Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    {t('ens.generalInfo')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">{t('ens.reference')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.reference}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('ens.lrn')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.lrn}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('ens.mrnLabel')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.mrn || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('common.status')}:</Typography>
                    <Box>{renderStatusChip(selectedDeclaration.status)}</Box>
                    <Typography variant="body2" color="textSecondary">{t('ens.transportModeFilter')}:</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {renderTransportModeIcon(selectedDeclaration.transportMode)}
                      <Typography variant="body2">
                        {transportModeConfig[selectedDeclaration.transportMode]?.label}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* Entry Office */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    {t('ens.entryCustomsLabel')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">{t('ens.code')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.entryOffice?.code}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('common.name')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.entryOffice?.name || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('ens.expectedArrival')}:</Typography>
                    <Typography variant="body2">{formatDate(selectedDeclaration.entryOffice?.expectedArrival)}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Carrier */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    {t('ens.carrier')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">{t('ens.eoriLabel')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.carrier?.eori}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('common.name')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.carrier?.name || '-'}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Consignment */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    {t('ens.shipment')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">{t('ens.reference')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.referenceNumber}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('ens.container')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.containerNumber || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">{t('ens.grossWeight')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.grossMass} kg</Typography>
                    <Typography variant="body2" color="textSecondary">{t('ens.packagesLabel')}:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.numberOfPackages}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Risk Assessment */}
              {selectedDeclaration.riskAssessment && (
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      {t('ens.riskAnalysis')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">{t('common.status')}:</Typography>
                        {renderRiskChip(selectedDeclaration.riskAssessment.status)}
                      </Box>
                      {selectedDeclaration.riskAssessment.riskScore !== undefined && (
                        <Box>
                          <Typography variant="body2" color="textSecondary">{t('ens.score')}:</Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {selectedDeclaration.riskAssessment.riskScore}/100
                          </Typography>
                        </Box>
                      )}
                      {selectedDeclaration.riskAssessment.doNotLoadList && (
                        <Alert severity="error" sx={{ flex: 1 }}>
                          <strong>{t('ens.dnlIssued')}:</strong> {selectedDeclaration.riskAssessment.dnlReason}
                        </Alert>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Status History */}
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    {t('ens.statusHistory')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedDeclaration.statusHistory?.map((history, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption" color="textSecondary" sx={{ minWidth: 150 }}>
                          {formatDate(history.timestamp)}
                        </Typography>
                        {renderStatusChip(history.status)}
                        {history.reason && (
                          <Typography variant="body2" color="textSecondary">
                            {history.reason}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            {t('common.close')}
          </Button>
          {selectedDeclaration?.status === 'draft' && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={() => {
                handleSubmitDeclaration(selectedDeclaration._id)
                setDetailDialogOpen(false)
              }}
            >
              {t('ens.sendToAeat')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          <ENSDeclarationForm
            onClose={() => setCreateDialogOpen(false)}
            onSuccess={(newDeclaration) => {
              setCreateDialogOpen(false)
              loadDeclarations()
              loadStats()
              // Optionally navigate to detail
              if (newDeclaration?._id) {
                navigate(`/ens/${newDeclaration._id}`)
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Batch Upload Dialog */}
      <ENSBatchUpload
        open={batchUploadOpen}
        onClose={() => setBatchUploadOpen(false)}
        onSuccess={() => {
          loadDeclarations()
          loadStats()
        }}
      />
    <ConfirmDialog {...dialogProps} />
    </Box>
  )
}

export default ENSDeclarationList
