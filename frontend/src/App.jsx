import React from 'react'
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
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
import H7DeclarationList from './components/H7/H7DeclarationList'
import GuaranteeManager from './components/Guarantees/GuaranteeManager'
import SpecialRegimeManager from './components/SpecialRegimes/SpecialRegimeManager'
import TransitManager from './components/Transit/TransitManager'
import RulesEngineAnalyzer from './components/RulesEngine/RulesEngineAnalyzer'
import PreferencesCalculator from './components/RulesEngine/PreferencesCalculator'
import ExciseDutiesCalculator from './components/RulesEngine/ExciseDutiesCalculator'
import QuotaManager from './components/RulesEngine/QuotaManager'
import OEAManager from './components/OEA/OEAManager'
import RegulationSearch from './components/Regulations/RegulationSearch'
import DeadlineManager from './components/Deadlines/DeadlineManager'
import InspectionManager from './components/Inspections/InspectionManager'
import CommunicationsManager from './components/Communications/CommunicationsManager'
import IntegrationsManager from './components/Integrations/IntegrationsManager'

// ENS/ICS2 Declarations
import { ENSDeclarationList, ENSDeclarationDetail, ENSDeclarationForm } from './components/ENS'

// Query Services (ADDS-JDIT)
import { QueryDashboard } from './components/Queries'

// PUE (Punto Unico de Entrada)
import { PUEManager, PUERequestDetail } from './components/PUE'

// AEAT Real Integration (Phase 6.1)
import { CertificateManager, AEATStatusMonitor } from './components/AEATReal'

// Analytics & BI (Phase 6.2)
import { AnalyticsDashboard, ReportsManager } from './components/Analytics'

// Tenant & Multi-Tenancy (Phase 6.3)
import { TenantSettings, BillingDashboard } from './components/Tenant'

// ML Advanced (Phase 6.5)
import { MLInsights } from './components/ML'

// Admin Panel
import AdminPanel from './components/Admin/AdminPanel'

// Portal Pages (Client)
import PortalHome from './components/Portal/PortalHome'
import PortalDocuments from './components/Portal/PortalDocuments'
import PortalChat from './components/Portal/PortalChat'
import PortalStatus from './components/Portal/PortalStatus'

// Landing Page
import LandingPage from './components/Landing/LandingPage'

// Auth
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import ForgotPassword from './components/Auth/ForgotPassword'
import ResetPassword from './components/Auth/ResetPassword'

// Legal
import PrivacyPolicy from './components/Legal/PrivacyPolicy'
import TermsOfService from './components/Legal/TermsOfService'
import CookiePolicy from './components/Legal/CookiePolicy'
import CookieBanner from './components/Legal/CookieBanner'
import NotFound from './components/NotFound'
// ENS Edit Page wrapper
const ENSEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  return <ENSDeclarationForm declarationId={id} onSuccess={() => navigate(`/ens/${id}`)} onClose={() => navigate(`/ens/${id}`)} />
}

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
    <>
    <CookieBanner />
    <Routes>
      {/* Public Routes */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/cookies" element={<CookiePolicy />} />

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
        <Route path="h7" element={<H7DeclarationList />} />
        <Route path="guarantees" element={<GuaranteeManager />} />
        <Route path="special-regimes" element={<SpecialRegimeManager />} />
        <Route path="transit" element={<TransitManager />} />
        <Route path="rules-engine" element={<RulesEngineAnalyzer />} />
        <Route path="preferences" element={<PreferencesCalculator />} />
        <Route path="excise-duties" element={<ExciseDutiesCalculator />} />
        <Route path="quotas" element={<QuotaManager />} />
        <Route path="oea" element={<OEAManager />} />
        <Route path="regulations" element={<RegulationSearch />} />
        <Route path="deadlines" element={<DeadlineManager />} />
        <Route path="inspections" element={<InspectionManager />} />
        <Route path="communications" element={<CommunicationsManager />} />
        <Route path="integrations" element={<IntegrationsManager />} />

        {/* ENS/ICS2 Declarations */}
        <Route path="ens" element={<ENSDeclarationList />} />
        <Route path="ens/:id" element={<ENSDeclarationDetail />} />
        <Route path="ens/:id/edit" element={<ENSEditPage />} />

        {/* Query Services (ADDS-JDIT) */}
        <Route path="queries" element={<QueryDashboard />} />

        {/* PUE (Punto Unico de Entrada) */}
        <Route path="pue" element={<PUEManager />} />
        <Route path="pue/:id" element={<PUERequestDetail />} />

        {/* AEAT Real Integration (Phase 6.1) */}
        <Route path="aeat/certificates" element={<CertificateManager />} />
        <Route path="aeat/monitor" element={<AEATStatusMonitor />} />

        {/* Analytics & BI (Phase 6.2) */}
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="analytics/reports" element={<ReportsManager />} />

        {/* Tenant & Multi-Tenancy (Phase 6.3) */}
        <Route path="settings" element={<TenantSettings />} />
        <Route path="billing" element={<BillingDashboard />} />

        {/* ML Advanced (Phase 6.5) */}
        <Route path="ml-insights" element={<MLInsights />} />

        {/* Admin Panel */}
        <Route path="admin" element={<AdminPanel />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}

export default App
