/**
 * Portal Signed Documents Component
 * Phase 6.7: Portal Cliente Avanzado
 * Download official/signed documents
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Shield,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Award,
  Receipt,
  FileCheck
} from 'lucide-react';
import { portalAPI } from '../../services/api';

const DOC_TYPE_CONFIG = {
  levante: {
    icon: CheckCircle,
    color: 'green',
    title: 'Documento de Levante',
    description: 'Autorizacion oficial de despacho aduanero'
  },
  declaration: {
    icon: FileText,
    color: 'blue',
    title: 'Copia de Declaracion',
    description: 'DUA presentado ante la AEAT'
  },
  payment_receipt: {
    icon: Receipt,
    color: 'purple',
    title: 'Recibo de Pago',
    description: 'Comprobante de pago de derechos'
  },
  certificate: {
    icon: Award,
    color: 'yellow',
    title: 'Certificado',
    description: 'Certificado de origen validado'
  }
};

const PortalSignedDocs = ({ token, expedition }) => {
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await portalAPI.getSignedDocuments(token);
      setDocuments(response.data);
    } catch (err) {
      setError('Error al cargar documentos firmados');
      console.error('Error fetching signed documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      setDownloading(doc.type);

      // If it's an external URL (like Stripe receipt), open in new tab
      if (doc.downloadUrl.startsWith('http')) {
        window.open(doc.downloadUrl, '_blank');
        return;
      }

      // For internal documents, fetch and download
      const response = await fetch(doc.downloadUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error downloading document');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Generate a simple PDF/text representation
        const content = generateDocumentContent(doc.type, data.data);
        downloadContent(content, `${doc.type}_${doc.mrn || doc.reference || 'doc'}.txt`);
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Error al descargar el documento');
    } finally {
      setDownloading(null);
    }
  };

  const generateDocumentContent = (type, data) => {
    let content = '';

    switch (type) {
      case 'levante':
        content = `
========================================
      DOCUMENTO DE LEVANTE
========================================

Expediente: ${data.expeditionId}
MRN: ${data.mrn}
Tipo de Declaracion: ${data.declarationType}
Aduana: ${data.customsOffice}

Fecha de Aceptacion: ${formatDate(data.acceptanceDate)}
Fecha de Levante: ${formatDate(data.levanteDate)}

DECLARANTE
----------
Empresa: ${data.client?.name}
NIF: ${data.client?.taxId}
EORI: ${data.client?.eori}

MERCANCIAS
----------
${data.goods?.map((g, i) => `
${i + 1}. ${g.description}
   Cantidad: ${g.quantity} ${g.unit}
   TARIC: ${g.taricCode}
   Origen: ${g.origin}
`).join('\n') || 'N/A'}

LIQUIDACION
-----------
Valor Factura: ${formatCurrency(data.totals?.invoiceValue)}
Derechos: ${formatCurrency(data.totals?.duties)}
IVA: ${formatCurrency(data.totals?.vat)}
TOTAL: ${formatCurrency(data.totals?.total)}

----------------------------------------
${data.disclaimer}
Generado: ${formatDate(data.generatedAt)}
========================================
        `;
        break;

      case 'declaration':
        content = `
========================================
      DECLARACION ADUANERA ${data.title}
========================================

MRN: ${data.mrn}
LRN: ${data.lrn}
Regimen: ${data.regime}
Estado: ${data.status}

Aduana: ${data.customsOffice}
Fecha Presentacion: ${formatDate(data.submittedAt)}
Fecha Aceptacion: ${formatDate(data.acceptanceDate)}

DECLARANTE
----------
Empresa: ${data.declarant?.name}
NIF: ${data.declarant?.taxId}
EORI: ${data.declarant?.eori}

Partidas: ${data.items}

----------------------------------------
Generado: ${formatDate(data.generatedAt)}
========================================
        `;
        break;

      default:
        content = JSON.stringify(data, null, 2);
    }

    return content;
  };

  const downloadContent = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
        <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
          <Shield className="w-6 h-6 mr-2 text-green-600" />
          Documentos Oficiales
        </h2>
        <p className="text-gray-600">
          Descargue los documentos oficiales y firmados de su expediente
        </p>

        {documents?.mrn && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-500">MRN: </span>
            <span className="font-mono font-semibold">{documents.mrn}</span>
          </div>
        )}
      </div>

      {/* Documents List */}
      {documents?.documents && documents.documents.length > 0 ? (
        <div className="space-y-4">
          {documents.documents.map((doc, index) => {
            const config = DOC_TYPE_CONFIG[doc.type] || {
              icon: FileText,
              color: 'gray',
              title: doc.name,
              description: ''
            };
            const IconComponent = config.icon;

            return (
              <div
                key={index}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`w-12 h-12 bg-${config.color}-100 rounded-lg flex items-center justify-center mr-4`}>
                      <IconComponent className={`w-6 h-6 text-${config.color}-600`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {doc.name || config.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {doc.description || config.description}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {doc.mrn && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            MRN: {doc.mrn}
                          </span>
                        )}
                        {doc.reference && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            Ref: {doc.reference}
                          </span>
                        )}
                        {doc.date && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            <Clock className="inline w-3 h-3 mr-1" />
                            {formatDate(doc.date)}
                          </span>
                        )}
                        {doc.amount && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {formatCurrency(doc.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={!doc.available || downloading === doc.type}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                      doc.available
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {downloading === doc.type ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Descargando...
                      </>
                    ) : doc.downloadUrl?.startsWith('http') ? (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Descargar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay documentos disponibles
          </h3>
          <p className="text-gray-500">
            Los documentos oficiales estaran disponibles una vez que el expediente
            haya sido procesado y se haya obtenido el levante.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Informacion</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• El Documento de Levante certifica la autorizacion de la aduana para retirar la mercancia</li>
          <li>• La copia de la Declaracion (DUA) es el documento oficial presentado ante la AEAT</li>
          <li>• Los recibos de pago son comprobantes de los derechos e impuestos abonados</li>
          <li>• Para documentos con firma digital, verifique su autenticidad en la sede electronica de la AEAT</li>
        </ul>
      </div>
    </div>
  );
};

export default PortalSignedDocs;
