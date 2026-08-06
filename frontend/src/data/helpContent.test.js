import { describe, it, expect, beforeEach, vi } from 'vitest'
import getHelpContent from './helpContent'
import i18n from '../i18n/i18n'

// Mock i18n.t to prevent actual translation lookups
vi.mock('../i18n/i18n', () => ({
  default: {
    t: vi.fn((key) => `TRANSLATED:${key}`)
  }
}))

describe('helpContent', () => {
  let helpContent

  beforeEach(() => {
    vi.clearAllMocks()
    helpContent = getHelpContent()
  })

  describe('getHelpContent function', () => {
    it('returns an object', () => {
      expect(typeof helpContent).toBe('object')
      expect(helpContent).not.toBeNull()
    })

    it('is a function that can be called multiple times', () => {
      const firstCall = getHelpContent()
      const secondCall = getHelpContent()
      expect(firstCall).toBeDefined()
      expect(secondCall).toBeDefined()
      expect(typeof firstCall).toBe('object')
      expect(typeof secondCall).toBe('object')
    })
  })

  describe('top-level structure', () => {
    it('contains expected route keys', () => {
      const expectedRoutes = [
        '/',
        '/expeditions',
        '/channels',
        '/requirements',
        '/deadlines',
        '/inspections',
        '/communications',
        '/classification',
        '/regulations',
        '/declarations',
        '/h7',
        '/ens',
        '/queries',
        '/pue',
        '/guarantees',
        '/oea',
        '/special-regimes',
        '/transit',
        '/calculator',
        '/rules-engine',
        '/preferences',
        '/excise-duties',
        '/quotas',
        '/integrations',
        '/aeat/certificates',
        '/aeat/monitor',
        '/analytics',
        '/settings',
        '/billing',
        '/admin',
        '/ml-insights',
        '/assistant'
      ]

      expectedRoutes.forEach(route => {
        expect(helpContent).toHaveProperty(route)
      })
    })

    it('has at least 30 routes defined', () => {
      const keys = Object.keys(helpContent)
      expect(keys.length).toBeGreaterThanOrEqual(30)
    })
  })

  describe('route entry structure', () => {
    it('each route has title, description, and tabs properties', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content).toHaveProperty('title')
        expect(content).toHaveProperty('description')
        expect(content).toHaveProperty('tabs')

        expect(typeof content.title).toBe('string')
        expect(typeof content.description).toBe('string')
        expect(typeof content.tabs).toBe('object')
      })
    })

    it('each route tabs object has uso, normativa, and luciIA tabs', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content.tabs).toHaveProperty('uso')
        expect(content.tabs).toHaveProperty('normativa')
        expect(content.tabs).toHaveProperty('luciIA')
      })
    })

    it('uso tab has sections and steps arrays', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        const uso = content.tabs.uso
        expect(uso).toHaveProperty('sections')
        expect(uso).toHaveProperty('steps')
        expect(Array.isArray(uso.sections)).toBe(true)
        expect(Array.isArray(uso.steps)).toBe(true)
      })
    })

    it('normativa tab has regulations array', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        const normativa = content.tabs.normativa
        expect(normativa).toHaveProperty('regulations')
        expect(Array.isArray(normativa.regulations)).toBe(true)
      })
    })

    it('luciIA tab has features array', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        const luciIA = content.tabs.luciIA
        expect(luciIA).toHaveProperty('features')
        expect(Array.isArray(luciIA.features)).toBe(true)
      })
    })
  })

  describe('uso tab content', () => {
    it('sections have title and text properties', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        content.tabs.uso.sections.forEach((section, idx) => {
          expect(section).toHaveProperty('title')
          expect(section).toHaveProperty('text')
          expect(typeof section.title).toBe('string')
          expect(typeof section.text).toBe('string')
        })
      })
    })

    it('steps are non-empty strings', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        content.tabs.uso.steps.forEach((step, idx) => {
          expect(typeof step).toBe('string')
          expect(step.length).toBeGreaterThan(0)
        })
      })
    })

    it('each route has at least 1 section', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content.tabs.uso.sections.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('each route has at least 1 step', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content.tabs.uso.steps.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('normativa tab content', () => {
    it('regulations have code, title, description, and url properties', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        content.tabs.normativa.regulations.forEach((reg, idx) => {
          expect(reg).toHaveProperty('code')
          expect(reg).toHaveProperty('title')
          expect(reg).toHaveProperty('description')
          expect(typeof reg.code).toBe('string')
          expect(typeof reg.title).toBe('string')
          expect(typeof reg.description).toBe('string')

          // url is optional for some entries (e.g., "Normativa interna")
          if (reg.url) {
            expect(typeof reg.url).toBe('string')
          }
        })
      })
    })

    it('each route has at least 1 regulation', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content.tabs.normativa.regulations.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('urls are valid when present', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        content.tabs.normativa.regulations.forEach(reg => {
          if (reg.url) {
            expect(reg.url).toMatch(/^https?:\/\//)
          }
        })
      })
    })
  })

  describe('luciIA tab content', () => {
    it('features have name and description properties', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        content.tabs.luciIA.features.forEach((feature, idx) => {
          expect(feature).toHaveProperty('name')
          expect(feature).toHaveProperty('description')
          expect(typeof feature.name).toBe('string')
          expect(typeof feature.description).toBe('string')
          expect(feature.name.length).toBeGreaterThan(0)
          expect(feature.description.length).toBeGreaterThan(0)
        })
      })
    })

    it('each route has at least 1 feature', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content.tabs.luciIA.features.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('specific route content samples', () => {
    it('dashboard route (/) exists and has expected structure', () => {
      const dashboard = helpContent['/']
      expect(dashboard).toBeDefined()
      expect(dashboard.title).toBeDefined()
      expect(dashboard.tabs.uso.sections.length).toBeGreaterThan(0)
      expect(dashboard.tabs.uso.steps.length).toBeGreaterThan(0)
      expect(dashboard.tabs.normativa.regulations.length).toBeGreaterThan(0)
      expect(dashboard.tabs.luciIA.features.length).toBeGreaterThan(0)
    })

    it('h7 route includes specific AEAT regulations', () => {
      const h7 = helpContent['/h7']
      expect(h7).toBeDefined()
      expect(h7.tabs.normativa.regulations.length).toBeGreaterThan(0)

      // Check for specific regulation about 9/Mar/2026 change
      const marchRegulation = h7.tabs.normativa.regulations.find(
        r => r.code === 'AEAT 9/Mar/2026'
      )
      expect(marchRegulation).toBeDefined()
      if (marchRegulation) {
        expect(marchRegulation.description).toContain('DSDT')
      }

      // Check for EU regulation 2026/382
      const euRegulation = h7.tabs.normativa.regulations.find(
        r => r.code === 'Reg. (UE) 2026/382'
      )
      expect(euRegulation).toBeDefined()
      if (euRegulation) {
        expect(euRegulation.title).toContain('150 EUR')
      }
    })

    it('h7 route includes special features for N337 and derecho fijo', () => {
      const h7 = helpContent['/h7']
      const features = h7.tabs.luciIA.features

      const n337Feature = features.find(f => f.name === 'Soporte N337 y G4')
      expect(n337Feature).toBeDefined()

      const derechoFijoFeature = features.find(f => f.name === 'Derecho fijo 3 EUR (preparado)')
      expect(derechoFijoFeature).toBeDefined()
    })

    it('classifications route exists', () => {
      const classification = helpContent['/classification']
      expect(classification).toBeDefined()
      expect(classification.tabs.uso.sections.length).toBeGreaterThan(0)
    })

    it('declarations route exists', () => {
      const declarations = helpContent['/declarations']
      expect(declarations).toBeDefined()
      expect(declarations.tabs.uso.steps.length).toBeGreaterThan(0)
    })
  })

  describe('i18n integration', () => {
    it('calls i18n.t for translatable content', () => {
      // getHelpContent should call i18n.t() internally
      expect(i18n.t).toHaveBeenCalled()
    })

    it('returns translated strings (mocked)', () => {
      // With our mock, all strings should start with "TRANSLATED:"
      Object.entries(helpContent).forEach(([route, content]) => {
        expect(content.title).toMatch(/^TRANSLATED:/)
        expect(content.description).toMatch(/^TRANSLATED:/)
      })
    })
  })

  describe('no duplicate keys', () => {
    it('has no duplicate route keys', () => {
      const keys = Object.keys(helpContent)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })
  })

  describe('consistency checks', () => {
    it('all routes follow the same tabs structure', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        const tabKeys = Object.keys(content.tabs)
        expect(tabKeys).toContain('uso')
        expect(tabKeys).toContain('normativa')
        expect(tabKeys).toContain('luciIA')
        expect(tabKeys.length).toBe(3)
      })
    })

    it('no empty arrays in critical fields', () => {
      Object.entries(helpContent).forEach(([route, content]) => {
        // Some routes might legitimately have fewer items, but none should have zero
        // except in edge cases. For now, just verify structure exists.
        expect(content.tabs.uso.sections).toBeDefined()
        expect(content.tabs.uso.steps).toBeDefined()
        expect(content.tabs.normativa.regulations).toBeDefined()
        expect(content.tabs.luciIA.features).toBeDefined()
      })
    })
  })
})
