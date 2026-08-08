/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // TransitManager compone clases de color al vuelo (`bg-${typeConfig.color}-100`,
  // `text-${statusConfig.color}-800`, `hover:bg-${action.color}-200`) a partir de
  // TRANSIT_TYPES, STATUS_CONFIG y getNextActions. El purge solo conserva las clases
  // que aparecen COMO TEXTO LITERAL en el fuente, asi que las que ningun otro
  // componente usaba desaparecian del CSS: T2F (teal) sin color, el estado
  // "Entregado" (lime) sin chip y el boton "Liberar Mercancias" sin fondo ni color
  // de texto. Sin error de compilacion ni de consola: el elemento se pinta en blanco.
  // El test `transit-tailwind-purge.test.js` exige que esta lista siga completa.
  safelist: [
    // Tipos de transito (TRANSIT_TYPES): tarjeta de estadisticas, icono y chip.
    'bg-blue-50', 'border-blue-200', 'bg-blue-100', 'text-blue-600', 'text-blue-800',
    'bg-green-50', 'border-green-200', 'bg-green-100', 'text-green-600', 'text-green-800',
    'bg-teal-50', 'border-teal-200', 'bg-teal-100', 'text-teal-600', 'text-teal-800',
    'bg-purple-50', 'border-purple-200', 'bg-purple-100', 'text-purple-600', 'text-purple-800',
    // Estados (STATUS_CONFIG): chip de estado.
    'bg-gray-100', 'text-gray-800',
    'bg-indigo-100', 'text-indigo-800',
    'bg-cyan-100', 'text-cyan-800',
    'bg-orange-100', 'text-orange-800',
    'bg-yellow-100', 'text-yellow-800',
    'bg-amber-100', 'text-amber-800',
    'bg-lime-100', 'text-lime-800',
    'bg-red-100', 'text-red-800',
    // Acciones del ciclo NCTS (getNextActions): incluye el estado hover.
    'hover:bg-blue-200', 'hover:bg-red-200', 'hover:bg-cyan-200', 'hover:bg-orange-200',
    'hover:bg-yellow-200', 'hover:bg-lime-200', 'hover:bg-green-200', 'hover:bg-amber-200',
    'hover:bg-purple-200',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        luci: {
          light: '#e0f2fe',
          DEFAULT: '#0284c7',
          dark: '#0369a1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
