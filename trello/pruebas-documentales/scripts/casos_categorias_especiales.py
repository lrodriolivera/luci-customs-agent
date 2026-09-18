# -*- coding: utf-8 -*-
"""
34 casos de prueba nuevos (20 H1 + 14 AES) para las 5 categorias pedidas:
frutas/verduras/perecederos vegetales, alimentos con riesgo sanitario reforzado
(origen animal/pesquero), productos quimicos (REACH/CLP), mercancias
peligrosas para el transporte (ADR/IMDG/IATA-DGR) y productos que exigen
cadena de frio farmaceutica/biologica (GDP). Continua la numeracion de
casos_h1.py (44-63) y casos_aes.py (22-35) sin modificar esos ficheros.
"""

H1_TITLES_ESP = {
    44: "Perecederos vegetales: CHED-PP sin pre-notificar en TRACES antes de la llegada fisica",
    45: "Perecederos vegetales: discrepancia entre temperatura de consigna y temperatura real registrada",
    46: "Perecederos vegetales: declaracion adicional fitosanitaria obligatoria por plaga de zona (citrus black spot)",
    47: "Perecederos vegetales: sistema de precio de entrada para tomates de terceros paises",
    48: "Alimentos: control oficial reforzado en frontera (Reg. 2019/1793) — muestreo obligatorio 20%",
    49: "Alimentos: doble control sobre producto de la pesca — certificado de captura INDNR + establecimiento UE-listado",
    50: "Alimentos: producto de origen animal — numero de establecimiento en el certificado veterinario vs. CHED-P",
    51: "Alimentos: triple control simultaneo (pesquero INDNR + veterinario + cadena de frio) sobre una sola partida",
    52: "Alimentos: vigilancia intensiva 100% por historial de alertas RASFF (residuos de antibioticos)",
    53: "Quimicos: ficha de datos de seguridad (FDS) obligatoria en espanol — REACH/CLP",
    54: "Quimicos: contraste — sustancia quimica NO clasificada como mercancia peligrosa para el transporte",
    55: "Quimicos: triple capa regulatoria — REACH/CLP + IMDG clase 5.1 + precursor de explosivos",
    56: "Quimicos: transporte por carretera de mercancia peligrosa (ADR) — senalizacion y formacion del conductor",
    57: "Mercancias peligrosas: baterias de litio-ion solas por via aerea — restriccion de estado de carga (SoC)",
    58: "Mercancias peligrosas: aerosoles bajo exencion de cantidades limitadas (LQ) en el codigo IMDG",
    59: "Mercancias peligrosas: explosivos de Clase 1 — autorizacion previa de naviera y autoridad portuaria",
    60: "Cadena de frio farmaceutica: medicamento biologico — licencia AEMPS + GDP + serializacion antifalsificacion",
    61: "Cadena de frio farmaceutica: producto veterinario biologico en transito maritimo de larga duracion",
    62: "Cadena de frio: acuicultura vs. pesca INDNR — el certificado de captura no aplica a productos de piscifactoria",
    63: "Perecederos vegetales: flor cortada de alta perecibilidad por via aerea con control de temperatura continuo",
}

AES_TITLES_ESP = {
    22: "Perecederos vegetales: certificado fitosanitario de exportacion — limite de residuos exigido por el pais tercero",
    23: "Perecederos vegetales: Reino Unido post-Brexit exige su propio Plant Health Certificate",
    24: "Perecederos vegetales: GLOBALG.A.P. como exigencia comercial del comprador, no requisito legal aduanero",
    25: "Alimentos: producto de origen animal — establecimiento debe figurar en listado bilateral UE-Japon",
    26: "Alimentos: trazabilidad pesquera completa en la exportacion de conserva transformada",
    27: "Alimentos: requisito bilateral de analisis de laboratorio no armonizado a nivel UE (China)",
    28: "Quimicos: exportacion de sustancia peligrosa — notificacion PIC (Reg. 649/2012) a la autoridad designada",
    29: "Quimicos: exportacion de producto quimico no peligroso para el transporte — solo FDS, sin DGD",
    30: "Quimicos: licencia de exportacion de doble uso/seguridad para fertilizante precursor de explosivos",
    31: "Mercancias peligrosas: exportacion aerea de baterias de litio — formacion IATA DGR del expedidor",
    32: "Mercancias peligrosas: aerosoles LQ — el manifiesto del buque exige declaracion IMDG igualmente",
    33: "Cadena de frio farmaceutica: exportacion veterinaria de corta distancia — la brevedad no exime la cadena de frio",
    34: "Cadena de frio farmaceutica: contenedor activo certificado (tipo Envirotainer) vs. anotacion manual en AWB",
    35: "Cadena de frio: bioseguridad reforzada del pais de destino para acuicultura espanola",
}


