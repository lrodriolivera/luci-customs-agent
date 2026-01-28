import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

// Transport mode icons and colors
const transportModeConfig = {
  ROAD: { icon: TruckIcon, color: '#4CAF50', label: 'Carretera' },
  RAIL: { icon: RailIcon, color: '#FF9800', label: 'Ferrocarril' },
  AIR: { icon: AirIcon, color: '#2196F3', label: 'Aereo' },
  SEA: { icon: SeaIcon, color: '#00BCD4', label: 'Maritimo' }
}

// Status configuration
const statusConfig = {
  draft: { color: 'default', label: 'Borrador' },
  validated: { color: 'info', label: 'Validada' },
  submitted: { color: 'primary', label: 'Enviada' },
  accepted: { color: 'success', label: 'Aceptada' },
  rejected: { color: 'error', label: 'Rechazada' },
  amendment_pending: { color: 'warning', label: 'Rectificacion Pendiente' },
  amended: { color: 'info', label: 'Rectificada' },
  arrived: { color: 'secondary', label: 'Llegada Notificada' },
  released: { color: 'success', label: 'Levantada' },
  dnl: { color: 'error', label: 'DNL' },
  cancelled: { color: 'default', label: 'Anulada' }
}

// Risk status configuration
const riskConfig = {
  PENDING: { color: 'default', label: 'Pendiente' },
  ACK: { color: 'success', label: 'Aceptada' },
  HOLD: { color: 'warning', label: 'Retenida' },
  DNL: { color: 'error', label: 'No Cargar' },
  CLEARED: { color: 'success', label: 'Despachada' }
}

const ENSDeclarationList = () => {
  const navigate = useNavigate()
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
    if (!window.confirm('Esta seguro de enviar esta declaracion a AEAT?')) return

    try {
      const response = await ensAPI.submit(id)
      if (response.data.success) {
        loadDeclarations()
        loadStats()
      }
    } catch (error) {
      console.error('Error submitting declaration:', error)
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
          Declaraciones ENS (ICS2)
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            sx={{ mr: 1 }}
            onClick={() => setBatchUploadOpen(true)}
          >
            Importar Lote
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Nueva ENS
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Declaraciones
                </Typography>
                <Typography variant="h4">
                  {stats.totals?.declarations || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Peso Total (Tn)
                </Typography>
                <Typography variant="h4">
                  {((stats.totals?.weight || 0) / 1000).toFixed(1)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Bultos
                </Typography>
                <Typography variant="h4">
                  {stats.totals?.packages?.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Por Modo Transporte
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
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por referencia, MRN, contenedor, B/L..."
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
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Estado"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Modo Transporte"
              value={filters.transportMode}
              onChange={(e) => handleFilterChange('transportMode', e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(transportModeConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Desde"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Hasta"
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
                <TableCell>Referencia</TableCell>
                <TableCell>Modo</TableCell>
                <TableCell>MRN</TableCell>
                <TableCell>Conocimiento</TableCell>
                <TableCell>Contenedor</TableCell>
                <TableCell>Transportista</TableCell>
                <TableCell>Aduana Entrada</TableCell>
                <TableCell>Llegada Prevista</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Riesgo</TableCell>
                <TableCell align="right">Acciones</TableCell>
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
                    <Tooltip title="Ver detalle">
                      <IconButton size="small" onClick={() => navigate(`/ens/${dec._id}`)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {dec.status === 'draft' && (
                      <>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => navigate(`/ens/${dec._id}`)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Enviar a AEAT">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleSubmitDeclaration(dec._id)}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
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
                      No se encontraron declaraciones ENS
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
          labelRowsPerPage="Filas por pagina:"
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
          Detalle ENS: {selectedDeclaration?.reference}
        </DialogTitle>
        <DialogContent dividers>
          {selectedDeclaration && (
            <Grid container spacing={3}>
              {/* General Info */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Informacion General
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">Referencia:</Typography>
                    <Typography variant="body2">{selectedDeclaration.reference}</Typography>
                    <Typography variant="body2" color="textSecondary">LRN:</Typography>
                    <Typography variant="body2">{selectedDeclaration.lrn}</Typography>
                    <Typography variant="body2" color="textSecondary">MRN:</Typography>
                    <Typography variant="body2">{selectedDeclaration.mrn || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">Estado:</Typography>
                    <Box>{renderStatusChip(selectedDeclaration.status)}</Box>
                    <Typography variant="body2" color="textSecondary">Modo Transporte:</Typography>
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
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Aduana de Entrada
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">Codigo:</Typography>
                    <Typography variant="body2">{selectedDeclaration.entryOffice?.code}</Typography>
                    <Typography variant="body2" color="textSecondary">Nombre:</Typography>
                    <Typography variant="body2">{selectedDeclaration.entryOffice?.name || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">Llegada Prevista:</Typography>
                    <Typography variant="body2">{formatDate(selectedDeclaration.entryOffice?.expectedArrival)}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Carrier */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Transportista
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">EORI:</Typography>
                    <Typography variant="body2">{selectedDeclaration.carrier?.eori}</Typography>
                    <Typography variant="body2" color="textSecondary">Nombre:</Typography>
                    <Typography variant="body2">{selectedDeclaration.carrier?.name || '-'}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Consignment */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Envio
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">Referencia:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.referenceNumber}</Typography>
                    <Typography variant="body2" color="textSecondary">Contenedor:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.containerNumber || '-'}</Typography>
                    <Typography variant="body2" color="textSecondary">Peso Bruto:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.grossMass} kg</Typography>
                    <Typography variant="body2" color="textSecondary">Bultos:</Typography>
                    <Typography variant="body2">{selectedDeclaration.consignment?.numberOfPackages}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Risk Assessment */}
              {selectedDeclaration.riskAssessment && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      Analisis de Riesgo
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">Estado:</Typography>
                        {renderRiskChip(selectedDeclaration.riskAssessment.status)}
                      </Box>
                      {selectedDeclaration.riskAssessment.riskScore !== undefined && (
                        <Box>
                          <Typography variant="body2" color="textSecondary">Puntuacion:</Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {selectedDeclaration.riskAssessment.riskScore}/100
                          </Typography>
                        </Box>
                      )}
                      {selectedDeclaration.riskAssessment.doNotLoadList && (
                        <Alert severity="error" sx={{ flex: 1 }}>
                          <strong>DNL Emitido:</strong> {selectedDeclaration.riskAssessment.dnlReason}
                        </Alert>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Status History */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Historial de Estados
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
            Cerrar
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
              Enviar a AEAT
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
    </Box>
  )
}

export default ENSDeclarationList
