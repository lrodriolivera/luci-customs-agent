#!/usr/bin/env node
/**
 * Sincroniza el catalogo de contingentes arancelarios desde el sistema QUOTA de
 * la Comision Europea a la coleccion `TariffQuota`.
 *
 * POR QUE
 * -------
 * `quotaService.js` llevaba 11 contingentes escritos a mano. De esos 11 numeros
 * de orden, 10 NO EXISTEN en la base oficial en ningun ano, y el unico que
 * existe (090101) describe otro producto y otra unidad. La fuente publica ~1.960
 * filas para 2026 (un contingente ocupa una fila por periodo de validez).
 *
 * USO
 * ---
 *   node scripts/sincronizarContingentes.js --ano 2026            # todos
 *   node scripts/sincronizarContingentes.js --ano 2026 --limite 50
 *   node scripts/sincronizarContingentes.js --orden 090006,090101
 *   node scripts/sincronizarContingentes.js --ano 2026 --seco     # sin escribir
 *
 * AVISOS
 * ------
 *  - Son dos peticiones por contingente (listado + detalle), mas ~98 paginas de
 *    listado: es una tirada de horas. Hay pausa entre peticiones para no
 *    castigar la fuente y se puede cortar con `--limite`.
 *  - Los contingentes que fallan se reintentan y, si siguen fallando, se anotan
 *    y NO se escriben a medias: un contingente con volumen y sin saldo se leeria
 *    como saldo cero.
 *  - El homelab no tiene salida directa a internet en los contenedores: este
 *    script se ejecuta donde haya salida (ver DEPLOY.md) o con la VPN levantada.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const cliente = require('../src/services/quotaOfficialClient');
const quotaService = require('../src/services/quotaService');

const PAUSA_MS = 300;
const INTENTOS = 3;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function argumentos() {
  const a = process.argv.slice(2);
  const valor = (nombre) => {
    const i = a.indexOf(nombre);
    return i >= 0 ? a[i + 1] : null;
  };
  return {
    ano: parseInt(valor('--ano'), 10) || new Date().getFullYear(),
    limite: parseInt(valor('--limite'), 10) || 0,
    ordenes: (valor('--orden') || '').split(',').filter(Boolean),
    seco: a.includes('--seco')
  };
}

/**
 * Consulta con reintentos: un fallo de red no es "el contingente no existe".
 *
 * El primer intento reutiliza la cookie en curso; los siguientes van sin ella para
 * que el cliente abra sesion nueva. Repetir la misma cookie ya muerta era volver a
 * pedir exactamente lo que acababa de fallar.
 */
async function consultarConReintentos(orden, ano, cookie) {
  let ultimo = null;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      return await cliente.consultarContingente(orden, ano, intento === 1 ? cookie : null);
    } catch (err) {
      ultimo = err;
      await espera(intento * 1500);
    }
  }
  throw ultimo;
}

async function main() {
  const { ano, limite, ordenes, seco } = argumentos();

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/luci');
  console.log(`Sincronizando contingentes de ${ano}${seco ? ' (SIMULACION, no escribe)' : ''}`);

  const cookie = await cliente.abrirSesion();

  let aConsultar = ordenes;
  if (!aConsultar.length) {
    const listado = await cliente.listarAno(ano, { cookie });
    console.log(`La fuente publica ${listado.length} contingentes para ${ano}`);
    aConsultar = listado.map((f) => f.orderNumber);
  }
  if (limite) aConsultar = aConsultar.slice(0, limite);

  const escritos = [];
  const inexistentes = [];
  const fallidos = [];

  // La cookie se va renovando: la sesion caduca a mitad de la tirada y el cliente
  // la reabre. Seguir pidiendo con la de arranque hacia que fallara TODO a partir
  // de ese punto (medido: 16 de 50 seguidos con "devolvio 302").
  let cookieViva = cookie;

  for (let i = 0; i < aConsultar.length; i++) {
    const orden = aConsultar[i];
    try {
      const detalle = await consultarConReintentos(orden, ano, cookieViva);
      if (detalle?.cookieEnUso) cookieViva = detalle.cookieEnUso;

      // `null` = la fuente responde 200 con la tabla vacia: ese numero de orden
      // no existe. Es un dato, no un fallo, y hay que distinguirlo.
      if (!detalle) {
        inexistentes.push(orden);
      } else if (seco) {
        escritos.push(orden);
      } else {
        await quotaService.guardarContingente({ ...detalle, orderNumber: orden, year: ano });
        escritos.push(orden);
      }
    } catch (err) {
      fallidos.push({ orden, error: err.message });
    }

    if ((i + 1) % 25 === 0 || i === aConsultar.length - 1) {
      console.log(`  ${i + 1}/${aConsultar.length} — ${escritos.length} ok, ` +
        `${inexistentes.length} inexistentes, ${fallidos.length} fallidos`);
    }
    await espera(PAUSA_MS);
  }

  console.log('\nResumen');
  console.log(`  sincronizados : ${escritos.length}`);
  console.log(`  inexistentes  : ${inexistentes.length}${inexistentes.length ? ` (${inexistentes.slice(0, 10).join(', ')}...)` : ''}`);
  console.log(`  fallidos      : ${fallidos.length}`);
  // Los fallidos se listan siempre: un contingente que no se pudo traer no debe
  // quedarse en silencio con el dato viejo en la base.
  fallidos.forEach((f) => console.log(`    ${f.orden}: ${f.error}`));

  await mongoose.disconnect();
  process.exit(fallidos.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Error:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
