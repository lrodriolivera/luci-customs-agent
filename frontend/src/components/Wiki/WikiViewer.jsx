import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import {
  BookOpenIcon,
  Bars3BottomLeftIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// Estructura del wiki: orden, títulos legibles, ruta al .md
const TOC = [
  { slug: 'README', title: 'Inicio', file: 'README.md', section: 'Introducción' },
  { slug: '01-empezando', title: '1. Empezando', file: '01-empezando.md', section: 'Introducción' },
  { slug: '02-glosario-aduanero', title: '2. Glosario aduanero', file: '02-glosario-aduanero.md', section: 'Introducción' },
  { slug: '03-flujos-diarios/README', title: 'Visión general', file: '03-flujos-diarios/README.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/crear-expediente', title: 'Crear expediente', file: '03-flujos-diarios/crear-expediente.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/declarar-h1-importacion', title: 'Declarar H1 (importación)', file: '03-flujos-diarios/declarar-h1-importacion.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/declarar-h7-ecommerce', title: 'Declarar H7 (e-commerce)', file: '03-flujos-diarios/declarar-h7-ecommerce.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/manifiesto-csv-masivo', title: 'Manifiesto CSV masivo', file: '03-flujos-diarios/manifiesto-csv-masivo.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/enviar-aeat-y-mrn', title: 'Enviar a AEAT y MRN', file: '03-flujos-diarios/enviar-aeat-y-mrn.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/responder-requerimiento', title: 'Responder requerimiento', file: '03-flujos-diarios/responder-requerimiento.md', section: '3. Flujos diarios' },
  { slug: '03-flujos-diarios/calcular-derechos', title: 'Calcular derechos', file: '03-flujos-diarios/calcular-derechos.md', section: '3. Flujos diarios' },
  { slug: '04-pantallas/README', title: 'Visión general', file: '04-pantallas/README.md', section: '4. Pantallas' },
  { slug: '04-pantallas/operaciones', title: 'Operaciones', file: '04-pantallas/operaciones.md', section: '4. Pantallas' },
  { slug: '04-pantallas/declaraciones', title: 'Declaraciones', file: '04-pantallas/declaraciones.md', section: '4. Pantallas' },
  { slug: '04-pantallas/calculo-normativa', title: 'Cálculo y normativa', file: '04-pantallas/calculo-normativa.md', section: '4. Pantallas' },
  { slug: '04-pantallas/control-aduanero', title: 'Control aduanero', file: '04-pantallas/control-aduanero.md', section: '4. Pantallas' },
  { slug: '04-pantallas/regimenes', title: 'Regímenes aduaneros', file: '04-pantallas/regimenes.md', section: '4. Pantallas' },
  { slug: '04-pantallas/aeat-integraciones', title: 'AEAT e Integraciones', file: '04-pantallas/aeat-integraciones.md', section: '4. Pantallas' },
  { slug: '04-pantallas/administracion', title: 'Administración', file: '04-pantallas/administracion.md', section: '4. Pantallas' },
  { slug: '05-asistente-luci-ia', title: '5. Asistente LUCI e IA', file: '05-asistente-luci-ia.md', section: 'Avanzado' },
  { slug: '06-casos-reales', title: '6. Casos reales (4 MRN)', file: '06-casos-reales.md', section: 'Avanzado' },
  { slug: '07-atajos-y-trucos', title: '7. Atajos y trucos', file: '07-atajos-y-trucos.md', section: 'Avanzado' },
  { slug: '08-faq-soporte', title: '8. FAQ y soporte', file: '08-faq-soporte.md', section: 'Avanzado' },
]

// Group by section
const SECTIONS = TOC.reduce((acc, item) => {
  if (!acc.find((s) => s.title === item.section)) acc.push({ title: item.section, items: [] })
  acc.find((s) => s.title === item.section).items.push(item)
  return acc
}, [])

// Cache de archivos cargados
const mdCache = new Map()

function fetchMd(file) {
  if (mdCache.has(file)) return Promise.resolve(mdCache.get(file))
  return fetch(`/wiki/${file}?v=${import.meta.env.VITE_BUILD_ID || Date.now()}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.text()
    })
    .then((text) => {
      mdCache.set(file, text)
      return text
    })
}

export default function WikiViewer() {
  const { '*': pathParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const slug = pathParam && pathParam.length > 0 ? pathParam : 'README'
  const tocItem = TOC.find((t) => t.slug === slug) || TOC[0]

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search, setSearch] = useState('')

  // Load current md
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchMd(tocItem.file)
      .then((text) => {
        setContent(text)
        setLoading(false)
        // Scroll to top on page change
        window.scrollTo(0, 0)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [tocItem.file])

  // Calcular base path para resolver imágenes y enlaces
  const baseDir = useMemo(() => {
    const idx = tocItem.file.lastIndexOf('/')
    return idx >= 0 ? tocItem.file.slice(0, idx + 1) : ''
  }, [tocItem.file])

  // Custom transformers
  const components = useMemo(() => ({
    // Resuelve imágenes relativas
    img: ({ src, alt, ...props }) => {
      let resolved = src
      if (src && !src.startsWith('http') && !src.startsWith('/')) {
        // ../img/x.png o img/x.png
        if (src.startsWith('../')) {
          // sube un nivel desde baseDir
          const parts = baseDir.split('/').filter(Boolean)
          parts.pop()
          resolved = '/wiki/' + parts.join('/') + (parts.length ? '/' : '') + src.slice(3)
        } else {
          resolved = '/wiki/' + baseDir + src
        }
      }
      return (
        <img
          src={resolved}
          alt={alt}
          loading="lazy"
          className="rounded-lg border border-gray-200 shadow-sm my-4 max-w-full"
          {...props}
        />
      )
    },
    // Convierte enlaces .md en navegación SPA
    a: ({ href, children, ...props }) => {
      if (!href) return <a {...props}>{children}</a>
      // Externo
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props} className="text-luci hover:underline">
            {children}
          </a>
        )
      }
      // Anchor interno (#section)
      if (href.startsWith('#')) {
        return <a href={href} {...props} className="text-luci hover:underline">{children}</a>
      }
      // Enlace .md → conversión a /wiki/<slug>
      let target = href
      // Resolver path relativo (../ y demás)
      if (target.startsWith('./')) target = target.slice(2)
      // Si está en subcarpeta, usar baseDir
      let absolutePath = target
      if (!target.startsWith('/')) {
        // Resolver respecto baseDir
        const baseParts = baseDir.split('/').filter(Boolean)
        const segs = target.split('/')
        for (const seg of segs) {
          if (seg === '..') baseParts.pop()
          else if (seg !== '.') baseParts.push(seg)
        }
        absolutePath = baseParts.join('/')
      }
      // Quitar extensión .md
      absolutePath = absolutePath.replace(/\.md$/, '')
      // Si referencia README.md => /wiki o /wiki/03-flujos-diarios/
      // Mantener ruta tal cual: /wiki/<absolutePath>
      const wikiUrl = absolutePath ? `/wiki/${absolutePath}` : '/wiki'
      return (
        <Link to={wikiUrl} {...props} className="text-luci hover:underline font-medium">
          {children}
        </Link>
      )
    },
    h1: ({ children, ...props }) => (
      <h1 {...props} className="text-3xl font-bold text-gray-900 mt-8 mb-4 pb-3 border-b-2 border-luci">
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 {...props} className="text-2xl font-semibold text-gray-900 mt-8 mb-3 pl-3 border-l-4 border-luci">
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 {...props} className="text-xl font-semibold text-gray-800 mt-6 mb-2">
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 {...props} className="text-lg font-semibold text-gray-800 mt-4 mb-2">
        {children}
      </h4>
    ),
    p: ({ children, ...props }) => (
      <p {...props} className="text-gray-700 leading-relaxed my-3">
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul {...props} className="list-disc list-outside ml-6 my-3 space-y-1 text-gray-700">
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol {...props} className="list-decimal list-outside ml-6 my-3 space-y-1 text-gray-700">
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li {...props} className="leading-relaxed">{children}</li>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote {...props} className="border-l-4 border-luci bg-luci/5 pl-4 pr-3 py-3 my-4 rounded-r text-gray-800 italic">
        {children}
      </blockquote>
    ),
    code: ({ inline, className, children, ...props }) => {
      const text = String(children).replace(/\n$/, '')
      if (inline) {
        return (
          <code {...props} className="bg-gray-100 text-pink-700 px-1.5 py-0.5 rounded text-sm font-mono">
            {text}
          </code>
        )
      }
      return (
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto text-sm">
          <code {...props} className="font-mono">{text}</code>
        </pre>
      )
    },
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table {...props} className="min-w-full border border-gray-200 rounded-lg text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead {...props} className="bg-luci text-white">{children}</thead>
    ),
    th: ({ children, ...props }) => (
      <th {...props} className="px-3 py-2 text-left font-semibold border border-luci-dark/20">{children}</th>
    ),
    td: ({ children, ...props }) => (
      <td {...props} className="px-3 py-2 border border-gray-200 align-top">{children}</td>
    ),
    tr: ({ children, ...props }) => (
      <tr {...props} className="even:bg-gray-50">{children}</tr>
    ),
    hr: () => <hr className="my-8 border-gray-200" />,
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  }), [baseDir])

  // Filtra TOC por search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS
    const q = search.toLowerCase()
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => it.title.toLowerCase().includes(q)),
    })).filter((s) => s.items.length > 0)
  }, [search])

  // Navegación previo/siguiente
  const currentIdx = TOC.findIndex((t) => t.slug === slug)
  const prev = currentIdx > 0 ? TOC[currentIdx - 1] : null
  const next = currentIdx < TOC.length - 1 ? TOC[currentIdx + 1] : null

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white -mx-4 lg:-mx-6">
      {/* Sidebar TOC */}
      {sidebarOpen && (
        <aside className="w-72 border-r border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
          <div className="sticky top-0 bg-gray-50 z-10 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-luci" />
            <h2 className="font-semibold text-gray-900">Wiki</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto p-1 hover:bg-gray-200 rounded"
              title="Ocultar índice"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tema..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-luci/40"
              />
            </div>
          </div>
          <nav className="px-2 py-3">
            {filteredSections.map((sec) => (
              <div key={sec.title} className="mb-4">
                <h3 className="text-xs uppercase font-semibold text-gray-500 tracking-wider px-3 mb-1">
                  {sec.title}
                </h3>
                <ul>
                  {sec.items.map((it) => {
                    const active = it.slug === slug
                    return (
                      <li key={it.slug}>
                        <Link
                          to={it.slug === 'README' ? '/wiki' : `/wiki/${it.slug}`}
                          className={`block px-3 py-1.5 text-sm rounded transition-colors ${
                            active
                              ? 'bg-luci text-white font-medium'
                              : 'text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {it.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {filteredSections.length === 0 && (
              <div className="text-sm text-gray-500 px-3 py-4">Sin resultados</div>
            )}
          </nav>
        </aside>
      )}

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Toggle sidebar cuando oculto */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="mb-4 flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              <Bars3BottomLeftIcon className="w-4 h-4" />
              Mostrar índice
            </button>
          )}

          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1">
            <Link to="/wiki" className="hover:text-luci">Wiki</Link>
            {tocItem.section !== 'Introducción' && (
              <>
                <ChevronRightIcon className="w-3 h-3" />
                <span>{tocItem.section}</span>
              </>
            )}
            {slug !== 'README' && (
              <>
                <ChevronRightIcon className="w-3 h-3" />
                <span className="text-gray-700 font-medium">{tocItem.title}</span>
              </>
            )}
          </nav>

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <ArrowPathIcon className="w-6 h-6 animate-spin mr-2" />
              Cargando...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              Error cargando contenido: {error}
            </div>
          )}

          {!loading && !error && (
            <article className="wiki-content prose prose-slate max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSlug]}
                components={components}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}

          {/* Navegación prev/next */}
          {!loading && !error && (prev || next) && (
            <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between gap-4">
              {prev ? (
                <Link
                  to={prev.slug === 'README' ? '/wiki' : `/wiki/${prev.slug}`}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:border-luci hover:bg-luci/5 transition-colors"
                >
                  <div className="text-xs text-gray-500">← Anterior</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{prev.title}</div>
                </Link>
              ) : <div className="flex-1" />}
              {next ? (
                <Link
                  to={`/wiki/${next.slug}`}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:border-luci hover:bg-luci/5 transition-colors text-right"
                >
                  <div className="text-xs text-gray-500">Siguiente →</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{next.title}</div>
                </Link>
              ) : <div className="flex-1" />}
            </div>
          )}

          <div className="mt-8 text-xs text-gray-400 text-center">
            Última actualización: 5 de mayo de 2026 · LUCI Customs Agent
          </div>
        </div>
      </main>
    </div>
  )
}
