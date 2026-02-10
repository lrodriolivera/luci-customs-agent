import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import helpContent from '../data/helpContent'

export default function useContextualHelp() {
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const helpData = useMemo(() => {
    // Exact match first
    if (helpContent[pathname]) {
      return helpContent[pathname]
    }

    // Fallback: try parent route for dynamic routes like /expeditions/abc
    const segments = pathname.split('/').filter(Boolean)
    while (segments.length > 0) {
      const parentPath = '/' + segments.join('/')
      if (helpContent[parentPath]) {
        return helpContent[parentPath]
      }
      segments.pop()
    }

    // Final fallback to dashboard
    return helpContent['/'] || null
  }, [pathname])

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)

  return { isOpen, open, close, helpData }
}
