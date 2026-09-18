# -*- coding: utf-8 -*-
"""
Casos de borde reales de clasificacion arancelaria (TARIC/Sistema Armonizado).
A diferencia de "mercancia extrana" (productos_raros.py, que se inyectan en
los 64 casos funcionales existentes), estos son casos AUTONOMOS dedicados
por completo a una tension de clasificacion documentada y conocida en la
practica aduanera real, fundamentada en una Regla General de Interpretacion
(GRI) concreta del Sistema Armonizado o en una nota legal de seccion/capitulo.

Cada caso indica en 'gri_basis' la base normativa/tecnica de la disputa y en
'challenge' el argumento de cada lado — informacion que va SOLO en el
resumen interno del caso, nunca en la factura comercial.
"""

PRODUCTOS_BORDE = {

    'impresora_multifuncion': {
        'desc': 'Equipo de oficina que combina en una sola unidad: impresora laser color, escaner de '
                'documentos, fax analogico y fotocopiadora, con bandeja de alimentacion automatica y '
                'conectividad de red, comercializado como "impresora multifuncion"',
        'hs': '844332',
        'unit': 'PCE', 'kg_unit': 22.0,
        'gri_basis': "Nota 3 de la Seccion XVI del Sistema Armonizado + GRI 3(c)",
        'challenge': "Maquina que realiza varias funciones alternativas de la partida 8443 (impresora) y "
                      "8471 (unidad periferica de tratamiento de datos, si se considera el escaner como "
                      "entrada de datos). La Nota 3 de Seccion XVI exige clasificar por la funcion "
                      "principal; cuando ninguna funcion es claramente principal, GRI 3(c) obliga a elegir "
                      "la partida de numeracion mas alta entre las igualmente aplicables — la practica real "
                      "consolidada en la UE clasifica estos equipos en 8443.32, pero el razonamiento hay que "
                      "poder justificarlo, no darlo por hecho por el nombre comercial.",
    },
    'dispositivo_antiestres': {
        'desc': 'Dispositivo giratorio de bolsillo fabricado en aleacion de zinc con rodamiento de bolas de '
                'precision, comercializado por el fabricante como "herramienta de alivio del estres y mejora '
                'de la concentracion para adultos con TDAH", sin ninguna certificacion medica ni marcado '
                'sanitario, vendido en tiendas de juguetes y de regalo por igual',
        'hs': '900190',  # el fabricante insiste en clasificarlo junto a instrumentos de precision/medicos
        'unit': 'PCE', 'kg_unit': 0.06,
        'gri_basis': "GRI 1 — texto de la partida 9503 (Nota Explicativa) frente a la alegacion comercial de "
                      "uso terapeutico",
        'challenge': "Caso real y ampliamente documentado en la practica aduanera de la UE (fidget spinners, "
                      "~2017): el fabricante alega uso terapeutico/medico para intentar evitar la partida de "
                      "juguetes (9503, con aranceles y controles de seguridad de juguete), pero al no existir "
                      "certificacion medica ni dispositivo medico registrado, las autoridades aduaneras "
                      "consolidaron su clasificacion como juguete (9503) independientemente del marketing.",
    },
    'ropa_disfraz_carnaval': {
        'desc': 'Traje completo de disfraz de "pirata" para adulto: chaqueta, pantalon, sombrero tricornio y '
                'pañuelo, en tejido sintetico ligero de baja calidad de confeccion (costuras simples sin '
                'acabado, no lavable, un solo uso previsto), vendido en set unico para fiestas tematicas',
        'hs': '950500',  # se declara como "articulo para fiestas, carnaval u otras diversiones"
        'unit': 'SET', 'kg_unit': 0.55,
        'gri_basis': "Nota 1(e) del Capitulo 95 + Notas Explicativas del SA sobre disfraces de fiesta",
        'challenge': "El Capitulo 95 (9505) cubre expresamente 'articulos para fiestas' incluidos los "
                      "disfraces de carnaval, PERO solo si la calidad de confeccion es claramente inferior a "
                      "la de una prenda de vestir normal (materiales endebles, costuras simples, un solo "
                      "uso). Si el disfraz tiene calidad de confeccion de prenda real (dobladillos, "
                      "cremalleras de calidad, reutilizable), la clasificacion correcta pasa a capitulos "
                      "61/62 como prenda de vestir ordinaria — el limite es la CALIDAD DE CONFECCION, no el "
                      "uso pretendido.",
    },
    'vino_desalcoholizado': {
        'desc': 'Vino tinto sometido a un proceso de destilacion al vacio que elimina el alcohol tras la '
                'fermentacion completa de la uva, graduacion alcoholica final inferior a 0,5% vol., '
                'envasado en botella de vidrio de 750ml, comercializado como "vino sin alcohol"',
        'hs': '220600',  # el vendedor lo declara bajo el codigo generico de sidra/bebidas fermentadas
        'unit': 'LTR', 'kg_unit': 1.0,
        'gri_basis': "Nota 5 del Capitulo 22 sobre bebidas desalcoholizadas",
        'challenge': "Aunque el producto se obtiene POR FERMENTACION de la uva igual que el vino normal "
                      "(partida 2204), el Sistema Armonizado dirige especificamente las bebidas a las que "
                      "se ha extraido el alcohol tras la fermentacion hacia la partida 2202 (bebidas no "
                      "alcoholicas), NO a la 2204 (vino) ni a la 2206 (otras bebidas fermentadas) — un punto "
                      "que se pasa por alto con frecuencia porque el producto 'sigue siendo vino' en el "
                      "lenguaje comercial.",
    },
    'colageno_marino_polvo': {
        'desc': 'Peptidos de colageno hidrolizado de origen marino (piel de pescado), en polvo soluble, '
                'envasado en botes de 300g con cuchara dosificadora, etiquetado como "complemento '
                'alimenticio para la salud articular", sin indicaciones terapeuticas especificas ni '
                'principio activo farmaceutico',
        'hs': '300190',  # el proveedor lo declara como "extracto de glandulas u organos, para usos opoterapicos"
        'unit': 'KGM', 'kg_unit': 1.0,
        'gri_basis': "Nota 1 del Capitulo 30 vs. partida 2106 (preparaciones alimenticias no expresadas)",
        'challenge': "El colageno hidrolizado en polvo para consumo por via oral, presentado y etiquetado "
                      "como complemento alimenticio (sin indicacion de dosis terapeutica ni enfermedad "
                      "concreta a tratar), corresponde a 2106 (preparaciones alimenticias), NO al Capitulo 30 "
                      "(productos farmaceuticos) que exige presentacion e indicaciones propias de un "
                      "medicamento. Clasificarlo como producto opoterapico (partida farmaceutica) por el "
                      "origen animal del colageno es un error frecuente que ignora la presentacion real del "
                      "producto.",
    },
    'antiguedad_replica_mueble': {
        'desc': 'Armario de madera de nogal maciza fabricado en 2024 replicando el diseño y las tecnicas de '
                'ebanisteria de un armario frances estilo Luis XV, con herrajes de latón envejecido '
                'artificialmente para simular desgaste, sin ningun componente ni pieza original de epoca',
        'hs': '970600',  # el vendedor lo factura como "objeto de antigüedad de mas de 100 años" para evitar arancel
        'unit': 'PCE', 'kg_unit': 68.0,
        'gri_basis': "Nota 4 del Capitulo 97 — definicion legal de 'antigüedad' (mas de 100 años de "
                      "antiguedad real, no de diseño)",
        'challenge': "Fraude de clasificacion real y recurrente: declarar como 'antigüedad' (partida 9706, "
                      "generalmente libre de derechos) un mueble de fabricacion reciente que simplemente "
                      "IMITA el estilo o las tecnicas de una epoca anterior. La partida 9706 exige que el "
                      "objeto tenga en si mismo mas de 100 años de antiguedad — el estilo, diseño o tecnica "
                      "de fabricacion imitados NO cuentan; un mueble fabricado en 2024 en estilo Luis XV va "
                      "en 9403 (muebles) con su arancel correspondiente, no en 9706.",
    },
    'obra_arte_original_vs_reproduccion': {
        'desc': 'Escultura de bronce fundido a la cera perdida, pieza numerada 3/8 de una edicion limitada '
                'autorizada y firmada por el escultor vivo, con certificado de autenticidad de la fundicion '
                'y del propio artista',
        'hs': '691310',  # el transitario la declara por error como "estatuilla de ceramica" generica
        'unit': 'PCE', 'kg_unit': 14.0,
        'gri_basis': "Nota 3 del Capitulo 97 — obras originales de arte estatuario o escultura",
        'challenge': "Las esculturas originales ejecutadas enteramente por el artista (incluidas ediciones "
                      "limitadas autorizadas de hasta 8 ejemplares numerados, segun la Nota del Capitulo 97) "
                      "se clasifican en la partida 9703 (con tratamiento aduanero preferente, habitualmente "
                      "exentas de IVA reducido/derechos), MUY distinta de las reproducciones en serie o "
                      "figuras decorativas de fabricacion industrial (6913/3926/8306). Confundir una pieza "
                      "de edicion limitada autentica con 'articulo decorativo' generico tiene un impacto "
                      "fiscal real y significativo.",
    },
    'ropa_usada_a_granel': {
        'desc': 'Fardo de 500kg de prendas de vestir de segunda mano sin clasificar por tipo ni talla, '
                'recogidas mediante contenedores de donacion benefica, con signos visibles de uso previo '
                '(desgaste, decoloracion), destinadas a reventa en mercados de ropa usada',
        'hs': '630900',  # partida especifica para articulos de prendería (ropa usada)
        'unit': 'KGM', 'kg_unit': 1.0,
        'gri_basis': "Nota Explicativa de la partida 6309 — requisito de uso efectivo y visible, no simple "
                      "declaracion",
        'challenge': "La partida 6309 (prenderia) es una de las pocas partidas del Sistema Armonizado "
                      "definida por el ESTADO del producto (usado) y no por su naturaleza. El fraude "
                      "clasico es declarar como 'ropa usada' (6309, tratamiento arancelario favorable) lo que "
                      "en realidad es excedente de stock nuevo sin vender (que corresponderia a la partida "
                      "textil ordinaria del articulo, 61/62, con su arancel normal) — la verificacion fisica "
                      "del desgaste real es indispensable, la factura sola no basta.",
    },
    'semillas_canamo_alimentario': {
        'desc': 'Semillas de canamo (Cannabis sativa) peladas, tostadas, para uso alimentario directo o como '
                'topping de ensaladas y batidos, contenido de THC inferior al 0,2% certificado por analisis '
                'de laboratorio, sin capacidad de germinacion',
        'hs': '120729',  # el proveedor las declara junto con "las demas semillas oleaginosas"
        'unit': 'KGM', 'kg_unit': 1.0,
        'gri_basis': "Nota complementaria de capitulo sobre semillas de Cannabis sativa con bajo contenido "
                      "de THC + control documental de estupefacientes",
        'challenge': "Las semillas de canamo con THC certificado por debajo del umbral legal (0,2% en la "
                      "UE) y sin capacidad germinativa se clasifican como semilla oleaginosa alimentaria "
                      "ordinaria (1207.99), pero CUALQUIER envio de productos derivados de Cannabis sativa "
                      "esta sujeto a escrutinio documental reforzado (certificado de analisis THC, a veces "
                      "licencia) independientemente del codigo TARIC que se declare — un caso donde la "
                      "clasificacion correcta NO exime del control regulatorio adicional.",
    },
    'controlador_midi_sin_sonido': {
        'desc': 'Controlador de teclado musical con 61 teclas sensibles a la velocidad, sin generador de '
                'sonido propio ni altavoces internos, se conecta por USB a un ordenador que ejecuta el '
                'software que realmente sintetiza el sonido; el propio controlador es electricamente '
                'incapaz de producir ninguna nota por si mismo',
        'hs': '920600',  # se factura como "instrumento musical electronico", igual que un teclado con sonido propio
        'unit': 'PCE', 'kg_unit': 4.1,
        'gri_basis': "GRI 1 — texto de la partida 9207 exige que el propio aparato genere o amplifique el "
                      "sonido",
        'challenge': "Un teclado MIDI controlador que no contiene ningun generador de sonido (ni sintetizador "
                      "interno, ni altavoz) no es, en sentido estricto, un 'instrumento musical electronico' "
                      "de la partida 9207 — es un periferico de entrada de datos para ordenador, mas propio "
                      "de la partida 8471 (o 8543 segun el analisis). Es un error habitual clasificar por "
                      "apariencia (parece un teclado de piano) en vez de por funcion real (no suena sin un "
                      "ordenador conectado).",
    },
    'pieza_repuesto_universal': {
        'desc': 'Correa de transmision de caucho reforzado con fibra, seccion trapezoidal estandar tipo A42, '
                'compatible indistintamente con motores de compresores de aire, generadores electricos, '
                'bombas de riego y maquinaria agricola de multiples fabricantes, vendida como recambio '
                'generico sin destino a una maquina especifica',
        'hs': '840999',  # el proveedor la declara como parte especifica de "motores de embolo"
        'unit': 'PCE', 'kg_unit': 0.3,
        'gri_basis': "Nota 2 de la Seccion XVI — partes de uso general",
        'challenge': "Cuando una pieza (aqui, una correa de transmision) es de USO GENERAL y no esta "
                      "diseñada ni destinada a una maquina concreta de una partida especifica, la Nota 2 de "
                      "la Seccion XVI impide clasificarla como 'parte' de una maquina determinada (lo que "
                      "haria el proveedor al facturarla como parte de 'motores de embolo', 8409); en su "
                      "lugar corresponde a su propia partida de articulo de caucho para uso tecnico general "
                      "(4010), independientemente de en que maquina termine instalandose el comprador.",
    },
    'kit_energia_solar_residencial': {
        'desc': 'Conjunto para autoconsumo domestico compuesto por 6 paneles fotovoltaicos, 1 inversor '
                'hibrido, 1 bateria de litio de 5kWh y el cableado/estructura de montaje necesarios, '
                'envasados y vendidos como un unico "kit de energia solar" con un solo numero de referencia '
                'comercial',
        'hs': '854140',  # se factura integramente bajo el codigo de los paneles solares
        'unit': 'SET', 'kg_unit': 145.0,
        'gri_basis': "GRI 3(b) 'surtidos' vs. Nota de Seccion XVI sobre instalaciones completas",
        'challenge': "Un 'kit' de energia solar combina componentes de partidas claramente distintas: "
                      "paneles fotovoltaicos (8541), inversor (8504), bateria (8507) y estructura metalica "
                      "(7308/7610). A diferencia de un 'surtido para la venta al por menor' (GRI 3b, un solo "
                      "codigo por caracter esencial), cuando los componentes forman una instalacion "
                      "funcional destinada a montarse como un sistema integrado, la practica aduanera exige "
                      "evaluar si corresponde declarar cada componente por su propia partida (lo habitual) "
                      "en vez de forzar un unico codigo — facturar 'todo como panel solar' subdeclara el "
                      "valor arancelario real de la bateria y el inversor, tipicamente con aranceles "
                      "distintos entre si.",
    },
    'te_hongo_kombucha_vivo': {
        'desc': 'Cultivo vivo de SCOBY (colonia simbiotica de bacterias y levaduras) para la elaboracion '
                'domestica de kombucha, transportado en su propio liquido de cultivo (te fermentado), '
                'refrigerado, con actividad biologica activa en el momento de la exportacion',
        'hs': '210210',  # el exportador lo declara como "levaduras vivas" generico
        'unit': 'KGM', 'kg_unit': 1.0,
        'gri_basis': "GRI 1 — naturaleza del producto (cultivo microbiologico vivo en medio liquido) frente a "
                      "'levadura' en sentido estricto",
        'challenge': "Un SCOBY no es una levadura pura sino un cultivo simbiotico mixto de bacterias "
                      "acidas y levaduras en una matriz de celulosa, transportado en te fermentado activo. "
                      "Clasificarlo sin mas como 'levadura' (2102) ignora que gran parte de su masa y "
                      "funcion es bacteriana, no fungica — ademas, al ser un organismo vivo en medio "
                      "liquido con fermentacion activa, puede requerir controles sanitarios/fitosanitarios "
                      "adicionales que un producto de levadura seca inerte no necesitaria.",
    },
    'mascara_realidad_virtual_con_auriculares': {
        'desc': 'Visor de realidad virtual con pantallas OLED estereoscopicas integradas, auriculares '
                'circumaurales con cancelacion de ruido incorporados de forma no desmontable, y controlador '
                'de mano con sensores de movimiento, vendido como conjunto unico "todo incluido"',
        'hs': '852872',  # se declara integramente como "monitor o proyector de video"
        'unit': 'PCE', 'kg_unit': 0.85,
        'gri_basis': "Nota 3 de la Seccion XVI (funcion principal) vs. GRI 3(b) si se considerase surtido",
        'challenge': "El visor combina pantalla (8528), auriculares con microfono/altavoz (8518) y mando "
                      "con sensores (8471/8543). Al estar los auriculares fisicamente INTEGRADOS y no ser "
                      "vendibles por separado, la Nota 3 de Seccion XVI aplica (maquina combinada, "
                      "clasificar por funcion principal: la visualizacion) — pero el mando de mano, si es "
                      "separable, podria analizarse de forma independiente en vez de forzarlo dentro del "
                      "mismo codigo que el visor.",
    },
    'te_con_cbd_infusion': {
        'desc': 'Infusion de te verde con extracto de cannabidiol (CBD) de origen vegetal añadido, contenido '
                "certificado de THC no detectable (0,00%), comercializada como 'te de bienestar relajante', "
                'sin ninguna alegacion medica ni terapeutica en el etiquetado',
        'hs': '090240',  # se declara junto con "los demas tes" sin considerar el aditivo de CBD
        'unit': 'KGM', 'kg_unit': 1.0,
        'gri_basis': "Reglamento (UE) de Nuevos Alimentos (Novel Food) + clasificacion arancelaria "
                      "por el componente que aporta el caracter esencial",
        'challenge': "El te con CBD añadido plantea dos capas de riesgo distintas que se confunden con "
                      "frecuencia: (1) clasificacion arancelaria — ¿sigue siendo 'te' (0902) con un aditivo, "
                      "o el CBD como principio activo dominante cambia la naturaleza del producto?; y "
                      "(2) reglamentacion alimentaria — el CBD como ingrediente puede estar sujeto a "
                      "autorizacion de Novel Food en la UE independientemente de que la clasificacion "
                      "arancelaria elegida sea correcta. Aprobar el codigo TARIC NO implica que el producto "
                      "pueda comercializarse legalmente sin la autorizacion alimentaria correspondiente.",
    },
}