def _ch1(n, foreign_iso, mode, incoterm, currency, products, **kw):
    base = dict(n=n, id=f"H1-{n:02d}", title=H1_TITLES_ESP[n], op='import', mode=mode,
                foreign_iso=foreign_iso, incoterm=incoterm, currency=currency, products=products)
    base.update(kw)
    return base


def _caes(n, foreign_iso, mode, incoterm, currency, products, **kw):
    base = dict(n=n, id=f"AES-{n:02d}", title=AES_TITLES_ESP[n], op='export', mode=mode,
                foreign_iso=foreign_iso, incoterm=incoterm, currency=currency, products=products)
    base.update(kw)
    return base


RAW_H1_ESP = [
    _ch1(44, 'KE', 'air', 'FCA', 'EUR', [('green_beans_fresh', 6000, 3.40)],
         extra_docs=['phytosanitary_certificate', 'ched_pp'],
         invoice_note="CHED-PP debe completarse en TRACES NT y estar disponible ANTES de la llegada fisica de la "
                      "mercancia al Puesto de Control Fronterizo (Reg. (UE) 2017/625, Art. 133). Envio de prueba: "
                      "el CHED-PP se registro despues de la llegada del vuelo — retencion en el PCF hasta subsanar."),

    _ch1(45, 'CR', 'maritime', 'CIF', 'USD', [('fresh_pineapple', 19000, 0.92)],
         container_type='Reefer 40RH', temp_deviation=True,
         extra_docs=['phytosanitary_certificate', 'fumigation_certificate', 'temperature_control_certificate'],
         invoice_note="Data logger del contenedor reefer registra una excursion de temperatura de 6 horas por encima "
                      "del punto de consigna durante el transito maritimo. Se prueba si esto es un asunto de control "
                      "aduanero/documental (no lo es, el certificado fitosanitario sigue siendo valido) o un asunto "
                      "puramente comercial/de calidad entre comprador y vendedor."),

    _ch1(46, 'ZA', 'maritime', 'FOB', 'ZAR', [('fresh_oranges', 24000, 11.80)],
         container_type='Reefer 40RH',
         extra_docs=['phytosanitary_certificate'],
         invoice_note="Origen sujeto a riesgo de Phyllosticta citricarpa (mancha negra de los citricos): el "
                      "certificado fitosanitario debe incluir declaracion adicional de zona de produccion "
                      "reconocida como de baja prevalencia, conforme al Reglamento de Ejecucion (UE) 2019/2072. "
                      "Sin esa declaracion adicional especifica, el certificado fitosanitario generico no basta."),

    _ch1(47, 'MA', 'road', 'FOB', 'EUR', [('fresh_tomatoes', 16000, 0.78)],
         extra_docs=['phytosanitary_certificate'],
         invoice_note="Sistema de precio de entrada para tomates de terceros paises (OCM unica, Reg. (UE) 1308/2013 "
                      "y normativa de desarrollo): si el valor declarado en factura es inferior al precio de "
                      "entrada de referencia vigente en el periodo, se aplica un derecho de importacion adicional "
                      "especifico sobre la diferencia, ademas del arancel ad valorem ordinario."),

    _ch1(48, 'IN', 'maritime', 'FOB', 'USD', [('black_pepper_india', 9000, 4.85)],
         extra_docs=['ched_d', 'analysis_certificate'],
         invoice_note="Producto incluido en el Anexo I del Reglamento de Ejecucion (UE) 2019/1793 (controles "
                      "oficiales reforzados en frontera) por riesgo de aflatoxinas, con frecuencia de muestreo "
                      "documental/fisico del 20%. El CHED-D debe reflejar el resultado analitico si el envio fue "
                      "seleccionado para muestreo — sin ese resultado no procede el levante."),

    _ch1(49, 'TH', 'maritime', 'FOB', 'USD', [('canned_tuna', 14000, 2.60)],
         extra_docs=['catch_certificate', 'sanitary_certificate'],
         invoice_note="Producto de la pesca transformado: requiere el Certificado de Captura validado por el "
                      "Estado de abanderamiento del buque pesquero (Reg. (CE) 1005/2008, regimen INDNR) Y que el "
                      "establecimiento elaborador figure en el listado de establecimientos autorizados por la UE. "
                      "Ambos controles son independientes — cumplir uno no dispensa del otro."),

    _ch1(50, 'CH', 'road', 'DAP', 'EUR', [('raw_milk_cheese', 3200, 9.80)],
         extra_docs=['veterinary_certificate', 'ched_p'],
         invoice_note="El numero de autorizacion sanitaria del establecimiento de origen declarado en el "
                      "certificado veterinario debe coincidir EXACTAMENTE con el indicado en el CHED-P y figurar "
                      "en la lista de establecimientos de terceros paises autorizados a exportar a la UE — una "
                      "discrepancia entre ambos documentos provoca el rechazo en el Puesto de Control Fronterizo."),

    _ch1(51, 'PE', 'maritime', 'CIF', 'USD', [('frozen_fish_fillets', 15000, 5.40)],
         container_type='Reefer 40RH',
         extra_docs=['catch_certificate', 'veterinary_certificate', 'temperature_control_certificate'],
         invoice_note="Triple control no arancelario simultaneo sobre una sola partida: pesquero INDNR (certificado "
                      "de captura), sanitario veterinario (establecimiento autorizado) y cadena de frio ininterrumpida "
                      "a -18°C desde la captura hasta el Puesto de Control Fronterizo — los tres deben superarse "
                      "independientemente para el levante."),

    _ch1(52, 'AR', 'maritime', 'FOB', 'USD', [('raw_honey', 20000, 2.35)],
         extra_docs=['ched_d', 'analysis_certificate'],
         invoice_note="Origen bajo vigilancia intensiva del 100% (no el 20% ordinario de otros origenes/productos) "
                      "por historial de alertas RASFF de residuos de antibioticos (cloranfenicol) en envios previos "
                      "del mismo origen — contrastar con el 20% aplicado a la pimienta india del caso H1-48: la "
                      "frecuencia de control depende del historial de riesgo especifico, no es un porcentaje fijo."),

    _ch1(53, 'IL', 'maritime', 'FOB', 'USD', [('sulfuric_acid', 180000, 0.18)],
         pack_type='ISOTANK', packages=1,
         extra_docs=['safety_data_sheet'],
         invoice_note="Sustancia quimica a granel: la Ficha de Datos de Seguridad (FDS) es obligatoria en espanol "
                      "conforme al Anexo II REACH (Reg. (CE) 1907/2006), con las 16 secciones normalizadas. El "
                      "registro REACH previo del proveedor NO exime al importador de la UE de verificar su propio "
                      "estatus como importador si supera el umbral de 1 tonelada/ano."),

    _ch1(54, 'CN', 'maritime', 'FOB', 'USD', [('epoxy_resin', 22000, 1.65)],
         pack_type='DRUM',
         extra_docs=['safety_data_sheet'],
         invoice_note="Contraste deliberado: mercancia quimica sujeta a REACH/CLP (requiere FDS) pero SIN numero "
                      "ONU asignado — NO es mercancia peligrosa para el transporte y por tanto NO requiere "
                      "Declaracion de Mercancias Peligrosas. 'Quimico' y 'peligroso para el transporte' no son "
                      "sinonimos, aunque coincidan con frecuencia."),

    _ch1(55, 'US', 'maritime', 'FOB', 'USD', [('ammonium_nitrate_fertilizer', 500000, 0.32)],
         pack_type='BULK', packages=1,
         extra_docs=['safety_data_sheet', 'dangerous_goods_declaration', 'import_license'],
         invoice_note="Triple capa regulatoria sobre un solo producto: (1) REACH/CLP — ficha de seguridad; (2) "
                      "IMDG clase 5.1 (comburente), UN2067 — declaracion de mercancias peligrosas para el "
                      "transporte maritimo; (3) precursor de explosivos regulado por el Reglamento (UE) 2019/1148 "
                      "— por encima del umbral de nitrogeno, uso final restringido y control reforzado."),

    _ch1(56, 'TR', 'road', 'DAP', 'EUR', [('acetone_industrial', 20000, 0.68)],
         pack_type='ISOTANK', packages=1,
         extra_docs=['safety_data_sheet', 'dangerous_goods_declaration'],
         invoice_note="Transporte por carretera de mercancia peligrosa bajo ADR: el conductor debe portar su "
                      "certificado de formacion ADR y el vehiculo debe llevar los paneles naranja de numero de "
                      "peligro/ONU visibles. El CMR debe incluir la descripcion reglamentaria completa de "
                      "mercancias peligrosas en su casilla especifica — no basta con adjuntar solo la factura."),

    _ch1(57, 'CN', 'air', 'CPT', 'USD', [('lithium_ion_batteries', 4000, 6.20)],
         extra_docs=['safety_data_sheet', 'dangerous_goods_declaration'],
         invoice_note="Baterias de litio-ion transportadas SOLAS (no instaladas en equipo) por via aerea: la IATA "
                      "restringe el estado de carga (SoC) declarado a <=30% para transporte como carga aerea, y "
                      "numerosas aerolineas de carga las excluyen directamente de aviones de pasajeros. La aduana no "
                      "valida el SoC, pero exige la DGD firmada antes de aceptar el despacho."),

    _ch1(58, 'CN', 'maritime', 'FOB', 'USD', [('aerosols_flammable', 48000, 0.85)],
         extra_docs=['safety_data_sheet', 'dangerous_goods_declaration'],
         invoice_note="Aerosoles bajo la exencion de 'cantidades limitadas' (Limited Quantities, LQ) del codigo "
                      "IMDG: si cada bulto no supera el volumen limite, se simplifica el marcado individual, pero "
                      "la obligacion de declarar la carga como mercancia peligrosa en el conocimiento de embarque "
                      "y en el manifiesto del buque NO desaparece."),

    _ch1(59, 'CN', 'maritime', 'FOB', 'USD', [('fireworks_display', 1200, 32.00)],
         extra_docs=['safety_data_sheet', 'dangerous_goods_declaration', 'import_license'],
         invoice_note="Mercancia de Clase 1 (explosivos, UN0335): requiere autorizacion previa expresa de la "
                      "naviera y de la autoridad portuaria antes de aceptar la reserva de espacio, ademas de la "
                      "licencia de importacion de articulos pirotecnicos. El rechazo, si se produce, ocurre en "
                      "origen — mucho antes de que la carga llegue a la aduana espanola."),

    _ch1(60, 'CH', 'air', 'CPT', 'EUR', [('human_insulin', 8000, 14.50)],
         extra_docs=['import_license', 'temperature_control_certificate', 'gdp_certificate'],
         invoice_note="Medicamento biologico: requiere autorizacion de importacion de la AEMPS (Agencia Espanola de "
                      "Medicamentos y Productos Sanitarios) ademas del control aduanero ordinario, cadena de frio "
                      "+2°C/+8°C certificada por transportista con GDP vigente, y dispositivo de seguridad/"
                      "serializacion anti-manipulacion conforme a la Directiva 2011/62/UE."),

    _ch1(61, 'AR', 'maritime', 'CIF', 'USD', [('veterinary_vaccines', 6000, 3.10)],
         container_type='Reefer 40RH',
         extra_docs=['veterinary_certificate', 'temperature_control_certificate', 'gdp_certificate'],
         invoice_note="Producto biologico veterinario en cadena de frio maritima de larga duracion (30+ dias de "
                      "transito): el certificado de control de temperatura debe cubrir la totalidad del trayecto "
                      "sin discontinuidad, incluido el tiempo de espera en deposito temporal antes del levante — "
                      "cualquier hueco documental invalida la cadena de frio aunque el resto sea correcto."),

    _ch1(62, 'EC', 'maritime', 'CIF', 'USD', [('frozen_shrimp', 17000, 6.90)],
         container_type='Reefer 40RH',
         extra_docs=['veterinary_certificate', 'catch_certificate', 'temperature_control_certificate'],
         invoice_note="Producto de ACUICULTURA (piscifactoria/camaronera), NO de captura salvaje: el certificado de "
                      "captura INDNR (Reg. (CE) 1005/2008) NO aplica a este envio — se sustituye por una "
                      "declaracion de origen de explotacion acuicola registrada. Error frecuente: exigir el "
                      "certificado de captura para el mismo capitulo arancelario (0306) sin distinguir el regimen."),

    _ch1(63, 'EC', 'air', 'CPT', 'USD', [('cut_roses', 5000, 1.35)],
         extra_docs=['phytosanitary_certificate', 'temperature_control_certificate'],
         invoice_note="Flor cortada de altisima perecibilidad y valor unitario alto, transportada por via aerea con "
                      "control de temperatura continuo desde el cultivo (+2°C/+4°C). El mismo patron fitosanitario "
                      "que la fruta/verdura fresca, pero con un vector comercial distinto: envios concentrados en "
                      "picos de demanda estacional (San Valentin, Dia de la Madre)."),
]

