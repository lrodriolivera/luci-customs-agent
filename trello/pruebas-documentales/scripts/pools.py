# -*- coding: utf-8 -*-
"""
Catalogo de datos realistas: paises, empresas, puertos/aeropuertos, productos,
transportistas. Usado para poblar los 64 casos de prueba (43 H1 + 21 AES) con
datos unicos y variados, dentro y fuera de la UE.
"""

# ---------------------------------------------------------------------------
# Paises: nombre, ISO2, prefijo telefonico, formato de codigo postal ejemplo,
# es_UE (para decidir si aplica VAT number UE o tax id local)
# ---------------------------------------------------------------------------
COUNTRIES = {
    'CN': {'name': 'China', 'phone': '+86', 'eu': False},
    'VN': {'name': 'Vietnam', 'phone': '+84', 'eu': False},
    'IN': {'name': 'India', 'phone': '+91', 'eu': False},
    'TR': {'name': 'Turquia', 'phone': '+90', 'eu': False},
    'MA': {'name': 'Marruecos', 'phone': '+212', 'eu': False},
    'US': {'name': 'Estados Unidos', 'phone': '+1', 'eu': False},
    'BR': {'name': 'Brasil', 'phone': '+55', 'eu': False},
    'MX': {'name': 'Mexico', 'phone': '+52', 'eu': False},
    'JP': {'name': 'Japon', 'phone': '+81', 'eu': False},
    'KR': {'name': 'Corea del Sur', 'phone': '+82', 'eu': False},
    'ZA': {'name': 'Sudafrica', 'phone': '+27', 'eu': False},
    'AE': {'name': 'Emiratos Arabes Unidos', 'phone': '+971', 'eu': False},
    'SA': {'name': 'Arabia Saudita', 'phone': '+966', 'eu': False},
    'GB': {'name': 'Reino Unido', 'phone': '+44', 'eu': False},
    'CH': {'name': 'Suiza', 'phone': '+41', 'eu': False},
    'NO': {'name': 'Noruega', 'phone': '+47', 'eu': False},
    'CA': {'name': 'Canada', 'phone': '+1', 'eu': False},
    'CL': {'name': 'Chile', 'phone': '+56', 'eu': False},
    'AR': {'name': 'Argentina', 'phone': '+54', 'eu': False},
    'AU': {'name': 'Australia', 'phone': '+61', 'eu': False},
    'TH': {'name': 'Tailandia', 'phone': '+66', 'eu': False},
    'ID': {'name': 'Indonesia', 'phone': '+62', 'eu': False},
    'EG': {'name': 'Egipto', 'phone': '+20', 'eu': False},
    'CO': {'name': 'Colombia', 'phone': '+57', 'eu': False},
    'PE': {'name': 'Peru', 'phone': '+51', 'eu': False},
    'TN': {'name': 'Tunez', 'phone': '+216', 'eu': False},
    'PK': {'name': 'Pakistan', 'phone': '+92', 'eu': False},
    'BD': {'name': 'Bangladesh', 'phone': '+880', 'eu': False},
    'KE': {'name': 'Kenia', 'phone': '+254', 'eu': False},
    'CR': {'name': 'Costa Rica', 'phone': '+506', 'eu': False},
    'EC': {'name': 'Ecuador', 'phone': '+593', 'eu': False},
    'IL': {'name': 'Israel', 'phone': '+972', 'eu': False},
    # UE (sede de empresas, transito, no origen aduanero para H1/AES)
    'ES': {'name': 'Espana', 'phone': '+34', 'eu': True},
    'FR': {'name': 'Francia', 'phone': '+33', 'eu': True},
    'DE': {'name': 'Alemania', 'phone': '+49', 'eu': True},
    'IT': {'name': 'Italia', 'phone': '+39', 'eu': True},
    'NL': {'name': 'Paises Bajos', 'phone': '+31', 'eu': True},
    'PT': {'name': 'Portugal', 'phone': '+351', 'eu': True},
    'PL': {'name': 'Polonia', 'phone': '+48', 'eu': True},
    'BE': {'name': 'Belgica', 'phone': '+32', 'eu': True},
    'IE': {'name': 'Irlanda', 'phone': '+353', 'eu': True},
}

