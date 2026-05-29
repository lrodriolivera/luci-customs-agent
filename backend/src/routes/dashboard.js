/**
 * Dashboard Routes
 * Endpoints para el panel de control: alertas, estadisticas consolidadas
 */

const express = require('express');
const router = express.Router();
const { Expedition, Requirement, Guarantee, SpecialRegime, ParaduaneroControl } = require('../models');
const logger = require('../config/logger');

/**
 * @openapi
 * /api/dashboard/alerts:
 *   get:
 *     tags: [expeditions]
 *     summary: Alertas consolidadas del tenant (requerimientos vencidos, canales rojo/naranja, garantías bajas)
 *     responses:
 *       200:
 *         description: Alertas ordenadas por severidad (critical → warning → info)
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];
    const now = new Date();

    // 1. Requerimientos por vencer (proximos 3 dias)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const urgentRequirements = await Requirement.find({
      status: { $in: ['pending', 'in_progress', 'awaiting_client'] },
      deadline: { $lte: threeDaysFromNow, $gte: now }
    }).populate('expeditionId', 'expeditionId client');

    urgentRequirements.forEach(req => {
      const daysLeft = Math.ceil((new Date(req.deadline) - now) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: req._id,
        type: 'requirement_deadline',
        severity: daysLeft <= 1 ? 'critical' : 'warning',
        title: `Requerimiento por vencer`,
        message: `${req.requirementNumber} vence en ${daysLeft} dia(s)`,
        expeditionId: req.expeditionId?._id,
        expeditionNumber: req.expeditionId?.expeditionId,
        client: req.expeditionId?.client?.companyName,
        deadline: req.deadline,
        link: `/expeditions/${req.expeditionId?._id}`,
        createdAt: req.createdAt
      });
    });

    // 2. Requerimientos vencidos
    const overdueRequirements = await Requirement.find({
      status: { $in: ['pending', 'in_progress', 'awaiting_client'] },
      deadline: { $lt: now }
    }).populate('expeditionId', 'expeditionId client');

    overdueRequirements.forEach(req => {
      const daysOverdue = Math.ceil((now - new Date(req.deadline)) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: req._id,
        type: 'requirement_overdue',
        severity: 'critical',
        title: `Requerimiento VENCIDO`,
        message: `${req.requirementNumber} vencio hace ${daysOverdue} dia(s)`,
        expeditionId: req.expeditionId?._id,
        expeditionNumber: req.expeditionId?.expedientId,
        client: req.expeditionId?.client?.companyName,
        deadline: req.deadline,
        link: `/expeditions/${req.expeditionId?._id}`,
        createdAt: req.createdAt
      });
    });

    // 3. Expedientes en canal naranja/rojo sin atender
    const channelExpeditions = await Expedition.find({
      status: { $in: ['orange_channel', 'red_channel'] },
      'declaration.channelAssignedAt': { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
    });

    channelExpeditions.forEach(exp => {
      const hoursInChannel = Math.floor((now - new Date(exp.declaration.channelAssignedAt)) / (1000 * 60 * 60));
      alerts.push({
        id: exp._id,
        type: exp.status === 'red_channel' ? 'red_channel_pending' : 'orange_channel_pending',
        severity: exp.status === 'red_channel' ? 'critical' : 'warning',
        title: exp.status === 'red_channel' ? 'Canal ROJO pendiente' : 'Canal NARANJA pendiente',
        message: `${exp.expeditionId} lleva ${hoursInChannel}h en canal ${exp.declaration.channel}`,
        expeditionId: exp._id,
        expeditionNumber: exp.expeditionId,
        client: exp.client?.companyName,
        channel: exp.declaration.channel,
        link: `/expeditions/${exp._id}`,
        createdAt: exp.declaration.channelAssignedAt
      });
    });

    // 4. Garantias con saldo bajo (<20%)
    const lowBalanceGuarantees = await Guarantee.find({
      status: 'active',
      $expr: {
        $lt: [
          '$balance.available',
          { $multiply: ['$amount', 0.2] }
        ]
      }
    });

    lowBalanceGuarantees.forEach(g => {
      const available = g.balance?.available ?? 0;
      const amount = g.amount || 1;
      const percentUsed = Math.round((1 - available / amount) * 100);
      const grn = g.guaranteeNumber || g.GRN || g.referenceNumber || `Garantia ${String(g._id).slice(-6)}`;
      alerts.push({
        id: g._id,
        type: 'guarantee_low_balance',
        severity: available < amount * 0.1 ? 'critical' : 'warning',
        title: 'Garantia con saldo bajo',
        message: `${grn}: ${percentUsed}% utilizado`,
        guaranteeNumber: grn,
        available: available,
        total: amount,
        link: `/guarantees/${g._id}`,
        createdAt: g.updatedAt
      });
    });

    // 5. Garantias por vencer (proximos 30 dias)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringGuarantees = await Guarantee.find({
      status: 'active',
      expirationDate: { $lte: thirtyDaysFromNow, $gte: now }
    });

    expiringGuarantees.forEach(g => {
      const daysLeft = Math.ceil((new Date(g.expirationDate) - now) / (1000 * 60 * 60 * 24));
      const grn = g.guaranteeNumber || g.GRN || g.referenceNumber || `Garantia ${String(g._id).slice(-6)}`;
      alerts.push({
        id: g._id,
        type: 'guarantee_expiring',
        severity: daysLeft <= 7 ? 'critical' : 'warning',
        title: 'Garantia por vencer',
        message: `${grn} vence en ${daysLeft} dias`,
        guaranteeNumber: grn,
        expirationDate: g.expirationDate,
        link: `/guarantees/${g._id}`,
        createdAt: g.updatedAt
      });
    });

    // 6. Regimenes especiales por vencer
    const expiringRegimes = await SpecialRegime.find({
      status: 'active',
      'authorization.expirationDate': { $lte: thirtyDaysFromNow, $gte: now }
    }).populate('expeditionId', 'expeditionId client');

    expiringRegimes.forEach(r => {
      const daysLeft = Math.ceil((new Date(r.authorization.expirationDate) - now) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: r._id,
        type: 'regime_expiring',
        severity: daysLeft <= 7 ? 'critical' : 'warning',
        title: `Regimen ${r.regimeCode} por vencer`,
        message: `${r.authorizationNumber} vence en ${daysLeft} dias`,
        regimeCode: r.regimeCode,
        expeditionId: r.expeditionId?._id,
        expeditionNumber: r.expeditionId?.expeditionId,
        expirationDate: r.authorization.expirationDate,
        link: `/special-regimes/${r._id}`,
        createdAt: r.updatedAt
      });
    });

    // 7. Controles paraduaneros pendientes
    const pendingControls = await ParaduaneroControl.find({
      overallStatus: { $in: ['pending', 'documents_pending', 'inspection_scheduled'] }
    }).populate('expeditionId', 'expeditionId client');

    pendingControls.forEach(c => {
      const hoursWaiting = Math.floor((now - new Date(c.createdAt)) / (1000 * 60 * 60));
      if (hoursWaiting > 24) {
        alerts.push({
          id: c._id,
          type: 'paraduanero_pending',
          severity: hoursWaiting > 48 ? 'warning' : 'info',
          title: `Control ${c.controlType} pendiente`,
          message: `${c.expeditionId?.expeditionId}: ${c.authority} esperando ${hoursWaiting}h`,
          authority: c.authority,
          controlType: c.controlType,
          expeditionId: c.expeditionId?._id,
          expeditionNumber: c.expeditionId?.expeditionId,
          link: `/expeditions/${c.expeditionId?._id}`,
          createdAt: c.createdAt
        });
      }
    });

    // Ordenar por severidad y fecha
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Estadisticas de alertas
    const stats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      byType: {}
    };

    alerts.forEach(a => {
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        alerts,
        stats
      }
    });

  } catch (error) {
    logger.error('Error getting dashboard alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener alertas'
    });
  }
});

/**
 * @openapi
 * /api/dashboard/stats:
 *   get:
 *     tags: [expeditions]
 *     summary: KPIs consolidados del tenant (expedientes, requerimientos, garantías)
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Estadisticas de expedientes
    const expeditionStats = await Expedition.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byChannel: [
            { $match: { 'declaration.channel': { $exists: true } } },
            { $group: { _id: '$declaration.channel', count: { $sum: 1 } } }
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $count: 'count' }
          ],
          pendingDocs: [
            { $match: { status: 'pending_docs' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Estadisticas de requerimientos
    const requirementStats = await Requirement.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [
            { $match: { status: { $in: ['pending', 'in_progress'] } } },
            { $count: 'count' }
          ],
          resolved: [
            { $match: { status: 'resolved' } },
            { $count: 'count' }
          ],
          overdue: [
            {
              $match: {
                status: { $in: ['pending', 'in_progress'] },
                deadline: { $lt: now }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Estadisticas de garantias
    const guaranteeStats = await Guarantee.aggregate([
      {
        $facet: {
          active: [
            { $match: { status: 'active' } },
            { $count: 'count' }
          ],
          totalAmount: [
            { $match: { status: 'active' } },
            { $group: { _id: null, total: { $sum: '$amount' }, available: { $sum: '$balance.available' } } }
          ]
        }
      }
    ]);

    // Formatear respuesta
    const stats = {
      expeditions: {
        total: expeditionStats[0]?.total[0]?.count || 0,
        thisMonth: expeditionStats[0]?.thisMonth[0]?.count || 0,
        pendingDocs: expeditionStats[0]?.pendingDocs[0]?.count || 0,
        byStatus: {},
        byChannel: {}
      },
      requirements: {
        total: requirementStats[0]?.total[0]?.count || 0,
        pending: requirementStats[0]?.pending[0]?.count || 0,
        resolved: requirementStats[0]?.resolved[0]?.count || 0,
        overdue: requirementStats[0]?.overdue[0]?.count || 0
      },
      guarantees: {
        active: guaranteeStats[0]?.active[0]?.count || 0,
        totalAmount: guaranteeStats[0]?.totalAmount[0]?.total || 0,
        availableAmount: guaranteeStats[0]?.totalAmount[0]?.available || 0
      }
    };

    // Mapear estadisticas por estado
    expeditionStats[0]?.byStatus?.forEach(s => {
      stats.expeditions.byStatus[s._id] = s.count;
    });
    expeditionStats[0]?.byChannel?.forEach(s => {
      stats.expeditions.byChannel[s._id] = s.count;
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas'
    });
  }
});

module.exports = router;
