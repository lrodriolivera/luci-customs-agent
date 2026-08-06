import { describe, it, expect } from 'vitest'
import TARIC_CHAPTERS, {
  TARIC_SECTIONS,
  getChapterName,
  getSectionByChapter,
  LEVEL_NAMES
} from './taricChapters'

describe('taricChapters', () => {
  describe('TARIC_CHAPTERS', () => {
    it('exports an object with chapter codes as keys', () => {
      expect(TARIC_CHAPTERS).toBeDefined()
      expect(typeof TARIC_CHAPTERS).toBe('object')
    })

    it('contains exactly 96 chapters (01-97, skipping 77 and 98)', () => {
      const keys = Object.keys(TARIC_CHAPTERS)
      expect(keys).toHaveLength(96)
    })

    it('has keys formatted as two-digit strings', () => {
      const keys = Object.keys(TARIC_CHAPTERS)
      keys.forEach(key => {
        expect(key).toMatch(/^\d{2}$/)
      })
    })

    it('has no duplicate chapter codes', () => {
      const keys = Object.keys(TARIC_CHAPTERS)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('includes known real TARIC chapters', () => {
      // Real TARIC chapter examples
      expect(TARIC_CHAPTERS['09']).toBe('Cafe, te, yerba mate y especias')
      expect(TARIC_CHAPTERS['84']).toBe('Reactores nucleares, calderas, maquinas, aparatos y artefactos mecanicos')
      expect(TARIC_CHAPTERS['85']).toBe('Maquinas, aparatos y material electrico')
      expect(TARIC_CHAPTERS['01']).toBe('Animales vivos')
      expect(TARIC_CHAPTERS['97']).toBe('Objetos de arte o coleccion y antiguedades')
    })

    it('does not include chapter 77 (reserved/unused in TARIC)', () => {
      expect(TARIC_CHAPTERS['77']).toBeUndefined()
    })

    it('all values are non-empty strings', () => {
      Object.values(TARIC_CHAPTERS).forEach(name => {
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
      })
    })
  })

  describe('TARIC_SECTIONS', () => {
    it('exports an array of sections', () => {
      expect(Array.isArray(TARIC_SECTIONS)).toBe(true)
      expect(TARIC_SECTIONS.length).toBeGreaterThan(0)
    })

    it('contains exactly 21 sections (I-XXI)', () => {
      expect(TARIC_SECTIONS).toHaveLength(21)
    })

    it('each section has num, name, and chapters properties', () => {
      TARIC_SECTIONS.forEach(section => {
        expect(section).toHaveProperty('num')
        expect(section).toHaveProperty('name')
        expect(section).toHaveProperty('chapters')
        expect(typeof section.num).toBe('string')
        expect(typeof section.name).toBe('string')
        expect(Array.isArray(section.chapters)).toBe(true)
      })
    })

    it('section numbers are Roman numerals I-XXI', () => {
      const romanNumerals = TARIC_SECTIONS.map(s => s.num)
      expect(romanNumerals).toEqual([
        'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
        'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'
      ])
    })

    it('all chapters in sections are two-digit strings', () => {
      TARIC_SECTIONS.forEach(section => {
        section.chapters.forEach(chapterCode => {
          expect(typeof chapterCode).toBe('string')
          expect(chapterCode).toMatch(/^\d{2}$/)
        })
      })
    })

    it('all referenced chapters exist in TARIC_CHAPTERS (except 77)', () => {
      const allReferencedChapters = TARIC_SECTIONS.flatMap(s => s.chapters)
      allReferencedChapters.forEach(chapterCode => {
        if (chapterCode !== '77') {
          expect(TARIC_CHAPTERS[chapterCode]).toBeDefined()
        }
      })
    })

    it('covers all chapters from 01 to 97 (with 77 and 98 missing)', () => {
      const allReferencedChapters = new Set(TARIC_SECTIONS.flatMap(s => s.chapters))
      // Should have 96 chapters total (chapters 01-97 minus reserved 77, and 98 doesn't exist)
      expect(allReferencedChapters.size).toBe(96)

      // Verify specific known chapters are included
      expect(allReferencedChapters.has('01')).toBe(true)
      expect(allReferencedChapters.has('09')).toBe(true)
      expect(allReferencedChapters.has('84')).toBe(true)
      expect(allReferencedChapters.has('97')).toBe(true)

      // Chapter 77 and 98 should not be included
      expect(allReferencedChapters.has('77')).toBe(false)
      expect(allReferencedChapters.has('98')).toBe(false)
    })

    it('has no duplicate chapters across sections', () => {
      const allChapters = TARIC_SECTIONS.flatMap(s => s.chapters)
      const uniqueChapters = new Set(allChapters)
      expect(uniqueChapters.size).toBe(allChapters.length)
    })
  })

  describe('getChapterName', () => {
    it('returns chapter name for valid 2-digit code', () => {
      expect(getChapterName('09')).toBe('Cafe, te, yerba mate y especias')
      expect(getChapterName('84')).toBe('Reactores nucleares, calderas, maquinas, aparatos y artefactos mecanicos')
    })

    it('extracts first 2 digits from longer codes (4, 6, 8, 10-digit TARIC codes)', () => {
      // Real TARIC code examples
      expect(getChapterName('0901210000')).toBe('Cafe, te, yerba mate y especias') // Coffee (chapter 09)
      expect(getChapterName('8471300000')).toBe('Reactores nucleares, calderas, maquinas, aparatos y artefactos mecanicos') // Computers (chapter 84)
      expect(getChapterName('850440')).toBe('Maquinas, aparatos y material electrico') // Chapter 85
    })

    it('returns fallback "Capitulo XX" for unknown chapters', () => {
      expect(getChapterName('99')).toBe('Capitulo 99')
      expect(getChapterName('77')).toBe('Capitulo 77') // Reserved chapter
    })

    it('handles null input gracefully', () => {
      expect(getChapterName(null)).toBe('Capitulo undefined')
    })

    it('handles undefined input gracefully', () => {
      expect(getChapterName(undefined)).toBe('Capitulo undefined')
    })

    it('handles empty string input', () => {
      expect(getChapterName('')).toBe('Capitulo ')
    })

    it('handles single-digit input', () => {
      expect(getChapterName('9')).toBe('Capitulo 9')
    })

    it('handles malformed codes shorter than 2 digits', () => {
      expect(getChapterName('0')).toBe('Capitulo 0')
    })
  })

  describe('getSectionByChapter', () => {
    it('returns section for valid chapter code', () => {
      const section = getSectionByChapter('09')
      expect(section).toBeDefined()
      expect(section.num).toBe('II')
      expect(section.name).toBe('Productos del reino vegetal')
      expect(section.chapters).toContain('09')
    })

    it('returns section for chapter 84', () => {
      const section = getSectionByChapter('84')
      expect(section).toBeDefined()
      expect(section.num).toBe('XVI')
      expect(section.chapters).toContain('84')
    })

    it('returns section for chapter 01', () => {
      const section = getSectionByChapter('01')
      expect(section).toBeDefined()
      expect(section.num).toBe('I')
      expect(section.chapters).toContain('01')
    })

    it('returns section for chapter 97', () => {
      const section = getSectionByChapter('97')
      expect(section).toBeDefined()
      expect(section.num).toBe('XXI')
      expect(section.chapters).toContain('97')
    })

    it('returns undefined for non-existent chapter', () => {
      expect(getSectionByChapter('99')).toBeUndefined()
    })

    it('returns undefined for chapter 77 (reserved)', () => {
      expect(getSectionByChapter('77')).toBeUndefined()
    })

    it('returns undefined for null input', () => {
      expect(getSectionByChapter(null)).toBeUndefined()
    })

    it('returns undefined for undefined input', () => {
      expect(getSectionByChapter(undefined)).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(getSectionByChapter('')).toBeUndefined()
    })
  })

  describe('LEVEL_NAMES', () => {
    it('exports an object mapping code length to level name', () => {
      expect(LEVEL_NAMES).toBeDefined()
      expect(typeof LEVEL_NAMES).toBe('object')
    })

    it('defines level names for TARIC hierarchy', () => {
      expect(LEVEL_NAMES[2]).toBe('Capitulo')
      expect(LEVEL_NAMES[4]).toBe('Partida')
      expect(LEVEL_NAMES[6]).toBe('Subpartida SA')
      expect(LEVEL_NAMES[8]).toBe('Nomenclatura Combinada (NC)')
      expect(LEVEL_NAMES[10]).toBe('Codigo TARIC')
    })

    it('has exactly 5 levels defined', () => {
      expect(Object.keys(LEVEL_NAMES)).toHaveLength(5)
    })

    it('all level values are non-empty strings', () => {
      Object.values(LEVEL_NAMES).forEach(name => {
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
      })
    })
  })
})
