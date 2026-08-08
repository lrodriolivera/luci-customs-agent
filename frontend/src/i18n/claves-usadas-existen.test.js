import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import es from './locales/es.json'
import en from './locales/en.json'
import pt from './locales/pt.json'
import ca from './locales/ca.json'
import va from './locales/va.json'
import it_ from './locales/it.json'
import fr from './locales/fr.json'

// Una t('clave') sin segundo argumento y sin entrada en el locale pinta la CLAVE CRUDA en
// la UI: el titulo de /analytics decia literalmente "analyticsPage.title" y el tooltip del
// boton de ayuda "help.contextualHelp" en TODAS las pantallas. i18next no avisa de nada,
// asi que el fallo solo se ve mirando la pagina. Este test recorre el codigo fuente y
// exige que cada clave usada sin fallback exista en los 7 idiomas.
const locales = { es, en, pt, ca, va, it: it_, fr }
const SRC = path.resolve(__dirname, '..')

// t('a.b') o t("a.b") con UN solo argumento. Se excluye t('a.b', 'texto') porque el
// segundo argumento ya es el texto por defecto que se muestra si falta la clave.
const T_SIN_FALLBACK = /\bt\(\s*(['"])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\1\s*\)/g
// labelKey: 'a.b' — el patron de las listas de opciones (TIME_PERIODS de Analytics),
// que acaban en un t(opt.labelKey) y por tanto tampoco tienen fallback.
const LABEL_KEY = /\blabelKey:\s*(['"])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\1/g

function ficherosFuente(dir = SRC, acc = []) {
  for (const nombre of fs.readdirSync(dir)) {
    const p = path.join(dir, nombre)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (nombre === 'test' || nombre === 'locales' || nombre === 'node_modules') continue
      ficherosFuente(p, acc)
    } else if (/\.(jsx?|tsx?)$/.test(nombre) && !/\.(test|spec)\./.test(nombre)) {
      acc.push(p)
    }
  }
  return acc
}

function resolver(obj, clave) {
  return clave.split('.').reduce((cur, parte) => (cur && typeof cur === 'object' ? cur[parte] : undefined), obj)
}

// Mapa clave -> primer sitio donde se usa, para que el fallo diga QUE fichero arreglar.
const clavesUsadas = new Map()
for (const fichero of ficherosFuente()) {
  const contenido = fs.readFileSync(fichero, 'utf8')
  const rel = path.relative(SRC, fichero)
  for (const re of [T_SIN_FALLBACK, LABEL_KEY]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(contenido)) !== null) {
      const clave = m[2]
      if (!clavesUsadas.has(clave)) {
        const linea = contenido.slice(0, m.index).split('\n').length
        clavesUsadas.set(clave, `src/${rel}:${linea}`)
      }
    }
  }
}

describe('i18n: toda clave usada sin texto por defecto existe en los 7 idiomas', () => {
  it('el barrido encuentra claves que revisar (guarda contra una regex que dejo de casar)', () => {
    expect(clavesUsadas.size).toBeGreaterThan(200)
  })

  for (const [lang, dic] of Object.entries(locales)) {
    it(`"${lang}" no deja ninguna clave sin traducir`, () => {
      const faltan = [...clavesUsadas.entries()]
        .filter(([clave]) => typeof resolver(dic, clave) !== 'string')
        .map(([clave, donde]) => `${clave} (${donde})`)
      expect(faltan).toEqual([])
    })
  }
})

// public/locales es lo que i18next-http-backend sirve en produccion; src/i18n/locales es
// lo que empaqueta el bundle. Si se tocan solo unos, la UI desplegada sigue rota.
describe('i18n: public/locales replica src/i18n/locales', () => {
  const PUBLIC = path.resolve(__dirname, '../../public/locales')

  for (const lang of Object.keys(locales)) {
    it(`"${lang}" tiene en public las mismas claves usadas que en src`, () => {
      const publico = JSON.parse(fs.readFileSync(path.join(PUBLIC, `${lang}.json`), 'utf8'))
      const faltan = [...clavesUsadas.entries()]
        .filter(([clave]) => typeof resolver(publico, clave) !== 'string')
        .map(([clave, donde]) => `${clave} (${donde})`)
      expect(faltan).toEqual([])
    })
  }
})
