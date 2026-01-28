import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Tabs, Tab, Paper, Grid, Card, CardContent,
  Button, Chip, Alert, CircularProgress
} from '@mui/material'
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material'
import { pueAPI } from '../../services/api'
import PUERequestList from './PUERequestList'
import PUERequestForm from './PUERequestForm'

// PUE Type configuration
const pueTypeConfig = {
  ROHS: {
    color: '#FF5722',
    bgColor: '#FBE9E7',
    label: 'ROHS/RAEE',
    description: 'Restriccion sustancias peligrosas',
    icon: '⚡'
  },
  COM: {
    color: '#2196F3',
    bgColor: '#E3F2FD',
    label: 'COM',
    description: 'Seguridad productos industriales',
    icon: '🛡️'
  },
  ECO: {
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    label: 'ECO',
    description: 'Productos ecologicos',
    icon: '🌿'
  },
  CAL: {
    color: '#9C27B0',
    bgColor: '#F3E5F5',
    label: 'CAL',
    description: 'Calidad comercial',
    icon: '✓'
  }
}

const PUEManager = () => {
  const [selectedTab, setSelectedTab] = useState(0)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await pueAPI.getStats()
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (err) {
      console.error('Error loading PUE stats:', err)
      setError('Error cargando estadisticas')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue)
    setSelectedType(newValue === 0 ? null : Object.keys(pueTypeConfig)[newValue - 1])
  }

  const handleCreateNew = (type = null) => {
    setSelectedType(type)
    setCreateDialogOpen(true)
  }

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false)
    setRefreshKey(prev => prev + 1)
    loadStats()
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    loadStats()
  }

  const getTypeStats = (type) => {
    const typeData = stats?.byType?.find(t => t._id === type)
    return {
      total: typeData?.count || 0,
      approved: typeData?.approved || 0,
      rejected: typeData?.rejected || 0,
      pending: typeData?.pending || 0
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            PUE - Punto Unico de Entrada
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Gestion de controles SOIVRE (ROHS, COM, ECO, CAL)
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ mr: 1 }}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleCreateNew()}
          >
            Nueva Solicitud
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Summary Card */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography color="textSecondary" variant="body2" gutterBottom>
                      Total Solicitudes
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 600 }}>
                      {stats?.totals?.total || 0}
                    </Typography>
                  </Box>
                  <AssignmentIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Chip
                    size="small"
                    icon={<CheckIcon />}
                    label={`${stats?.totals?.approved || 0} Aprobadas`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    icon={<ScheduleIcon />}
                    label={`${stats?.totals?.pending || 0} Pendientes`}
                    color="warning"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Type Cards */}
          {Object.entries(pueTypeConfig).map(([type, config]) => {
            const typeStats = getTypeStats(type)
            return (
              <Grid item xs={12} sm={6} md={2.25} key={type}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: selectedTab === Object.keys(pueTypeConfig).indexOf(type) + 1 ? `2px solid ${config.color}` : 'none',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => setSelectedTab(Object.keys(pueTypeConfig).indexOf(type) + 1)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          color: config.color,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        <span>{config.icon}</span>
                        {config.label}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {typeStats.total}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {config.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {typeStats.approved > 0 && (
                        <Chip
                          size="small"
                          label={typeStats.approved}
                          sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontSize: '0.7rem' }}
                        />
                      )}
                      {typeStats.pending > 0 && (
                        <Chip
                          size="small"
                          label={typeStats.pending}
                          sx={{ bgcolor: '#FFF3E0', color: '#EF6C00', fontSize: '0.7rem' }}
                        />
                      )}
                      {typeStats.rejected > 0 && (
                        <Chip
                          size="small"
                          label={typeStats.rejected}
                          sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Alerts */}
      {stats?.pendingInspections > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          Hay <strong>{stats.pendingInspections}</strong> solicitudes pendientes de inspeccion
        </Alert>
      )}

      {stats?.overdueDeadlines > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Hay <strong>{stats.overdueDeadlines}</strong> solicitudes con plazos vencidos
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { minHeight: 48 }
          }}
        >
          <Tab label="Todas" />
          {Object.entries(pueTypeConfig).map(([type, config]) => (
            <Tab
              key={type}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{config.icon}</span>
                  {config.label}
                </Box>
              }
              sx={{ color: config.color }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Request List */}
      <PUERequestList
        key={refreshKey}
        pueType={selectedType}
        onRefresh={handleRefresh}
        onCreateNew={handleCreateNew}
      />

      {/* Create Dialog */}
      <PUERequestForm
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
        initialType={selectedType}
      />
    </Box>
  )
}

export default PUEManager
