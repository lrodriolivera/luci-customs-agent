/**
 * Portal Payments Component
 * Phase 6.7: Portal Cliente Avanzado
 * Handles payment display and Stripe checkout
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  Check,
  Clock,
  AlertCircle,
  ExternalLink,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { portalAPI } from '../../services/api';

const STATUS_CONFIG = {
  pending: { color: 'yellow', icon: Clock, text: 'Pendiente' },
  processing: { color: 'blue', icon: RefreshCw, text: 'Procesando' },
  completed: { color: 'green', icon: Check, text: 'Completado' },
  failed: { color: 'red', icon: AlertCircle, text: 'Fallido' },
  refunded: { color: 'gray', icon: RefreshCw, text: 'Reembolsado' }
};

const PortalPayments = ({ token, expedition }) => {
  const [payments, setPayments] = useState({ pending: null, history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [expandedPayment, setExpandedPayment] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, [token]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await portalAPI.getPayments(token);
      setPayments(response.data);
    } catch (err) {
      setError('Error al cargar informacion de pagos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    try {
      setCreatingPayment(true);
      setError(null);
      const response = await portalAPI.createPayment(token);
      setPayments(prev => ({
        ...prev,
        pending: {
          hasPendingPayment: true,
          payment: response.data,
          paymentId: response.data.paymentId
        }
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear pago');
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleCheckout = async (paymentId) => {
    try {
      setError(null);
      const response = await portalAPI.createCheckoutSession(token, paymentId);

      if (response.data.url) {
        window.location.href = response.data.url;
      } else if (response.data.mockMode) {
        // Mock mode - simulate success
        await fetchPayments();
        alert('Pago simulado completado (modo de prueba)');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar checkout');
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const { pending, history } = payments;

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Pending Payment Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <CreditCard className="w-6 h-6 mr-2 text-blue-600" />
          Pago Pendiente
        </h2>

        {pending?.hasPendingPayment ? (
          <div className="space-y-4">
            {/* Payment breakdown */}
            {pending.breakdown && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Desglose</h3>
                <div className="space-y-2">
                  {pending.breakdown.duties > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Derechos de Aduana</span>
                      <span className="font-medium">
                        {formatCurrency(pending.breakdown.duties)}
                      </span>
                    </div>
                  )}
                  {pending.breakdown.vat > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">IVA Importacion</span>
                      <span className="font-medium">
                        {formatCurrency(pending.breakdown.vat)}
                      </span>
                    </div>
                  )}
                  {pending.breakdown.specialTaxes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Impuestos Especiales</span>
                      <span className="font-medium">
                        {formatCurrency(pending.breakdown.specialTaxes)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2 flex justify-between">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="font-bold text-lg text-blue-600">
                      {formatCurrency(pending.breakdown.total)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment details (if created) */}
            {pending.payment && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-blue-700">ID de Pago</span>
                  <span className="font-mono text-sm">{pending.payment.paymentId}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-blue-700">Monto</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(pending.payment.totalAmount)}
                  </span>
                </div>
                <button
                  onClick={() => handleCheckout(pending.payment.paymentId)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-semibold"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pagar Ahora
                </button>
              </div>
            )}

            {/* Create payment button */}
            {pending.needsPaymentCreation && (
              <button
                onClick={handleCreatePayment}
                disabled={creatingPayment}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center font-semibold"
              >
                {creatingPayment ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Creando pago...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5 mr-2" />
                    Proceder al Pago
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-gray-600">
              {pending?.message || 'No hay pagos pendientes'}
            </p>
            {pending?.paidAt && (
              <p className="text-sm text-gray-500 mt-2">
                Ultimo pago: {formatDate(pending.paidAt)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <FileText className="w-6 h-6 mr-2 text-gray-600" />
          Historial de Pagos
        </h2>

        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((payment) => {
              const statusConfig = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;
              const isExpanded = expandedPayment === payment.paymentId;

              return (
                <div
                  key={payment.paymentId}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedPayment(isExpanded ? null : payment.paymentId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full bg-${statusConfig.color}-100 flex items-center justify-center mr-3`}>
                        <StatusIcon className={`w-5 h-5 text-${statusConfig.color}-600`} />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(payment.totalAmount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(payment.paidAt || payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${statusConfig.color}-100 text-${statusConfig.color}-700 mr-2`}>
                        {statusConfig.text}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50">
                      <div className="pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">ID de Pago</span>
                          <span className="font-mono">{payment.paymentId}</span>
                        </div>
                        {payment.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">{item.description}</span>
                            <span>{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {payment.receiptUrl && (
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-2"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Ver Recibo
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay pagos anteriores</p>
          </div>
        )}
      </div>

      {/* Payment Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Informacion de Pago</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Aceptamos tarjetas de credito y debito (Visa, Mastercard, Amex)</li>
          <li>• Los pagos son procesados de forma segura mediante Stripe</li>
          <li>• Recibira un recibo por email al completar el pago</li>
          <li>• Para pagos por transferencia bancaria, contacte con nosotros</li>
        </ul>
      </div>
    </div>
  );
};

export default PortalPayments;
