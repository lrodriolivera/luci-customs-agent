import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Grid, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, Card, CardContent, CardHeader, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  Alert, Tooltip, CircularProgress, Divider, InputAdornment, List,
  ListItem, ListItemText, ListItemIcon
} from '@mui/material'
import {
  Search as SearchIcon,
  History as HistoryIcon,
  DirectionsBoat as ContainerIcon,
  Description as DocumentIcon,
  LocalShipping as BOLIcon,
  Flight as AWBIcon,
  LocationOn as LocationIcon,
  Business as EOIRIcon,
  Assignment as MRNIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon
} from '@mui/icons-material'
import { queryAPI } from '../../services/api'

// Query type configuration
const queryTypeConfig = {
  QIntNuCono: { icon: BOLIcon, color: '#4CAF50', label: 'Conocimiento (B/L)', field: 'reference' },
  QIntCont: { icon: ContainerIcon, color: '#2196F3', label: 'Contenedor', field: 'containerNumber' },
  QIntUbic: { icon: LocationIcon, color: '#FF9800', label: 'Ubicacion', field: 'locationCode' },
  QIntDocAsoc: { icon: DocumentIcon, color: '#9C27B0', label: 'Documentos', field: 'reference' },
  QIntMRN: { icon: MRNIcon, color: '#00BCD4', label: 'MRN', field: 'mrn' },
  QIntEORI: { icon: EOIRIcon, color: '#795548', label: 'EORI', field: 'eori' }
}

// Status configuration
const queryStatusConfig = {
  pending: { color: 'default', icon: PendingIcon, label: 'Pendiente' },
  processing: { color: 'info', icon: RefreshIcon, label: 'Procesando' },
  completed: { color: 'success', icon: SuccessIcon, label: 'Completada' },
  failed: { color: 'error', icon: ErrorIcon, label: 'Fallida' },
  timeout: { color: 'warning', icon: ErrorIcon, label: 'Timeout' }
}

// Declaration type colors
const declarationTypeColors = {
  ENS: '#4CAF50',
  H1: '#2196F3',
  H7: '#FF9800',
  AES: '#9C27B0',
  NCTS: '#00BCD4',
  DUA: '#795548'
}

