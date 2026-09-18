# -*- coding: utf-8 -*-
"""
Productos de las 5 categorias nuevas pedidas: perecederos vegetales (frutas y
verduras frescas), alimentos con riesgo sanitario/veterinario/pesquero,
productos quimicos (REACH/CLP), mercancias peligrosas para el transporte
(ADR/IMDG/IATA-DGR) y productos que exigen cadena de frio farmaceutica (GDP).

Mismo esquema que pools.PRODUCTS (desc/hs/unit/kg_unit/supplementary) mas
campos opcionales especificos que leen las nuevas funciones de pdfgen.py:
  temp_range     -> rango de temperatura de conservacion/transporte exigido
  un_number      -> numero ONU (mercancia peligrosa para el transporte)
  hazard_class   -> clase de peligro ADR/IMDG/IATA (1 a 9)
  packing_group  -> grupo de embalaje (I/II/III), cuando aplica
  flash_point    -> punto de inflamacion (liquidos inflamables)
  cas_no         -> numero CAS de la sustancia (FDS/REACH)
  catch_area     -> zona FAO de captura (productos de la pesca, IUU/INDNR)
  reinforced_pct -> frecuencia de control reforzado en frontera (Reg. 2019/1793)
  est_number     -> numero de autorizacion sanitaria del establecimiento de origen
  gdp_required   -> requiere certificado de Buenas Practicas de Distribucion
  limited_qty    -> admite la exencion IMDG/IATA de "cantidades limitadas" (LQ)
  special_note   -> nota reglamentaria adicional especifica del producto
"""

