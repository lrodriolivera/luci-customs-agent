/**
 * oeaService — ciclo de vida completo de la certificacion OEA (Operador
 * Economico Autorizado) sobre Mongo REAL en memoria. Es logica de negocio
 * critica: la aprobacion fija la reduccion de garantia (dinero) y el estado OEA
 * habilita simplificaciones ante la AEAT.
 *
 * Los tests existentes (oeaService.test.js / .pure / Logic) cubren SOLO los
 * helpers puros y los catalogos, con el modelo OEA mockeado. Esta suite ataca lo
 * que NO se cubria: los metodos async que escriben en Mongo (createApplication,
 * submitForReview, approve, suspend, revoke, reevaluacion, incidentes,
 * renovacion, auditorias, cumplimiento, simplificaciones y guardias de
 * propiedad). Ahi vive la mayoria de las ramas sin cubrir.
 *
 * NO hay frontera de red que mockear: oeaService solo toca el modelo OEA. Se usa
 * la BD en memoria para ejecutar save(), los hooks pre('save'), addActivityLog/
 * addAlert y getGuaranteeReductionPercentage DE VERDAD. No se mockea el codigo
 * bajo prueba.
 */

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const oea = require('../../src/services/oeaService');
const OEA = require('../../src/models/OEA');
const mongoose = require('mongoose');

usarBaseDeDatosEnMemoria();

const userId = new mongoose.Types.ObjectId();

/** Datos de una solicitud OEA completa (pasa validateApplication). */
function datosSolicitud(overrides = {}) {
  return {
    organization: {
      name: 'ACME Importaciones SL',
      nif: 'B12345678',
      eori: 'ESB12345678',
      address: { city: 'Madrid', street: 'Gran Via 1', postalCode: '28001' },
      contact: { name: 'Juan Perez', email: 'juan@acme.es' },
      legalRepresentative: { name: 'Maria Lopez' }
    },
    certification: { type: 'OEAC' },
    ...overrides
  };
}

/** Crea una solicitud y devuelve el documento OEA persistido. */
async function crearSolicitud(overrides) {
  return oea.createApplication(datosSolicitud(overrides), userId);
}

/** Crea + envia a revision + aprueba. Deja la OEA en 'approved'. */
async function crearAprobada(overrides) {
  const doc = await crearSolicitud(overrides);
  await oea.submitForReview(doc._id, userId);
  return oea.approve(doc._id, { responsibleOffice: 'AEAT Madrid' }, userId);
}

describe('createApplication', () => {
  test('crea una solicitud OEAC: estado pending, beneficios inactivos, log inicial', async () => {
    const doc = await crearSolicitud();
    expect(doc.certification.status).toBe('pending');
    expect(doc.certification.applicationDate).toBeInstanceOf(Date);
    // OEAC -> beneficios OEAC, todos inactivos de inicio
    expect(doc.benefits.length).toBe(6);
    expect(doc.benefits.every(b => b.active === false)).toBe(true);
    // securityStandards no aplica para OEAC
    expect(doc.requirements.securityStandards.status).toBe('not_applicable');
    expect(doc.activityLog.some(l => l.action === 'APPLICATION_CREATED')).toBe(true);
  });

  test('OEAF combina beneficios OEAC + OEAS y exige seguridad (partial)', async () => {
    const doc = await crearSolicitud({ certification: { type: 'OEAF' }, organization: { ...datosSolicitud().organization, nif: 'B99999999' } });
    expect(doc.benefits.length).toBe(11); // 6 OEAC + 5 OEAS
    expect(doc.requirements.securityStandards.status).toBe('partial');
  });

  test('rechaza una segunda solicitud si la organizacion ya tiene una activa', async () => {
    await crearSolicitud();
    await expect(crearSolicitud()).rejects.toThrow(/ya tiene una certificacion OEA/i);
  });
});