def _c(n, title, op, mode, foreign_iso, foreign_idx, es_idx, incoterm, currency, product_key, qty, unit_price, **kw):
    base = dict(n=n, id=f"BORDE-{n:02d}", title=title, op=op, mode=mode,
                foreign_iso=foreign_iso, foreign_idx=foreign_idx, es_idx=es_idx,
                incoterm=incoterm, currency=currency, products=[(product_key, qty, unit_price)],
                hide_hs_confidence=True,
                classification_challenge=PRODUCTOS_BORDE[product_key]['challenge'],
                gri_basis=PRODUCTOS_BORDE[product_key]['gri_basis'])
    base.update(kw)
    return base


RAW_BORDE = [
    _c(1, "Impresora multifuncion: ¿una sola partida o varias funciones combinadas? (Nota 3 Sec. XVI)",
       'import', 'maritime', 'CN', 0, 4, 'FOB', 'USD', 'impresora_multifuncion', 340, 165.00),

    _c(2, "Dispositivo 'antiestres': ¿instrumento de precision/medico o juguete? (GRI 1, caso real UE)",
       'import', 'air', 'CN', 1, 5, 'FCA', 'USD', 'dispositivo_antiestres', 8600, 1.85),

    _c(3, "Disfraz de carnaval: calidad de confeccion como criterio de partida (Nota 1(e) Cap. 95)",
       'import', 'maritime', 'IN', 0, 6, 'FOB', 'USD', 'ropa_disfraz_carnaval', 2400, 6.40),

    _c(4, "Vino desalcoholizado: ¿sigue siendo 'vino' tras eliminar el alcohol? (Nota 5 Cap. 22)",
       'import', 'maritime', 'AR', 0, 7, 'FOB', 'USD', 'vino_desalcoholizado', 7200, 3.10),

    _c(5, "Colageno marino en polvo: complemento alimenticio vs. producto opoterapico (Nota 1 Cap. 30)",
       'import', 'air', 'KR', 1, 8, 'CPT', 'USD', 'colageno_marino_polvo', 480, 42.00),

    _c(6, "Mueble 'estilo Luis XV' fabricado en 2024: antiguedad falsa vs. mueble nuevo (Nota 4 Cap. 97)",
       'import', 'maritime', 'MA', 1, 9, 'DAP', 'EUR', 'antiguedad_replica_mueble', 12, 890.00),

    _c(7, "Escultura de edicion limitada firmada: obra de arte original vs. reproduccion (Nota 3 Cap. 97)",
       'import', 'air', 'GB', 2, 10, 'CPT', 'GBP', 'obra_arte_original_vs_reproduccion', 1, 15800.00),

    _c(8, "Fardo de ropa usada a granel: prenderia real vs. stock nuevo mal declarado (partida 6309)",
       'import', 'maritime', 'US', 1, 11, 'FOB', 'USD', 'ropa_usada_a_granel', 3, 0.85),

    _c(9, "Semillas de canamo alimentario con THC certificado <0,2% (control documental reforzado)",
       'import', 'maritime', 'CA', 0, 12, 'FOB', 'CAD', 'semillas_canamo_alimentario', 4800, 3.90),

    _c(10, "Controlador MIDI sin generador de sonido: ¿instrumento musical o periferico informatico? (GRI 1)",
        'import', 'air', 'CN', 2, 13, 'FCA', 'USD', 'controlador_midi_sin_sonido', 210, 78.00),

    _c(11, "Correa de transmision universal: pieza de uso general, no 'parte' de una maquina (Nota 2 Sec. XVI)",
        'import', 'maritime', 'IN', 2, 14, 'FOB', 'USD', 'pieza_repuesto_universal', 9600, 4.60),

    _c(12, "Kit de energia solar residencial: ¿un solo codigo o declarar cada componente por separado? (GRI 3b)",
        'import', 'maritime', 'CN', 3, 0, 'FOB', 'USD', 'kit_energia_solar_residencial', 65, 780.00),

    _c(13, "Cultivo vivo de SCOBY para kombucha: organismo simbiotico vs. 'levadura' generica (GRI 1)",
        'import', 'air', 'GB', 3, 1, 'CPT', 'GBP', 'te_hongo_kombucha_vivo', 85, 21.00,
        extra_docs=['sanitary_certificate']),

    _c(14, "Visor de realidad virtual con auriculares integrados: funcion principal combinada (Nota 3 Sec. XVI)",
        'import', 'air', 'KR', 0, 2, 'FCA', 'USD', 'mascara_realidad_virtual_con_auriculares', 620, 285.00),

    _c(15, "Te con CBD añadido: clasificacion arancelaria vs. autorizacion Novel Food (doble control)",
        'import', 'maritime', 'CH', 1, 3, 'FCA', 'CHF', 'te_con_cbd_infusion', 1400, 14.50),
]
