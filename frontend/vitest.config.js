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
    // La batería completa corre ~1500 tests con userEvent real; bajo esa carga
    // algunos tests con secuencias de teclado superan el default de 5s de forma
    // no determinista (en aislamiento terminan en <1s). 15s da margen sin
    // enmascarar cuelgues reales (bucles infinitos siguen atrapados).
    testTimeout: 15000,
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