RAW_AES_ESP = [
    _caes(22, 'AE', 'air', 'CPT', 'EUR', [('fresh_strawberries', 4000, 6.50)],
          extra_docs=['phytosanitary_certificate'],
          invoice_note="Certificado fitosanitario de exportacion emitido por Sanidad Vegetal espanola. El limite "
                       "de residuos de plaguicidas exigido por Emiratos Arabes Unidos es un requisito del pais de "
                       "destino, no de la UE — la aduana espanola de salida verifica la correccion documental del "
                       "certificado, no el limite de residuos del pais tercero."),

    _caes(23, 'GB', 'road', 'DAP', 'EUR', [('fresh_oranges', 18000, 0.72)],
          container_type='Reefer 40RH',
          extra_docs=['phytosanitary_certificate'],
          invoice_note="Desde el Brexit, Reino Unido exige su propio 'Plant Health Certificate' britanico para "
                       "importar citricos espanoles — Sanidad Vegetal emite este certificado bajo el modelo GB "
                       "especifico, distinto del modelo IPPC interno de la UE. Doble anotacion de temperatura de "
                       "transito en el CMR del remolque reefer, salida via Eurotunnel Calais-Folkestone."),

    _caes(24, 'CA', 'maritime', 'CIF', 'USD', [('fresh_tomatoes', 14000, 1.15)],
          container_type='Reefer 40RH',
          extra_docs=['phytosanitary_certificate', 'quality_certificate'],
          invoice_note="El certificado GLOBALG.A.P. lo exige comercialmente el comprador canadiense de la cadena "
                       "de distribucion minorista — NO es un requisito legal aduanero ni fitosanitario de la UE ni "
                       "de Canada, sino un estandar privado. El agente debe distinguir requisito legal de exigencia "
                       "puramente comercial del cliente."),

    _caes(25, 'JP', 'air', 'CPT', 'EUR', [('raw_milk_cheese', 1800, 12.40)],
          extra_docs=['veterinary_certificate'],
          invoice_note="Exportacion de producto de origen animal: el establecimiento espanol debe figurar en el "
                       "listado bilateral de establecimientos autorizados a exportar a Japon (acuerdo sanitario "
                       "especifico UE-Japon). El certificado veterinario de exportacion sigue el modelo pactado "
                       "bilateralmente, no el modelo generico de importacion a la UE."),

    _caes(26, 'KR', 'maritime', 'FOB', 'USD', [('canned_tuna', 16000, 2.95)],
          extra_docs=['catch_certificate', 'veterinary_certificate'],
          invoice_note="Exportacion de producto de la pesca transformado: Espana, como Estado de elaboracion, debe "
                       "emitir el certificado de captura de salida y el certificado sanitario de exportacion, "
                       "aunque la materia prima proceda originalmente de aguas de terceros paises — se declara la "
                       "trazabilidad completa del origen del pescado, no solo el lugar de fabricacion de la conserva."),

    _caes(27, 'CN', 'maritime', 'FOB', 'USD', [('olive_oil', 20000, 4.60)],
          extra_docs=['sanitary_certificate', 'analysis_certificate'],
          invoice_note="China exige un certificado de analisis de laboratorio (acidez, indice de peroxidos, "
                       "parametros de calidad) ADEMAS del certificado sanitario UE estandar de exportacion — "
                       "requisito bilateral especifico de China para aceite de oliva, no armonizado a nivel UE."),

    _caes(28, 'MA', 'road', 'FOB', 'EUR', [('sulfuric_acid', 40000, 0.24)],
          pack_type='ISOTANK', packages=1,
          extra_docs=['safety_data_sheet', 'dangerous_goods_declaration'],
          invoice_note="Exportacion de sustancia quimica peligrosa a un tercer pais: si la sustancia figura en el "
                       "Anexo I del Reglamento (UE) 649/2012 (PIC — consentimiento fundamentado previo), el "
                       "exportador debe notificar la exportacion al MITECO como autoridad designada antes del "
                       "primer envio del ano a ese pais de destino, independientemente del tramite aduanero ordinario."),

    _caes(29, 'BR', 'maritime', 'FOB', 'USD', [('epoxy_resin', 18000, 1.85)],
          pack_type='DRUM',
          extra_docs=['safety_data_sheet'],
          invoice_note="Exportacion de producto quimico NO peligroso para el transporte — mismo contraste que el "
                       "caso H1-54 pero en sentido exportador: se prueba que no se exige Declaracion de Mercancias "
                       "Peligrosas, unicamente la Ficha de Datos de Seguridad."),

    _caes(30, 'EG', 'maritime', 'FOB', 'EUR', [('ammonium_nitrate_fertilizer', 300000, 0.29)],
          pack_type='BULK', packages=1,
          extra_docs=['safety_data_sheet', 'dangerous_goods_declaration', 'export_license'],
          invoice_note="Exportacion de fertilizante a base de nitrato de amonio: licencia de exportacion de "
                       "seguridad si la concentracion de nitrogeno supera el umbral que lo califica como precursor "
                       "de explosivos regulado (Reglamento (UE) 2019/1148), ademas de la declaracion de mercancias "
                       "peligrosas ordinaria del transporte maritimo."),

    _caes(31, 'US', 'air', 'CPT', 'USD', [('lithium_ion_batteries', 3200, 7.10)],
          extra_docs=['safety_data_sheet', 'dangerous_goods_declaration'],
          invoice_note="Exportacion aerea de baterias de litio-ion solas: el expedidor espanol debe estar "
                       "certificado/formado en mercancias peligrosas (IATA DGR, categoria de expedidor), y la "
                       "aerolinea exige el Estado de Carga (SoC) declarado por escrito antes de aceptar la reserva "
                       "— sin la formacion certificada del expedidor, ninguna aerolinea de carga acepta la DGD."),

    _caes(32, 'CL', 'maritime', 'FOB', 'USD', [('aerosols_flammable', 36000, 0.98)],
          extra_docs=['safety_data_sheet', 'dangerous_goods_declaration'],
          invoice_note="Exportacion maritima de aerosoles bajo 'cantidades limitadas' (LQ): aun con la exencion de "
                       "marcado individual reducido, el conocimiento de embarque y el manifiesto de mercancias "
                       "peligrosas del buque SI deben declarar la carga como IMDG — no es opcional aunque el bulto "
                       "individual este exento de algunas marcas."),

    _caes(33, 'MA', 'road', 'DAP', 'EUR', [('veterinary_vaccines', 3000, 3.60)],
          extra_docs=['export_license', 'temperature_control_certificate', 'gdp_certificate'],
          invoice_note="Exportacion de producto biologico veterinario por carretera de corta distancia (Algeciras — "
                       "Tanger Med): la brevedad del trayecto no exime de mantener y documentar la cadena de frio "
                       "continua, ni de la licencia de exportacion de medicamentos veterinarios de la AEMPS."),

    _caes(34, 'CO', 'air', 'CPT', 'EUR', [('human_insulin', 6000, 15.80)],
          extra_docs=['export_license', 'temperature_control_certificate', 'gdp_certificate'],
          invoice_note="Exportacion de medicamento biologico termosensible por via aerea: control de temperatura "
                       "mediante contenedor activo certificado (tipo Envirotainer) con registro propio, no una mera "
                       "anotacion manual de temperatura en el AWB — el dispositivo certificado es lo que acredita el "
                       "cumplimiento, no la declaracion del transportista."),

    _caes(35, 'AU', 'maritime', 'CIF', 'USD', [('frozen_shrimp', 15000, 7.20)],
          container_type='Reefer 40RH',
          extra_docs=['veterinary_certificate', 'temperature_control_certificate'],
          invoice_note="Exportacion de producto de acuicultura espanola a un pais con bioseguridad de frontera muy "
                       "estricta: Australia exige un certificado veterinario adicional de ausencia de enfermedades "
                       "especificas de crustaceos, requisito propio del pais de destino que se suma (no sustituye) "
                       "al certificado sanitario UE estandar."),
]
