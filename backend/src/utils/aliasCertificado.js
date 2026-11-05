/**
 * Alias de certificado AEAT. Aparece en rutas (/certificates/:alias) y en
 * listados, asi que se restringe a un conjunto seguro (F9, CWE-22): letras,
 * digitos, ".", "_" y "-", de 1 a 64 caracteres, y nunca "." ni "..".
 */
const PATRON_ALIAS = /^[A-Za-z0-9._-]{1,64}$/;

function esAliasCertificadoValido(alias) {
  return typeof alias === 'string' && PATRON_ALIAS.test(alias) && alias !== '.' && alias !== '..';
}

module.exports = { PATRON_ALIAS, esAliasCertificadoValido };
