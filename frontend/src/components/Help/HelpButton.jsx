import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

export default function HelpButton({ onClick }) {
  const { t } = useTranslation()
  const [showPulse, setShowPulse] = useState(false)

  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('luci-help-seen')
    if (!hasSeenHelp) {
      setShowPulse(true)
    }
  }, [])

  const handleClick = () => {
    if (showPulse) {
      localStorage.setItem('luci-help-seen', 'true')
      setShowPulse(false)
    }
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className="help-fab"
      title={t('help.contextualHelp')}
      aria-label={t('help.openContextualHelp')}
    >
      <QuestionMarkCircleIcon className="w-7 h-7" />
      {showPulse && (
        <span className="absolute inset-0 rounded-full bg-luci opacity-40 animate-[help-pulse_2s_ease-in-out_infinite]" />
      )}
    </button>
  )
}
