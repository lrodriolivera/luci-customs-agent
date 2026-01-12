import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layout
import MainLayout from './components/Layout/MainLayout'
import PortalLayout from './components/Layout/PortalLayout'

// Agent/Dashboard Pages
import Dashboard from './components/Dashboard/Dashboard'
import ExpeditionList from './components/Expeditions/ExpeditionList'
import ExpeditionDetail from './components/Expeditions/ExpeditionDetail'
import ExpeditionNew from './components/Expeditions/ExpeditionNew'
import ClassificationTool from './components/Classification/ClassificationTool'
import DeclarationGenerator from './components/Declarations/DeclarationGenerator'
import DutyCalculator from './components/Calculations/DutyCalculator'
import ChatAssistant from './components/Chat/ChatAssistant'
import RequirementsList from './components/Requirements/RequirementsList'
import ChannelDashboard from './components/Channels/ChannelDashboard'

// Portal Pages (Client)
import PortalHome from './components/Portal/PortalHome'
import PortalDocuments from './components/Portal/PortalDocuments'
import PortalChat from './components/Portal/PortalChat'
import PortalStatus from './components/Portal/PortalStatus'

// Auth
import Login from './components/Auth/Login'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luci"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />

      {/* Client Portal Routes (Public with token) */}
      <Route path="/portal/:token" element={<PortalLayout />}>
        <Route index element={<PortalHome />} />
        <Route path="documents" element={<PortalDocuments />} />
        <Route path="chat" element={<PortalChat />} />
        <Route path="status" element={<PortalStatus />} />
      </Route>

      {/* Protected Agent Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="expeditions" element={<ExpeditionList />} />
        <Route path="expeditions/new" element={<ExpeditionNew />} />
        <Route path="expeditions/:id" element={<ExpeditionDetail />} />
        <Route path="classification" element={<ClassificationTool />} />
        <Route path="declarations" element={<DeclarationGenerator />} />
        <Route path="calculator" element={<DutyCalculator />} />
        <Route path="assistant" element={<ChatAssistant />} />
        <Route path="requirements" element={<RequirementsList />} />
        <Route path="channels" element={<ChannelDashboard />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
