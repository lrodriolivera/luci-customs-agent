import React from 'react'
import { useTranslation } from 'react-i18next'
import { AEAT_SUMMARY_LINKS, getEnlaceDestacado } from '../../utils/enlacesAeat'

/**
 * Enlaces a la Sede electronica de la AEAT donde el agente busca la
 * declaracion sumaria del expediente. LUCI no puede consultarlos por el
 * agente: las tres paginas piden su certificado digital, asi que solo se
 * ofrecen los enlaces donde los necesita.
 *
 * Se destaca el que corresponde al modo de transporte del expediente, sin
 * ocultar los demas (un expediente de exportacion puede necesitar el de
 * contenedor en terminal aunque el transporte sea maritimo, por ejemplo).
 *
 * @param {{ expedition: { transportMode?: string } }} props
 */
export default function AeatSumariaLinks({ expedition }) {
  const { t } = useTranslation()
  const enlaceDestacado = getEnlaceDestacado(expedition?.transportMode)

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-2">{t('aeatSumariaLinks.title')}</h2>
      <p className="text-sm text-gray-600 mb-4">{t('aeatSumariaLinks.certificateWarning')}</p>
      <ul className="space-y-3">
        {AEAT_SUMMARY_LINKS.map((link) => {
          const destacado = link.id === enlaceDestacado
          return (
            <li
              key={link.id}
              className={`p-3 rounded-lg border text-sm ${
                destacado ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-700 hover:underline"
                >
                  {t(link.titleKey)}
                </a>
                {destacado && <span className="badge badge-completed">{t('aeatSumariaLinks.highlighted')}</span>}
              </div>
              <p className="mt-1 text-gray-600">{t(link.descriptionKey)}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
