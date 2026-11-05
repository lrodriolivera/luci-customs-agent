# LUCI — frontend

React + Vite + MUI. Tests unitarios con vitest (`npm test`), build con `npm run build`.

## Tests E2E (Cypress y Playwright)

Los E2E **no corren en CI** y no llevan credenciales en el código: las leen del
entorno a través de `e2e/env.js`. Si falta alguna variable, fallan al cargar con
un error que nombra cuál definir.

| Variable | Para qué |
|---|---|
| `E2E_USER` | Email del usuario de pruebas |
| `E2E_PASS` | Contraseña del usuario de pruebas |
| `E2E_CERT_PASSWORD` | Frase de paso del `.p12` de pruebas (solo `playwright/aeat-certificates-e2e.spec.js`) |
| `BASE_URL` | Entorno objetivo. Por defecto `http://localhost:5173` |

Los valores están en 1Password. Cómo lanzarlos:

```bash
cp .env.example .env        # frontend/.env está en .gitignore; rellénalo
npm run dev                 # en otra terminal: sirve http://localhost:5173
set -a; . ./.env; set +a    # exporta las variables al shell actual
npm run test:e2e:playwright
npm run test:e2e:cypress
```

Cypress y Playwright no cargan `.env` por sí solos: hay que exportar las
variables como arriba (o anteponerlas al comando).

Contra otro entorno, `BASE_URL` se pasa de forma explícita:

```bash
BASE_URL=https://staging.example.com npm run test:e2e:playwright
```

No lances los E2E contra producción con una cuenta de superadmin: usa un usuario
de pruebas de mínimos privilegios.
