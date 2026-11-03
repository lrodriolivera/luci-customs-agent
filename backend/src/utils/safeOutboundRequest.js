/**
 * Peticiones salientes a URLs que configura un tenant (webhooks de workflow).
 *
 * Las acciones call_webhook y call_api llamaban con axios a cualquier URL
 * guardada en el workflow y devolvian la respuesta: un admin de tenant (el
 * registro publico da uno) podia leer servicios internos o el endpoint de
 * metadatos de la nube (hallazgo F3, SSRF).
 *
 * Reglas:
 *  - solo https, sin credenciales en la URL;
 *  - la IP de destino no puede ser privada, loopback, link-local (incluido
 *    169.254.169.254), CGNAT, multicast, reservada ni no especificada;
 *  - la IP se comprueba DESPUES de resolver el nombre y es la misma a la que se
 *    conecta: el agente https usa crearLookupSeguro, asi que un DNS que primero
 *    apunta fuera y luego dentro (rebinding) no sirve;
 *  - sin redirecciones (un 302 a una IP interna saltaria todo lo anterior) y
 *    sin proxy de entorno.
 */

const dns = require('dns');
const https = require('https');
const net = require('net');

function ipv4ANumero(ip) {
  return ip.split('.').reduce((acc, octeto) => (acc * 256) + Number(octeto), 0);
}

// [red, bits] en IPv4.
const RANGOS_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4]
].map(([red, bits]) => [ipv4ANumero(red), bits]);

function v4Bloqueada(ip) {
  const n = ipv4ANumero(ip);
  return RANGOS_V4.some(([red, bits]) => {
    const mascara = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
    return ((n & mascara) >>> 0) === ((red & mascara) >>> 0);
  });
}

function v6Bloqueada(ip) {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  // IPv4 mapeada (::ffff:a.b.c.d) o compatible: se juzga la IPv4.
  const mapeada = s.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapeada) return v4Bloqueada(mapeada[1]);
  if (s === '::' || s === '::1') return true;
  const primerGrupo = parseInt(s.split(':')[0] || '0', 16);
  if ((primerGrupo & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local (incluye fd00:ec2::254)
  if ((primerGrupo & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((primerGrupo & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (s.startsWith('64:ff9b:')) return true; // NAT64: puede llegar a IPv4 internas
  return false;
}

/**
 * ¿Es una direccion a la que no se debe conectar? Lo que no es una IP valida
 * se trata como bloqueado.
 * @param {string} ip
 * @returns {boolean}
 */
function esIpBloqueada(ip) {
  const tipo = net.isIP(String(ip).replace(/^\[|\]$/g, ''));
  if (tipo === 4) return v4Bloqueada(ip);
  if (tipo === 6) return v6Bloqueada(ip);
  return true;
}

/**
 * Valida la forma de la URL (antes de resolver nada).
 * @param {string} url
 * @returns {URL}
 */
function validarUrlSaliente(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error('URL de webhook no valida');
  }
  if (u.protocol !== 'https:') throw new Error('Solo se permiten webhooks https');
  if (u.username || u.password) throw new Error('La URL del webhook no puede llevar credenciales');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && esIpBloqueada(host)) throw new Error(`Direccion de destino no permitida: ${host}`);
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error(`Direccion de destino no permitida: ${host}`);
  return u;
}

/**
 * lookup para el agente https: resuelve el nombre, rechaza si ALGUNA de las IP
 * esta bloqueada y conecta a la primera. Al ser el propio lookup del socket,
 * la IP comprobada es la IP a la que se conecta.
 * @param {Function} [resolver=dns.lookup]
 */
function crearLookupSeguro(resolver = dns.lookup) {
  return function lookupSeguro(hostname, opciones, callback) {
    const cb = typeof opciones === 'function' ? opciones : callback;
    const opts = typeof opciones === 'function' ? {} : (opciones || {});
    resolver(hostname, { ...opts, all: true }, (err, direcciones) => {
      if (err) return cb(err);
      const lista = Array.isArray(direcciones) ? direcciones : [{ address: direcciones, family: net.isIP(direcciones) }];
      const bloqueada = lista.find((d) => esIpBloqueada(d.address));
      if (!lista.length || bloqueada) {
        return cb(new Error(`Direccion de destino no permitida: ${bloqueada ? bloqueada.address : hostname}`));
      }
      if (opts.all) return cb(null, lista);
      return cb(null, lista[0].address, lista[0].family);
    });
  };
}

/**
 * Opciones de axios para llamar a una URL de tenant de forma segura. Lanza si
 * la URL no es aceptable.
 * @param {string} url
 * @returns {{ url: string, httpsAgent: https.Agent, maxRedirects: number, proxy: false }}
 */
function opcionesAxiosSeguras(url) {
  validarUrlSaliente(url);
  return {
    url,
    httpsAgent: new https.Agent({ lookup: crearLookupSeguro() }),
    maxRedirects: 0,
    proxy: false
  };
}

module.exports = { esIpBloqueada, validarUrlSaliente, crearLookupSeguro, opcionesAxiosSeguras };
