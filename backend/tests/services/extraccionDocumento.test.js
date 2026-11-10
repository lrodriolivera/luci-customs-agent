/**
 * Lectura de documentos del expediente: normalizacion de lo que devuelve la IA,
 * propuesta de cambios y aplicacion de lo que marca el agente.
 *
 * Los datos de `LECTURA_*` son lecturas reales (10/Nov/2026) de los documentos
 * de prueba del caso H1-01, recortadas.
 */
const {
  normalizarExtraccion, proponerCambios, aplicarCambios, SYSTEM_PROMPT, construirPrompt
} = require('../../src/services/documentos/extraccionDocumento');

const LECTURA_FACTURA = {
  legible: true, tipoDetectado: 'commercial_invoice', confianza: 0.95, notas: ['El codigo HS aparece enmascarado.'],
  exportador: { nombre: 'Shanghai Hongtai Import & Export Co., Ltd.', direccion: 'No. 1288 Pudong Ave', ciudad: 'Shanghai', pais: 'CN' },
  factura: { numero: 'INV-H1-01', fecha: '04/03/2026', moneda: 'usd', importeTotal: 184800, incoterm: 'fob', lugarIncoterm: 'Shanghai' },
  transporte: { numeroDocumento: null, medio: 'Maritimo', contenedores: [], tipoCarga: null },
  partidas: [{ descripcion: 'Ordenadores portatiles', codigoMercancia: '8471.30', paisOrigen: 'cn', cantidad: 480, unidad: 'PCE', importe: 184800 }],
  totales: {}
};
const LECTURA_PACKING = {
  legible: true, tipoDetectado: 'packing_list', confianza: 90, notas: [],
  transporte: { contenedores: ['MSCU 115058-4'], tipoCarga: null },
  partidas: [{ descripcion: 'Ordenadores portatiles', bultos: 1, tipoBulto: 'CTN', pesoBrutoKg: 924.48, pesoNetoKg: 864 }],
  totales: { bultos: 12, pesoBrutoKg: 924.48, pesoNetoKg: 864 }
};
const LECTURA_BL = {
  legible: true, tipoDetectado: 'bill_of_lading', confianza: 88, notas: [],
  factura: { incoterm: 'FOB' },
  transporte: { numeroDocumento: 'MSCU20268198800', medio: 'MSC OSCAR', puertoCarga: 'Shanghai', puertoDescarga: 'Algeciras', contenedores: ['MSCU1150584'], tipoCarga: 'LCL' },
  partidas: [], totales: { bultos: 12, pesoBrutoKg: 924.5 }
};

const expediente = (extra = {}) => ({
  transportMode: 'maritime',
  goods: [{ description: 'Portatiles', taricCode: '8471300000', originCountry: '', grossWeight: null, netWeight: null, invoiceValue: 184800, currency: 'EUR', packages: {} }],
  transport: {}, incoterm: { code: 'CIF' }, exporter: { companyName: '', country: '' },
  ...extra
});
const claves = (cambios) => cambios.map(c => c.clave);

