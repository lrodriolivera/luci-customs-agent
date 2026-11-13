/**
 * Politica unica para "poner una contrasena nueva" (no para iniciar sesion:
 * el minlength de 6 del esquema de User no cambia, asi que una contrasena
 * corta de antes de que existiera esta politica sigue entrando sin problema).
 *
 * Antes cada punto que dejaba elegir una contrasena nueva la validaba a su
 * manera (o no la validaba): PUT /api/auth/password (10-128, letra+numero,
 * via express-validator), POST /reset-password/:token (solo minlength 6),
 * adminController.createUser/updateUser (solo longitud, y updateUser ni
 * siquiera avisaba si no llegaba a 6: la ignoraba en silencio). Un valor no
 * string (un array, p.ej.) colaba 400 en unos sitios y 500 en otros, segun
 * que operador de forma lo tocara primero.
 *
 * Un solo punto: .isString() primero (nunca .length ni regex sobre algo que
 * no sea texto), 10-128 caracteres, al menos una letra y un numero.
 */

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;
const REGEX_LETRA = /[A-Za-z]/;
const REGEX_NUMERO = /\d/;

function esPasswordValida(password) {
  if (typeof password !== 'string') return false;
  if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) return false;
  if (!REGEX_LETRA.test(password)) return false;
  if (!REGEX_NUMERO.test(password)) return false;
  return true;
}

const MENSAJE_POLITICA = `La contrasena debe ser texto, de ${MIN_LENGTH} a ${MAX_LENGTH} caracteres, con al menos una letra y un numero.`;

module.exports = { esPasswordValida, MENSAJE_POLITICA, MIN_LENGTH, MAX_LENGTH };
