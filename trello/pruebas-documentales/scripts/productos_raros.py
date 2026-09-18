# -*- coding: utf-8 -*-
"""
Catalogo de mercancias inusuales/complejas para poner a prueba la clasificacion
TARIC con IA de LUCI. Cada producto combina materiales o funciones de forma
que la clasificacion por una sola partida no es obvia (tension real entre
Reglas Generales de Interpretacion 1, 2(a)/(b) y 3(a)/(b)/(c) del Sistema
Armonizado). El campo 'hs' es el codigo que SUGIERE el propio proveedor en su
documentacion (a menudo generico, simplista o directamente cuestionable) —
no es "la respuesta correcta": el objetivo es que el agente/LUCI clasifique
de verdad a partir de la descripcion, no que copie el codigo de la factura.
El campo 'challenge' es la nota interna (va solo en el resumen del caso, NUNCA
en la factura) que explica por que es dificil de clasificar.
"""

PRODUCTOS_RAROS = {

    'mochila_solar': {
        'desc': 'Mochila de nylon con panel solar flexible integrado en la solapa frontal, puerto USB-A y '
                'power bank de litio de 10.000 mAh cosido en el compartimento interior, con cerradura de '
                'combinacion antirrobo integrada en la cremallera principal',
        'hs': '420229',  # proveedor sugiere "articulo de viaje textil" ignorando la parte electronica
        'unit': 'PCE', 'kg_unit': 0.95,
        'challenge': "Articulo compuesto: contenedor textil (cap. 42) vs. bateria/power bank (8507) vs. panel "
                      "fotovoltaico (8541). GRI 3(b): determinar el caracter esencial — ¿es una mochila con "
                      "electronica accesoria, o un cargador portatil con forma de mochila?",
    },
    'peluche_termico': {
        'desc': 'Peluche de felpa de poliester con forma de oso, relleno con semillas de trigo y lavanda '
                'seca, apto para calentar en microondas como compresa termica, con funda textil extraible',
        'hs': '950300',  # proveedor lo declara como "juguete de peluche" sin mas
        'unit': 'PCE', 'kg_unit': 0.42,
        'challenge': "¿Juguete (9503) o aparato/articulo de uso terapeutico-domestico (compresa termica, "
                      "posible 3005/6307)? La funcion de calentar (no jugar) puede prevalecer segun GRI 1 "
                      "sobre la apariencia de peluche.",
    },
    'tabla_hibrida_patinete': {
        'desc': 'Tabla de skate electrica autoequilibrada (hoverboard) con dos ruedas independientes, motor '
                'electrico de 350W, bateria de litio, control por inclinacion corporal, sin manillar, '
                'velocidad maxima 15 km/h, uso mixto adultos/adolescentes',
        'hs': '950300',  # el fabricante insiste en clasificarlo como "juguete de ruedas"
        'unit': 'PCE', 'kg_unit': 12.0,
        'challenge': "Disputa real y conocida en la practica aduanera UE: hoverboards clasificados como "
                      "juguete (9503, si uso claramente recreativo/infantil) frente a vehiculo con motor "
                      "electrico (8711) si la velocidad/potencia y el publico objetivo son de adultos.",
    },
    'dron_camara_profesional': {
        'desc': 'Aeronave no tripulada (dron) de ala rotatoria con camara de video 4K integrada de forma no '
                'desmontable, gimbal estabilizador de 3 ejes, autonomia de 34 minutos, peso 900g, uso '
                'fotografia aerea profesional, no apto para uso infantil',
        'hs': '950300',  # el exportador lo etiqueta erroneamente como "juguete radiocontrolado"
        'unit': 'PCE', 'kg_unit': 0.9,
        'challenge': "Desde la actualizacion del Sistema Armonizado 2022 existe la partida especifica 8806 "
                      "(vehiculos aereos no tripulados) distinta de 9503 (juguetes) y de 8525 (camaras). "
                      "Con camara no desmontable y uso profesional, 9503 es casi con certeza incorrecto.",
    },
    'cigarrillo_electronico_kit': {
        'desc': 'Kit de cigarrillo electronico recargable con bateria de litio 900mAh, atomizador '
                'intercambiable de ceramica, sin liquido incluido, mando a distancia por bluetooth para '
                'ajustar temperatura desde app movil',
        'hs': '854370',  # el proveedor usa el generico "otras maquinas y aparatos electricos"
        'unit': 'PCE', 'kg_unit': 0.08,
        'challenge': "TARIC creo subpartidas especificas para cigarrillos electronicos (8543.40) tras años "
                      "de clasificacion dispersa entre 8543.70 (generico) y partidas de bateria/atomizador "
                      "por separado. Riesgo real de usar el codigo generico antiguo.",
    },
    'reloj_multifuncion': {
        'desc': 'Reloj de pulsera con caja de acero inoxidable, movimiento de cuarzo analogico tradicional '
                'combinado con pantalla OLED secundaria para notificaciones de smartphone, GPS y monitor de '
                'ritmo cardiaco, sin conectividad celular propia',
        'hs': '910211',  # el fabricante lo declara simplemente como "reloj de pulsera con cuarzo"
        'unit': 'PCE', 'kg_unit': 0.09,
        'challenge': "Frontera clasica entre reloj (cap. 91, 9102) y aparato de comunicacion/computo "
                      "vestible (8517/8471). La UE distingue por si la funcion de reloj es accesoria o "
                      "principal; aqui el movimiento de cuarzo tradicional es el elemento dominante, pero la "
                      "pantalla OLED y sensores complican el caracter esencial.",
    },
    'impresora_3d_alimentos': {
        'desc': 'Impresora 3D de sobremesa especializada en extrusion de pasta de chocolate y masa alimentaria '
                'para reposteria decorativa, cabezal calefactado, estructura de aluminio, sin funcion de '
                'impresion de plasticos ni resinas',
        'hs': '847780',  # se declara como "maquina para trabajar caucho o plastico, no expresada"
        'unit': 'PCE', 'kg_unit': 18.5,
        'challenge': "Las impresoras 3D genericas se debaten entre 8477 (maquinaria de plastico/caucho) y "
                      "8479 (maquinas con funcion propia no expresada en otra partida). Al ser exclusivamente "
                      "para alimentos, 8477 (pensada para plastico/caucho) resulta cuestionable: podria "
                      "corresponder a maquinaria para la industria alimentaria (8438).",
    },
    'chaqueta_calefactable': {
        'desc': 'Chaqueta de exterior en tejido tecnico impermeable con 3 paneles de fibra de carbono '
                'calefactables integrados en el forro, alimentados por bateria de litio extraible de 7,4V, '
                'control de temperatura via boton fisico, sin conectividad',
        'hs': '620201',  # se declara como prenda textil ordinaria de mujer
        'unit': 'PCE', 'kg_unit': 0.85,
        'challenge': "Textil (cap. 62) con funcion electrica de calefaccion incorporada. Segun la Nota "
                      "explicativa correspondiente, si el elemento electrico es accesorio al uso de la "
                      "prenda, se mantiene en textil; si predomina la funcion de calentar, podria derivar a "
                      "8516 (aparatos electricos de calefaccion). El limite es estrecho.",
    },
    'cesta_regalo_gourmet': {
        'desc': 'Cesta de mimbre para regalo que contiene: 1 botella de vino tinto (750ml), 200g de jamon '
                'curado envasado al vacio, un tarro de mermelada artesanal, una tableta de chocolate negro y '
                'un cuenco de ceramica decorativa, todo presentado en un unico envase de venta al por menor',
        'hs': '220421',  # el proveedor factura todo bajo el codigo del vino, el producto de mayor valor
        'unit': 'SET', 'kg_unit': 2.8,
        'challenge': "Caso de manual de GRI 3(b): 'surtidos para la venta al por menor' compuestos por "
                      "productos de distintas partidas (bebida, alimentos, ceramica) presentados juntos. Se "
                      "clasifica por el componente que le da el caracter esencial al conjunto — normalmente "
                      "NO es simplemente 'el mas caro', sino el que define la naturaleza del surtido.",
    },
    'mueble_desmontado_incompleto': {
        'desc': 'Estanteria modular de madera de pino en kit desmontado (flat-pack), sin los tornillos ni '
                'bisagras metalicas de montaje (se venden por separado en el pais de destino), compuesta por '
                '6 paneles cortados a medida y taladrados',
        'hs': '441900',  # el exportador declara "articulos de madera n.e.p." de forma generica
        'unit': 'SET', 'kg_unit': 34.0,
        'challenge': "GRI 2(a): un articulo incompleto o sin terminar se clasifica como el articulo completo "
                      "si ya presenta las caracteristicas esenciales de este (mueble desmontado = mueble, "
                      "9403), aunque falten piezas menores de ferreteria que se compran aparte.",
    },
    'gnomo_jardin_solar': {
        'desc': 'Figura decorativa de jardin en resina con forma de gnomo, altura 35cm, con panel solar '
                'oculto en el sombrero que alimenta una luz LED en el interior de una lampara de cristal que '
                'sostiene en la mano, encendido automatico al anochecer',
        'hs': '691390',  # se declara como "estatuilla y articulo de adorno de ceramica/resina"
        'unit': 'PCE', 'kg_unit': 1.6,
        'challenge': "Objeto decorativo (9505/3926/6913 segun material) con funcion de iluminacion electrica "
                      "real (9405, lampara). La pregunta de caracter esencial: ¿es un adorno con una luz, o "
                      "una lampara con forma decorativa? El uso predominante nocturno como luz de jardin "
                      "apunta a 9405.",
    },
    'bolsa_pet_reciclado': {
        'desc': 'Bolsa reutilizable de la compra tejida a partir de hilo fabricado con botellas de PET '
                'recicladas (100% material reciclado post-consumo), con asas reforzadas y estampado '
                'publicitario, capacidad 20kg',
        'hs': '392329',  # se declara como "articulo de transporte o envasado de plastico"
        'unit': 'PCE', 'kg_unit': 0.11,
        'challenge': "El material de origen (botellas PET) no determina la clasificacion: una vez "
                      "transformado en hilo y tejido, el producto final es un articulo textil de materia "
                      "textil sintetica (cap. 63, 6305) y no un 'articulo de plastico' (cap. 39) — error "
                      "frecuente en declaraciones basadas en el origen del material, no en el producto final.",
    },
    'pintura_dedos_comestible': {
        'desc': 'Set de pintura para manualidades infantiles fabricada con colorantes alimentarios y '
                'almidon de maiz, formulada para ser segura en caso de ingestion accidental por niños '
                'pequeños, presentada en 6 botes de 100ml con pincel',
        'hs': '320910',  # se declara como "pintura y barniz" generico de la partida 32
        'unit': 'SET', 'kg_unit': 0.75,
        'challenge': "Pinturas convencionales van en el capitulo 32, pero una formulacion explicitamente "
                      "comestible/apta para ingestion con base en almidon alimentario puede acercarse a "
                      "preparaciones del capitulo 21 (otras preparaciones alimenticias) segun su composicion "
                      "real — requiere ficha tecnica, no solo la descripcion comercial 'pintura'.",
    },
    'mascara_proteccion_hibrida': {
        'desc': 'Mascarilla facial reutilizable de tejido de punto con capa filtrante de polipropileno no '
                'tejido insertada, válvula de exhalacion de plastico, comercializada indistintamente como '
                'accesorio de moda y como proteccion respiratoria basica, sin certificacion medica FFP',
        'hs': '630790',  # se declara como "articulo textil confeccionado n.e.p."
        'unit': 'PCE', 'kg_unit': 0.02,
        'challenge': "Clasico dilema post-2020: mascarilla textil de uso general (6307) frente a equipo de "
                      "proteccion respiratoria (6307.90 especifico o cap. 90 si tiene certificacion medica). "
                      "Sin certificacion FFP/medica, NO deberia declararse como EPI sanitario aunque el "
                      "vendedor lo sugiera en marketing.",
    },
    'instrumento_musical_electronico': {
        'desc': 'Guitarra electroacustica de cuerpo hueco en madera con pastilla piezoelectrica integrada, '
                'preamplificador y ecualizador digital de 3 bandas alimentado por pila de 9V, salida jack '
                '1/4 pulgada',
        'hs': '920600',  # el proveedor declara "instrumento musical de cuerda" sin considerar la electronica
        'unit': 'PCE', 'kg_unit': 2.4,
        'challenge': "Los instrumentos musicales con componentes electronicos de amplificacion incorporados "
                      "siguen clasificandose en el capitulo 92 (instrumentos musicales) mientras la "
                      "electronica sea accesoria a la funcion musical — pero el limite se cuestiona cuando el "
                      "preamplificador/ecualizador tiene mas valor que el cuerpo de madera.",
    },
    'kit_camping_multiuso': {
        'desc': 'Set para acampada compuesto por: una tienda de campaña para 2 personas, un hornillo de gas '
                'portatil, una linterna de LED recargable y un set de cubiertos plegables, empaquetados '
                'juntos en una unica bolsa de transporte para venta al detalle como "kit de supervivencia"',
        'hs': '630622',  # se declara integramente bajo el codigo de la tienda de campaña
        'unit': 'SET', 'kg_unit': 4.2,
        'challenge': "Otro caso de GRI 3(b) 'surtidos': tienda (textil, 6306), hornillo (metal/gas, 7321 o "
                      "similar), linterna (electrico, 8513) y cubiertos (metal, 8211/7323) presentados como "
                      "un conjunto. Debe determinarse el componente de caracter esencial del conjunto para "
                      "la venta al detalle, no facturar todo bajo la partida del articulo mas voluminoso.",
    },
    'silla_convertible_mesa': {
        'desc': 'Mueble plegable de doble funcion: en posicion vertical es una silla con respaldo '
                'tapizado, y al abatirse se convierte en una mesa auxiliar con superficie de melamina, '
                'estructura de acero tubular',
        'hs': '940179',  # se declara como "asiento con armazon de metal"
        'unit': 'PCE', 'kg_unit': 9.8,
        'challenge': "Mueble de doble uso simultaneo (silla/mesa): ni la partida 9401 (asientos) ni la 9403 "
                      "(los demas muebles) describen por si solas el articulo completo. GRI 3(c): cuando no "
                      "puede determinarse el caracter esencial entre partidas igualmente especificas, se "
                      "clasifica en la partida de numeracion mas alta (9403), lo contrario de lo declarado.",
    },
    'joya_impresa_3d_titanio': {
        'desc': 'Anillo de compromiso fabricado por impresion 3D en polvo de titanio sinterizado con '
                'engaste de diamante sintetico cultivado en laboratorio de 0,5 quilates, diseño '
                'geometrico parametrico unico por pieza, sin moldes ni troqueles',
        'hs': '711719',  # se declara como "bisuteria de metal comun"
        'unit': 'PCE', 'kg_unit': 0.006,
        'challenge': "El titanio no es un metal precioso (excluye cap. 71 seccion joyeria fina), pero el "
                      "diamante sintetico engastado SI puede ser relevante para 7104 (piedras sinteticas). "
                      "La fabricacion aditiva (impresion 3D) no cambia la clasificacion del producto final, "
                      "pero la combinacion titanio+diamante sintetico exige verificar la partida exacta, no "
                      "asumir 'bisuteria' generica.",
    },
    'alfombra_calefactada_electrica': {
        'desc': 'Alfombra de salon tejida en lana con circuito de cable calefactor de carbono integrado en '
                'el reverso, termostato regulable, certificacion electrica CE, dimensiones 200x300cm',
        'hs': '570210',  # se declara como "alfombra de punto anudado o enrollado" textil ordinaria
        'unit': 'PCE', 'kg_unit': 6.5,
        'challenge': "Igual tension que la chaqueta calefactable: textil de superficie (cap. 57) con "
                      "elemento electrico de calefaccion incorporado con caracter funcional relevante — "
                      "podria derivar a 8516 (aparato electrico de calefaccion) si la funcion de calentar "
                      "predomina sobre la funcion decorativa/textil de la alfombra.",
    },
    'perfume_solido_metal': {
        'desc': 'Perfume solido en base de cera de abeja y aceites esenciales, presentado en un estuche '
                'compacto de aleacion de zinc con espejo integrado y grabado personalizable, para venta '
                'como accesorio de bolsillo/joya olfativa',
        'hs': '330300',  # se declara como "perfumes y aguas de tocador" sin mas
        'unit': 'PCE', 'kg_unit': 0.045,
        'challenge': "El contenido (perfume solido) va en 3303, pero el estuche de metal con espejo tiene "
                      "entidad propia como articulo de tocador/bisuteria (7326/8306). Cuando el envase tiene "
                      "un uso y valor claramente independientes del producto que contiene (no es un envase "
                      "'normal' desechable), puede exigir clasificacion o valoracion separada.",
    },
    'cortina_purificadora_aire': {
        'desc': 'Panel textil decorativo para ventana con recubrimiento fotocatalitico de dioxido de '
                'titanio que descompone particulas contaminantes del aire al contacto con luz solar, sin '
                'componentes electricos ni motor, funcion pasiva',
        'hs': '630392',  # se declara como "cortina y visillo de fibra sintetica"
        'unit': 'PCE', 'kg_unit': 0.38,
        'challenge': "Producto textil con tratamiento quimico funcional (purificacion de aire pasiva). Al no "
                      "tener motor ni ser un 'aparato', se mantiene mayoritariamente en textil (6303), pero "
                      "el recubrimiento activo con funcion catalitica podria cuestionar si sigue siendo 'solo "
                      "textil' segun la proporcion y funcion del tratamiento quimico frente al soporte.",
    },
    'huevos_hormiga_comestibles': {
        'desc': 'Huevos de hormiga escamolera (Liometopum) deshidratados, envasados al vacio para consumo '
                'humano como delicatessen (conocidos como "caviar mexicano"), producto tradicional '
                'gourmet de exportacion limitada',
        'hs': '210690',  # se declara como "preparacion alimenticia no expresada"
        'unit': 'KGM', 'kg_unit': 1.0,
        'challenge': "Producto de insecto para consumo humano: desde la revision HS 2022 existen partidas "
                      "mas especificas para insectos comestibles (0410) distintas del generico 'preparacion "
                      "alimenticia no expresada'. Ademas puede estar sujeto a Reglamento de Nuevos Alimentos "
                      "(Novel Food) de la UE si no tiene historial de consumo demostrado en territorio UE.",
    },
    'banco_madera_maceta_integrada': {
        'desc': 'Banco de jardin de madera tratada con dos jardineras de metal galvanizado integradas en '
                'los extremos, diseñado para exterior, vendido como pieza unica de mobiliario-jardineria',
        'hs': '940179',  # se declara integramente como "asiento de madera"
        'unit': 'PCE', 'kg_unit': 28.0,
        'challenge': "Mueble de exterior (9403) con jardineras/macetas de metal (7324/3924 segun material) "
                      "integradas como parte inseparable de una unica pieza vendida. GRI 1 y las Notas de "
                      "Seccion: al ser un articulo compuesto de fabricacion unica (no un surtido de piezas "
                      "sueltas), se clasifica por su funcion principal como mueble, pero exige justificar por "
                      "que las jardineras metalicas no cambian la partida.",
    },
    'muneca_coleccionista_porcelana': {
        'desc': 'Muñeca de coleccionista de edicion limitada (150 unidades numeradas) con cabeza y manos '
                'de porcelana pintada a mano por artesano identificado, cuerpo articulado de tela relleno, '
                'vestido de época cosido a medida, certificado de autenticidad y numero de serie',
        'hs': '950300',  # se declara simplemente como "muñeca, juguete"
        'unit': 'PCE', 'kg_unit': 0.9,
        'challenge': "Las muñecas 'de juguete' van en 9503, pero las piezas de coleccionista de edicion "
                      "limitada, numeradas y certificadas, sin destino de juego infantil, se acercan al "
                      "concepto de objeto de coleccion/articulo decorativo de porcelana artistica (6913) — "
                      "la intencion de uso (jugar vs. coleccionar/exhibir) es determinante y no siempre es "
                      "obvia solo por la descripcion 'muñeca'.",
    },
    'cinturon_lastre_buceo_reciclado': {
        'desc': 'Cinturon de lastre para buceo relleno con perdigones de plomo reciclado encapsulados en '
                'bolsas de neopreno cosidas, hebilla de liberacion rapida de acero inoxidable, uso '
                'deportivo profesional',
        'hs': '401699',  # se declara como "articulo de caucho vulcanizado n.e.p." por el neopreno
        'unit': 'PCE', 'kg_unit': 3.5,
        'challenge': "El neopreno (caucho, cap. 40) es solo el envoltorio; el componente que da la funcion "
                      "y el peso real es el plomo (metal, cap. 78/83 segun forma). Articulo compuesto de "
                      "materiales diferentes donde el material 'visible' (neopreno) no es el que aporta el "
                      "caracter esencial (el lastre de plomo).",
    },
}
