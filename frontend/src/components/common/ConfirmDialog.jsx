import React from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Modal de confirmación reutilizable.
 *
 * Sustituye al confirm() nativo del navegador, que bloquea la automatización
 * (la extensión de Chrome no puede interactuar con diálogos nativos) y ofrece
 * una UX pobre. Controlado: el padre gestiona `open` y responde en
 * `onConfirm` / `onCancel`.
 *
 * Uso típico con el hook useConfirm (ver useConfirm.js), que expone
 * `confirm(opts)` como una promesa y el `<ConfirmDialog {...dialogProps} />`.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default', // 'default' | 'danger'
  onConfirm,
  onCancel
}) {
  const { t } = useTranslation()
  if (!open) return null

  const confirmClasses = variant === 'danger'
    ? 'text-white bg-red-600 hover:bg-red-700'
    : 'text-white bg-luci hover:opacity-90'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title || t('common.confirmTitle', 'Confirmar')}
        </h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {cancelLabel || t('common.cancel', 'Cancelar')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${confirmClasses}`}
          >
            {confirmLabel || t('common.confirm', 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}
