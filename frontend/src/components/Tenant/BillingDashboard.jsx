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

const BillingDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      // Simulated data - replace with API calls
      setBillingData({
        subscription: {
          plan: 'professional',
          status: 'active',
          billingCycle: 'monthly',
          price: 149,
          currentPeriodStart: '2026-01-20',
          currentPeriodEnd: '2026-02-20',
          cancelAtPeriodEnd: false
        },
        usage: {
          declarations: { used: 287, limit: 500, percentage: 57.4 },
          expeditions: { used: 145, limit: 250, percentage: 58 },
          users: { used: 12, limit: 20, percentage: 60 },
          storage: { used: 23.5, limit: 50, unit: 'GB', percentage: 47 },
          apiCalls: { used: 2340, limit: 5000, percentage: 46.8 },
          luciQueries: { used: 856, limit: 2000, percentage: 42.8 }
        },
        nextInvoice: {
          date: '2026-02-20',
          amount: 180.29,
          items: [
            { description: 'Plan Professional', amount: 149 },
            { description: 'IVA (21%)', amount: 31.29 }
          ]
        }
      });

      setInvoices([
        { id: 'INV-2026-00012', date: '2026-01-20', amount: 180.29, status: 'paid', plan: 'professional' },
        { id: 'INV-2025-00011', date: '2025-12-20', amount: 180.29, status: 'paid', plan: 'professional' },
        { id: 'INV-2025-00010', date: '2025-11-20', amount: 180.29, status: 'paid', plan: 'professional' },
        { id: 'INV-2025-00009', date: '2025-10-20', amount: 59.29, status: 'paid', plan: 'starter' },
        { id: 'INV-2025-00008', date: '2025-09-20', amount: 59.29, status: 'paid', plan: 'starter' }
      ]);

      setPaymentMethods([
        { id: 'pm-1', type: 'card', brand: 'visa', last4: '4242', expiryMonth: 12, expiryYear: 2027, isDefault: true },
        { id: 'pm-2', type: 'sepa', iban: 'ES91****1234', bankName: 'BBVA', isDefault: false }
      ]);

      setPlans([
        {
          id: 'free',
          name: 'Free',
          price: 0,
          billingCycle: 'monthly',
          features: ['20 declaraciones/mes', '2 usuarios', '1 GB almacenamiento', 'Soporte por email']
        },
        {
          id: 'starter',
          name: 'Starter',
          price: 49,
          billingCycle: 'monthly',
          features: ['100 declaraciones/mes', '5 usuarios', '10 GB almacenamiento', 'Analytics basico', 'Soporte estandar']
        },
        {
          id: 'professional',
          name: 'Professional',
          price: 149,
          billingCycle: 'monthly',
          popular: true,
          features: ['500 declaraciones/mes', '20 usuarios', '50 GB almacenamiento', 'Analytics avanzado', 'API access', 'Soporte prioritario']
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: 499,
          billingCycle: 'monthly',
          features: ['Ilimitadas declaraciones', 'Usuarios ilimitados', 'Almacenamiento ilimitado', 'Todo incluido', 'SSO', 'SLA garantizado']
        }
      ]);

    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
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
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Metodos de Pago</h3>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar Metodo
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {paymentMethods.map(method => (
                <div key={method.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${
                      method.type === 'card' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <CreditCardIcon className={`h-6 w-6 ${
                        method.type === 'card' ? 'text-blue-600' : 'text-green-600'
                      }`} />
                    </div>
                    <div>
                      {method.type === 'card' ? (
                        <>
                          <p className="font-medium text-gray-900 capitalize">
                            {method.brand} ****{method.last4}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expira {method.expiryMonth}/{method.expiryYear}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">
                            SEPA - {method.iban}
                          </p>
                          <p className="text-sm text-gray-500">{method.bankName}</p>
                        </>
                      )}
                    </div>
                    {method.isDefault && (
                      <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                        Por defecto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
                        Hacer principal
                      </button>
                    )}
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Datos de Facturacion</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razon Social
                </label>
                <input
                  type="text"
                  defaultValue="Agencia Aduanera Demo S.L."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NIF/CIF
                </label>
                <input
                  type="text"
                  defaultValue="B12345678"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Direccion de Facturacion
                </label>
                <input
                  type="text"
                  defaultValue="Calle Principal 123, 08001 Barcelona"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de Facturacion
                </label>
                <input
                  type="email"
                  defaultValue="facturacion@demo-agency.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              Guardar Datos
            </button>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
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
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">EUR/mes</span>
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
                >
                  {billingData?.subscription?.plan === plan.id ? 'Plan Actual' : 'Seleccionar'}
                </button>
              </div>
            </div>
          ))}
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
                      // Handle plan change
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{plan.name}</span>
                        <span className="text-gray-500 ml-2">{plan.price} EUR/mes</span>
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

      {/* Add Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPaymentModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Agregar Metodo de Pago</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button className="flex-1 p-4 border-2 border-violet-500 bg-violet-50 rounded-lg text-center">
                    <CreditCardIcon className="h-8 w-8 mx-auto text-violet-600" />
                    <span className="block mt-2 font-medium">Tarjeta</span>
                  </button>
                  <button className="flex-1 p-4 border border-gray-200 rounded-lg text-center hover:border-violet-500">
                    <DocumentTextIcon className="h-8 w-8 mx-auto text-gray-400" />
                    <span className="block mt-2 font-medium">SEPA</span>
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numero de Tarjeta
                  </label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha Expiracion
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300 text-violet-600" />
                  <span className="text-sm text-gray-700">Establecer como metodo por defecto</span>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  Agregar Tarjeta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingDashboard;