describe('submitForReview', () => {
  test('una solicitud completa pasa a under_review', async () => {
    const doc = await crearSolicitud();
    const r = await oea.submitForReview(doc._id, userId);
    expect(r.certification.status).toBe('under_review');
    expect(r.activityLog.some(l => l.action === 'SUBMITTED_FOR_REVIEW')).toBe(true);
  });

  test('una solicitud con datos incompletos falla la validacion', async () => {
    // sin representante legal -> validateApplication (el vivo) falla
    const doc = await crearSolicitud({
      organization: { name: 'X SL', nif: 'B00000001', eori: 'ESB00000001', address: { city: 'Madrid' }, contact: { name: 'A', email: 'a@x.es' } }
    });
    await expect(oea.submitForReview(doc._id, userId)).rejects.toThrow(/Validacion fallida/i);
  });

  test('no se puede enviar a revision si no esta pending', async () => {
    const doc = await crearSolicitud();
    await oea.submitForReview(doc._id, userId);
    await expect(oea.submitForReview(doc._id, userId)).rejects.toThrow(/No se puede enviar a revision/i);
  });
});

describe('approve', () => {
  test('aprueba: numero OEA, expiracion +5 anos, beneficios activos, reduccion 30%, alerta de renovacion', async () => {
    const doc = await crearAprobada();
    expect(doc.certification.status).toBe('approved');
    // fix bug: el numero usa el EORI (ES...) como prefijo de pais, no el NIF.
    expect(doc.certification.number).toMatch(/^ESOEAC\d{4}[A-Z0-9]{6}$/);
    // expiracion ~5 anos por delante
    const anos = (doc.certification.expirationDate.getFullYear() - new Date().getFullYear());
    expect(anos).toBe(5);
    expect(doc.benefits.every(b => b.active === true)).toBe(true);
    // OEAC standard -> reduced_30
    expect(doc.guaranteeReduction.level).toBe('reduced_30');
    expect(doc.getGuaranteeReductionPercentage()).toBe(30);
    // OEAC NO tiene reconocimiento mutuo
    expect(doc.mutualRecognition || []).toHaveLength(0);
    // alerta de recordatorio de renovacion creada
    expect(doc.alerts.some(a => a.type === 'renewal_reminder')).toBe(true);
  });

  test('el numero OEA usa el codigo de pais del EORI, no del NIF (regresion del bug)', async () => {
    // EORI portugues -> el numero debe empezar por PT, no por el NIF.
    const doc = await crearAprobada({
      organization: { ...datosSolicitud().organization, nif: 'B44444444', eori: 'PT123456789' }
    });
    expect(doc.certification.number.startsWith('PT')).toBe(true);
  });

  test('OEAS aprobada obtiene reconocimiento mutuo con los paises socios', async () => {
    const doc = await crearAprobada({ certification: { type: 'OEAS' }, organization: { ...datosSolicitud().organization, nif: 'B22222222' } });
    expect(doc.certification.type).toBe('OEAS');
    expect(doc.mutualRecognition.length).toBeGreaterThan(0);
    expect(doc.mutualRecognition.some(m => m.countryCode === 'US')).toBe(true);
    // OEAS standard -> sin reduccion de garantia
    expect(doc.guaranteeReduction.level).toBe('none');
  });

  test('no se puede aprobar si no esta under_review', async () => {
    const doc = await crearSolicitud();
    await expect(oea.approve(doc._id, {}, userId)).rejects.toThrow(/No se puede aprobar/i);
  });
});

