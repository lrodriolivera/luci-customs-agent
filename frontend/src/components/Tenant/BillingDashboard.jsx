import React, { useState, useEffect } from 'react';
import {
  CreditCardIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { billingAPI } from '../../services/api';

const BillingDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const PLAN_PRICES = { starter: 0, professional: 149, business: 349, enterprise: 799 };

  const loadBillingData = async () => {
    setLoading(true);
    try {
      // Fetch real subscription data from backend
      const subResponse = await billingAPI.getSubscription();
      const sub = subResponse.data?.data || subResponse.data || {};

      setBillingData({
        subscription: {
          plan: sub.plan || 'starter',
          status: sub.status || 'active',
          billingCycle: 'monthly',
          price: PLAN_PRICES[sub.plan] || 0,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
          trialEnd: sub.trialEnd
        },
        usage: null,
        nextInvoice: sub.currentPeriodEnd ? {
          date: sub.currentPeriodEnd,
          amount: Math.round((PLAN_PRICES[sub.plan] || 0) * 1.21 * 100) / 100,
          items: [
            { description: `Plan ${sub.plan || 'Starter'}`, amount: PLAN_PRICES[sub.plan] || 0 },
            { description: 'IVA (21%)', amount: Math.round((PLAN_PRICES[sub.plan] || 0) * 0.21 * 100) / 100 }
          ]
        } : null
      });

      setInvoices([]);
      setPaymentMethods([]);

      setPlans([
        {
          id: 'starter',
          name: 'Starter',
          price: 0,
          yearlyPrice: 0,
          features: ['5 declaraciones/mes', '1 usuario', 'Clasificacion TARIC con IA', 'Calculo de aranceles e IVA', 'Chat basico con asistente IA']
        },
        {
          id: 'professional',
          name: 'Professional',
          price: 149,
          yearlyPrice: 1490,
          features: ['50 declaraciones/mes', 'Hasta 5 usuarios', 'H1, H7, AES, NCTS, ENS completos', 'Envio directo a AEAT', 'PDF declaraciones (DUA oficial)', 'Portal de clientes']
        },
        {
          id: 'business',
          name: 'Business',
          price: 349,
          yearlyPrice: 3490,
          popular: true,
          features: ['200 declaraciones/mes', 'Hasta 15 usuarios', 'Todo de Professional', 'PUE SOIVRE / ROHS completo', 'API publica + analytics', 'Soporte prioritario']
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: 799,
          yearlyPrice: 7990,
          isCustom: true,
          features: ['Declaraciones ilimitadas', 'Usuarios ilimitados', 'Todo de Business', 'Integraciones custom (ERP, WMS)', 'Soporte dedicado + onboarding', 'SLA 99.9%']
        }
      ]);

    } catch (error) {
      console.error('Error loading billing data:', error);
      // Fallback to starter
      setBillingData({ subscription: { plan: 'starter', status: 'active', price: 0 } });
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Stripe checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setSuccessMsg('Suscripcion activada correctamente');
      window.history.replaceState({}, '', '/billing');
      loadBillingData();
    }
    if (params.get('cancelled') === 'true') {
      setSuccessMsg('Pago cancelado');
      window.history.replaceState({}, '', '/billing');
    }
  }, []);

  const handlePlanSelect = async (planId) => {
    if (planId === billingData?.subscription?.plan) return;

    if (planId === 'enterprise') {
      window.open('mailto:luci@strixai.es?subject=Plan Enterprise LUCI', '_blank');
      return;
    }

    try {
      setLoading(true);
      const response = await billingAPI.createCheckout(planId, billingCycle);
      const data = response.data?.data || response.data;

      if (data.freePlan) {
        await loadBillingData();
        setSuccessMsg('Plan actualizado a Starter');
        setShowUpgradeModal(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Error al crear la sesion de pago. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleManagePayments = async () => {
    try {
      const response = await billingAPI.createCustomerPortal();
      const data = response.data?.data || response.data;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      alert('Para gestionar pagos necesitas una suscripcion activa de pago.');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      overdue: 'bg-red-100 text-red-700',
      active: 'bg-green-100 text-green-700',
      trialing: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-gray-100 text-gray-700'
    };
    const labels = {
      paid: 'Pagada',
      pending: 'Pendiente',
      overdue: 'Vencida',
      active: 'Activa',
      trialing: 'Prueba',
      cancelled: 'Cancelada'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const UsageBar = ({ used, limit, percentage, label, unit = '' }) => (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">
          {used}{unit} / {limit === -1 ? 'Ilimitado' : `${limit}${unit}`}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            percentage > 90 ? 'bg-red-500' : percentage > 75 ? 'bg-yellow-500' : 'bg-violet-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturacion</h1>
          <p className="text-gray-500 mt-1">
            Gestiona tu suscripcion y metodos de pago
          </p>
        </div>
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2"
        >
          <ArrowUpIcon className="h-4 w-4" />
          Cambiar Plan
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-700">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Resumen', icon: ChartBarIcon },
            { id: 'invoices', name: 'Facturas', icon: DocumentTextIcon },
            { id: 'payment', name: 'Metodos de Pago', icon: CreditCardIcon },
            { id: 'plans', name: 'Planes', icon: StarIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Subscription Card */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-200 text-sm">Plan Actual</p>
                <h2 className="text-3xl font-bold capitalize">{billingData?.subscription?.plan}</h2>
                <p className="text-violet-200 mt-1">
                  {getStatusBadge(billingData?.subscription?.status)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold">{billingData?.subscription?.price}EUR</p>
                <p className="text-violet-200">/mes</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-violet-400/30 flex items-center justify-between">
              <div>
                <p className="text-violet-200 text-sm">Proxima facturacion</p>
                <p className="font-medium">{new Date(billingData?.subscription?.currentPeriodEnd).toLocaleDateString('es-ES')}</p>
              </div>
              <div className="text-right">
                <p className="text-violet-200 text-sm">Importe</p>
                <p className="font-medium">{billingData?.nextInvoice?.amount} EUR</p>
              </div>
            </div>
          </div>

          {/* Usage Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Uso del Periodo Actual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <UsageBar
                used={billingData?.usage?.declarations?.used}
                limit={billingData?.usage?.declarations?.limit}
                percentage={billingData?.usage?.declarations?.percentage}
                label="Declaraciones"
              />
              <UsageBar
                used={billingData?.usage?.expeditions?.used}
                limit={billingData?.usage?.expeditions?.limit}
                percentage={billingData?.usage?.expeditions?.percentage}
                label="Expedientes"
              />
              <UsageBar
                used={billingData?.usage?.users?.used}
                limit={billingData?.usage?.users?.limit}
                percentage={billingData?.usage?.users?.percentage}
                label="Usuarios"
              />
              <UsageBar
                used={billingData?.usage?.storage?.used}
                limit={billingData?.usage?.storage?.limit}
                percentage={billingData?.usage?.storage?.percentage}
                label="Almacenamiento"
                unit=" GB"
              />
              <UsageBar
                used={billingData?.usage?.apiCalls?.used}
                limit={billingData?.usage?.apiCalls?.limit}
                percentage={billingData?.usage?.apiCalls?.percentage}
                label="Llamadas API"
              />
              <UsageBar
                used={billingData?.usage?.luciQueries?.used}
                limit={billingData?.usage?.luciQueries?.limit}
                percentage={billingData?.usage?.luciQueries?.percentage}
                label="Consultas LUCI"
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Facturas Pagadas</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {invoices.filter(i => i.status === 'paid').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CreditCardIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Metodos de Pago</p>
                  <p className="text-2xl font-bold text-gray-900">{paymentMethods.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-100 rounded-lg">
                  <ClockIcon className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dias Restantes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.ceil((new Date(billingData?.subscription?.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Historial de Facturas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Importe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{invoice.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {new Date(invoice.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize">{invoice.plan}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {invoice.amount.toFixed(2)} EUR
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className="text-violet-600 hover:text-violet-800">
                        Descargar PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Methods Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <CreditCardIcon className="h-16 w-16 text-violet-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Gestion de Pagos</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Los metodos de pago, facturas y datos de facturacion se gestionan de forma segura a traves del portal de Stripe.
            </p>
            <button
              onClick={handleManagePayments}
              className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
            >
              Abrir Portal de Pagos
            </button>
            <p className="text-xs text-gray-400 mt-3">Procesado de forma segura por Stripe</p>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center mb-8 gap-3">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Mensual</span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${billingCycle === 'yearly' ? 'bg-violet-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${billingCycle === 'yearly' ? 'translate-x-7' : ''}`} />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-400'}`}>
              Anual <span className="text-green-600 text-xs font-bold">-17%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                plan.popular ? 'ring-2 ring-violet-500' : ''
              }`}
            >
              {plan.popular && (
                <div className="bg-violet-500 text-white text-center py-1 text-sm font-medium">
                  Mas Popular
                </div>
              )}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-4">
                  {plan.isCustom ? (
                    <>
                      <span className="text-lg text-gray-500">Desde </span>
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500"> EUR/mes</span>
                    </>
                  ) : billingCycle === 'yearly' && plan.yearlyPrice ? (
                    <>
                      <span className="text-4xl font-bold text-gray-900">{Math.round(plan.yearlyPrice / 12)}</span>
                      <span className="text-gray-500"> EUR/mes</span>
                      <div className="text-xs text-gray-400 mt-1">{plan.yearlyPrice} EUR/ano</div>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500"> EUR/mes</span>
                    </>
                  )}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-6 w-full py-2 rounded-lg font-medium ${
                    billingData?.subscription?.plan === plan.id
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : plan.popular
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={billingData?.subscription?.plan === plan.id}
                  onClick={() => handlePlanSelect(plan.id)}
                >
                  {billingData?.subscription?.plan === plan.id ? 'Plan Actual' : plan.isCustom ? 'Contactar Ventas' : 'Seleccionar'}
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowUpgradeModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cambiar Plan</h3>
              <p className="text-gray-500 mb-6">
                Selecciona el plan al que deseas cambiar. Los cambios se aplicaran inmediatamente para upgrades
                o al final del periodo para downgrades.
              </p>
              <div className="space-y-3">
                {plans.filter(p => p.id !== billingData?.subscription?.plan).map(plan => (
                  <button
                    key={plan.id}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-violet-500 hover:bg-violet-50 text-left"
                    onClick={() => {
                      setShowUpgradeModal(false);
                      handlePlanSelect(plan.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{plan.name}</span>
                        <span className="text-gray-500 ml-2">{plan.isCustom ? 'Desde ' : ''}{plan.price} EUR/mes</span>
                      </div>
                      {plan.price > billingData?.subscription?.price ? (
                        <ArrowUpIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDownIcon className="h-5 w-5 text-orange-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal removed - managed via Stripe Customer Portal */}
    </div>
  );
};

export default BillingDashboard;
