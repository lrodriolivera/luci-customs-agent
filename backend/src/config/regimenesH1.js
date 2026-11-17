/**
 * Catalogo oficial del regimen (D.E. 1/10, casilla 37.1) y de los codigos de
 * regimen adicional (D.E. 1/11, casilla 37.2) para el H1 que se presenta a la
 * AEAT por el servicio CAU (CC415A).
 *
 * Fuentes (consultadas el 17/11/2026):
 *  - [UE-1/10] Reglamento de Ejecucion (UE) 2015/2447, anexo B, titulo II, E.D.
 *    11 09 000 000 «Regimen» (version consolidada 02015R2447-20260701, EUR-Lex):
 *    lista de los elementos de dos cifras y cuadro «Codigos de regimen
 *    utilizados en el contexto de las declaraciones en aduana», fila H1:
 *    «01, 07, 40, 42, 43, 44, 45, 46, 48, 61, 63 y 68». Los codigos marcados
 *    con a) (78) solo sirven como regimen precedente.
 *  - [UE-1/11] Mismo anexo, E.D. 11 10 000 000 «Regimen adicional»: codigos de
 *    la Union de importacion (A, B, C, D, E y F). Los de exportacion (B5x,
 *    C7x, E5x-E7x, F61, F65, F75, F76) no se usan en el H1.
 *  - [AEAT-GUIA] AEAT, «Guia tecnica de Importacion adaptada al CAU» v3.20:
 *    requestedProcedure y previousProcedure se validan concatenados contra la
 *    tabla H1REG371 (regla ESR0967) y additionalProcedure contra H1REG372.
 *    Esas dos tablas solo se consultan con certificado
 *    (wlpl/ADIP-JDIT/SvListaTablasCCI), por eso aqui solo hay combinaciones
 *    que una fuente publica respalda.
 *  - [AEAT-REGLAS] AEAT, «Reglas y Condiciones Importacion CAU» v4.10:
 *    ESR0973 (40.51 y 40.71), ESR0900 (71 solo con destino Gibraltar en
 *    declaraciones no CCI), ESRGI0002-ESRGI0025 (Gibraltar: 4051, 4053, 4071,
 *    5100, 5300, 7100, 4400 y los adicionales 5GI, 5GS, 5GP, 5GT, 5GA, 5GD).
 *  - [AEAT-INFO] AEAT, «Informacion complementaria H1» v3.26 (14/09/2026):
 *    separata 13 (adicionales 132, 327, 328, 404), separata 37 (pendencias
 *    9AI-9VI) y separata de Gibraltar (5GA, 5GD, 71.00 y 71.71).
 *  - [AEAT-RREE] AEAT, «Informacion complementaria H1 RR.EE.» v1.4: regimenes
 *    especiales 44, 46, 48, 51 y 53 en el H1 y adicional 131 (destino final con
 *    envio simultaneo a otro Estado miembro).
 *
 * Los codigos nacionales 1P1-1P5 (impuesto sobre envases de plastico) no estan
 * aqui: los anade cada partida segun su exencion (ver plasticoEnH1).
 */

const FUENTE_UE_110 = 'Reglamento de Ejecución (UE) 2015/2447, anexo B, título II, E.D. 11 09 000 000 (columna H1)';
const FUENTE_UE_111 = 'Reglamento de Ejecución (UE) 2015/2447, anexo B, título II, E.D. 11 10 000 000';

// Regimen solicitado: resumen del texto oficial [UE-1/10]. El 40 es literal.
const REGIMENES_SOLICITADOS = Object.freeze({
  '01': 'Despacho a libre práctica con reexpedición simultánea a una parte del territorio aduanero de la Unión donde no se aplica la Directiva del IVA',
  '07': 'Despacho a libre práctica con inclusión simultánea en un depósito distinto del aduanero, sin pagar el IVA ni, en su caso, impuestos especiales',
  '40': 'Despacho a libre práctica con despacho simultáneo a consumo de mercancías',
  '42': 'Despacho a consumo y a libre práctica de mercancías objeto de entrega exenta del IVA a otro Estado miembro',
  '43': 'Despacho a consumo y a libre práctica con medidas especiales del período transitorio tras una adhesión',
  '44': 'Destino final: libre práctica y consumo con exención o tipo reducido de derechos por su utilización con fines particulares',
  '45': 'Libre práctica y entrada parcial para consumo (solo IVA o solo impuestos especiales) e inclusión en un depósito distinto del aduanero',
  '46': 'Importación previa de productos transformados a partir de mercancías equivalentes en perfeccionamiento pasivo',
  '48': 'Despacho a consumo y a libre práctica de productos de sustitución en perfeccionamiento pasivo antes de exportar las mercancías defectuosas',
  '51': 'Inclusión de mercancías en el régimen de perfeccionamiento activo',
  '53': 'Inclusión de mercancías en el régimen de importación temporal',
  '61': 'Reimportación con despacho simultáneo a libre práctica y a consumo',
  '63': 'Reimportación con despacho a consumo y a libre práctica de mercancías objeto de entrega exenta del IVA a otro Estado miembro',
  '68': 'Reimportación con entrada parcial para consumo y libre práctica e inclusión en un depósito distinto del aduanero',
  '71': 'Inclusión de mercancías en el régimen de depósito aduanero'
});