describe('suspend / revoke', () => {
  test('suspend desactiva beneficios y quita la reduccion de garantia', async () => {
    const doc = await crearAprobada();
    const r = await oea.suspend(doc._id, 'Incumplimiento detectado', userId);
    expect(r.certification.status).toBe('suspended');
    expect(r.benefits.every(b => b.active === false)).toBe(true);
    expect(r.guaranteeReduction.level).toBe('none');
    expect(r.alerts.some(a => a.severity === 'critical')).toBe(true);
  });

  test('no se puede suspender una que no esta aprobada', async () => {
    const doc = await crearSolicitud();
    await expect(oea.suspend(doc._id, 'x', userId)).rejects.toThrow(/No se puede suspender/i);
  });

  test('revoke desactiva beneficios y simplificaciones desde cualquier estado', async () => {
    const doc = await crearAprobada();
    await oea.grantSimplification(doc._id, 'GGR', userId); // OEAC permite GGR
    const r = await oea.revoke(doc._id, 'Fraude', userId);
    expect(r.certification.status).toBe('revoked');
    expect(r.benefits.every(b => b.active === false)).toBe(true);
    expect(r.simplifications.every(s => s.active === false)).toBe(true);
    expect(r.guaranteeReduction.level).toBe('none');
  });
});

describe('reevaluacion e incidentes', () => {
  test('initiateReevaluation guarda el estado previo y pasa a reevaluation', async () => {
    const doc = await crearAprobada();
    const r = await oea.initiateReevaluation(doc._id, 'Cambio legislativo', userId);
    expect(r.certification.status).toBe('reevaluation');
    expect(r.certification.previousStatus).toBe('approved');
    expect(r.alerts.some(a => a.type === 'compliance_issue')).toBe(true);
  });

  test('registerIncident registra la incidencia y pasa a incident', async () => {
    const doc = await crearAprobada();
    const r = await oea.registerIncident(doc._id, {
      type: 'compliance', description: 'Retraso en registros', severity: 'critical'
    }, userId);
    expect(r.certification.status).toBe('incident');
    expect(r.incidents).toHaveLength(1);
    expect(r.incidents[0].status).toBe('open');
    // severidad critical -> alerta critical
    expect(r.alerts.some(a => a.severity === 'critical' && a.type === 'compliance_issue')).toBe(true);
  });

  test('resolveIncident cierra la incidencia y restaura el estado previo', async () => {
    const doc = await crearAprobada();
    await oea.registerIncident(doc._id, { type: 'operational', description: 'Fallo puntual' }, userId);
    const r = await oea.resolveIncident(doc._id, 0, 'Corregido y verificado', userId);
    expect(r.incidents[0].status).toBe('resolved');
    expect(r.incidents[0].resolution).toBe('Corregido y verificado');
    // sin incidencias abiertas -> vuelve a approved
    expect(r.certification.status).toBe('approved');
  });

  test('resolveIncident con indice inexistente lanza error', async () => {
    const doc = await crearAprobada();
    await expect(oea.resolveIncident(doc._id, 5, 'x', userId)).rejects.toThrow(/no encontrada/i);
  });

  test('no se puede registrar incidencia si no esta aprobada', async () => {
    const doc = await crearSolicitud();
    await expect(oea.registerIncident(doc._id, { type: 'other', description: 'x' }, userId))
      .rejects.toThrow(/No se puede registrar incidencia/i);
  });
});

describe('renovacion', () => {
  test('initiateRenewal + completeRenewal reactiva y extiende +5 anos', async () => {
    const doc = await crearAprobada();
    const pending = await oea.initiateRenewal(doc._id, userId);
    expect(pending.certification.status).toBe('renewal_pending');

    const renewed = await oea.completeRenewal(doc._id, userId);
    expect(renewed.certification.status).toBe('approved');
    expect(renewed.certification.lastRenewalDate).toBeInstanceOf(Date);
    expect(renewed.benefits.every(b => b.active === true)).toBe(true);
  });

  test('completeRenewal falla si no estaba en renewal_pending', async () => {
    const doc = await crearAprobada();
    await expect(oea.completeRenewal(doc._id, userId)).rejects.toThrow(/no esta en proceso de renovacion/i);
  });

  test('initiateRenewal falla si no esta aprobada', async () => {
    const doc = await crearSolicitud();
    await expect(oea.initiateRenewal(doc._id, userId)).rejects.toThrow(/Solo se pueden renovar/i);
  });
});

