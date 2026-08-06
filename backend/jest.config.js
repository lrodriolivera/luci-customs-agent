module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/config/**',
    // Scripts CLI de operación (seed de datos, createIndexes, createSuperAdmin,
    // backfill/cifrado de PII): se ejecutan a mano fuera del ciclo de la app, no
    // son código servido. Mismo criterio que app.js/config: fuera del denominador.
    '!src/scripts/**',
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  coverageDirectory: 'coverage',

  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Timeout
  testTimeout: 10000,

  // 61 suites levantan cada una su propio mongod en memoria (tests/helpers/
  // memoryDb.js). Sin tope, Jest lanza un worker por CPU-1 y esta maquina
  // acababa con 7 mongod simultaneos peleando por la RAM: la bateria completa
  // no terminaba en 50 minutos y aparecian fallos fantasma de suites que
  // pasaban al reintentarlas en solitario. 4 workers es el equilibrio medido
  // aqui; subirlo vuelve a degradar. Override puntual con --maxWorkers=N.
  maxWorkers: process.env.JEST_MAX_WORKERS || 4,

  // Recicla el worker cuando pasa de este consumo. Sin esto, la memoria de las
  // suites con BD se acumula a lo largo de la bateria y los ultimos workers se
  // arrastran.
  workerIdleMemoryLimit: '512MB',

  // Un handle que quede abierto (una conexion de Mongoose sin cerrar, un timer
  // sin unref) dejaba el proceso colgado tras el resumen: al matarlo por
  // timeout quedaban workers huerfanos consumiendo CPU e interfiriendo con la
  // siguiente ejecucion. Con forceExit el proceso termina cuando acaban los
  // tests; detectOpenHandles (bajo demanda) dice cual es el culpable.
  forceExit: true,

  // verbose imprimia una linea por cada uno de los ~8.100 tests, lo que hace
  // ilegible la salida y esconde el resumen. Se activa por suite cuando hace
  // falta: npx jest ruta/al.test.js --verbose
  verbose: false,

  // Clear mocks between tests
  clearMocks: true,

  // Reset mocks between tests
  resetMocks: true,

  // Restore mocks between tests
  restoreMocks: true
};