// Regimen precedente [UE-1/10]: «el regimen en el que estaban incluidas las
// mercancias antes de ser incluidas en el regimen solicitado».
const REGIMENES_PRECEDENTES = Object.freeze({
  '00': 'sin régimen precedente',
  '21': 'tras una exportación temporal en perfeccionamiento pasivo',
  '51': 'procedente de perfeccionamiento activo',
  '53': 'procedente de importación temporal',
  '54': 'procedente de perfeccionamiento activo en otro Estado miembro',
  '71': 'procedente de depósito aduanero',
  '78': 'procedente de zona franca'
});

const GRUPO_LIBRE_PRACTICA = 'Despacho a libre práctica (columna H1 de la UE)';
const GRUPO_PRECEDENTE = 'Procedente de otro régimen';
const GRUPO_ESPECIALES = 'Regímenes especiales que la AEAT admite en el H1';
const GRUPO_GIBRALTAR = 'Solo con destino Gibraltar';

// Combinaciones solicitado + precedente admitidas en LUCI, cada una con su fuente.
const COMBINACIONES = [
  ...['01', '07', '40', '42', '43', '44', '45', '46', '48', '61', '63', '68']
    .map((r) => ({ codigo: `${r}00`, grupo: GRUPO_LIBRE_PRACTICA, fuente: FUENTE_UE_110 })),
  { codigo: '4051', grupo: GRUPO_PRECEDENTE, fuente: 'AEAT, Reglas y Condiciones Importación CAU v4.10, ESR0973 y ESRGI0019' },
  { codigo: '4053', grupo: GRUPO_PRECEDENTE, fuente: 'AEAT, Reglas y Condiciones Importación CAU v4.10, ESRGI0019' },
  { codigo: '4054', grupo: GRUPO_PRECEDENTE, fuente: 'Reglamento de Ejecución (UE) 2015/2447, anexo B, título II, E.D. 11 09 000 000 (ejemplo 4054)' },
  { codigo: '4071', grupo: GRUPO_PRECEDENTE, fuente: 'AEAT, Reglas y Condiciones Importación CAU v4.10, ESR0973 y ESRGI0019' },
  { codigo: '4078', grupo: GRUPO_PRECEDENTE, fuente: 'Reglamento de Ejecución (UE) 2015/2447, anexo B, título II, E.D. 11 09 000 000 (código 78, solo como precedente)' },
  { codigo: '6121', grupo: GRUPO_PRECEDENTE, fuente: 'Reglamento de Ejecución (UE) 2015/2447, anexo B, título II, E.D. 11 09 000 000 (ejemplo 6121)' },
  { codigo: '5100', grupo: GRUPO_ESPECIALES, fuente: 'AEAT, Información complementaria H1 RR.EE. v1.4; Reglas ESRGI0013' },
  { codigo: '5300', grupo: GRUPO_ESPECIALES, fuente: 'AEAT, Información complementaria H1 RR.EE. v1.4; Reglas ESRGI0013' },
  {
    codigo: '7100', grupo: GRUPO_GIBRALTAR, fuente: 'AEAT, Reglas ESR0900 y ESRGI0023; Información complementaria H1 v3.26 (Gibraltar)',
    nota: 'La AEAT solo admite el 71 en el H1 con destino Gibraltar.'
  },
  {
    codigo: '7171', grupo: GRUPO_GIBRALTAR, fuente: 'AEAT, Información complementaria H1 v3.26 (Gibraltar: 71.71 si viene de un depósito del TAU)',
    nota: 'La AEAT solo admite el 71 en el H1 con destino Gibraltar.'
  }
].map((c) => Object.freeze({
  ...c,
  solicitado: c.codigo.slice(0, 2),
  precedente: c.codigo.slice(2, 4),
  descripcion: descripcionDe(c.codigo.slice(0, 2), c.codigo.slice(2, 4))
}));

