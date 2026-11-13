/**
 * Mide la clasificacion TARIC contra el juego fijo de productos
 * (tests/fixtures/clasificacion/juego-productos.json).
 *
 * Llama a `aiService.classifyProduct` igual que POST /api/classification/suggest
 * sin expediente: `{ description, additionalInfo: {}, expeditionContext: null }`.
 * Por producto guarda esperado, propuesto, sugerencias, candidatos del
 * catalogo, acierto a 4/6 digitos (8/10 solo si el juego trae `esperado10`) y
 * tiempo; el resumen separa «proveedor sin validar» y «casos de borde».
 *
 * No escribe en la base de datos: las escrituras de Mongoose lanzan error, no
 * se crean indices, y la cache de clasificaciones se anula (ni se lee una
 * respuesta antigua ni se guarda la nueva).
 *
 * Funciona dentro del repo y copiado a otra carpeta (p. ej. /tmp en el
 * contenedor): el codigo de la aplicacion se carga de --app (por defecto el
 * backend del propio guion o, si no lo hay, /app).
 *
 * Ejecutar:  node src/scripts/medirClasificacion.js --salida=/tmp/medicion.json
 *            node /tmp/medirClasificacion.js --app=/app --juego=/tmp/juego-productos.json --salida=/tmp/antes.json
 * Opciones:  --limite=N  --ids=P01,P02
 * Requiere MONGODB_URI y las credenciales de Bedrock en el entorno (o .env de --app).
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const NIVELES = [4, 6, 8, 10];
const RAIZ_CONTENEDOR = '/app';
const OPERACIONES_ESCRITURA = [
  'save', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate',
  'findOneAndDelete', 'findOneAndReplace', 'replaceOne', 'insertMany'
];

const soloDigitos = (codigo) => String(codigo || '').replace(/\D/g, '');

function leerArgumentos(argv) {
  const valor = (nombre) => {
    const arg = argv.find((a) => a.startsWith(`--${nombre}=`));
    return arg ? arg.slice(nombre.length + 3) : undefined;
  };
  const limite = valor('limite');
  const ids = valor('ids');
  return {
    salida: valor('salida'),
    juego: valor('juego'),
    app: valor('app'),
    limite: limite ? parseInt(limite, 10) : undefined,
    ids: ids ? ids.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  };
}

/** Carpeta del backend cuyo codigo se mide. */
function resolverRaizApp(args, dirScript, existe = fs.existsSync) {
  if (args.app) return args.app;
  const delRepo = path.resolve(dirScript, '..', '..');
  if (existe(path.join(delRepo, 'src', 'services', 'aiService.js'))) return delRepo;
  return RAIZ_CONTENEDOR;
}

function resolverJuego(args, dirScript, raizApp, existe = fs.existsSync) {
  if (args.juego) return args.juego;
  const opciones = [
    path.join(dirScript, 'juego-productos.json'),
    path.join(raizApp, 'tests', 'fixtures', 'clasificacion', 'juego-productos.json')
  ];
  return opciones.find((f) => existe(f)) || opciones[1];
}

/** Acierto por nivel; null en los niveles que el juego no permite medir. */
function evaluar(producto, propuesto) {
  const codigo = soloDigitos(propuesto);
  const prefijos4 = [producto.esperado4, ...(producto.alternativas4 || [])].filter(Boolean);
  const esperado10 = soloDigitos(producto.esperado10);
  return {
    4: prefijos4.length ? prefijos4.some((p) => codigo.startsWith(p)) : null,
    6: producto.esperado6 ? codigo.slice(0, 6) === producto.esperado6 : null,
    8: esperado10 ? codigo.slice(0, 8) === esperado10.slice(0, 8) : null,
    10: esperado10 ? codigo === esperado10 : null
  };
}

/** Si la busqueda en el catalogo trajo algun codigo del nivel esperado. */
function esperadoEnCandidatos(producto, candidatos) {
  const codigos = candidatos.map(soloDigitos);
  const algunoEmpieza = (prefijos) => codigos.some((c) => prefijos.some((p) => c.startsWith(p)));
  const prefijos4 = [producto.esperado4, ...(producto.alternativas4 || [])].filter(Boolean);
  const esperado10 = soloDigitos(producto.esperado10);
  return {
    4: prefijos4.length ? algunoEmpieza(prefijos4) : null,
    6: producto.esperado6 ? algunoEmpieza([producto.esperado6]) : null,
    10: esperado10 ? codigos.includes(esperado10) : null
  };
}

function contar(resultados, campo, nivel) {
  const medibles = resultados.filter((r) => r[campo] && r[campo][nivel] !== null && r[campo][nivel] !== undefined);
  const aciertos = medibles.filter((r) => r[campo][nivel] === true).length;
  return {
    medibles: medibles.length,
    aciertos,
    porcentaje: medibles.length ? Math.round((aciertos / medibles.length) * 1000) / 10 : null
  };
}

function resumirGrupo(resultados) {
  const conTiempo = resultados.filter((r) => typeof r.ms === 'number');
  return {
    productos: resultados.length,
    errores: resultados.filter((r) => r.error).length,
    propuestosDeclarables: resultados.filter((r) => r.verificado === true).length,
    msMedio: conTiempo.length ? Math.round(conTiempo.reduce((t, r) => t + r.ms, 0) / conTiempo.length) : null,
    aciertos: Object.fromEntries(NIVELES.map((n) => [String(n), contar(resultados, 'aciertos', n)])),
    esperadoEnCandidatos: Object.fromEntries([4, 6, 10].map((n) => [String(n), contar(resultados, 'esperadoEnCandidatos', n)]))
  };
}

