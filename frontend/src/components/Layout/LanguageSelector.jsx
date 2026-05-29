import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { languages } from '../../i18n/i18n'
import { GlobeAltIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

// Senyera catalana: 9 franjas alternas amarillo/rojo
const CatalanFlag = () => (
  <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-sm flex-shrink-0">
    {[0,1,2,3,4,5,6,7,8].map(i => (
      <rect key={i} x="0" y={i * 14/9} width="20" height={14/9} fill={i % 2 === 0 ? '#FCDD09' : '#DA121A'} />
    ))}
  </svg>
)

// Senyera valenciana: igual que catalana + franja azul izquierda con corona
const ValencianFlag = () => (
  <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-sm flex-shrink-0">
    {[0,1,2,3,4,5,6,7,8].map(i => (
      <rect key={i} x="0" y={i * 14/9} width="20" height={14/9} fill={i % 2 === 0 ? '#FCDD09' : '#DA121A'} />
    ))}
    <rect x="0" y="0" width="4" height="14" fill="#0056A0" />
  </svg>
)

const emojiFlags = {
  ES: '\u{1F1EA}\u{1F1F8}',
  GB: '\u{1F1EC}\u{1F1E7}',
  FR: '\u{1F1EB}\u{1F1F7}',
  IT: '\u{1F1EE}\u{1F1F9}',
  PT: '\u{1F1F5}\u{1F1F9}'
}

const FlagIcon = ({ flag }) => {
  if (flag === 'CA') return <CatalanFlag />
  if (flag === 'VA') return <ValencianFlag />
  return <span>{emojiFlags[flag] || flag}</span>
}

export default function LanguageSelector({ variant = 'header' }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const currentLang = languages.find(l => l.code === i18n.resolvedLanguage) || languages[0]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLang = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  if (variant === 'sidebar') {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <GlobeAltIcon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left"><FlagIcon flag={currentLang.flag} /> {currentLang.name}</span>
          <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => changeLang(lang.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  lang.code === i18n.resolvedLanguage
                    ? 'bg-sky-500/20 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FlagIcon flag={lang.flag} />
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <GlobeAltIcon className="w-4 h-4" />
        <span className="hidden sm:inline"><FlagIcon flag={currentLang.flag} /> {currentLang.code.toUpperCase()}</span>
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLang(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                lang.code === i18n.resolvedLanguage
                  ? 'bg-sky-50 text-sky-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FlagIcon flag={lang.flag} />
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