/** «Despacho a libre práctica… · procedente de depósito aduanero» (sin sufijo con precedente 00). */
function descripcionDe(solicitado, precedente) {
  const base = REGIMENES_SOLICITADOS[solicitado];
  if (!base) return null;
  return precedente && precedente !== '00' && REGIMENES_PRECEDENTES[precedente]
    ? `${base} · ${REGIMENES_PRECEDENTES[precedente]}` : base;
}

const GRUPOS_UE = {
  A: 'Perfeccionamiento activo (art. 256 del Código)',
  B: 'Perfeccionamiento pasivo (art. 259 del Código)',
  C: 'Franquicias (Reglamento (CE) n.º 1186/2009)',
  D: 'Importación temporal',
  E: 'Productos agrícolas',
  F: 'Otros'
};

// Codigos de la Union de importacion [UE-1/11], texto oficial.
const ADICIONALES_UE = [
  ['A04', 'Mercancías incluidas en un régimen de perfeccionamiento activo en situaciones en las que solo deba pagarse el IVA.'],
  ['A10', 'Destrucción de mercancías en régimen de perfeccionamiento activo.'],
  ['B01', 'Reimportación tras el perfeccionamiento pasivo de conformidad con el artículo 260 bis del Código.'],
  ['B02', 'Productos transformados de retorno tras su reparación bajo garantía de conformidad con el artículo 260 del Código (mercancías reparadas de forma gratuita).'],
  ['B03', 'Productos transformados de retorno tras su sustitución bajo garantía de conformidad con el artículo 261 del Código (sistema de intercambios estándar).'],
  ['B06', 'Productos transformados de retorno – solo IVA.'],
  ['C01', 'Bienes y efectos personales importados por personas físicas que trasladen su residencia normal al territorio aduanero de la Unión.'],
  ['C02', 'Ajuar y mobiliario importados con ocasión de un matrimonio.'],
  ['C03', 'Regalos habitualmente ofrecidos con ocasión de un matrimonio.'],
  ['C04', 'Bienes personales recibidos en herencia por una persona física que tenga su residencia normal en el territorio aduanero de la Unión.'],
  ['C06', 'Equipo, material de estudio y demás mobiliario de alumnos y estudiantes.'],
  ['C08', 'Envíos de particular a particular.'],
  ['C09', 'Bienes de inversión y otros bienes de equipo importados con ocasión del traslado de actividades desde un tercer país a la Unión.'],
  ['C10', 'Bienes de inversión y otros bienes de equipo pertenecientes a personas que ejerzan una profesión liberal, así como a personas jurídicas que ejerzan una actividad sin fines lucrativos.'],
  ['C11', 'Objetos de carácter educativo, científico o cultural; instrumentos y aparatos científicos mencionados en anexo I del Reglamento (CE) n.º 1186/2009.'],
  ['C12', 'Objetos de carácter educativo, científico o cultural; instrumentos y aparatos científicos mencionados en anexo II del Reglamento (CE) n.º 1186/2009.'],
  ['C13', 'Objetos de carácter educativo, científico o cultural; instrumentos y aparatos científicos importados exclusivamente con fines no comerciales (como piezas de repuesto, elementos, accesorios y herramientas).'],
  ['C14', 'Equipos importados con fines no comerciales para o por cuenta de un establecimiento o un organismo de investigación científica cuya sede está situada fuera de la Unión.'],
  ['C15', 'Animales de laboratorio y sustancias biológicas o químicas destinadas a la investigación.'],
  ['C16', 'Sustancias terapéuticas de origen humano y reactivos para la determinación de los grupos sanguíneos y el análisis de tejidos humanos.'],
  ['C17', 'Instrumentos y aparatos destinados a la investigación médica, al establecimiento de diagnósticos médicos o a la realización de tratamientos médicos.'],
  ['C18', 'Sustancias de referencia para el control de la calidad de los medicamentos.'],
  ['C19', 'Productos farmacéuticos utilizados con ocasión de manifestaciones deportivas internacionales.'],
  ['C20', 'Mercancías dirigidas a organismos de carácter benéfico y filantrópico-Mercancías de primera necesidad importadas por organismos estatales o por otros organismos reconocidos.'],
  ['C21', 'Objetos mencionados en el anexo III del Reglamento (CE) n.º 1186/2009 destinados a los ciegos.'],
  ['C22', 'Objetos mencionados en el anexo IV del Reglamento (CE) n.º 1186/2009 destinados a los ciegos, importados por los mismos ciegos para su propio uso (como piezas de repuesto, componentes, accesorios y herramientas).'],
  ['C23', 'Objetos mencionados en el anexo IV del Reglamento (CE) n.º 1186/2009 destinados a los ciegos, importados por determinadas instituciones u organizaciones (como piezas de repuesto, componentes, accesorios y herramientas).'],
  ['C24', 'Objetos destinados a personas con discapacidad (distintas de los ciegos), importados por dichas personas para su propio uso (como piezas de repuesto, componentes, accesorios y herramientas).'],
  ['C25', 'Objetos destinados a otras personas con discapacidad (distintas de los ciegos), importados por determinadas instituciones y organizaciones (como piezas de repuesto, componentes, accesorios y herramientas).'],
  ['C26', 'Mercancías importadas en beneficio de las víctimas de catástrofes.'],
  ['C27', 'Condecoraciones concedidas por gobiernos de terceros países a personas que tengan su residencia normal en el territorio aduanero de la Unión.'],
  ['C28', 'Objetos importados en el territorio aduanero de la Unión por personas que hayan efectuado una visita oficial a un tercer país y los hayan recibido como regalo con tal motivo por parte de las autoridades anfitrionas.'],
  ['C29', 'Mercancías destinadas al uso de soberanos y jefes de Estado.'],
  ['C30', 'Muestras de mercancías sin valor estimable importadas con fines de promoción comercial.'],
  ['C31', 'Impresos de carácter publicitario.'],
  ['C32', 'Pequeñas muestras representativas de mercancías fabricadas fuera del territorio aduanero de la Unión y destinadas a una exposición o a una manifestación similar.'],
  ['C33', 'Mercancías importadas para examen, análisis o ensayos.'],
  ['C34', 'Envíos destinados a organismos competentes en materia de protección de los derechos de autor o de protección industrial o comercial.'],
  ['C35', 'Documentación de carácter turístico.'],
  ['C36', 'Documentos y artículos diversos.'],
  ['C37', 'Materiales auxiliares para la estiba y protección de las mercancías durante su transporte.'],
  ['C38', 'Camas de paja, forraje y alimentos para los animales durante su transporte.'],
  ['C39', 'Carburantes y lubricantes a bordo de vehículos terrestres a motor y en los contenedores para usos especiales.'],
  ['C40', 'Materiales destinados a la construcción, conservación o decoración de monumentos conmemorativos, o de cementerios, de víctimas de guerra.'],
  ['C41', 'Ataúdes, urnas funerarias y objetos de ornamentación funeraria.'],
  ['C42', 'Bienes personales declarados para libre práctica antes de que el interesado haya establecido su residencia normal en el territorio aduanero de la Unión (franquicia sujeta a un compromiso).'],
  ['C43', 'Bienes personales declarados para libre práctica por una persona física que tenga intención de establecer su residencia normal en el territorio aduanero de la Unión (admisión con franquicia sujeta a compromiso).'],
  ['C44', 'Bienes personales recibidos en herencia por personas jurídicas que ejerzan una actividad sin fines lucrativos y estén establecidas en el territorio aduanero de la Unión.'],
  ['C45', 'Productos de la agricultura, la ganadería, la apicultura, la horticultura y la silvicultura procedentes de fincas situadas en un tercer país contiguas al territorio aduanero de la Unión.'],
  ['C46', 'Productos de la pesca o de la piscicultura practicada en los lagos y en los cursos de agua que separan a un Estado miembro de un tercer país por pescadores de la Unión y productos de la caza practicada por cazadores de la Unión en tales lagos y cursos de agua.'],
  ['C47', 'Simientes, abonos y productos para el tratamiento del suelo y las plantas destinados a ser utilizados en propiedades situadas en el territorio aduanero de la Unión limítrofes con un tercer país.'],
  ['C48', 'Mercancías contenidas en el equipaje personal de los viajeros y exentas de IVA.'],
  ['C49', 'Mercancías dirigidas a organismos de carácter benéfico y filantrópico-Mercancías de cualquier naturaleza enviadas con carácter gratuito para la recaudación de fondos durante actos benéficos ocasionales organizados en beneficio de personas necesitadas.'],
  ['C50', 'Mercancías dirigidas a organismos de carácter benéfico y filantrópico-Equipo y material de oficina enviados con carácter gratuito.'],
  ['C51', 'Copas, medallas y objetos similares que tengan esencialmente un carácter simbólico, concedidos en un tercer país a personas que tengan su residencia normal en el territorio aduanero de la Unión.'],
  ['C52', 'Copas, medallas y objetos similares que tengan esencialmente un carácter simbólico que sean ofrecidos gratuitamente por autoridades o personas establecidas en un tercer país para ser concedidos en el territorio aduanero de la Unión.'],
  ['C53', 'Recompensas, trofeos y recuerdos de carácter simbólico y escaso valor, destinados a su distribución gratuita entre personas que tengan su residencia normal en terceros países, con ocasión de congresos de negocios o manifestaciones similares de carácter internacional.'],
  ['C54', 'Objetos importados en el territorio aduanero de la Unión por personas que vengan a efectuar una visita oficial al territorio aduanero de la Unión y que con tal motivo tengan intención de regalarlos a las autoridades anfitrionas.'],
  ['C55', 'Objetos dirigidos como regalo, en prueba de amistad o de buena voluntad, por una autoridad oficial, por una colectividad pública o por una agrupación que realice actividades de interés público, que estén situadas en un tercer país, a una autoridad oficial, a una colectividad pública o a un grupo que realice actividades de interés público, situadas en el territorio aduanero de la Unión, y autorizadas por las autoridades competentes para recibir tales objetos con franquicia.'],
  ['C56', 'Objetos de carácter publicitario sin valor comercial propio dirigidos gratuitamente por los proveedores a sus clientes y que, fuera de su función publicitaria, no sean utilizables para ningún otro fin.'],
  ['C57', 'Mercancías importadas únicamente para su demostración o para la demostración de máquinas y aparatos fabricados fuera del territorio aduanero de la Unión y presentados en una exposición o manifestación similar.'],
  ['C58', 'Diversos materiales de poco valor tales como pinturas, barnices, papeles pintados, utilizados en la construcción, equipamiento y decoración de los stands provisionales que tengan los representantes de terceros países en una exposición o manifestación similar y que se destruyan por el hecho de su utilización.'],
  ['C59', 'Impresos, catálogos, prospectos, listas de precios, carteles publicitarios, calendarios ilustrados o no, fotografías sin enmarcar y otros objetos suministrados gratuitamente para ser utilizados como publicidad de mercancías fabricadas fuera del territorio aduanero de la Unión y presentadas en una exposición o manifestación similar.'],
  ['C60', 'Ajuar y mobiliario importados con ocasión de un matrimonio declarados para libre práctica no antes de dos meses antes del matrimonio (franquicia sujeta a la presentación de una garantía adecuada).'],
  ['C61', 'Regalos habitualmente ofrecidos con ocasión de un matrimonio declarados para libre práctica no antes de dos meses antes del matrimonio (franquicia sujeta a la presentación de una garantía adecuada).'],
  ['D01', 'Palés (incluidas las piezas de recambio, accesorios y equipos de palés).'],
  ['D02', 'Contenedores (incluidas las piezas de recambio, accesorios y equipos de contenedores).'],
  ['D03', 'Medios de transporte por carretera y ferrocarril, o de navegación aérea, marítima y fluvial.'],
  ['D04', 'Efectos personales y mercancías destinados a ser utilizados con fines deportivos importadas por viajeros.'],
  ['D05', 'Material de bienestar de las gentes del mar.'],
  ['D06', 'Material destinado a combatir los efectos de las catástrofes.'],
  ['D07', 'Material médico-quirúrgico y de laboratorio.'],
  ['D08', 'Animales (doce meses o más).'],
  ['D09', 'Mercancías destinadas a ser utilizadas en zonas fronterizas.'],
  ['D10', 'Soportes de sonido, imágenes o información.'],
  ['D11', 'Material promocional.'],
  ['D12', 'Material profesional.'],
  ['D13', 'Material pedagógico y científico.'],
  ['D14', 'Envases, llenos.'],
  ['D15', 'Envases, vacíos.'],
  ['D16', 'Moldes, matrices, clichés, proyectos, instrumentos de medida, control, verificación y otros objetos similares.'],
  ['D17', 'Utensilios e instrumentos especiales.'],
  ['D18', 'Mercancías que deban someterse a ensayos, experimentos o demostraciones.'],
  ['D19', 'Mercancías, a reserva de la superación de un ensayo de aceptación previsto en un contrato de compraventa.'],
  ['D20', 'Mercancías utilizadas para efectuar ensayos, experimentos o demostraciones que no constituyan una actividad lucrativa (seis meses).'],
  ['D21', 'Muestras.'],
  ['D22', 'Medios de producción de sustitución (seis meses).'],
  ['D23', 'Mercancías destinadas a su exposición o venta.'],
  ['D24', 'Envíos a prueba (seis meses).'],
  ['D25', 'Objetos de arte, objetos de colección y antigüedades.'],
  ['D26', 'Mercancías importadas para ser vendidas en subasta.'],
  ['D27', 'Piezas de repuesto, accesorios y equipos.'],
  ['D28', 'Mercancías importadas en situaciones especiales sin incidencia económica.'],
  ['D29', 'Mercancías importadas durante un período no superior a tres meses.'],
  ['D30', 'Medios de transporte para personas establecidas fuera del territorio aduanero de la Unión o para personas que preparan el traslado de su residencia normal fuera de dicho territorio.'],
  ['D51', 'Importación temporal con exención parcial de derechos de importación.'],
  ['E01', 'Uso del precio unitario para determinar el valor en aduana de ciertas mercancías perecederas [artículo 74, apartado 2, letra c), del Código y artículo 142, apartado 6].'],
  ['E02', 'Valores de importación estándar [por ejemplo: Reglamento (UE) n.º 543/2011].'],
  ['F01', 'Exención de los derechos de importación para las mercancías de retorno (artículo 203 del Código).'],
  ['F02', 'Exención de los derechos de importación para las mercancías de retorno [circunstancias especiales previstas en el artículo 159 del Reglamento Delegado (UE) 2015/2446: productos agrícolas].'],
  ['F03', 'Exención de los derechos de importación para las mercancías de retorno [circunstancias especiales previstas en el artículo 158, apartado 3, del Reglamento Delegado (UE) 2015/2446: reparación o restauración].'],
  ['F04', 'Productos transformados que retornen a la Unión Europea tras haber sido reexportados previamente después de haber sido incluidos en el régimen de perfeccionamiento activo (artículo 205, apartado 1, del Código).'],
  ['F05', 'Exención de los derechos de importación y del IVA y/o los impuestos especiales para las mercancías de retorno [artículo 203 del Código y artículo 143, apartado 1, letra e), de la Directiva 2006/112/CE].'],
  ['F06', 'Circulación de mercancías sujetas a impuestos especiales en régimen suspensivo desde el lugar de importación, de conformidad con el artículo 16, apartado 1, letra b), de la Directiva (UE) 2020/262.'],
  ['F07', 'Productos transformados que retornen a la Unión Europea tras haber sido reexportados previamente después de haber sido incluidos en un régimen de perfeccionamiento activo en el que el importe de los derechos de importación se determine de conformidad con el artículo 86, apartado 3, del Código (artículo 205, apartado 2, del Código).'],
  ['F15', 'Mercancías introducidas en el marco del comercio de mercancías con territorios fiscales especiales (artículo 1, apartado 3, del Código).'],
  ['F16', 'Mercancías introducidas en el marco del comercio de mercancías entre la Unión y los países con los que esta ha establecido una unión aduanera.'],
  ['F21', 'Exención de los derechos de importación para los productos de la pesca marítima y otros productos extraídos de las aguas territoriales de un país o territorio situado fuera del territorio aduanero de la Unión por buques exclusivamente matriculados o registrados en un Estado miembro y que enarbolen pabellón de dicho Estado.'],
  ['F22', 'Exención de los derechos de importación para los productos de la pesca marítima y otros productos extraídos de las aguas territoriales de un país o territorio situado fuera del territorio aduanero de la Unión a bordo de barcos factoría matriculados o registrados en un Estado miembro y que enarbolen pabellón de dicho Estado.'],
  ['F44', 'Despacho a libre práctica de productos transformados cuando sea aplicable el artículo 86, apartado 3, del Código.'],
  ['F45', 'Exención del IVA sobre la importación final de determinadas mercancías [Directiva 2009/132/CE del Consejo ].'],
  ['F46', 'Utilización de la clasificación arancelaria original de las mercancías en los casos previstos en el artículo 86, apartado 2, del Código.'],
  ['F47', 'Simplificación del establecimiento de la declaración en aduana de mercancías incluidas en diferentes subpartidas arancelarias previstas en el artículo 177 del Código.'],
  ['F48', 'Importación en el marco del régimen especial para las ventas a distancia de mercancías importadas de terceros países y territorios establecido en el título XII, capítulo 6, sección 4, de la Directiva 2006/112/CE.'],
  ['F49', 'Importación en el marco de las modalidades especiales para la declaración y el pago del IVA establecidas en el título XII, capítulo 7, de la Directiva 2006/112/CE.'],
  ['F50', 'Importación de mercancías contenidas en envíos a las que se aplica el derecho de aduana único ad valorem del 2,5 % establecido en la primera parte, sección II, letra D, apartados 1 y 2, del Reglamento (CEE) n.º 2658/87 del Consejo, relativo a la nomenclatura arancelaria y estadística y al arancel aduanero común.'],
  ['F51', 'Importación de mercancías contenidas en envíos, en relación con las cuales el interesado solicita la aplicación de derechos de aduana adecuados a mercancías específicas en lugar del derecho de aduana único ad valorem del 2,5 % establecido en la primera parte, sección II, letra D, apartado 3, del Reglamento (CEE) n.º 2658/87 del Consejo, relativo a la nomenclatura arancelaria y estadística y al arancel aduanero común.'],
  ['F52', 'Exención de derechos de importación para las mercancías de retorno exportadas desde Turquía (artículo 30 de la Decisión n.º 1/2006 del Comité de cooperación aduanera CE-Turquía, de 26 de septiembre de 2006, por la que se establecen disposiciones de aplicación de la Decisión n.º 1/95 del Consejo de Asociación CE-Turquía, DO L 265 de 26.9.2006, p. 18).'],
  ['F53', 'Mercancías cuyo valor intrínseco no exceda de un total de 150 EUR por envío, vendidos en ventas a distancia de bienes importados, tal como se definen en el artículo 14, apartado 4, punto 2, de la Directiva 2006/112/CE, excluidos los bienes cuya importación esté exenta del IVA de conformidad con el artículo 143, apartado 1, letra c bis), de la Directiva 2006/112/CE y los bienes cuyo IVA se declare con arreglo al régimen especial establecido en el título XII, capítulo 7, de la Directiva 2006/112/CE.'],
].map(([codigo, descripcion]) => ({ codigo, descripcion, grupo: `UE · ${GRUPOS_UE[codigo[0]]}`, fuente: FUENTE_UE_111 }));

