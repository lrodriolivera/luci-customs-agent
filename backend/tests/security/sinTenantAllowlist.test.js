/**
 * Lista cerrada de excepciones al guard de listados por tenant.
 *
 * utils/tenantListGuard deja pasar un listado sin tenantId solo si declara la
 * opcion sinTenant con un motivo. Cada excepcion es un sitio donde se puede leer
 * entre tenants, asi que estan fijadas aqui: si aparece una nueva (o cambia el
 * motivo de una existente) el test falla y hay que revisarla y anadirla a mano.
 *
 * Solo cuenta el codigo de produccion (src/): los tests pueden usar sinTenant
 * para leer la base y comprobar resultados.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../src');

/**
 * fichero -> motivos permitidos (uno por uso). Revisados uno a uno.
 */
const PERMITIDOS = {
  'models/Deadline.js': [
    'cron de alertas: recorre los plazos de todos los tenants y avisa a cada asignado'
  ],
  'scripts/seedDemoData.js': [
    'seed: resumen global de lo que hay en la base tras sembrar',
    'seed: resumen global de lo que hay en la base tras sembrar',
    'seed: resumen global de lo que hay en la base tras sembrar'
  ],
  'models/ChatMessage.js': [
    'acotado por expediente: quien llama ya comprobo que el expediente es del tenant (ensureSameTenant o token del portal)',
    'acotado por expediente: quien llama ya comprobo que el expediente es del tenant (ensureSameTenant o token del portal)'
  ]
};

function ficheros(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

function usosDeSinTenant() {
  const usos = {};
  for (const f of ficheros(SRC)) {
    const rel = path.relative(SRC, f);
    if (rel === 'utils/tenantListGuard.js') continue; // la definicion, con ejemplos en comentarios
    const codigo = fs.readFileSync(f, 'utf8')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    for (const m of codigo.matchAll(/sinTenant\s*:\s*([^}]*)/g)) {
      const literal = m[1].trim().match(/^'([^']*)'|^"([^"]*)"/);
      (usos[rel] = usos[rel] || []).push(literal ? (literal[1] ?? literal[2]) : `NO ES UN LITERAL: ${m[1].trim()}`);
    }
  }
  return usos;
}

test('los usos de sinTenant en src/ son exactamente los permitidos', () => {
  expect(usosDeSinTenant()).toEqual(PERMITIDOS);
});

test('cada motivo es un texto explicativo, no true ni una variable', () => {
  for (const motivos of Object.values(usosDeSinTenant())) {
    for (const motivo of motivos) {
      expect(motivo).not.toMatch(/^NO ES UN LITERAL/);
      expect(motivo.length).toBeGreaterThan(20);
    }
  }
});