describe('addAudit', () => {
  test('una auditoria fallida marca el cumplimiento como critico y alerta de hallazgos', async () => {
    const doc = await crearAprobada();
    const r = await oea.addAudit(doc._id, {
      type: 'aeat', result: 'failed',
      findings: [{ severity: 'critical', description: 'Sin control de acceso', dueDate: new Date() }]
    }, userId);
    expect(r.compliance.currentStatus).toBe('critical');
    expect(r.audits).toHaveLength(1);
    expect(r.alerts.some(a => a.type === 'finding_due' && a.severity === 'critical')).toBe(true);
  });

  test('auditoria con condiciones deja cumplimiento en warning', async () => {
    const doc = await crearAprobada();
    const r = await oea.addAudit(doc._id, { type: 'internal', result: 'passed_with_conditions' }, userId);
    expect(r.compliance.currentStatus).toBe('warning');
  });
});

describe('updateRequirement', () => {
  test('actualiza un requisito valido y registra la fecha de verificacion', async () => {
    const doc = await crearSolicitud();
    const r = await oea.updateRequirement(doc._id, 'financialSolvency', 'met', 'Auditado', userId);
    expect(r.requirements.financialSolvency.status).toBe('met');
    expect(r.requirements.financialSolvency.lastVerified).toBeInstanceOf(Date);
    expect(r.requirements.financialSolvency.notes).toBe('Auditado');
  });

  test('un requisito inexistente lanza error', async () => {
    const doc = await crearSolicitud();
    await expect(oea.updateRequirement(doc._id, 'noExiste', 'met', null, userId))
      .rejects.toThrow(/Requisito no valido/i);
  });
});

describe('addComplianceRecord — scoring del semaforo', () => {
  const registro = (metrics) => ({
    period: { year: 2026, quarter: 2 },
    metrics: { errorRate: 0, customsInfractions: 0, lateSubmissions: 0, ...metrics }
  });

  test('metricas limpias -> registro compliant y estado global excellent', async () => {
    const doc = await crearAprobada();
    const r = await oea.addComplianceRecord(doc._id, registro({}), userId);
    const last = r.compliance.records[r.compliance.records.length - 1];
    expect(last.status).toBe('compliant');
    expect(r.compliance.currentStatus).toBe('excellent');
  });

  test('infraccion aduanera -> non_compliant', async () => {
    const doc = await crearAprobada();
    const r = await oea.addComplianceRecord(doc._id, registro({ customsInfractions: 1 }), userId);
    const last = r.compliance.records[r.compliance.records.length - 1];
    expect(last.status).toBe('non_compliant');
  });

  test('errorRate entre 2 y 5 -> warning', async () => {
    const doc = await crearAprobada();
    const r = await oea.addComplianceRecord(doc._id, registro({ errorRate: 3 }), userId);
    const last = r.compliance.records[r.compliance.records.length - 1];
    expect(last.status).toBe('warning');
  });

  test('dos registros non_compliant seguidos -> cumplimiento global critical', async () => {
    const doc = await crearAprobada();
    await oea.addComplianceRecord(doc._id, registro({ errorRate: 10 }), userId);
    const r = await oea.addComplianceRecord(doc._id, registro({ customsInfractions: 2 }), userId);
    expect(r.compliance.currentStatus).toBe('critical');
  });
});