const FUENTE_SEPARATA_13 = 'AEAT, Información complementaria H1 v3.26, separata 13 (tabla H1REG372)';
const FUENTE_SEPARATA_37 = 'AEAT, Información complementaria H1 v3.26, separata 37';
const FUENTE_GIBRALTAR = 'AEAT, Reglas y Condiciones Importación CAU v4.10 (ESRGI) e Información complementaria H1 v3.26 (Gibraltar)';
const GRUPO_NACIONAL = 'España · Destino final, II.EE. y Canarias';
const GRUPO_PENDENCIAS = 'España · Pendencias (separata 37)';
const GRUPO_NAC_GIBRALTAR = 'España · Gibraltar';
const NOTA_PENDENCIAS = 'Solo en los tipos de declaración que permite la separata 37; genera una pendencia en la AEAT.';

// Codigos nacionales espanoles publicados por la AEAT (3 caracteres).
const ADICIONALES_ES = [
  { codigo: '131', descripcion: 'Destino final con envío simultáneo a otro Estado miembro (44 + 42)', fuente: 'AEAT, Información complementaria H1 RR.EE. v1.4, separata 7', grupo: GRUPO_NACIONAL },
  { codigo: '132', descripcion: 'Destino final simultáneo con régimen suspensivo de II.EE.', fuente: FUENTE_SEPARATA_13, grupo: GRUPO_NACIONAL },
  { codigo: '327', descripcion: 'REF: entrada en depósito REF canario', fuente: FUENTE_SEPARATA_13, grupo: GRUPO_NACIONAL },
  { codigo: '328', descripcion: 'REF: vinculación a depósito fiscal de II.EE. canario', fuente: FUENTE_SEPARATA_13, grupo: GRUPO_NACIONAL },
  { codigo: '404', descripcion: 'REF: vinculación simultánea a depósito REF y depósito ILT o de II.EE. canario', fuente: FUENTE_SEPARATA_13, grupo: GRUPO_NACIONAL },
  { codigo: '9AI', descripcion: 'Pendiente de concesión de franquicia arancelaria y exención del IVA', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9AR', descripcion: 'Pendiente de concesión de franquicia arancelaria', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9CO', descripcion: 'Pendiente de levante sin espera de la concesión del contingente', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9CR', descripcion: 'Cambio de residencia con compromiso de establecerse', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9DU', descripcion: 'Pendiente de presentar el justificante del antidumping reducido', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9EA', descripcion: 'Pendiente del estado de liquidación de perfeccionamiento activo con exportación anticipada', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9IV', descripcion: 'Pendiente de concesión de la exención del IVA', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9LF', descripcion: 'Pendiente de presentar el T2LF', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9OR', descripcion: 'Despacho provisional pendiente de presentar el certificado de origen', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9VG', descripcion: 'Pendiente de presentar la factura (pendencia D1)', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '9VI', descripcion: 'Pendiente de presentar la factura (pendencia D2)', fuente: FUENTE_SEPARATA_37, grupo: GRUPO_PENDENCIAS, nota: NOTA_PENDENCIAS },
  { codigo: '5GI', descripcion: 'Gibraltar: régimen 40 con destino Gibraltar (o 40.51, 40.53, 40.71 con expedición desde Gibraltar)', fuente: FUENTE_GIBRALTAR, grupo: GRUPO_NAC_GIBRALTAR },
  { codigo: '5GS', descripcion: 'Gibraltar: expedición desde Gibraltar con régimen 44, 51 o 53', fuente: FUENTE_GIBRALTAR, grupo: GRUPO_NAC_GIBRALTAR },
  { codigo: '5GP', descripcion: 'Gibraltar: perfeccionamiento activo (51) con destino Gibraltar', fuente: FUENTE_GIBRALTAR, grupo: GRUPO_NAC_GIBRALTAR },
  { codigo: '5GT', descripcion: 'Gibraltar: importación temporal (53) con destino Gibraltar', fuente: FUENTE_GIBRALTAR, grupo: GRUPO_NAC_GIBRALTAR },
  { codigo: '5GA', descripcion: 'Gibraltar: depósito (71) para avituallamiento de buques o aeronaves, sin entrada física', fuente: FUENTE_GIBRALTAR, grupo: GRUPO_NAC_GIBRALTAR },
  { codigo: '5GD', descripcion: 'Gibraltar: depósito (71) con entrada física en un depósito de Gibraltar', fuente: FUENTE_GIBRALTAR, grupo: GRUPO_NAC_GIBRALTAR }
];

const ADICIONALES = Object.freeze([...ADICIONALES_UE, ...ADICIONALES_ES].map((a) => Object.freeze(a)));

const POR_CODIGO = new Map(COMBINACIONES.map((c) => [c.codigo, c]));
const ADICIONAL_POR_CODIGO = new Map(ADICIONALES.map((a) => [a.codigo, a]));

/** «40.71», «4071» o «40 71» -> «4071»; cualquier otra cosa -> null. */
function normalizarRegimen(valor) {
  const limpio = String(valor ?? '').replace(/[\s.]/g, '');
  return /^\d{4}$/.test(limpio) ? limpio : null;
}

/** Combinacion del catalogo para un codigo de cuatro cifras (con o sin punto), o null. */
const combinacionH1 = (valor) => POR_CODIGO.get(normalizarRegimen(valor)) || null;

/** Codigo de regimen adicional del catalogo (mayusculas), o null. */
const adicionalH1 = (valor) => ADICIONAL_POR_CODIGO.get(String(valor ?? '').trim().toUpperCase()) || null;

/** Regimen de un expediente como codigo de cuatro cifras: lo guardado antes de este cambio es «40» + «00». */
function regimenDelExpediente(declaration = {}) {
  const solicitado = String(declaration?.regime || '40');
  if (/^\d{4}$/.test(solicitado)) return solicitado;
  const precedente = /^\d{2}$/.test(String(declaration?.previousRegime || '')) ? declaration.previousRegime : '00';
  return `${solicitado}${precedente}`;
}

/** «40.00 – Despacho a libre práctica…» para mostrar; sin descripcion si no esta en el catalogo. */
function regimenComoTexto(solicitado, precedente = '00') {
  const codigo = `${solicitado}.${precedente}`;
  const descripcion = descripcionDe(solicitado, precedente);
  return descripcion ? `${codigo} – ${descripcion}` : codigo;
}

/** Catalogo para la interfaz (solo lectura). */
const catalogoH1 = () => ({
  combinaciones: COMBINACIONES,
  adicionales: ADICIONALES,
  fuentes: {
    regimen: FUENTE_UE_110,
    adicionales: `${FUENTE_UE_111}; AEAT, Información complementaria H1 v3.26 y Reglas y Condiciones Importación CAU v4.10`
  }
});

module.exports = {
  REGIMENES_SOLICITADOS, REGIMENES_PRECEDENTES, COMBINACIONES, ADICIONALES,
  normalizarRegimen, combinacionH1, adicionalH1, regimenDelExpediente, regimenComoTexto, descripcionDe, catalogoH1
};
