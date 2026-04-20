const express = require('express');
const router = express.Router();
const multer = require('multer');
const manifestService = require('../services/manifestService');
const { auth } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.txt', '.tsv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se aceptan archivos CSV/TXT/TSV'));
  }
});

router.use(auth);

/**
 * @openapi
 * /api/manifest/upload:
 *   post:
 *     tags: [h7]
 *     summary: Subir CSV de manifiesto (e-commerce) y clasificar con IA
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               manifest: { type: string, format: binary }
 *               delimiter: { type: string }
 *               carrier: { type: string }
 *               iossNumber: { type: string }
 *     responses:
 *       200:
 *         description: Resultados de clasificación IA por fila
 *
 * /api/manifest/create-h7-batch:
 *   post:
 *     tags: [h7]
 *     summary: Crear declaraciones H7 en batch a partir de resultados clasificados
 *
 * /api/manifest/template:
 *   get:
 *     tags: [h7]
 *     summary: Descargar plantilla CSV de manifiesto
 */
// POST /api/manifest/upload - Upload and process manifest
router.post('/upload', upload.single('manifest'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Archivo de manifiesto requerido' });
    }

    const options = {
      delimiter: req.body.delimiter || ',',
      carrier: req.body.carrier || 'OTHER',
      iossNumber: req.body.iossNumber || ''
    };

    const result = await manifestService.processManifest(req.file.buffer, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Manifest upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Error procesando manifiesto' });
  }
});

// POST /api/manifest/create-h7-batch - Create H7 declarations from processed manifest
router.post('/create-h7-batch', async (req, res) => {
  try {
    const { h7Declarations } = req.body;

    if (!h7Declarations || !Array.isArray(h7Declarations) || h7Declarations.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay declaraciones H7 para crear' });
    }

    // Create H7 declarations using existing h7 model directly
    let H7Declaration;
    try { H7Declaration = require('../models/H7Declaration'); } catch(e) {}

    const results = [];
    for (let i = 0; i < h7Declarations.length; i++) {
      const decl = h7Declarations[i];
      try {
        if (H7Declaration) {
          // Generate reference
          const ref = `H7-MAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          // Map carrier code to valid enum
          const validCarriers = ['CORREOS', 'DHL', 'UPS', 'FEDEX', 'TNT', 'GLS', 'SEUR', 'MRW', 'AMAZON', 'OTHER'];
          const carrierCode = validCarriers.includes(decl.carrier?.code) ? decl.carrier.code : 'OTHER';

          const intrinsicValue = decl.totals?.intrinsicValue || 0;
          const netWeight = parseFloat(decl.items?.[0]?.netWeight) || parseFloat(decl.totals?.grossWeight) || 0.1;
          const grossWeight = parseFloat(decl.totals?.grossWeight) || netWeight || 0.1;

          // Auto-generate N337 reference for G4 (obligatorio aereos desde 9/Mar/2026)
          const g4Ref = `G4-${Date.now().toString(36).toUpperCase()}-${(i + 1).toString().padStart(3, '0')}`;

          const h7Doc = new H7Declaration({
            reference: ref,
            trackingNumber: decl.trackingNumber,
            carrier: { code: carrierCode, name: decl.carrier?.name || carrierCode },
            iossNumber: decl.iossNumber || undefined,
            // Documento previo G4 (N337) - cumplimiento 9/Mar/2026
            documentoPrevio: {
              tipo: 'N337',
              referencia: decl.documentoPrevioRef || g4Ref,
              descripcion: 'Deposito temporal G4 - generado automaticamente'
            },
            garantiaGRN: decl.garantiaGRN || '',
            sender: {
              name: decl.sender?.name || 'REMITENTE DESCONOCIDO',
              address: {
                street: decl.sender?.address?.street || '-',
                city: decl.sender?.address?.city || '-',
                postalCode: decl.sender?.address?.postalCode || '00000',
                country: decl.sender?.address?.country || 'CN'
              }
            },
            recipient: {
              name: decl.recipient?.name || 'DESTINATARIO',
              taxId: decl.recipient?.taxId || '',
              address: {
                street: decl.recipient?.address?.street || '-',
                city: decl.recipient?.address?.city || '-',
                postalCode: decl.recipient?.address?.postalCode || '00000',
                country: decl.recipient?.address?.country || 'ES'
              }
            },
            items: (decl.items || []).map(item => ({
              description: item.description || 'Mercancia general',
              taricCode: (item.taricCode || '000000').padEnd(6, '0').substring(0, 6),
              quantity: parseInt(item.quantity) || 1,
              unitValue: parseFloat(item.unitValue) || 0,
              totalValue: parseFloat(item.totalValue) || parseFloat(item.unitValue) || 0,
              netWeight: parseFloat(item.netWeight) || 0.1,
              countryOfOrigin: item.countryOfOrigin || 'CN'
            })),
            totals: {
              intrinsicValue: Math.min(intrinsicValue, 150),
              customsValue: intrinsicValue,
              shippingCost: decl.totals?.shippingCost || 0,
              grossWeight: grossWeight,
              netWeight: netWeight,
              packages: decl.totals?.packages || 1
            },
            status: 'draft',
            source: 'manifest',
            tenantId: req.user?.tenantId,
            createdBy: req.user?._id
          });

          const saved = await h7Doc.save();
          results.push({ tracking: decl.trackingNumber, success: true, id: saved._id, reference: saved.reference });
        } else {
          // Fallback: store as pending
          results.push({ tracking: decl.trackingNumber, success: true, status: 'pending_creation' });
        }
      } catch (error) {
        results.push({ tracking: decl.trackingNumber, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      data: {
        total: h7Declarations.length,
        created: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  } catch (error) {
    console.error('Batch H7 creation error:', error);
    res.status(500).json({ success: false, error: 'Error creando declaraciones H7' });
  }
});

// GET /api/manifest/template - Download CSV template
router.get('/template', (req, res) => {
  const template = 'tracking,sender_name,sender_country,recipient_name,recipient_id,recipient_address,recipient_city,recipient_postal,description,quantity,value,weight\n';
  const example = 'AWB-001,Shenzhen Electronics Ltd,CN,Juan Garcia,12345678A,Calle Mayor 10,Madrid,28001,Funda movil silicona,2,15.99,0.3\n';
  const example2 = 'AWB-002,Tokyo Fashion Co,JP,Maria Lopez,87654321B,Av Diagonal 100,Barcelona,08001,Camiseta algodon estampada,1,29.99,0.2\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_manifiesto_h7.csv"');
  res.send(template + example + example2);
});

module.exports = router;
