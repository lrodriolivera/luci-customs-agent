import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config de tests unitarios/componentes SEPARADA de vite.config.js (build).
// jsdom + Testing Library. La cobertura se mide con v8.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',              // bootstrap, no es código de negocio servido
        'src/i18n/**',               // config i18next + locales
        'src/styles/**',
        'src/test/**',
        'src/**/*.{test,spec}.{js,jsx}',
        'src/services/cognitoConfig.js' // 2 líneas de config estática
      ]
    }
  }
})
