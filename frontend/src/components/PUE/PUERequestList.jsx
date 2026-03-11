import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, IconButton, Tooltip, LinearProgress, Button
} from '@mui/material'
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { pueAPI } from '../../services/api'
import { useTranslation } from 'react-i18next'

// Status configuration
const statusConfig = {
  draft: { color: 'default', label: 'Borrador' },
  validated: { color: 'info', label: 'Validada' },
  submitted: { color: 'primary', label: 'Enviada' },
  registered: { color: 'secondary', label: 'Registrada' },
  pending_documents: { color: 'warning', label: 'Pend. Documentos' },
  pending_inspection: { color: 'warning', label: 'Pend. Inspeccion' },
  inspection_scheduled: { color: 'info', label: 'Insp. Programada' },
  in_inspection: { color: 'info', label: 'En Inspeccion' },
  pending_lab: { color: 'warning', label: 'Pend. Laboratorio' },
  approved: { color: 'success', label: 'Aprobada' },
  approved_conditions: { color: 'success', label: 'Aprob. Condiciones' },
  rejected: { color: 'error', label: 'Rechazada' },
  cancelled: { color: 'default', label: 'Cancelada' },
  expired: { color: 'error', label: 'Caducada' }
}

// Type colors
const typeColors = {
  ROHS: '#FF5722',
  COM: '#2196F3',
  ECO: '#4CAF50',
  CAL: '#9C27B0'
}

const PUERequestList = ({ pueType, onRefresh, onCreateNew }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 20,
    total: 0
  })
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    loadRequests()
  }, [pagination.page, pagination.limit, filters, pueType])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page + 1,
        limit: pagination.limit,
        ...filters
      }
      if (pueType) {
        params.pueType = pueType
      }

      const response = await pueAPI.list(params)
      if (response.data.success) {
        setRequests(response.data.data)
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }))
      }
    } catch (error) {
      console.error('Error loading PUE requests:', error)
    } finally {
      setLoading(false)
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

  const handleView = (request) => {
    navigate(`/pue/${request._id}`)
  }

  const handleSubmit = async (request) => {
    if (!window.confirm('Esta seguro de enviar esta solicitud a AEAT/SOIVRE?')) return

    try {
      const response = await pueAPI.submit(request._id)
      if (response.data.success) {
        loadRequests()
        if (onRefresh) onRefresh()
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Error al enviar la solicitud')
    }
  }

  const handleCancel = async (request) => {
    const reason = window.prompt('Motivo de cancelacion:')
    if (!reason) return

    try {
      const response = await pueAPI.cancel(request._id, reason)
      if (response.data.success) {
        loadRequests()
        if (onRefresh) onRefresh()
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
      alert('Error al cancelar la solicitud')
    }
  }

  const renderStatusChip = (status) => {
    const config = statusConfig[status] || { color: 'default', label: status }
    return <Chip size="small" color={config.color} label={config.label} />
  }

  const renderTypeChip = (type) => {
    return (
      <Chip
        size="small"
        label={type}
        sx={{
          bgcolor: typeColors[type] + '20',
          color: typeColors[type],
          fontWeight: 600
        }}
      />
    )
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const isDeadlineNear = (deadline) => {
    if (!deadline) return false
    const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
    return days <= 3 && days >= 0
  }

  const isDeadlineOverdue = (deadline) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por referencia, operador, TARIC..."
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
          <Grid item xs={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => onCreateNew && onCreateNew(pueType)}
            >
              Nueva
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Referencia</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Operador</TableCell>
                <TableCell>Mercancias</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Oficina SOIVRE</TableCell>
                <TableCell>Plazo</TableCell>
                <TableCell>Creado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {req.reference}
                    </Typography>
                    {req.pueReference && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {req.pueReference}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {renderTypeChip(req.pueType)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {req.operator?.name || '-'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {req.operator?.eori || req.operator?.nif || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {req.goods?.length || 0} items
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {req.totals?.grossMass ? `${req.totals.grossMass.toFixed(2)} kg` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {renderStatusChip(req.status)}
                  </TableCell>
                  <TableCell>
                    {req.soivreOffice?.name || req.soivreOffice?.code || '-'}
                  </TableCell>
                  <TableCell>
                    {req.deadline && (
                      <Chip
                        size="small"
                        label={formatDate(req.deadline)}
                        color={isDeadlineOverdue(req.deadline) ? 'error' : isDeadlineNear(req.deadline) ? 'warning' : 'default'}
                        variant={isDeadlineOverdue(req.deadline) || isDeadlineNear(req.deadline) ? 'filled' : 'outlined'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDate(req.createdAt)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Ver detalle">
                      <IconButton size="small" onClick={() => handleView(req)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {req.status === 'draft' && (
                      <>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleView(req)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Enviar">
                          <IconButton size="small" color="primary" onClick={() => handleSubmit(req)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {['draft', 'validated', 'submitted', 'registered', 'pending_documents'].includes(req.status) && (
                      <Tooltip title="Cancelar">
                        <IconButton size="small" color="error" onClick={() => handleCancel(req)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="textSecondary" sx={{ py: 4 }}>
                      No se encontraron solicitudes PUE
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
    </Box>
  )
}

export default PUERequestList