PRODUCTOS_ESPECIALES = {
    # -----------------------------------------------------------------
    # PERECEDEROS VEGETALES (frutas y verduras frescas)
    # -----------------------------------------------------------------
    'green_beans_fresh': {
        'desc': 'Judias verdes frescas, variedad Boby, para consumo directo en fresco',
        'hs': '070820', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '+6°C a +8°C',
    },
    'fresh_pineapple': {
        'desc': 'Pinas tropicales frescas, variedad MD-2 (Golden Sweet), enteras',
        'hs': '080430', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '+7°C a +9°C',
    },
    'fresh_oranges': {
        'desc': 'Naranjas frescas, variedad Valencia Late, para consumo en fresco',
        'hs': '080510', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '+2°C a +8°C',
    },
    'fresh_tomatoes': {
        'desc': 'Tomates frescos, variedad Cherry en racimo (tipo vine), calibre 20-30mm',
        'hs': '070200', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '+8°C a +10°C',
    },
    'fresh_strawberries': {
        'desc': 'Fresas frescas variedad Fortuna, en bandejas de 250g para venta al detalle',
        'hs': '081010', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '0°C a +2°C',
    },
    'cut_roses': {
        'desc': 'Rosas cortadas frescas, variedad Freedom, tallo largo (60cm), para floristeria',
        'hs': '060311', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '+2°C a +4°C',
    },

    # -----------------------------------------------------------------
    # ALIMENTOS (riesgo sanitario reforzado / origen animal / pesquero)
    # -----------------------------------------------------------------
    'raw_honey': {
        'desc': 'Miel natural de flores silvestres, sin procesar, a granel en bidones de 300kg',
        'hs': '040900', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'reinforced_pct': '100% (vigilancia intensiva por alertas RASFF de residuos de antibioticos)',
    },
    'black_pepper_india': {
        'desc': 'Pimienta negra en grano, entera, variedad Malabar, a granel en sacos de 25kg',
        'hs': '090411', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'reinforced_pct': '20% (Reglamento de Ejecucion (UE) 2019/1793, Anexo I — riesgo de aflatoxinas)',
    },
    'canned_tuna': {
        'desc': 'Atun en conserva al natural en aceite de oliva, lata de 160g, caja de 48 uds.',
        'hs': '160414', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'catch_area': 'FAO 71 (Pacifico Centro-Occidental)',
    },
    'raw_milk_cheese': {
        'desc': 'Queso de leche cruda de oveja, curado 6 meses, en piezas de 1kg',
        'hs': '040690', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '+2°C a +6°C', 'est_number': 'CH-2024-0456-EC (planta autorizada UE)',
    },
    'frozen_fish_fillets': {
        'desc': 'Filetes de pescado congelado (merluza austral), sin piel, IQF, caja de 10kg',
        'hs': '030462', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'temp_range': '-18°C o inferior', 'catch_area': 'FAO 87 (Pacifico Sudeste)',
    },

    # -----------------------------------------------------------------
    # PRODUCTOS QUIMICOS (REACH / CLP)
    # -----------------------------------------------------------------
    'acetone_industrial': {
        'desc': 'Acetona tecnica, grado industrial, a granel en cisterna ISO de 20.000L',
        'hs': '291411', 'unit': 'LTR', 'kg_unit': 0.79, 'supplementary': None,
        'cas_no': '67-64-1', 'un_number': 'UN1090', 'hazard_class': '3',
        'packing_group': 'II', 'flash_point': '-20°C',
    },
    'sulfuric_acid': {
        'desc': 'Acido sulfurico tecnico, concentracion 98%, a granel en cisterna ISO',
        'hs': '280700', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'cas_no': '7664-93-9', 'un_number': 'UN1830', 'hazard_class': '8', 'packing_group': 'II',
    },
    'epoxy_resin': {
        'desc': 'Resina epoxi liquida, sin curar, para uso industrial, en bidones de 25kg',
        'hs': '390730', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'cas_no': '25068-38-6',
        'special_note': 'Sustancia quimica sujeta a REACH/CLP (requiere FDS) pero NO clasificada como '
                         'mercancia peligrosa para el transporte: no tiene numero ONU asignado.',
    },
    'ammonium_nitrate_fertilizer': {
        'desc': 'Fertilizante a base de nitrato de amonio, granulado, 34,5% de nitrogeno',
        'hs': '310230', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None,
        'cas_no': '6484-52-2', 'un_number': 'UN2067', 'hazard_class': '5.1', 'packing_group': 'III',
        'special_note': 'Precursor de explosivos regulado por el Reglamento (UE) 2019/1148: por encima del '
                         'umbral de concentracion de nitrogeno, su comercializacion al publico general esta '
                         'restringida y requiere control adicional del uso final declarado.',
    },

    # -----------------------------------------------------------------
    # MERCANCIAS PELIGROSAS PARA EL TRANSPORTE (no necesariamente "quimicas")
    # -----------------------------------------------------------------
    'lithium_ion_batteries': {
        'desc': 'Baterias de litio-ion recargables para dispositivos electronicos portatiles, '
                'embaladas solas (no instaladas en equipo)',
        'hs': '850760', 'unit': 'PCE', 'kg_unit': 0.28, 'supplementary': 'p/st',
        'un_number': 'UN3480', 'hazard_class': '9', 'packing_group': 'II',
        'special_note': 'Bateria de litio-ion SOLA (Section II PI965): estado de carga (SoC) declarado <=30% '
                         'para transporte aereo de carga — muchas aerolineas la rechazan como carga en aviones '
                         'de pasajeros independientemente de este limite.',
    },
    'aerosols_flammable': {
        'desc': 'Aerosoles cosmeticos (desodorante corporal), propelente inflamable, envase de 150ml',
        'hs': '330720', 'unit': 'PCE', 'kg_unit': 0.15, 'supplementary': None,
        'un_number': 'UN1950', 'hazard_class': '2.1', 'packing_group': None, 'limited_qty': True,
    },
    'fireworks_display': {
        'desc': 'Articulos de pirotecnia para espectaculos, categoria F4 (uso exclusivo profesional)',
        'hs': '360410', 'unit': 'PCE', 'kg_unit': 4.5, 'supplementary': None,
        'un_number': 'UN0335', 'hazard_class': '1.3G', 'packing_group': 'II',
        'special_note': 'Mercancia de Clase 1 (explosivos): requiere autorizacion previa expresa de la naviera '
                         'y de la autoridad portuaria antes de aceptar la reserva de espacio — el rechazo, si '
                         'se produce, ocurre en origen, antes de llegar a la aduana espanola.',
    },

    # -----------------------------------------------------------------
    # CADENA DE FRIO FARMACEUTICA / BIOLOGICA (GDP)
    # -----------------------------------------------------------------
    'veterinary_vaccines': {
        'desc': 'Vacunas veterinarias inactivadas, viales de 50 dosis, uso ganadero, en nevera activa',
        'hs': '300220', 'unit': 'PCE', 'kg_unit': 0.05, 'supplementary': None,
        'temp_range': '+2°C a +8°C', 'gdp_required': True,
    },
    'human_insulin': {
        'desc': 'Insulina humana biosintetica, cartuchos de 3ml para pluma precargada, caja de 5 uds.',
        'hs': '300431', 'unit': 'PCE', 'kg_unit': 0.03, 'supplementary': None,
        'temp_range': '+2°C a +8°C', 'gdp_required': True,
        'special_note': 'Medicamento biologico sujeto a la Directiva 2011/62/UE (medicamentos falsificados): '
                         'dispositivo de seguridad/serializacion anti-manipulacion obligatorio en el envase.',
    },
}