const QueryDashboard = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [queryType, setQueryType] = useState('QIntNuCono')
  const [searchValue, setSearchValue] = useState('')
  const [additionalParams, setAdditionalParams] = useState({
    dateFrom: '',
    dateTo: '',
    declarationType: '',
    includeDocuments: true
  })
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [selectedResult, setSelectedResult] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0
  })

  useEffect(() => {
    loadHistory()
    loadStats()
  }, [])

  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      const response = await queryAPI.getHistory({
        page: pagination.page + 1,
        limit: pagination.limit
      })
      if (response.data.success) {
        setHistory(response.data.data)
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0
        }))
      }
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await queryAPI.getStats()
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchValue.trim()) return

    setLoading(true)
    setResults(null)

    try {
      let response
      const params = {
        ...additionalParams,
        [queryTypeConfig[queryType].field]: searchValue
      }

      switch (queryType) {
        case 'QIntNuCono':
          response = await queryAPI.byBillOfLading(params)
          break
        case 'QIntCont':
          response = await queryAPI.byContainer(params)
          break
        case 'QIntUbic':
          response = await queryAPI.byLocation(params)
          break
        case 'QIntDocAsoc':
          response = await queryAPI.documents(params)
          break
        case 'QIntMRN':
          response = await queryAPI.byMRN(params)
          break
        case 'QIntEORI':
          response = await queryAPI.byEORI(params)
          break
        default:
          return
      }

      if (response.data.success) {
        setResults(response.data)
        loadHistory() // Refresh history after new query
      } else {
        setResults({ success: false, error: response.data.error })
      }
    } catch (error) {
      console.error('Error executing query:', error)
      setResults({
        success: false,
        error: error.response?.data?.message || error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewHistoryResult = async (queryId) => {
    try {
      const response = await queryAPI.get(queryId)
      if (response.data.success) {
        setResults(response.data.data)
      }
    } catch (error) {
      console.error('Error loading query result:', error)
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

  const renderQueryTypeIcon = (type) => {
    const config = queryTypeConfig[type]
    if (!config) return null
    const IconComponent = config.icon
    return <IconComponent style={{ color: config.color }} />
  }

  const renderStatusChip = (status) => {
    const config = queryStatusConfig[status] || { color: 'default', label: status }
    return <Chip size="small" color={config.color} label={config.label} />
  }

  const renderDeclarationTypeChip = (type) => {
    return (
      <Chip
        size="small"
        label={type}
        sx={{
          bgcolor: declarationTypeColors[type] || '#757575',
          color: 'white'
        }}
      />
    )
  }

  const renderChannelChip = (channel) => {
    const colors = {
      GREEN: 'success',
      ORANGE: 'warning',
      RED: 'error',
      YELLOW: 'info'
    }
    return channel ? (
      <Chip size="small" color={colors[channel] || 'default'} label={channel} />
    ) : null
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>
        Consultas ADDS-JDIT
      </Typography>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Consultas
                </Typography>
                <Typography variant="h4">
                  {stats.totals?.queries || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Exitosas
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.totals?.successful || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Fallidas
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.totals?.failed || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Consultas Recientes
                </Typography>
                <Typography variant="h4">
                  {stats.recentQueries?.length || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab icon={<SearchIcon />} label="Nueva Consulta" />
          <Tab icon={<HistoryIcon />} label="Historial" />
        </Tabs>
      </Paper>

      {/* Tab 0: New Query */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Query Form */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Parametros de Busqueda
              </Typography>

              {/* Query Type Selection */}
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {Object.entries(queryTypeConfig).map(([key, config]) => {
                  const IconComponent = config.icon
                  return (
                    <Grid item xs={6} key={key}>
                      <Button
                        fullWidth
                        variant={queryType === key ? 'contained' : 'outlined'}
                        onClick={() => {
                          setQueryType(key)
                          setSearchValue('')
                        }}
                        startIcon={<IconComponent />}
                        sx={{
                          borderColor: queryType === key ? config.color : undefined,
                          bgcolor: queryType === key ? config.color : undefined,
                          '&:hover': {
                            borderColor: config.color,
                            bgcolor: queryType === key ? config.color : `${config.color}20`
                          }
                        }}
                        size="small"
                      >
                        {config.label}
                      </Button>
                    </Grid>
                  )
                })}
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Search Input */}
              <TextField
                fullWidth
                label={queryTypeConfig[queryType].label}
                placeholder={`Introduzca ${queryTypeConfig[queryType].label.toLowerCase()}...`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {renderQueryTypeIcon(queryType)}
                    </InputAdornment>
                  )
                }}
              />

              {/* Additional Params */}
              <TextField
                fullWidth
                type="date"
                label="Fecha Desde"
                value={additionalParams.dateFrom}
                onChange={(e) => setAdditionalParams(prev => ({ ...prev, dateFrom: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="date"
                label="Fecha Hasta"
                value={additionalParams.dateTo}
                onChange={(e) => setAdditionalParams(prev => ({ ...prev, dateTo: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                select
                label="Tipo Declaracion"
                value={additionalParams.declarationType}
                onChange={(e) => setAdditionalParams(prev => ({ ...prev, declarationType: e.target.value }))}
                sx={{ mb: 3 }}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="ENS">ENS</MenuItem>
                <MenuItem value="H1">H1 (DUA Importacion)</MenuItem>
                <MenuItem value="H7">H7 (Bajo Valor)</MenuItem>
                <MenuItem value="AES">AES (Exportacion)</MenuItem>
                <MenuItem value="NCTS">NCTS (Transito)</MenuItem>
              </TextField>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                onClick={handleSearch}
                disabled={!searchValue.trim() || loading}
              >
                {loading ? 'Consultando...' : 'Buscar'}
              </Button>
            </Paper>
          </Grid>

          {/* Results */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, minHeight: 500 }}>
              <Typography variant="h6" gutterBottom>
                Resultados
              </Typography>

              {!results && !loading && (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                  <SearchIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                  <Typography>
                    Seleccione un tipo de consulta e introduzca los parametros de busqueda
                  </Typography>
                </Box>
              )}

              {loading && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <CircularProgress size={48} />
                  <Typography sx={{ mt: 2 }}>
                    Consultando AEAT...
                  </Typography>
                </Box>
              )}

              {results && !loading && (
                <>
                  {results.success === false ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {results.error}
                    </Alert>
                  ) : (
                    <>
                      <Alert severity="success" sx={{ mb: 2 }}>
                        {results.count || results.results?.length || 0} resultado(s) encontrado(s)
                        {results.executionTime && ` en ${results.executionTime}ms`}
                      </Alert>

                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>MRN</TableCell>
                              <TableCell>Tipo</TableCell>
                              <TableCell>Estado</TableCell>
                              <TableCell>Canal</TableCell>
                              <TableCell>Aduana</TableCell>
                              <TableCell>Fecha</TableCell>
                              <TableCell>Acciones</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(results.results || []).map((result, idx) => (
                              <TableRow key={idx} hover>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={500}>
                                    {result.mrn}
                                  </Typography>
                                  {result.lrn && (
                                    <Typography variant="caption" color="textSecondary">
                                      LRN: {result.lrn}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {renderDeclarationTypeChip(result.declarationType)}
                                </TableCell>
                                <TableCell>
                                  <Chip size="small" label={result.status} />
                                </TableCell>
                                <TableCell>
                                  {renderChannelChip(result.channel)}
                                </TableCell>
                                <TableCell>
                                  {result.customsOffice?.code || '-'}
                                </TableCell>
                                <TableCell>
                                  {formatDate(result.submissionDate)}
                                </TableCell>
                                <TableCell>
                                  <Tooltip title="Ver detalle">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setSelectedResult(result)
                                        setDetailDialogOpen(true)
                                      }}
                                    >
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!results.results || results.results.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={7} align="center">
                                  <Typography color="textSecondary" sx={{ py: 2 }}>
                                    No se encontraron resultados
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: History */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Historial de Consultas
          </Typography>

          {historyLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID Consulta</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Parametros</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Resultados</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tiempo (ms)</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((query) => (
                    <TableRow key={query._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {query.queryId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {renderQueryTypeIcon(query.queryType)}
                          <Typography variant="body2">
                            {queryTypeConfig[query.queryType]?.label}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {query.searchParams?.billOfLading ||
                           query.searchParams?.containerNumber ||
                           query.searchParams?.mrn ||
                           query.searchParams?.eori ||
                           query.searchParams?.locationCode ||
                           '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {renderStatusChip(query.queryStatus)}
                      </TableCell>
                      <TableCell>
                        {query.resultsCount}
                      </TableCell>
                      <TableCell>
                        {formatDate(query.executedAt)}
                      </TableCell>
                      <TableCell>
                        {query.executionTime || '-'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Ver resultados">
                          <IconButton
                            size="small"
                            onClick={() => handleViewHistoryResult(query.queryId)}
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="textSecondary" sx={{ py: 4 }}>
                          No hay consultas en el historial
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.page}
            onPageChange={(e, newPage) => {
              setPagination(prev => ({ ...prev, page: newPage }))
              loadHistory()
            }}
            rowsPerPage={pagination.limit}
            onRowsPerPageChange={(e) => {
              setPagination(prev => ({
                ...prev,
                limit: parseInt(e.target.value, 10),
                page: 0
              }))
              loadHistory()
            }}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="Filas por pagina:"
          />
        </Paper>
      )}

      {/* Result Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Detalle de Declaracion: {selectedResult?.mrn}
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Informacion General
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="MRN" secondary={selectedResult.mrn} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="LRN" secondary={selectedResult.lrn || '-'} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Tipo" secondary={selectedResult.declarationType} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Estado" secondary={selectedResult.status} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Canal" secondary={selectedResult.channel || '-'} />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Fechas y Aduana
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Aduana" secondary={`${selectedResult.customsOffice?.code} - ${selectedResult.customsOffice?.name || ''}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Presentacion" secondary={formatDate(selectedResult.submissionDate)} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Aceptacion" secondary={formatDate(selectedResult.acceptanceDate)} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Levante" secondary={formatDate(selectedResult.releaseDate)} />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Partes
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Declarante"
                        secondary={`${selectedResult.declarant?.eori || ''} - ${selectedResult.declarant?.name || '-'}`}
                      />
                    </ListItem>
                    {selectedResult.carrier && (
                      <ListItem>
                        <ListItemText
                          primary="Transportista"
                          secondary={`${selectedResult.carrier.eori || ''} - ${selectedResult.carrier.name || '-'}`}
                        />
                      </ListItem>
                    )}
                    {selectedResult.consignee && (
                      <ListItem>
                        <ListItemText
                          primary="Destinatario"
                          secondary={`${selectedResult.consignee.eori || ''} - ${selectedResult.consignee.name || '-'}`}
                        />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Mercancia
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Contenedor" secondary={selectedResult.containerNumber || '-'} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Ref. Transporte" secondary={selectedResult.transportReference || '-'} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Peso Bruto" secondary={`${selectedResult.grossMass || '-'} kg`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Bultos" secondary={selectedResult.numberOfPackages || '-'} />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              {selectedResult.pendingActions?.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    <Typography variant="subtitle2" gutterBottom>
                      Acciones Pendientes:
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {selectedResult.pendingActions.map((action, idx) => (
                        <li key={idx}>
                          {action.description}
                          {action.deadline && ` (Plazo: ${formatDate(action.deadline)})`}
                        </li>
                      ))}
                    </ul>
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default QueryDashboard
