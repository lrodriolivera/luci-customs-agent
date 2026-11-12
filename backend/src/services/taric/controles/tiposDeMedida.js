/**
 * Nombre en español de los tipos de medida de control del TARIC. La Comision
 * solo publica el nombre en ingles en el fichero de medidas: esta traduccion
 * es de LUCI. Un tipo que no este aqui se muestra con su nombre oficial.
 */
const NOMBRES = {
  277: 'Prohibición de importación',
  410: 'Control veterinario',
  415: 'Control oficial de vegetales (fitosanitario)',
  464: 'Declaración de subpartida sujeta a disposiciones de destino final',
  465: 'Restricción al despacho a libre práctica',
  474: 'Despacho a libre práctica con límite cuantitativo',
  475: 'Restricción al despacho a libre práctica',
  481: 'Declaración de subpartida sujeta a restricciones',
  482: 'Declaración de subpartida sujeta a restricciones legales (peso neto)',
  483: 'Declaración de subpartida sujeta a restricciones legales (precio unitario)',
  484: 'Declaración de subpartida sujeta a restricciones físicas',
  495: 'Declaración de subpartida sujeta a restricciones legales',
  496: 'Declaración de subpartida sujeta a restricciones legales',
  705: 'Prohibición de importación de productos para tortura y represión',
  707: 'Control de importación',
  710: 'Control de importación CITES',
  711: 'Control de importación de bienes y tecnologías restringidos',
  712: 'Control de importación de especies exóticas invasoras',
  713: 'Control de importación de organismos modificados genéticamente',
  714: 'Control de importación',
  719: 'Control de la pesca ilegal, no declarada y no reglamentada',
  722: 'Restricción al despacho a libre práctica (piensos y alimentos)',
  724: 'Control de importación de gases fluorados de efecto invernadero',
  726: 'Control de importación de sustancias que agotan la capa de ozono',
  728: 'Control de importación de artículos de lujo',
  730: 'Cumplimiento de los controles previos a la exportación',
  731: 'Control de importación',
  732: 'Control de importación',
  734: 'Control de importación de bienes culturales',
  738: 'Restricción de importación de la Lista Común Militar',
  745: 'Control de importación de pieles de perro y de gato',
  746: 'Control de importación de productos derivados de la foca',
  747: 'Control de importación de madera (licencia FLEGT)',
  748: 'Control de importación de mercurio',
  750: 'Control de importación de productos ecológicos',
  755: 'Control de importación de residuos',
  760: 'Control de importación',
  761: 'Control de importación REACH',
  762: 'Control de importación',
  763: 'Control de importación',
  764: 'Control de importación',
  769: 'Control de importación de contaminantes orgánicos persistentes',
  770: 'Control de importación de madera (licencia FLEGT)',
  775: 'Mecanismo de Ajuste en Frontera por Carbono (CBAM)'
};

// Medidas que no piden un certificado: impiden la importacion.
const PROHIBICIONES = new Set(['277', '705']);

const nombreDeTipo = (tipo, nombreOficial) => NOMBRES[tipo] || nombreOficial || `Medida ${tipo}`;
const esProhibicion = (tipo) => PROHIBICIONES.has(String(tipo));

module.exports = { nombreDeTipo, esProhibicion, NOMBRES };
