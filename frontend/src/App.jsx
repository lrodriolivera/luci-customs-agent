import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Eager: critical above-the-fold / auth
import MainLayout from './components/Layout/MainLayout'
import PortalLayout from './components/Layout/PortalLayout'
import Dashboard from './components/Dashboard/Dashboard'
import Login from './components/Auth/Login'
import CookieBanner from './components/Legal/CookieBanner'
import NotFound from './components/NotFound'

// Lazy: everything else
const Register = lazy(() => import('./components/Auth/Register'))
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./components/Auth/ResetPassword'))
const LandingPage = lazy(() => import('./components/Landing/LandingPage'))
const PrivacyPolicy = lazy(() => import('./components/Legal/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./components/Legal/TermsOfService'))
const CookiePolicy = lazy(() => import('./components/Legal/CookiePolicy'))

const ExpeditionList = lazy(() => import('./components/Expeditions/ExpeditionList'))
const ExpeditionDetail = lazy(() => import('./components/Expeditions/ExpeditionDetail'))
const ExpeditionNew = lazy(() => import('./components/Expeditions/ExpeditionNew'))
const ClassificationTool = lazy(() => import('./components/Classification/ClassificationTool'))
const DeclarationGenerator = lazy(() => import('./components/Declarations/DeclarationGenerator'))
const H1DirectForm = lazy(() => import('./components/Declarations/H1DirectForm'))
const DutyCalculator = lazy(() => import('./components/Calculations/DutyCalculator'))
const ChatAssistant = lazy(() => import('./components/Chat/ChatAssistant'))
const RequirementsList = lazy(() => import('./components/Requirements/RequirementsList'))
const ChannelDashboard = lazy(() => import('./components/Channels/ChannelDashboard'))
const H7DeclarationList = lazy(() => import('./components/H7/H7DeclarationList'))
const H7DeclarationDetail = lazy(() => import('./components/H7/H7DeclarationDetail'))
const H7DirectForm = lazy(() => import('./components/H7/H7DirectForm'))
const GuaranteeManager = lazy(() => import('./components/Guarantees/GuaranteeManager'))
const SpecialRegimeManager = lazy(() => import('./components/SpecialRegimes/SpecialRegimeManager'))
const TransitManager = lazy(() => import('./components/Transit/TransitManager'))
const RulesEngineAnalyzer = lazy(() => import('./components/RulesEngine/RulesEngineAnalyzer'))
const PreferencesCalculator = lazy(() => import('./components/RulesEngine/PreferencesCalculator'))
const ExciseDutiesCalculator = lazy(() => import('./components/RulesEngine/ExciseDutiesCalculator'))
const QuotaManager = lazy(() => import('./components/RulesEngine/QuotaManager'))
const OEAManager = lazy(() => import('./components/OEA/OEAManager'))
const RegulationSearch = lazy(() => import('./components/Regulations/RegulationSearch'))
const DeadlineManager = lazy(() => import('./components/Deadlines/DeadlineManager'))
const InspectionManager = lazy(() => import('./components/Inspections/InspectionManager'))
const CommunicationsManager = lazy(() => import('./components/Communications/CommunicationsManager'))
const IntegrationsManager = lazy(() => import('./components/Integrations/IntegrationsManager'))

// Named exports need .then destructuring
const ENSDeclarationList = lazy(() => import('./components/ENS').then(m => ({ default: m.ENSDeclarationList })))
const ENSDeclarationDetail = lazy(() => import('./components/ENS').then(m => ({ default: m.ENSDeclarationDetail })))
const ENSDeclarationForm = lazy(() => import('./components/ENS').then(m => ({ default: m.ENSDeclarationForm })))
const QueryDashboard = lazy(() => import('./components/Queries').then(m => ({ default: m.QueryDashboard })))
const PUEManager = lazy(() => import('./components/PUE').then(m => ({ default: m.PUEManager })))
const PUERequestDetail = lazy(() => import('./components/PUE').then(m => ({ default: m.PUERequestDetail })))
const CertificateManager = lazy(() => import('./components/AEATReal').then(m => ({ default: m.CertificateManager })))
const AEATStatusMonitor = lazy(() => import('./components/AEATReal').then(m => ({ default: m.AEATStatusMonitor })))
const AnalyticsDashboard = lazy(() => import('./components/Analytics').then(m => ({ default: m.AnalyticsDashboard })))
const ReportsManager = lazy(() => import('./components/Analytics').then(m => ({ default: m.ReportsManager })))
const TenantSettings = lazy(() => import('./components/Tenant').then(m => ({ default: m.TenantSettings })))
const MLInsights = lazy(() => import('./components/ML').then(m => ({ default: m.MLInsights })))

const NLExpeditionPanel = lazy(() => import('./components/NL/NLExpeditionPanel'))
const AdminPanel = lazy(() => import('./components/Admin/AdminPanel'))
const PortalHome = lazy(() => import('./components/Portal/PortalHome'))
const PortalDocuments = lazy(() => import('./components/Portal/PortalDocuments'))
const PortalChat = lazy(() => import('./components/Portal/PortalChat'))
const PortalStatus = lazy(() => import('./components/Portal/PortalStatus'))

// ENS Edit wrapper — must be defined after ENSDeclarationForm is referenced
const ENSEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  return <ENSDeclarationForm declarationId={id} onSuccess={() => navigate(`/ens/${id}`)} onClose={() => navigate(`/ens/${id}`)} />
}

const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-luci" aria-label="Cargando" />
  </div>
)

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-luci" aria-label="Cargando" />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <>
      <CookieBanner />
      <Suspense fallback={<RouteFallback />}>
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
            <Route path="declarations/h1/new" element={<H1DirectForm />} />
            <Route path="calculator" element={<DutyCalculator />} />
            <Route path="assistant" element={<ChatAssistant />} />
            <Route path="requirements" element={<RequirementsList />} />
            <Route path="channels" element={<ChannelDashboard />} />
            <Route path="h7" element={<H7DeclarationList />} />
            <Route path="h7/new" element={<H7DirectForm />} />
            <Route path="h7/:id" element={<H7DeclarationDetail />} />
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

            {/* PUE */}
            <Route path="pue" element={<PUEManager />} />
            <Route path="pue/:id" element={<PUERequestDetail />} />

            {/* AEAT Real Integration */}
            <Route path="aeat/certificates" element={<CertificateManager />} />
            <Route path="aeat/monitor" element={<AEATStatusMonitor />} />

            {/* Analytics & BI */}
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="analytics/reports" element={<ReportsManager />} />

            {/* Tenant */}
            <Route path="settings" element={<TenantSettings />} />

            {/* ML Advanced */}
            <Route path="ml-insights" element={<MLInsights />} />

            {/* NL Customs */}
            <Route path="nl-customs" element={<NLExpeditionPanel />} />

            {/* Admin */}
            <Route path="admin" element={<AdminPanel />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