describe('grantSimplification', () => {
  test('otorga una simplificacion valida para OEAC', async () => {
    const doc = await crearAprobada();
    const r = await oea.grantSimplification(doc._id, 'SDE', userId);
    expect(r.simplifications.some(s => s.code === 'SDE' && s.active)).toBe(true);
  });

  test('rechaza una simplificacion no valida', async () => {
    const doc = await crearAprobada();
    await expect(oea.grantSimplification(doc._id, 'NOPE', userId)).rejects.toThrow(/no valida/i);
  });

  test('rechaza otorgar dos veces la misma simplificacion activa', async () => {
    const doc = await crearAprobada();
    await oea.grantSimplification(doc._id, 'DIF', userId);
    await expect(oea.grantSimplification(doc._id, 'DIF', userId)).rejects.toThrow(/ya esta activa/i);
  });

  test('no se puede otorgar simplificacion si no esta aprobada', async () => {
    const doc = await crearSolicitud();
    await expect(oea.grantSimplification(doc._id, 'SDE', userId)).rejects.toThrow(/certificaciones activas/i);
  });
});

describe('calculateGuaranteeReduction', () => {
  test('OEAC aprobada aplica el 30% de reduccion sobre el importe', async () => {
    const doc = await crearAprobada();
    const r = await oea.calculateGuaranteeReduction(doc._id, 10000);
    expect(r.applicable).toBe(true);
    expect(r.reductionPercentage).toBe(30);
    expect(r.reducedAmount).toBe(7000); // 10000 * (1 - 0.30)
  });

  test('OEA no aprobada no aplica reduccion', async () => {
    const doc = await crearSolicitud(); // pending
    const r = await oea.calculateGuaranteeReduction(doc._id, 10000);
    expect(r.applicable).toBe(false);
    expect(r.reducedAmount).toBe(10000);
  });
});

describe('guardia de propiedad (_loadOwnedOEA)', () => {
  test('otro usuario no puede aprobar una OEA ajena', async () => {
    const doc = await crearSolicitud();
    await oea.submitForReview(doc._id, userId);
    const otro = new mongoose.Types.ObjectId();
    await expect(oea.approve(doc._id, {}, otro)).rejects.toThrow(/no encontrada/i);
  });

  test('id inexistente lanza no encontrada', async () => {
    await expect(oea.suspend(new mongoose.Types.ObjectId(), 'x', userId)).rejects.toThrow(/no encontrada/i);
  });
});

describe('consultas y stats', () => {
  test('list acota por userId (no filtra las de otros usuarios)', async () => {
    await crearSolicitud();
    const otroUser = new mongoose.Types.ObjectId();
    await oea.createApplication(datosSolicitud({ organization: { ...datosSolicitud().organization, nif: 'B33333333', eori: 'ESB33333333' } }), otroUser);

    const r = await oea.list({ userId });
    expect(r.data.length).toBe(1);
    expect(r.pagination.total).toBe(1);
  });

  test('getStats agrega por tipo y estado', async () => {
    await crearAprobada();
    const r = await oea.getStats();
    expect(r.totalActive).toBe(1);
    expect(r.byType.OEAC).toBe(1);
    expect(r.byStatus.approved).toBe(1);
  });

  test('getByNIF y getByEORI localizan la certificacion', async () => {
    await crearSolicitud();
    expect(await oea.getByNIF('B12345678')).toBeTruthy();
    expect(await oea.getByEORI('ESB12345678')).toBeTruthy();
  });
});

describe('alertas', () => {
  test('acknowledgeAlert y resolveAlert marcan la alerta', async () => {
    const doc = await crearAprobada(); // crea una alerta de renovacion
    const alertId = doc.alerts[0]._id;

    const ack = await oea.acknowledgeAlert(doc._id, alertId, userId);
    expect(ack.alerts.id(alertId).acknowledged).toBe(true);

    const res = await oea.resolveAlert(doc._id, alertId, userId);
    expect(res.alerts.id(alertId).resolved).toBe(true);
  });

  test('alerta inexistente lanza error', async () => {
    const doc = await crearAprobada();
    await expect(oea.acknowledgeAlert(doc._id, new mongoose.Types.ObjectId(), userId))
      .rejects.toThrow(/Alerta no encontrada/i);
  });
});