# ---------------------------------------------------------------------------
# Empresas por pais: (nombre, calle+numero, ciudad, codigo_postal, tax_id_fmt)
# Varias por pais para no repetir la misma empresa en dos casos.
# ---------------------------------------------------------------------------
COMPANIES = {
    'CN': [
        ('Shanghai Hongtai Import & Export Co., Ltd.', 'No. 1288 Pudong Ave, Bldg 3', 'Shanghai', '200120', '91310115MA1K3F5Q28'),
        ('Shenzhen Weilun Electronics Co., Ltd.', 'Bldg 7, Nanshan Zhiyuan Ind. Park', 'Shenzhen', '518052', '91440300MA5G7H2N63'),
        ('Ningbo Haitong Trading Co., Ltd.', '88 Jiangdong North Rd', 'Ningbo', '315040', '91330204MA2H1D8P47'),
        ('Yiwu Chuangxin Commodity Co., Ltd.', '3F, Futian Market Zone 5', 'Yiwu', '322000', '91330782MA28T6R91X'),
    ],
    'VN': [
        ('Hanoi Phuong Dong Garment JSC', '45 Duy Tan Street, Cau Giay', 'Hanoi', '100000', '0106789452'),
        ('Binh Duong Furniture Export Co.', 'Lot C-12, VSIP II Industrial Park', 'Binh Duong', '75000', '3702134567'),
    ],
    'IN': [
        ('Sunrise Textiles Pvt. Ltd.', 'Plot 22, MIDC Industrial Area', 'Mumbai', '400093', 'AAECS1234F'),
        ('Ganesh Handicrafts Exports', '14 Sardar Patel Road', 'Jaipur', '302001', 'AABCG5678K'),
        ('Mumbai Rubber Components Pvt. Ltd.', 'Plot 45, MIDC Andheri Industrial Estate', 'Mumbai', '400093', 'AAFCR6789M'),
    ],
    'TR': [
        ('Anadolu Tekstil San. ve Tic. A.S.', 'Organize Sanayi Bolgesi, 4. Cad. No:17', 'Istanbul', '34530', '1234567890'),
        ('Ege Makina Ithalat Ihracat Ltd. Sti.', 'Ataturk Cad. No: 88', 'Izmir', '35220', '9876543210'),
    ],
    'MA': [
        ('Atlas Agrumes S.A.R.L.', 'Zone Industrielle Sidi Bernoussi, Lot 34', 'Casablanca', '20600', 'IF40123456'),
        ('Marrakech Artisanat Export', 'Route de Safi, Km 5', 'Marrakech', '40000', 'IF40987654'),
        ('Souss Massa BioVet Import-Export S.A.R.L.', 'Zone Industrielle Ait Melloul, Lot 56', 'Agadir', '86150', 'IF40567891'),
    ],
    'US': [
        ('Meridian Industrial Supply Inc.', '4820 Corporate Blvd, Suite 210', 'Charlotte', 'NC 28216', '56-2345671'),
        ('Pacific Coast Machinery LLC', '1150 Harbor Way', 'Long Beach', 'CA 90802', '95-1123456'),
    ],
    'BR': [
        ('Comercial Amazonia Exportacao Ltda.', 'Av. das Nacoes Unidas, 1200, Sala 5', 'Sao Paulo', '04578-000', '12.345.678/0001-90'),
        ('Cafe Serra Verde Exportadora S.A.', 'Rua dos Cafeicultores, 340', 'Santos', '11015-020', '98.765.432/0001-11'),
    ],
    'MX': [
        ('Manufacturas del Bajio S.A. de C.V.', 'Blvd. Industrial 450, Parque Ind. Norte', 'Leon', '37490', 'MBA950612AB1'),
        ('Aguacates de Michoacan Exportadora', 'Carretera Uruapan-Apatzingan Km 8', 'Uruapan', '60130', 'AME870215CD3'),
    ],
    'JP': [
        ('Fujimoto Precision Instruments Co., Ltd.', '3-14-2 Nishishinjuku', 'Tokyo', '160-0023', 'T1010401012345'),
        ('Osaka Kiko Trading Corporation', '5-1-8 Minamisenba, Chuo-ku', 'Osaka', '542-0081', 'T5120001067890'),
    ],
    'KR': [
        ('Hanwoori Electronics Co., Ltd.', '128 Teheran-ro, Gangnam-gu', 'Seoul', '06133', '214-81-23456'),
        ('Busan Marine Parts Corp.', '45 Haeundae-ro, Haeundae-gu', 'Busan', '48099', '605-81-98765'),
    ],
    'ZA': [
        ('Cape Fruit Exporters (Pty) Ltd', '12 Beach Road, Paarden Eiland', 'Cape Town', '7405', '4230123456'),
        ('Johannesburg Mineral Traders (Pty) Ltd', '88 Rivonia Road', 'Sandton', '2196', '4450987654'),
    ],
    'AE': [
        ('Al Maha General Trading LLC', 'Office 1204, Jumeirah Lakes Towers', 'Dubai', '00000', '100234567800003'),
        ('Emirates Perfume Trading Co. LLC', 'Warehouse 22, Jebel Ali Free Zone', 'Dubai', '00000', '100876543200003'),
    ],
    'SA': [
        ('Riyadh Advanced Materials Co.', 'King Fahd Road, Al Olaya District', 'Riyadh', '12212', '300123456700003'),
    ],
    'GB': [
        ('Thames Valley Precision Ltd.', 'Unit 8, Bicester Business Park', 'Bicester', 'OX26 4SP', 'GB123456789'),
        ('Highland Whisky Merchants Ltd.', '22 Speyside Way', 'Elgin', 'IV30 1TF', 'GB987654321'),
        ('London Fine Art Foundry Ltd.', '14 Cork Street, Mayfair', 'London', 'W1S 3NG', 'GB456789123'),
        ('Bristol Fermented Foods Ltd.', 'Unit 3, Avonmouth Trading Estate', 'Bristol', 'BS11 9YA', 'GB321654987'),
    ],
    'CH': [
        ('Gruyère Alpin Affineurs SA', 'Route de Bulle 22', 'Gruyères', '1663', 'CHE-456.789.123'),
        ('Helvetia Pharma Export AG', 'Baarerstrasse 88', 'Zug', '6302', 'CHE-789.123.456'),
        ('Alpina Precision Instruments AG', 'Industriestrasse 14', 'Zug', '6300', 'CHE-123.456.789'),
        ('Geneve Horlogerie Fine SA', 'Rue du Rhone 45', 'Geneve', '1204', 'CHE-987.654.321'),
    ],
    'NO': [
        ('Nordfjord Seafood AS', 'Havnegata 12', 'Alesund', '6002', '923456789'),
    ],
    'CA': [
        ('Great Lakes Industrial Equipment Inc.', '1450 Dundas Street East', 'Mississauga', 'ON L4X 2R9', '123456789RT0001'),
        ('Maple Valley Timber Corp.', '780 Rue Principale', 'Trois-Rivieres', 'QC G8T 4H3', '987654321RT0001'),
    ],
    'CL': [
        ('Vinedos del Maule Exportadora S.A.', 'Camino Real 340', 'Talca', '3460000', '76.123.456-7'),
        ('Cobre Andino Trading S.A.', 'Av. Apoquindo 4500, Of. 802', 'Santiago', '7550000', '76.987.654-3'),
    ],
    'AR': [
        ('Pampa Apicola Exportadora S.A.', 'Ruta Nacional 5, Km 340', 'General Pico', 'L6360', '30-87654321-0'),
        ('Patagonia BioFarma Import S.A.', 'Av. Rivadavia 3200, Piso 6', 'Buenos Aires', 'C1203AAM', '30-98765432-1'),
        ('Pampa Cueros y Marroquineria S.A.', 'Av. Corrientes 2340, Piso 4', 'Buenos Aires', 'C1046AAQ', '30-71234567-8'),
    ],
    'AU': [
        ('Outback Mining Supplies Pty Ltd', '55 Coronation Drive', 'Brisbane', 'QLD 4000', '51 234 567 890'),
        ('Southern Wool Exporters Pty Ltd', '12 Flinders Lane', 'Melbourne', 'VIC 3000', '29 876 543 210'),
    ],
    'TH': [
        ('Bangkok Rice Trading Co., Ltd.', '399 Sukhumvit Soi 22', 'Bangkok', '10110', '0105536012345'),
        ('Chiang Mai Ceramics Export Co., Ltd.', '88 Nimmanhaemin Road', 'Chiang Mai', '50200', '0505562098765'),
    ],
    'ID': [
        ('Jakarta Furniture Manufacturing PT', 'Jl. Industri Raya III No. 5', 'Jakarta', '15136', '01.234.567.8-901.000'),
        ('Surabaya Rice Export PT', 'Jl. Raya Rungkut Industri No. 20', 'Surabaya', '60293', '02.345.678.9-012.000'),
    ],
    'EG': [
        ('Nile Cotton Export Co.', '18 El Nasr Road, Nasr City', 'Cairo', '11765', '123-456-789'),
        ('Alexandria Ceramics & Sanitary Co.', '25 Horreya Road', 'Alexandria', '21131', '987-654-321'),
    ],
    'CO': [
        ('Cafe de los Andes Exportadora S.A.S.', 'Calle 26 #68-90, Torre B Of. 501', 'Bogota', '111071', '900.123.456-7'),
    ],
    'PE': [
        ('Textiles Alpaca del Sur S.A.C.', 'Av. Argentina 2140', 'Lima', '15082', '20512345678'),
    ],
    'TN': [
        ('Sfax Huile d\'Olive Export S.A.R.L.', 'Route de Tunis Km 6', 'Sfax', '3000', '123456A'),
    ],
    'PK': [
        ('Lahore Surgical Instruments Ltd.', 'Sialkot Road, Industrial Estate', 'Lahore', '54000', 'NTN-1234567-8'),
        ('Karachi Textile Mills (Pvt.) Ltd.', 'S.I.T.E. Area, Manghopir Road', 'Karachi', '75700', 'NTN-8765432-1'),
    ],
    'BD': [
        ('Dhaka Knitwear Exports Ltd.', 'Plot 45, Export Processing Zone', 'Dhaka', '1230', 'BIN-000123456-0101'),
    ],
    'KE': [
        ('Rift Valley Horticultural Exporters Ltd.', 'Naivasha-Nakuru Highway, Plot 45', 'Naivasha', '20117', 'P051234567X'),
        ('Mombasa Coastal Produce Co. Ltd.', 'Nyali Road, Warehouse 9', 'Mombasa', '80100', 'P052345678Y'),
    ],
    'CR': [
        ('Piñas Tropicales de Costa Rica S.A.', 'Carretera a Guápiles, Km 18', 'Guácimo', '70201', '3-101-456789'),
        ('Café Volcán Poás Exportadora S.A.', 'Barrio San José Centro', 'Alajuela', '20101', '3-101-654321'),
    ],
    'EC': [
        ('Camaronera del Golfo de Guayaquil S.A.', 'Malecón del Estero, Bodega 7', 'Guayaquil', '090250', '0992345678001'),
        ('Rosas del Cotopaxi Export Cia. Ltda.', 'Via Lasso-Mulaló Km 4', 'Latacunga', '050101', '0993456789001'),
        ('Bananera del Pacífico S.A.', 'Vía a Salitre Km 12', 'Guayaquil', '090150', '0991234567001'),
    ],
    'IL': [
        ('Haifa Chemical Industries Export Ltd.', 'HaShayarot Street 12, Haifa Bay Ind. Zone', 'Haifa', '2624002', '514123456'),
        ('Negev Agro Export Ltd.', 'Industrial Park, Ramat Hovav', 'Beer Sheva', '8551900', '515987654'),
    ],
    # Empresas UE (importador/exportador o sede de agente)
    'ES': [
        ('Distribuciones Iberica del Levante S.L.', 'Poligono Industrial Fuente del Jarro, Calle 4 nº 12', 'Paterna (Valencia)', '46988', 'B-46123456'),
        ('Importaciones Costa Brava S.L.', 'Carrer de la Indústria, 8', 'Girona', '17005', 'B-17987654'),
        ('Suministros Norte Peninsular S.A.', 'Poligono Asipo, Parcela 22', 'Llanera (Asturias)', '33428', 'A-33456789'),
        ('Mercantil Andaluza de Importacion S.L.', 'Avda. de la Innovacion, 3', 'Dos Hermanas (Sevilla)', '41703', 'B-41678912'),
        ('Comercial Vasca de Componentes S.L.', 'Poligono Jundiz, Calle E nº 15', 'Vitoria-Gasteiz', '01015', 'B-01234567'),
        ('Ibertrade Import-Export S.A.', 'Muelle de Poniente s/n, Edif. Lonja', 'Las Palmas de Gran Canaria', '35008', 'A-35678901'),
        ('Grupo Manchego de Distribucion S.L.', 'Ctra. Nacional 401, Km 12', 'Ciudad Real', '13004', 'B-13456789'),
        ('Aragonesa de Suministros Industriales S.A.', 'Poligono El Pilar, Nave 8', 'Zaragoza', '50197', 'A-50123890'),
        ('Baleares Import S.L.', 'Poligono Son Castello, Calle Gremi de Fusters 22', 'Palma de Mallorca', '07009', 'B-07234561'),
        ('Extremadura Trading Company S.L.', 'Avda. de la Constitucion, 4', 'Badajoz', '06011', 'B-06345678'),
        ('Cantabrica Import S.A.', 'Poligono Guarnizo, Parcela 14', 'Guarnizo (Cantabria)', '39611', 'A-39456782'),
        ('Riojana de Comercio Exterior S.L.', 'Avda. de Lobete, 8', 'Logroño', '26007', 'B-26567834'),
        ('Ceutrade Comercio Exterior S.L.', 'Calle Real, 45', 'Ceuta', '51001', 'B-51123456'),
        ('Distribuciones del Estrecho S.A.', 'Poligono Tres Culturas, Nave 6', 'Melilla', '52006', 'A-52234567'),
        ('Zona Franca Trading Barcelona S.L.', 'Calle 2, Sector A, Nave 12', 'Barcelona (Zona Franca)', '08040', 'B-08987651'),
    ],
    'FR': [
        ('Distribution Atlantique SARL', '14 Rue des Entrepots', 'Le Havre', '76600', 'FR12345678901'),
        ('Comptoir Franco-Asiatique SAS', '55 Avenue Jean Jaures', 'Lyon', '69007', 'FR98765432109'),
    ],
    'DE': [
        ('Rheinland Handelsgesellschaft mbH', 'Industriestrasse 22', 'Duisburg', '47229', 'DE123456789'),
        ('Bayerische Importwaren GmbH & Co. KG', 'Muenchner Strasse 145', 'Augsburg', '86167', 'DE987654321'),
    ],
    'IT': [
        ('Distribuzione Mediterranea S.r.l.', 'Via dei Mille 78', 'Genova', '16147', 'IT01234567890'),
    ],
    'NL': [
        ('Rotterdam Trading Partners B.V.', 'Waalhaven Oostzijde 42', 'Rotterdam', '3087 BM', 'NL123456789B01'),
    ],
    'PT': [
        ('Importadora Lusitana Lda.', 'Rua do Comercio 120', 'Porto', '4050-201', 'PT501234567'),
    ],
    'PL': [
        ('Baltyckie Centrum Handlowe Sp. z o.o.', 'ul. Portowa 15', 'Gdynia', '81-350', 'PL1234567890'),
    ],
    'BE': [
        ('Antwerp Logistics & Trade NV', 'Noorderlaan 133', 'Antwerpen', '2030', 'BE0123456789'),
    ],
    'IE': [
        ('Dublin Import Partners Ltd.', 'Unit 4, Dublin Airport Logistics Park', 'Dublin', 'D11 XY45', 'IE1234567A'),
    ],
}

