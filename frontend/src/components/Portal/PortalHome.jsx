import React from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DocumentArrowUpIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { esImportacion } from '../../utils/expedition'

export default function PortalHome() {
  const { t } = useTranslation()
  const { expedition, token } = useOutletContext()

  const getProgressPercentage = () => {
    const statusProgress = {
      'PENDING_DOCS': 10,
      'DOCS_RECEIVED': 30,
      'VALIDATING': 50,
      'PROCESSING': 70,
      'SUBMITTED': 90,
      'COMPLETED': 100
    }
    return statusProgress[expedition?.status] || 0
  }

  const getStatusMessage = () => {
    const messages = {
      'PENDING_DOCS': t('portal.waitingDocs'),
      'DOCS_RECEIVED': t('portal.docsReceived'),
      'VALIDATING': t('portal.validatingInfo'),
      'PROCESSING': t('portal.processingDeclaration'),
      'SUBMITTED': t('portal.submittedToCustoms'),
      'COMPLETED': t('portal.customsCompleted')
    }
    return messages[expedition?.status] || t('portal.unknownStatus')
  }

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="card bg-gradient-to-r from-luci to-blue-600 text-white">
        <h1 className="text-2xl font-bold mb-2">
          {t('portal.welcome')} {expedition?.client?.companyName}
        </h1>
        <p className="opacity-90">
          {esImportacion(expedition) ? t('portal.importExpedition') : t('portal.exportExpedition')}: {expedition?.expeditionId}
        </p>
      </div>

      {/* Progress */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{t('portal.expeditionStatus')}</h2>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{t('portal.progress')}</span>
            <span className="font-medium">{getProgressPercentage()}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-luci rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-luci-light rounded-xl">
          <div className="w-10 h-10 bg-luci rounded-full flex items-center justify-center flex-shrink-0">
            {getProgressPercentage() === 100 ? (
              <CheckCircleIcon className="w-6 h-6 text-white" />
            ) : (
              <ClockIcon className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {getProgressPercentage() === 100 ? t('portal.completed') : t('portal.inProcess')}
            </p>
            <p className="text-sm text-gray-600">{getStatusMessage()}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to={`/portal/${token}/documents`}
          className="card hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <DocumentArrowUpIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('portal.uploadDocs')}</h3>
              <p className="text-sm text-gray-500">{t('portal.uploadDocsDesc')}</p>
            </div>
          </div>
        </Link>

        <Link
          to={`/portal/${token}/chat`}
          className="card hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('portal.chatWithLuci')}</h3>
              <p className="text-sm text-gray-500">{t('portal.chatDesc')}</p>
            </div>
          </div>
        </Link>

        <Link
          to={`/portal/${token}/status`}
          className="card hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <ClockIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t('portal.viewStatus')}</h3>
              <p className="text-sm text-gray-500">{t('portal.viewStatusDesc')}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Documents Checklist Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{t('portal.requiredDocs')}</h2>
        <div className="space-y-2">
          {expedition?.documentChecklist?.slice(0, 5).map((doc, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                doc.uploaded ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              {doc.uploaded ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
              )}
              <span className={doc.uploaded ? 'text-green-700' : 'text-gray-700'}>
                {doc.name}
              </span>
              {doc.required && !doc.uploaded && (
                <span className="text-xs text-red-500 ml-auto">{t('common.pending')}</span>
              )}
            </div>
          )) || (
            <p className="text-gray-500 text-sm">{t('portal.loadingChecklist')}</p>
          )}
        </div>
        <Link
          to={`/portal/${token}/documents`}
          className="mt-4 text-luci hover:text-luci-dark text-sm font-medium inline-block"
        >
          {t('portal.allDocs')} &rarr;
        </Link>
      </div>
    </div>
  )
}