describe('extraccionDocumento', () => {
  describe('normalizarExtraccion', () => {
    test('una respuesta vacia o con forma inesperada da el esquema completo con nulos', () => {
      for (const bruto of [undefined, null, 'texto', [], {}]) {
        const d = normalizarExtraccion(bruto);
        expect(d.exportador).toEqual({ nombre: null, direccion: null, ciudad: null, codigoPostal: null, pais: null });
        expect(d.partidas).toEqual([]);
        expect(d.totales).toEqual({ bultos: null, pesoBrutoKg: null, pesoNetoKg: null });
        expect(d.transporte.contenedores).toEqual([]);
        expect(d.notas).toEqual([]);
      }
    });

    test('normaliza paises, moneda, incoterm y codigo de mercancia', () => {
      const d = normalizarExtraccion(LECTURA_FACTURA);

      expect(d.factura).toMatchObject({ moneda: 'USD', incoterm: 'FOB', importeTotal: 184800 });
      expect(d.partidas[0]).toMatchObject({ paisOrigen: 'CN', codigoMercancia: '847130', importe: 184800 });
    });

    test('un pais o una moneda que no son un codigo quedan en null, no se adivinan', () => {
      const d = normalizarExtraccion({ exportador: { pais: 'China' }, factura: { moneda: 'dolares', incoterm: 'Free on board' } });

      expect(d.exportador.pais).toBeNull();
      expect(d.factura.moneda).toBeNull();
      expect(d.factura.incoterm).toBeNull();
    });

    test('la confianza admite fraccion o porcentaje y queda entre 0 y 100', () => {
      const conf = (v) => normalizarExtraccion({ confianza: v }).confianza;

      expect(conf(0.95)).toBe(95);
      expect(conf(1)).toBe(100);
      expect(conf(70)).toBe(70);
      expect(conf(250)).toBe(100);
      expect(conf('alta')).toBe(0);
      expect(conf(undefined)).toBe(0);
    });

    test('el modo de transporte no es el nombre del medio', () => {
      expect(normalizarExtraccion(LECTURA_FACTURA).transporte.medio).toBeNull();
      expect(normalizarExtraccion({ transporte: { medio: 'aéreo' } }).transporte.medio).toBeNull();
      expect(normalizarExtraccion(LECTURA_BL).transporte.medio).toBe('MSC OSCAR');
    });

    test('el tipo de carga solo admite FCL o LCL', () => {
      expect(normalizarExtraccion({ transporte: { tipoCarga: 'lcl' } }).transporte.tipoCarga).toBe('LCL');
      expect(normalizarExtraccion({ transporte: { tipoCarga: 'contenedor completo' } }).transporte.tipoCarga).toBeNull();
    });

    test('traduce el tipo de bulto escrito en el documento y limpia los contenedores', () => {
      const d = normalizarExtraccion(LECTURA_PACKING);

      expect(d.partidas[0].tipoBulto).toBe('CT');
      expect(d.transporte.contenedores).toEqual(['MSCU1150584']);
      expect(normalizarExtraccion({ partidas: [{ tipoBulto: 'Pallets' }, { tipoBulto: 'cosas' }] }).partidas.map(p => p.tipoBulto)).toEqual(['PX', null]);
    });

    test('el codigo postal se guarda aparte y la ciudad queda sin el', () => {
      const d = normalizarExtraccion({
        exportador: { ciudad: 'Shanghai', codigoPostal: '200120' },
        importador: { ciudad: 'Paterna (Valencia)', codigoPostal: ' 46988 ' }
      });
      expect(d.exportador).toMatchObject({ ciudad: 'Shanghai', codigoPostal: '200120' });
      expect(d.importador).toMatchObject({ ciudad: 'Paterna (Valencia)', codigoPostal: '46988' });
    });

    test('si el modelo deja el codigo postal dentro de la ciudad, se separa', () => {
      const d = normalizarExtraccion({
        exportador: { ciudad: '200120, Shanghai' },
        importador: { ciudad: 'Paterna (Valencia), 46988', codigoPostal: null }
      });
      expect(d.exportador).toMatchObject({ ciudad: 'Shanghai', codigoPostal: '200120' });
      expect(d.importador).toMatchObject({ ciudad: 'Paterna (Valencia)', codigoPostal: '46988' });
    });

    test('un codigo postal repetido en la ciudad se quita de ella sin cambiar el que ya venia', () => {
      const d = normalizarExtraccion({ importador: { ciudad: '46988 Paterna', codigoPostal: '46988' } });
      expect(d.importador).toMatchObject({ ciudad: 'Paterna', codigoPostal: '46988' });
    });

    test('una ciudad sin codigo postal no se toca y el codigo postal queda en null', () => {
      const d = normalizarExtraccion({ importador: { ciudad: 'L\'Hospitalet de Llobregat' }, exportador: { ciudad: '12345' } });
      expect(d.importador).toMatchObject({ ciudad: 'L\'Hospitalet de Llobregat', codigoPostal: null });
      // Solo cifras: no hay localidad que separar, se deja como se leyo.
      expect(d.exportador).toMatchObject({ ciudad: '12345', codigoPostal: null });
    });

    test('una matricula que no cumple el formato ISO se guarda sola, sin el tipo ni el precinto', () => {
      const d = normalizarExtraccion({ transporte: { contenedores: ['MSCU1150584400 (40HC, PRECINTO SL264686400)', 'TGHU 88422-170 / 20GP', 'sin numero'] } });
      expect(d.transporte.contenedores).toEqual(['MSCU1150584400', 'TGHU88422170', 'SINNUMERO']);
    });

    test('del contenedor se guarda solo la matricula ISO, sin el tipo ni el precinto', () => {
      // Lectura real de un Excel: «TGHU8842217 (40HC, FCL/FCL)» llegaba como «TGHU8842217(40HC)».
      const cont = (lista) => normalizarExtraccion({ transporte: { contenedores: lista } }).transporte.contenedores;

      expect(cont(['TGHU8842217 (40HC)', 'tghu 884221-7', 'Container MSCU1150584 / seal 99'])).toEqual(['TGHU8842217', 'TGHU8842217', 'MSCU1150584']);
      // Si no hay una matricula valida se conserva lo leido, para que el agente lo vea.
      expect(cont(['MSCU1150584400'])).toEqual(['MSCU1150584400']);
      expect(cont([null, '', 'N/A'])).toEqual([]);
    });

    test('numeros negativos, textos y objetos donde va un dato quedan en null', () => {
      const d = normalizarExtraccion({ partidas: [{ bultos: -3, pesoBrutoKg: 'mucho', descripcion: { x: 1 }, importe: '1500.50' }], factura: { numero: 'N/A' } });

      expect(d.partidas[0]).toMatchObject({ bultos: null, pesoBrutoKg: null, descripcion: null, importe: 1500.5 });
      expect(d.factura.numero).toBeNull();
    });

    test('legible:false se respeta y las notas se recortan', () => {
      const d = normalizarExtraccion({ legible: false, notas: ['ilegible', 7, null, ''] });

      expect(d.legible).toBe(false);
      expect(d.notas).toEqual(['ilegible', '7']);
    });
  });

  describe('proponerCambios', () => {
    test('una factura propone moneda, incoterm, origen y exportador; nunca el importe que ya coincide', () => {
      const cambios = proponerCambios(expediente(), normalizarExtraccion(LECTURA_FACTURA), 'commercial_invoice');

      expect(claves(cambios)).toEqual([
        'goods.0.originCountry', 'goods.0.currency', 'incoterm.code', 'incoterm.place',
        'exporter.companyName', 'exporter.country', 'exporter.city'
      ]);
      expect(cambios.find(c => c.clave === 'incoterm.code')).toMatchObject({ actual: 'CIF', nuevo: 'FOB', grupo: 'condiciones' });
      expect(cambios.find(c => c.clave === 'goods.0.originCountry')).toMatchObject({ actual: null, nuevo: 'CN', partida: 1 });
    });

    test('un HS de 6 digitos no se propone como TARIC; uno de 10 si, pero solo si la partida no tiene codigo', () => {
      const conDiez = normalizarExtraccion({ partidas: [{ codigoMercancia: '8471300000' }] });
      const sinCodigo = expediente({ goods: [{ taricCode: '', packages: {} }] });

      expect(claves(proponerCambios(sinCodigo, normalizarExtraccion(LECTURA_FACTURA), 'commercial_invoice'))).not.toContain('goods.0.taricCode');
      expect(claves(proponerCambios(sinCodigo, conDiez, 'commercial_invoice'))).toContain('goods.0.taricCode');
      expect(claves(proponerCambios(expediente(), conDiez, 'commercial_invoice'))).not.toContain('goods.0.taricCode');
    });

    test('con una sola partida mandan los totales del documento: 12 bultos, no el 1 de la linea', () => {
      const cambios = proponerCambios(expediente(), normalizarExtraccion(LECTURA_PACKING), 'packing_list');

      expect(cambios.find(c => c.clave === 'goods.0.packages.quantity').nuevo).toBe(12);
      expect(cambios.find(c => c.clave === 'goods.0.packages.type').nuevo).toBe('CT');
      expect(cambios.find(c => c.clave === 'goods.0.grossWeight').nuevo).toBe(924.48);
      expect(cambios.find(c => c.clave === 'transport.containers')).toMatchObject({ actual: null, nuevo: 'MSCU1150584' });
    });

    test('un BL sin partidas aporta totales, documento de transporte, puertos, buque y tipo de carga', () => {
      const cambios = proponerCambios(expediente(), normalizarExtraccion(LECTURA_BL), 'bill_of_lading');

      expect(Object.fromEntries(cambios.map(c => [c.clave, c.nuevo]))).toMatchObject({
        'goods.0.packages.quantity': 12, 'goods.0.grossWeight': 924.5,
        'transport.documentType': 'BL', 'transport.documentNumber': 'MSCU20268198800',
        'transport.vehicleId': 'MSC OSCAR', 'transport.departurePort': 'Shanghai', 'transport.arrivalPort': 'Algeciras',
        'transport.loadType': 'LCL', 'incoterm.code': 'FOB'
      });
    });

    test('el numero de documento de transporte solo sale de un documento de transporte', () => {
      const datos = normalizarExtraccion({ transporte: { numeroDocumento: 'BL-1' } });

      expect(claves(proponerCambios(expediente(), datos, 'commercial_invoice'))).not.toContain('transport.documentNumber');
      expect(claves(proponerCambios(expediente(), datos, 'air_waybill'))).toEqual(expect.arrayContaining(['transport.documentType', 'transport.documentNumber']));
    });

    test('el tipo de carga no se propone fuera del maritimo', () => {
      const cambios = proponerCambios(expediente({ transportMode: 'air' }), normalizarExtraccion(LECTURA_BL), 'bill_of_lading');
      expect(claves(cambios)).not.toContain('transport.loadType');
    });

    test('con varias partidas se emparejan por posicion y los totales no se reparten', () => {
      const exp = expediente({ goods: [{ packages: {} }, { packages: {} }] });
      const datos = normalizarExtraccion({ partidas: [{ bultos: 4, pesoBrutoKg: 100 }, { bultos: 8, pesoBrutoKg: 200 }], totales: { bultos: 12, pesoBrutoKg: 300 } });

      const nuevos = Object.fromEntries(proponerCambios(exp, datos, 'packing_list').map(c => [c.clave, c.nuevo]));
      expect(nuevos).toMatchObject({ 'goods.0.packages.quantity': 4, 'goods.1.packages.quantity': 8, 'goods.0.grossWeight': 100, 'goods.1.grossWeight': 200 });
    });

    test('con varias partidas en el expediente y solo totales en el documento no se propone nada por partida', () => {
      const exp = expediente({ goods: [{ packages: {} }, { packages: {} }] });
      const cambios = proponerCambios(exp, normalizarExtraccion({ totales: { bultos: 12, pesoBrutoKg: 300 } }), 'packing_list');

      expect(cambios.filter(c => c.grupo === 'partida')).toEqual([]);
    });

    test('lo que ya coincide no se propone, sin distinguir mayusculas ni tipo', () => {
      const exp = expediente({
        goods: [{ taricCode: '8471300000', originCountry: 'cn', currency: 'usd', invoiceValue: '184800', packages: {} }],
        incoterm: { code: 'fob', place: 'SHANGHAI' },
        exporter: { companyName: 'shanghai hongtai import & export co., ltd.', country: 'CN', city: 'Shanghai' }
      });

      expect(proponerCambios(exp, normalizarExtraccion(LECTURA_FACTURA), 'commercial_invoice')).toEqual([]);
    });

    test('un documento ilegible o sin datos no propone nada', () => {
      expect(proponerCambios(expediente(), normalizarExtraccion({ legible: false }), 'commercial_invoice')).toEqual([]);
      expect(proponerCambios(expediente(), null, 'commercial_invoice')).toEqual([]);
      expect(proponerCambios(expediente(), normalizarExtraccion({}), 'commercial_invoice')).toEqual([]);
    });
  });

  describe('aplicarCambios', () => {
    // Imita lo que usa del documento Mongoose: set por ruta con puntos.
    const conSet = (exp) => Object.assign(exp, {
      set(ruta, valor) {
        const partes = ruta.split('.');
        let nodo = this;
        partes.slice(0, -1).forEach((p) => { if (nodo[p] === undefined || nodo[p] === null) nodo[p] = {}; nodo = nodo[p]; });
        nodo[partes[partes.length - 1]] = valor;
      }
    });

    test('solo escribe las claves marcadas', () => {
      const exp = conSet(expediente());
      const datos = normalizarExtraccion(LECTURA_PACKING);

      const aplicados = aplicarCambios(exp, datos, 'packing_list', ['goods.0.packages.quantity', 'goods.0.grossWeight']);

      expect(claves(aplicados)).toEqual(['goods.0.packages.quantity', 'goods.0.grossWeight']);
      expect(exp.goods[0].packages.quantity).toBe(12);
      expect(exp.goods[0].grossWeight).toBe(924.48);
      expect(exp.goods[0].netWeight).toBeNull();
      expect(exp.transport.containers).toBeUndefined();
    });

    test('una clave que no esta en la propuesta no escribe nada (no es una via para tocar otros campos)', () => {
      const exp = conSet(expediente());

      const aplicados = aplicarCambios(exp, normalizarExtraccion(LECTURA_PACKING), 'packing_list', ['status', 'tenantId', 'client.nif', 'goods.0.invoiceValue', '__proto__.x']);

      expect(aplicados).toEqual([]);
      expect(exp.status).toBeUndefined();
      expect(exp.goods[0].invoiceValue).toBe(184800);
    });

    test('los contenedores se guardan como lista, conservando los datos de los que ya estaban', () => {
      const exp = conSet(expediente({ transport: { containers: [{ number: 'MSCU1150584', sealNumber: 'P-1' }] } }));
      const datos = normalizarExtraccion({ transporte: { contenedores: ['MSCU1150584', 'TGHU9999999'] } });

      aplicarCambios(exp, datos, 'bill_of_lading', ['transport.containers']);

      expect(exp.transport.containers).toEqual([{ number: 'MSCU1150584', sealNumber: 'P-1' }, { number: 'TGHU9999999' }]);
    });

    test('sin claves, o con algo que no es una lista, no aplica nada', () => {
      const exp = conSet(expediente());
      expect(aplicarCambios(exp, normalizarExtraccion(LECTURA_PACKING), 'packing_list', [])).toEqual([]);
      expect(aplicarCambios(exp, normalizarExtraccion(LECTURA_PACKING), 'packing_list', 'goods.0.grossWeight')).toEqual([]);
    });
  });

  describe('prompt', () => {
    test('prohibe deducir el tipo de carga y pide null para lo que no se lee', () => {
      expect(SYSTEM_PROMPT).toContain('PROHIBIDO deducirlo');
      expect(SYSTEM_PROMPT).toContain('usa null');
      expect(SYSTEM_PROMPT).toContain('El modo (maritimo, aereo, carretera) NO es un medio');
    });

    test('la peticion nombra el tipo con el que el agente clasifico el documento', () => {
      expect(construirPrompt({ type: 'bill_of_lading' })).toContain('"bill_of_lading"');
    });
  });
});
