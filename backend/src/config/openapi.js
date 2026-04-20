const swaggerJsdoc = require('swagger-jsdoc');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'LUCI Customs Agent API',
    version: '1.0.0',
    description: 'Plataforma aduanera multi-país con IA (AEAT España + Douane Netherlands)',
    contact: { name: 'STRIX AI', email: 'soporte@strixai.es', url: 'https://aduanas.strixai.es' }
  },
  servers: [
    { url: 'https://aduanas.strixai.es', description: 'Production' },
    { url: 'http://localhost:5001', description: 'Local dev' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'agent', 'supervisor', 'viewer'] },
          tenantId: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8 }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'JWT signed with iss=luci-customs-agent, aud=luci-api' },
              user: { $ref: '#/components/schemas/User' }
            }
          }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'auth', description: 'Autenticación y gestión de sesión' },
    { name: 'expeditions', description: 'Expedientes aduaneros' },
    { name: 'h7', description: 'Declaraciones H7 (low value / DECO)' },
    { name: 'declarations', description: 'Declaraciones H1/AES/ENS/NCTS/PUE' },
    { name: 'classification', description: 'Clasificación TARIC con IA' },
    { name: 'calculation', description: 'Cálculo de aranceles y tributos' },
    { name: 'aeat', description: 'Integración AEAT (envío / consulta)' },
    { name: 'tenant', description: 'Gestión multi-tenant y configuración' },
    { name: 'admin', description: 'Operaciones admin' },
    { name: 'internal', description: 'Métricas y observabilidad (admin)' }
  ]
};

const options = {
  definition,
  apis: [
    __dirname + '/../routes/*.js',
    __dirname + '/../controllers/*.js'
  ]
};

const spec = swaggerJsdoc(options);

module.exports = spec;
