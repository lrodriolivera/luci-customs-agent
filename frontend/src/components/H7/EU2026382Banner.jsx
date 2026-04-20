/**
 * EU2026382Banner - Banner informativo sobre el Reglamento (UE) 2026/382
 * Supresion de la franquicia aduanera de 150 EUR para envios de escaso valor
 *
 * Entra en vigor: 1 de julio de 2026
 * Medida transitoria: derecho fijo 3 EUR/articulo (julio 2026 - julio 2028)
 */
import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

const EFFECTIVE_DATE = new Date('2026-07-01');

function daysUntilEffective() {
  const now = new Date();
  const diff = EFFECTIVE_DATE.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function EU2026382Banner({ variant = 'full', className = '' }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const daysLeft = daysUntilEffective();
  const isActive = daysLeft <= 0;

  if (dismissed && variant !== 'inline') return null;

  // Compact inline version (for forms)
  if (variant === 'inline') {
    return (
      <div className={`flex items-start gap-2 p-3 rounded-lg border ${
        isActive ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      } ${className}`}>
        <ExclamationTriangleIcon className={`w-5 h-5 mt-0.5 shrink-0 ${
          isActive ? 'text-red-500' : 'text-amber-500'
        }`} />
        <div className="text-sm">
          <p className={`font-semibold ${isActive ? 'text-red-800' : 'text-amber-800'}`}>
            {isActive
              ? 'Reglamento (UE) 2026/382 en vigor - Derecho fijo 3 EUR/articulo'
              : `Reglamento (UE) 2026/382 - Entra en vigor en ${daysLeft} dias (1 julio 2026)`
            }
          </p>
          <p className={`mt-0.5 ${isActive ? 'text-red-700' : 'text-amber-700'}`}>
            {isActive
              ? 'La franquicia aduanera de 150 EUR ha sido suprimida. Se aplica un derecho de aduana de 3 EUR por articulo para envios IOSS y postales.'
              : 'Se suprimira la franquicia aduanera de 150 EUR. Se aplicara un derecho de aduana transitorio de 3 EUR por articulo (IOSS/postal).'
            }
          </p>
        </div>
      </div>
    );
  }

  // Full banner version (for list/dashboard)
  return (
    <div className={`relative rounded-xl border overflow-hidden ${
      isActive ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
    } ${className}`}>
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/60 transition-colors"
        title="Cerrar"
      >
        <XMarkIcon className="w-4 h-4 text-gray-500" />
      </button>

      <div className="p-4 pr-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isActive ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <ExclamationTriangleIcon className={`w-6 h-6 ${
              isActive ? 'text-red-600' : 'text-amber-600'
            }`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-bold ${isActive ? 'text-red-900' : 'text-amber-900'}`}>
              Reglamento (UE) 2026/382 - Supresion franquicia aduanera 150 EUR
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                isActive ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
              }`}>
                <CalendarDaysIcon className="w-3 h-3" />
                {isActive ? 'EN VIGOR' : `Entra en vigor: 1 julio 2026 (${daysLeft} dias)`}
              </span>
              <a
                href="https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=OJ:L_202600382"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                EUR-Lex <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className={`mt-3 text-sm ${isActive ? 'text-red-800' : 'text-amber-800'}`}>
          <p>
            El Consejo de la UE ha suprimido la franquicia aduanera para envios de escaso valor (≤150 EUR).
            {isActive
              ? ' Los derechos de aduana se aplican a todos los envios de comercio electronico.'
              : ' A partir del 1 de julio de 2026, todos los envios estaran sujetos a derechos de aduana.'
            }
          </p>
        </div>

        {/* Expand/collapse details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`mt-2 text-xs font-medium flex items-center gap-1 ${
            isActive ? 'text-red-600 hover:text-red-800' : 'text-amber-600 hover:text-amber-800'
          }`}
        >
          <InformationCircleIcon className="w-4 h-4" />
          {expanded ? 'Ocultar detalles' : 'Ver detalles del cambio'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                <p className="text-xs font-bold text-gray-500 uppercase">Hasta 30 junio 2026</p>
                <p className="text-sm font-semibold text-green-700 mt-1">Franquicia vigente</p>
                <p className="text-xs text-gray-600 mt-0.5">Envios ≤150 EUR exentos de derechos arancelarios (regimen actual)</p>
              </div>
              <div className={`rounded-lg p-3 border ${
                isActive ? 'bg-red-100/60 border-red-200' : 'bg-white/60 border-white/80'
              }`}>
                <p className="text-xs font-bold text-gray-500 uppercase">1 julio 2026 - 30 junio 2028</p>
                <p className="text-sm font-semibold text-orange-700 mt-1">Regimen transitorio</p>
                <p className="text-xs text-gray-600 mt-0.5">Derecho fijo <strong>3 EUR por articulo</strong> para envios IOSS y postales. Resto: arancel comun.</p>
              </div>
              <div className="bg-white/60 rounded-lg p-3 border border-white/80">
                <p className="text-xs font-bold text-gray-500 uppercase">Desde 1 julio 2028</p>
                <p className="text-sm font-semibold text-red-700 mt-1">Arancel completo</p>
                <p className="text-xs text-gray-600 mt-0.5">Arancel Aduanero Comun segun clasificacion TARIC para todos los envios.</p>
              </div>
            </div>

            {/* Impact on H7 */}
            <div className="bg-white/60 rounded-lg p-3 border border-white/80">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Impacto en declaraciones H7</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">●</span>
                  <span><strong>Tributo A00:</strong> Pasara de 0% (franquicia) a 3 EUR/articulo (transitorio) o arancel TARIC (definitivo)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">●</span>
                  <span><strong>Plataformas digitales:</strong> Seran consideradas "importador presunto" y responsables del pago</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">●</span>
                  <span><strong>IOSS:</strong> El regimen de ventanilla unica sigue operativo. El derecho fijo de 3 EUR se aplica ademas del IVA IOSS</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">●</span>
                  <span><strong>LUCI esta preparado:</strong> El sistema calculara automaticamente el derecho fijo cuando entre en vigor</span>
                </li>
              </ul>
            </div>

            {/* N337 change */}
            <div className="bg-white/60 rounded-lg p-3 border border-white/80">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Cambio operativo 9 marzo 2026 (ya en vigor)</p>
              <ul className="text-xs text-gray-700 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>DSDT cerradas en aereos:</strong> Nuevos medios de transporte deben usar G3v2/G4/G5v2</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Documento previo N337:</strong> Obligatorio para referenciar G4 en declaraciones H7</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">!</span>
                  <span><strong>Desconsolidacion G4 restringida (10/Mar):</strong> Solo se pueden desconsolidar G4 (via G5G o tránsitos) en ubicaciones con "Admite DSDT = Si". Los operadores sin adaptacion pueden tener mercancia bloqueada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>LUCI actualizado:</strong> Soporte completo para N337, referencia G4 y ubicaciones compatibles en H7 builder</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