# ---------------------------------------------------------------------------
# Puertos / aeropuertos por pais (para POL/POD y AWB origin/dest)
# ---------------------------------------------------------------------------
SEAPORTS = {
    'CN': 'Shanghai', 'VN': 'Ho Chi Minh City (Cat Lai)', 'IN': 'Nhava Sheva (Mumbai)',
    'TR': 'Ambarli (Istanbul)', 'MA': 'Casablanca', 'US': 'Long Beach, CA', 'BR': 'Santos',
    'MX': 'Manzanillo', 'JP': 'Yokohama', 'KR': 'Busan', 'ZA': 'Durban', 'AE': 'Jebel Ali (Dubai)',
    'SA': 'Jeddah Islamic Port', 'GB': 'Felixstowe', 'CA': 'Montreal', 'CL': 'San Antonio',
    'AR': 'Buenos Aires', 'AU': 'Melbourne', 'TH': 'Laem Chabang', 'ID': 'Tanjung Priok (Jakarta)',
    'EG': 'Alexandria', 'CO': 'Cartagena', 'PE': 'Callao', 'TN': 'Rades', 'PK': 'Karachi',
    'BD': 'Chittagong', 'ES': 'Algeciras', 'NL': 'Rotterdam', 'BE': 'Antwerpen',
    'KE': 'Mombasa', 'CR': 'Puerto Limon', 'EC': 'Guayaquil', 'IL': 'Haifa',
}
AIRPORTS = {
    'CN': 'Shanghai Pudong (PVG)', 'VN': 'Tan Son Nhat (SGN)', 'IN': 'Chhatrapati Shivaji (BOM)',
    'TR': 'Istanbul (IST)', 'US': 'Miami Intl (MIA)', 'BR': 'Guarulhos (GRU)', 'MX': 'Ciudad de Mexico (MEX)',
    'JP': 'Narita (NRT)', 'KR': 'Incheon (ICN)', 'AE': 'Dubai Intl (DXB)', 'SA': 'King Abdulaziz (JED)',
    'GB': 'London Heathrow (LHR)', 'CH': 'Zurich (ZRH)', 'CA': 'Toronto Pearson (YYZ)',
    'ZA': 'O.R. Tambo (JNB)', 'AU': 'Sydney (SYD)', 'EG': 'Cairo Intl (CAI)', 'TH': 'Suvarnabhumi (BKK)',
    'ES': 'Madrid-Barajas (MAD)', 'NO': 'Oslo (OSL)', 'PK': 'Jinnah Intl (KHI)',
    'KE': 'Jomo Kenyatta Intl (NBO)', 'IL': 'Ben Gurion (TLV)', 'CO': 'El Dorado (BOG)',
    'EC': 'Mariscal Sucre (Quito, UIO)',
}
ROAD_CROSSINGS = {
    'TR': 'Kapikule (frontera Turquia-Bulgaria)', 'MA': 'Puerto de Tanger Med / Algeciras (Ro-Ro)',
    'CH': 'Basilea (frontera Suiza-Francia)', 'GB': 'Eurotunnel Calais-Folkestone', 'NO': 'Svinesund (frontera Noruega-Suecia)',
    'FR': 'La Jonquera (frontera Francia-Espana)', 'PT': 'Tuy-Valenca do Minho', 'PL': 'Frankfurt (Oder)',
    'DE': 'Hendaya-Biriatou', 'IT': 'Tunel del Frejus',
}

