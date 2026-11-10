# -*- coding: utf-8 -*-
"""Explicacion en español de que se prueba en cada caso base (H1-01..43, AES-01..21).

La factura comercial de cada caso lleva impresa una nota en ingles (la emite un
proveedor extranjero y asi es realista). Esa nota NO se traduce en el PDF; lo que
lee la agente aduanera en el manifiesto, en la tarjeta de Trello y en la guia es
esta version en español.
"""

NOTAS_ES = {
    'H1-01': 'El declarante es el propio importador (representación directa).',
    'H1-02': 'No hay representante aduanero registrado ante la AEAT en el momento de facturar: la representación indirecta está pendiente de nombramiento.',
    'H1-03': 'La partida no lleva código adicional TARIC: debe declararse como \'000\', no dejarse en blanco.',
    'H1-04': 'La subpartida exige unidad suplementaria obligatoria según TARIC (litros de alcohol puro): ver la cantidad en \'l alc. 100%\'.',
    'H1-05': 'El envío tiene 3 partidas arancelarias con regímenes distintos (40, 42, 51) y países de origen distintos (ver origen por línea).',
    'H1-06': 'La factura respalda una declaración que se modifica después de tener MRN asignado (ver notas del caso).',
    'H1-07': 'Régimen 44, destino final: se solicita la franquicia y la mercancía queda bajo control de destino final (Reglamento (UE) 952/2013, art. 254).',
    'H1-08': 'Régimen 95: en el momento de la factura no se han pagado ni el IVA ni los impuestos especiales, condición necesaria para acogerse al régimen.',
    'H1-09': 'El destinatario está establecido en Canarias: territorio fiscal especial, fuera del área del IVA de la UE pero dentro de la unión aduanera.',
    'H1-10': 'La mercancía queda en depósito temporal en un almacén autorizado hasta que se autorice la ubicación para el levante.',
    'H1-11': 'Se ha alcanzado la fase PREDUA con indicador de control activo: el declarante/representante queda bloqueado hasta la decisión de la aduana.',
    'H1-12': 'Se solicita la preferencia con número de orden 14 11, sujeta al saldo disponible del contingente arancelario, no a una exención por orden de llegada.',
    'H1-13': 'La deuda aduanera no está pagada en el despacho: hace falta garantía (CGU) antes del levante.',
    'H1-14': 'La comisión de venta (agente de compras, 4 %) va incluida según el Incoterm; la comisión de compra que paga el comprador a su propio agente NO forma parte del valor de la factura.',
    'H1-15': 'Declaración simplificada, casilla 1.2 tipo C: faltan algunos datos que se completarán en la declaración complementaria.',
    'H1-16': 'Declaración simplificada presentada con documentos justificativos pendientes (códigos 9AR a 9VI para los certificados que faltan).',
    'H1-17': 'Mercancía incluida en zona franca a la entrada (Zona Franca de Barcelona): desde la reforma de 2023 NO se aplica la suspensión del IVA.',
    'H1-18': 'En la casilla 14 el código de representación va entre corchetes delante del nombre del representante, según el formato de la AEAT.',
    'H1-19': 'El destinatario (importador final) está establecido en Suiza, fuera del territorio aduanero de la Unión: el agente aduanero español NO puede actuar como representante directo de un principal no establecido; la representación indirecta es obligatoria (CAU, arts. 18 y 19).',
    'H1-20': 'Canal verde y levante concedido: aun así la AEAT puede emitir un requerimiento posterior al despacho.',
    'H1-21': 'Envío multifactura: esta es la factura 1 de 2 amparadas por un único conocimiento de embarque consolidado (ver la factura compañera para la línea 2).',
    'H1-22': 'Valor en aduana declarado en USD (divisa distinta del euro) en un envío aéreo: se aplica el tipo de cambio de la tabla diaria de la AEAT.',
    'H1-23': 'Los documentos justificativos (certificados de ensayo) se presentan por el servicio web específico de la AEAT DESPUÉS de concedido el levante.',
    'H1-24': 'Régimen 82 (salida de un lugar distinto del depósito aduanero): se aplican 6 exclusiones de régimen simultáneas según el anexo 71-05 del CDU.',
    'H1-25': 'Sin valor comercial: unidades de sustitución en garantía suministradas gratis. Valor estadístico solo a efectos aduaneros.',
    'H1-26': 'El importador es un particular (NIF, sin empresa ni EORI), no un operador registrado.',
    'H1-27': 'Transporte por carretera sin contenedor (grupaje): el indicador de contenedor de la casilla 19 debe reflejar \'no contenerizado\'.',
    'H1-28': 'Envío de referencia para la codificación del modo de transporte (casillas 21/26: transporte interior por carretera).',
    'H1-29': 'Tipo de cambio aplicable: el diario de la AEAT; los códigos antiguos 7008/7010 no se admiten en esta declaración.',
    'H1-30': 'El importador tiene estatus OEA-C (operador económico autorizado, simplificaciones aduaneras), que se referencia en la declaración.',
    'H1-31': 'El importador tiene estatus OEA-C y solicita la dispensa de garantía (CAU, art. 95.2).',
    'H1-32': 'La mercancía se vincula al régimen de zona franca nada más entrar (vinculación automática a la introducción).',
    'H1-33': 'El destinatario está establecido en Ceuta: el despacho centralizado queda excluido para este destino.',
    'H1-34': 'Régimen 42 (despacho a libre práctica con entrega intracomunitaria posterior): no aplica la inscripción en registros del declarante (IRD).',
    'H1-35': 'Representación indirecta por agente aduanero: la reducción de la garantía global (30 %) depende de la modalidad de representación.',
    'H1-36': 'Factura de referencia para el plazo de notificación de la deuda posterior al despacho (prescripción general de 3 años).',
    'H1-37': 'Incoterm DAP con lugar de destino designado (Polígono Industrial Fuente del Jarro, Paterna, Valencia): debe coincidir con la ubicación aduanera declarada.',
    'H1-38': 'Se referencia el documento 9018 (número de referencia de la garantía, GRN): el lugar de la declaración está restringido según el tipo de declaración.',
    'H1-39': 'Régimen 82: en este régimen las unidades suplementarias son OPCIONALES, no obligatorias.',
    'H1-40': 'La referencia del documento de transporte (número de conocimiento de embarque) debe coincidir exactamente con el documento adjunto: ver el B/L.',
    'H1-41': 'Prueba de descripción larga: una sola partida con una descripción de mercancía inusualmente larga y detallada (ver línea 1).',
    'H1-42': 'Envío con deuda aduanera baja: referencia para el umbral de dispensa de notificación de la deuda (menos de 10 €).',
    'H1-43': 'El vendedor (exportador extracomunitario) no tiene identificación fiscal española; el comprador (importador) tiene NIF y EORI españoles.',
    'AES-01': 'El comprador tiene un EORI/identificación válido: según la regla AES NO se declaran además su nombre y dirección.',
    'AES-02': 'Exportación directa declarada en la aduana de salida: compárese con el escenario de exportación indirecta por otra oficina.',
    'AES-03': 'Persona de contacto del envío: Sra. Marta Alonso Ruiz. Es un dato obligatorio siempre, con independencia del tipo de representación.',
    'AES-04': 'Países de ruta: la mercancía transita por un tercer país (Singapur) antes de llegar al destino extracomunitario; aplican dos países de ruta.',
    'AES-05': 'La partida TARIC exige unidad suplementaria obligatoria (litros de alcohol puro).',
    'AES-06': 'La factura respalda una declaración AES RECTIFICADA después de ser aceptada por la aduana (ver el detalle de la rectificación en las notas del caso).',
    'AES-07': 'Declaración tipo EX-A (sin datos de seguridad): compárese con una EX-B (con datos de declaración sumaria de entrada/seguridad) para la misma mercancía.',
    'AES-08': 'La representación indirecta se deduce de las partes que intervienen: NO se declara como dato aparte.',
    'AES-09': 'El exportador a efectos legales es quien decide que la mercancía salga de la UE (el mandante), que NO es necesariamente quien emite la factura.',
    'AES-10': 'Exportador sin EORI: se aplica una de las 5 excepciones documentadas (exportador ocasional, envío de un particular).',
    'AES-11': 'Pre-DUA presentado antes de la llegada de la mercancía a la aduana de salida: caduca automáticamente a los 30 días sin presentación.',
    'AES-12': 'Referencia para el procedimiento de investigación AES: sin confirmación de salida en 90 días se abre indagación; a los 150 días la declaración se invalida.',
    'AES-13': 'Exportación indirecta por la aduana de salida de otro Estado miembro: exige aviso de llegada (IE507/IE521) en la aduana de salida real.',
    'AES-14': 'Condiciones de entrega: se declara O BIEN un código de lugar UN/LOCODE O BIEN una dirección en texto libre, nunca los dos a la vez.',
    'AES-15': 'El transportista solo se declara cuando es distinto del declarante, y en ese caso su EORI es obligatorio.',
    'AES-16': 'El expedidor a efectos de seguridad (quien aporta los datos de protección y seguridad) es una parte distinta del exportador.',
    'AES-17': 'El certificado de origen EUR.1 NO debe visarse hasta que la exportación sea efectiva o esté asegurada: ver el estado de borrador del EUR.1 adjunto.',
    'AES-18': 'Factura de referencia: el documento de levante NO se regenera automáticamente cuando la declaración se modifica después.',
    'AES-19': 'Deuda aduanera nacida de una declaración de exportación: no hay devolución aunque la mercancía finalmente no se embarque.',
    'AES-20': 'Envío multicontenedor: referencia para el límite de la declaración de 30 precintos y 99 contenedores como máximo.',
    'AES-21': 'Masa bruta sin decimales en las líneas de 1 kg o más y con hasta 3 decimales en las de menos de 1 kg: ver las cifras exactas en el packing list.',
}


def nota_es(case_id, por_defecto=None):
    """Nota en español del caso base; para variantes (H1-01-EXTRANA-a) usa la del caso padre."""
    if case_id in NOTAS_ES:
        return NOTAS_ES[case_id]
    padre = '-'.join(case_id.split('-')[:2])
    return NOTAS_ES.get(padre, por_defecto)