function resumir(resultados) {
  const grupos = [...new Set(resultados.map((r) => r.grupo))].sort();
  return {
    total: resultados.length,
    errores: resultados.filter((r) => r.error).length,
    global: resumirGrupo(resultados),
    porGrupo: Object.fromEntries(grupos.map((g) => [g, resumirGrupo(resultados.filter((r) => r.grupo === g))]))
  };
}

/**
 * Clasifica cada producto del juego, uno detras de otro.
 * `clasificar` recibe los mismos parametros que classifyProduct y devuelve
 * `{ sugerencias, candidatos }` (codigos de los candidatos del catalogo).
 */
async function medirJuego({ productos, clasificar, ids, limite, reloj = Date.now, alAvanzar = () => {} }) {
  const elegidos = productos
    .filter((p) => !ids || ids.includes(p.id))
    .slice(0, limite || undefined);

  const resultados = [];
  for (const producto of elegidos) {
    const base = {
      id: producto.id,
      grupo: producto.grupo,
      descripcion: producto.descripcion,
      esperado: { 4: producto.esperado4 || null, 6: producto.esperado6 || null, 10: producto.esperado10 || null },
      ...(producto.alternativas4 ? { alternativas4: producto.alternativas4 } : {})
    };
    const inicio = reloj();
    let resultado;
    try {
      const { sugerencias = [], candidatos = [] } = await clasificar({
        description: producto.descripcion,
        additionalInfo: {},
        expeditionContext: null
      });
      const primera = sugerencias[0] || {};
      resultado = {
        ...base,
        propuesto: primera.code || null,
        verificado: primera.verified,
        sugerencias: sugerencias.map((s) => ({
          code: s.code,
          confidence: s.confidence,
          verified: s.verified,
          enCandidatos: s.enCandidatos,
          reasoning: String(s.reasoning || '').slice(0, 600)
        })),
        candidatos,
        esperadoEnCandidatos: esperadoEnCandidatos(producto, candidatos),
        aciertos: evaluar(producto, primera.code),
        ms: reloj() - inicio
      };
    } catch (error) {
      resultado = {
        ...base,
        propuesto: null,
        sugerencias: [],
        candidatos: [],
        aciertos: evaluar(producto, null),
        ms: reloj() - inicio,
        error: error.message
      };
    }
    resultados.push(resultado);
    alAvanzar(resultado, resultados.length, elegidos.length);
  }
  return resultados;
}

/** Plugin de Mongoose: cualquier escritura lanza error. */
function soloLectura(esquema) {
  const bloquear = () => {
    throw new Error('medirClasificacion: base de datos en solo lectura');
  };
  esquema.pre(OPERACIONES_ESCRITURA, bloquear);
}

async function main() {
  const args = leerArgumentos(process.argv.slice(2));
  const raizApp = resolverRaizApp(args, __dirname);
  const rutaJuego = resolverJuego(args, __dirname, raizApp);
  const salida = args.salida || `/tmp/medicion-clasificacion-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const requerirApp = createRequire(path.join(raizApp, 'package.json'));

  try { requerirApp('dotenv').config({ path: path.join(raizApp, '.env') }); } catch (e) { /* sin dotenv: entorno del contenedor */ }

  const mongoose = requerirApp('mongoose');
  // Antes de cargar ningun modelo, para que el bloqueo llegue a todos.
  mongoose.plugin(soloLectura);
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs', { autoIndex: false });

  const aiService = requerirApp(path.join(raizApp, 'src', 'services', 'aiService.js'));
  if (!aiService.client) throw new Error('Bedrock no configurado: la IA responderia en modo simulado y la medida no valdria');
  aiService.classificationCache = { get: async () => null, set: async () => {} };

  let candidatosUltimos = [];
  const candidatosOriginal = aiService._candidatosCatalogo.bind(aiService);
  aiService._candidatosCatalogo = async (...a) => {
    const candidatos = await candidatosOriginal(...a);
    candidatosUltimos = candidatos.map((c) => c.code);
    return candidatos;
  };

  const clasificar = async (parametros) => {
    candidatosUltimos = [];
    const sugerencias = await aiService.classifyProduct(parametros);
    return { sugerencias, candidatos: candidatosUltimos };
  };

  const juego = JSON.parse(fs.readFileSync(rutaJuego, 'utf8'));
  const inicio = new Date();
  const resultados = await medirJuego({
    productos: juego.productos,
    clasificar,
    ids: args.ids,
    limite: args.limite,
    alAvanzar: (r, i, total) => console.log(
      `[${i}/${total}] ${r.id} esperado ${r.esperado[6] || r.esperado[4]} -> ${r.propuesto || r.error} (${r.ms} ms)`
    )
  });

  const informe = {
    medidoEl: inicio.toISOString(),
    codigoMedido: raizApp,
    juego: rutaJuego,
    llamada: 'aiService.classifyProduct({ description, additionalInfo: {}, expeditionContext: null })',
    resumen: resumir(resultados),
    resultados
  };
  fs.writeFileSync(salida, `${JSON.stringify(informe, null, 2)}\n`);

  console.log(`\nResultados en ${salida}`);
  console.log(JSON.stringify(informe.resumen, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`medirClasificacion: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { leerArgumentos, resolverRaizApp, resolverJuego, evaluar, esperadoEnCandidatos, resumir, medirJuego, soloLectura };