# ---------------------------------------------------------------------------
# Navieras / aerolineas / transportistas por modo
# ---------------------------------------------------------------------------
SEA_CARRIERS = ['MAERSK LINE A/S', 'CMA CGM S.A.', 'MEDITERRANEAN SHIPPING COMPANY S.A. (MSC)',
                'HAPAG-LLOYD AG', 'COSCO SHIPPING LINES CO., LTD.', 'ONE (Ocean Network Express) Pte. Ltd.',
                'EVERGREEN MARINE CORP.']
AIR_CARRIERS = ['Lufthansa Cargo AG', 'Emirates SkyCargo', 'Cathay Pacific Cargo', 'Air France Cargo',
                'Korean Air Cargo', 'Qatar Airways Cargo', 'Turkish Cargo']
ROAD_CARRIERS = ['Transportes Internacionales Iberia S.L.', 'DACHSER Spain S.A.', 'Transalliance Iberia S.L.U.',
                 'FERCAM Iberica S.A.', 'Waberer\'s International Zrt.']

# ---------------------------------------------------------------------------
# Productos: descripcion, capitulo/HS 6 digitos real, unidad, peso unitario
# aproximado (kg), unidad suplementaria si el capitulo TARIC la exige.
# ---------------------------------------------------------------------------
PRODUCTS = {
    'laptop': {'desc': 'Ordenadores portatiles, pantalla 14", 16GB RAM / 512GB SSD, modelo comercial "ProBook X14"',
               'hs': '847130', 'unit': 'PCE', 'kg_unit': 1.8, 'supplementary': 'p/st'},
    'phone': {'desc': 'Telefonos moviles inteligentes, pantalla 6.5", doble SIM, modelo "GalaxyLine S24"',
              'hs': '851712', 'unit': 'PCE', 'kg_unit': 0.22, 'supplementary': 'p/st'},
    'tshirt': {'desc': 'Camisetas de punto, 100% algodon, manga corta, para caballero',
               'hs': '610910', 'unit': 'PCE', 'kg_unit': 0.18, 'supplementary': 'p/st'},
    'jeans': {'desc': 'Pantalones vaqueros de mezclilla (denim), 98% algodon / 2% elastano',
              'hs': '620342', 'unit': 'PCE', 'kg_unit': 0.6, 'supplementary': 'p/st'},
    'shoes': {'desc': 'Calzado deportivo con parte superior de material textil y suela de caucho',
              'hs': '640411', 'unit': 'PCE', 'kg_unit': 0.9, 'supplementary': 'p/st (par)'},
    'furniture': {'desc': 'Muebles de madera de haya para dormitorio, sin tapizar, en kit desmontado',
                  'hs': '940350', 'unit': 'PCE', 'kg_unit': 32.0, 'supplementary': None},
    'toys': {'desc': 'Juguetes de plastico, figuras de accion articuladas, con marcado CE',
             'hs': '950300', 'unit': 'PCE', 'kg_unit': 0.15, 'supplementary': None},
    'ceramic': {'desc': 'Vajilla y articulos de mesa de porcelana, decorados, para uso domestico',
                'hs': '691110', 'unit': 'PCE', 'kg_unit': 0.35, 'supplementary': None},
    'olive_oil': {'desc': 'Aceite de oliva virgen extra, envasado en botellas de vidrio de 750 ml',
                  'hs': '150910', 'unit': 'LTR', 'kg_unit': 0.92, 'supplementary': 'l'},
    'wine': {'desc': 'Vino tinto de mesa, en botellas de vidrio de 750 ml, grado alcoholico 13% vol.',
             'hs': '220421', 'unit': 'LTR', 'kg_unit': 1.0, 'supplementary': 'l'},
    'coffee': {'desc': 'Cafe sin tostar, sin descafeinar, en grano, variedad Arabica',
               'hs': '090111', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'cotton_fabric': {'desc': 'Tejidos de algodon crudo, ligamento tafetan, en rollos',
                      'hs': '520911', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'auto_parts': {'desc': 'Frenos de disco y sus partes, para vehiculos automoviles de turismo',
                   'hs': '870830', 'unit': 'PCE', 'kg_unit': 3.2, 'supplementary': None},
    'bicycles': {'desc': 'Bicicletas de paseo, sin motor auxiliar, rueda de 28 pulgadas',
                 'hs': '871200', 'unit': 'PCE', 'kg_unit': 14.5, 'supplementary': 'p/st'},
    'solar_panels': {'desc': 'Modulos fotovoltaicos de silicio cristalino, potencia 450W',
                     'hs': '854143', 'unit': 'PCE', 'kg_unit': 24.0, 'supplementary': None},
    'hand_tools': {'desc': 'Herramientas de mano, llaves de tuerca de acero al cromo-vanadio, en juego',
                   'hs': '820411', 'unit': 'SET', 'kg_unit': 2.1, 'supplementary': None},
    'watches': {'desc': 'Relojes de pulsera mecanicos, caja de acero inoxidable',
                'hs': '910219', 'unit': 'PCE', 'kg_unit': 0.09, 'supplementary': 'p/st'},
    'leather_bags': {'desc': 'Bolsos de mano de cuero natural bovino, con cierre de cremallera',
                     'hs': '420221', 'unit': 'PCE', 'kg_unit': 0.8, 'supplementary': None},
    'frozen_shrimp': {'desc': 'Camarones y langostinos congelados, sin cabeza, calibre 21/25',
                      'hs': '030617', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'timber': {'desc': 'Madera aserrada de coniferas, tablas cepilladas, tratamiento NIMF-15',
               'hs': '440710', 'unit': 'MTQ', 'kg_unit': 550.0, 'supplementary': 'm3'},
    'cocoa': {'desc': 'Cacao en grano, entero o partido, crudo o tostado',
              'hs': '180100', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'ceramic_tiles': {'desc': 'Baldosas y losas de ceramica esmaltada para pavimento, 60x60 cm',
                      'hs': '690723', 'unit': 'MTK', 'kg_unit': 18.5, 'supplementary': 'm2'},
    'perfume': {'desc': 'Perfumes y aguas de tocador, en frasco pulverizador de 100 ml',
                'hs': '330300', 'unit': 'LTR', 'kg_unit': 0.12, 'supplementary': None},
    'medical_devices': {'desc': 'Instrumentos y aparatos de medicina, tensiometros digitales de brazo',
                        'hs': '901819', 'unit': 'PCE', 'kg_unit': 0.4, 'supplementary': None},
    'surgical_instruments': {'desc': 'Instrumentos y aparatos de cirugia, pinzas y tijeras de acero inoxidable',
                             'hs': '901839', 'unit': 'PCE', 'kg_unit': 0.05, 'supplementary': None},
    'copper_wire': {'desc': 'Alambre de cobre refinado, diametro de la maxima secc. transversal > 6 mm',
                    'hs': '740811', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'aluminium_profiles': {'desc': 'Perfiles de aleaciones de aluminio, anodizados, para construccion',
                           'hs': '760420', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'rice': {'desc': 'Arroz semiblanqueado o blanqueado, de grano largo, variedad Jasmine',
             'hs': '100630', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'raisins_nuts': {'desc': 'Frutos secos y pasas surtidos, envasados al vacio para venta al detalle',
                     'hs': '081350', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'ceramic_sanitary': {'desc': 'Aparatos sanitarios ceramicos, lavabos, sin instalar',
                         'hs': '691010', 'unit': 'PCE', 'kg_unit': 12.0, 'supplementary': None},
    'led_lighting': {'desc': 'Aparatos electricos de alumbrado con fuente de luz LED integrada',
                     'hs': '940540', 'unit': 'PCE', 'kg_unit': 0.65, 'supplementary': None},
    'plastic_toys_dolls': {'desc': 'Munecas de plastico articuladas para el juego infantil, con accesorios',
                           'hs': '950300', 'unit': 'PCE', 'kg_unit': 0.28, 'supplementary': None},
    'whisky': {'desc': 'Whisky escoces "single malt", envasado en botella de vidrio de 700 ml',
               'hs': '220830', 'unit': 'LTR', 'kg_unit': 0.95, 'supplementary': 'l alc. 100%'},
    'cigars': {'desc': 'Cigarros (puros), incluso despuntados, con tripa de tabaco natural',
               'hs': '240210', 'unit': 'PCE', 'kg_unit': 0.012, 'supplementary': 'p/st'},
    'machinery_parts': {'desc': 'Partes y piezas para maquinas herramienta de mecanizado por arranque',
                        'hs': '845959', 'unit': 'PCE', 'kg_unit': 8.4, 'supplementary': None},
    'wool_yarn': {'desc': 'Hilados de lana peinada, sin acondicionar para la venta al por menor',
                  'hs': '510610', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
    'fresh_avocado': {'desc': 'Aguacates (paltas) frescos, variedad Hass, calibre 16-18',
                      'hs': '080440', 'unit': 'KGM', 'kg_unit': 1.0, 'supplementary': None},
}

# Companies y productos ya usados (para evitar repeticion entre casos)
USED_COMPANY_KEYS = set()
USED_PRODUCT_KEYS = set()
