import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// Conservative manualChunks: keep React + everything that imports React together in
// vendor-react to avoid TDZ errors where a UI lib loads before react-dom. Only split
// purely standalone libraries (charts, icons, sentry, i18n, utilities).
export default defineConfig({
  plugins: [
    react(),
    // Generates dist/stats.html on build (gzip + brotli sizes). View with `open dist/stats.html`.
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap'
    })
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Charts: recharts + its d3 helpers (no direct React lib deps in runtime)
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-vendor/')) return 'vendor-charts'
          // Heroicons: pure SVG components, safe to split
          if (id.includes('/@heroicons/')) return 'vendor-icons'
          // Sentry: its own bundle
          if (id.includes('/@sentry/')) return 'vendor-sentry'
          // i18n: standalone
          if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'vendor-i18n'
          // Everything else (react, react-dom, react-router, @mui, @emotion, @headlessui,
          // react-hot-toast, react-dropzone, axios, etc.) stays together so React is
          // always loaded before any consumer.
          return 'vendor'
        }
      }
    },
    chunkSizeWarningLimit: 1500
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/ai': {
        target: 'http://localhost:8003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, '')
      }
    }
  }
})
