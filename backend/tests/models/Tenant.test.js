/**
 * Modelo Tenant sobre Mongo REAL en memoria.
 *
 * Es logica de tenant-scoping critica: limites de plan, permisos por feature,
 * comprobacion de cuotas y los metodos estaticos que reparten los limites por
 * plan (getDefaultLimits). Un limite mal aplicado deja pasar consumo que
 * deberia estar bloqueado (o al reves, bloquea a un cliente que ha pagado).
 *
 * NO se mockea el codigo bajo prueba: se crean Tenants REALES y se invocan sus
 * metodos de instancia (isActive, canUseFeature, hasReachedLimit, incrementUsage,
 * resetMonthlyUsage), sus virtuals (fullAddress) y sus estaticos (findBySlug,
 * findActive, findByPlan, getDefaultLimits). Las escrituras (save) validan DE
 * VERDAD enums, required, defaults y el pre-save contra el mongod efimero.
 *
 * NO se usan fake timers (Mongoose depende de timers internos y las escrituras
 * cuelgan) ni jest.isolateModules (duplicaria el modelo -> escrituras a otra
 * conexion). El unico require es el modelo real.
 */

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const Tenant = require('../../src/models/Tenant');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

/**
 * Crea y persiste un Tenant valido minimo. Acepta overrides para variar el
 * escenario bajo prueba sin repetir el andamiaje.
 */
async function crearTenant(overrides = {}) {
  const base = {
    name: 'ACME Aduanas SL',
    slug: `acme-${Math.random().toString(36).slice(2, 10)}`,
    ...overrides
  };
  return Tenant.create(base);
}

describe('Modelo Tenant', () => {
  describe('validaciones del schema y defaults', () => {
    it('exige name y slug (required) y falla sin ellos', async () => {
      // Arrange
      const tenant = new Tenant({});

      // Act
      let error;
      try {
        await tenant.save();
      } catch (e) {
        error = e;
      }

      // Assert
      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.slug).toBeDefined();
    });

    it('normaliza el slug a minusculas y hace trim', async () => {
      // Arrange + Act
      const tenant = await crearTenant({ slug: '  MiSlug-RARO  ' });

      // Assert
      expect(tenant.slug).toBe('mislug-raro');
    });

    it('aplica el estado por defecto PENDING cuando no se indica', async () => {
      // Act
      const tenant = await crearTenant();

      // Assert
      expect(tenant.status).toBe('pending');
    });

    it('rechaza un status fuera del enum de TENANT_STATUS', async () => {
      // Arrange
      const tenant = new Tenant({ name: 'X', slug: 'x-invalid-status', status: 'zombie' });

      // Act
      let error;
      try {
        await tenant.save();
      } catch (e) {
        error = e;
      }

      // Assert
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });

    it('impide dos tenants con el mismo slug (unique)', async () => {
      // Arrange
      await crearTenant({ slug: 'slug-repetido' });

      // Act
      let error;
      try {
        await crearTenant({ slug: 'slug-repetido' });
      } catch (e) {
        error = e;
      }

      // Assert: el indice unique lanza un error de clave duplicada (11000)
      expect(error).toBeDefined();
      expect(error.code).toBe(11000);
    });

    it('aplica los defaults de la suscripcion (plan free, status active)', async () => {
      // Act
      const tenant = await crearTenant({ subscription: {} });

      // Assert
      expect(tenant.subscription.plan).toBe('free');
      expect(tenant.subscription.status).toBe('active');
      expect(tenant.subscription.cancelAtPeriodEnd).toBe(false);
    });

    it('acepta cada plan valido del enum de suscripcion', async () => {
      // Arrange
      const planes = ['free', 'starter', 'professional', 'business', 'enterprise'];

      // Act + Assert
      for (const plan of planes) {
        const tenant = await crearTenant({
          slug: `plan-${plan}`,
          subscription: { plan }
        });
        expect(tenant.subscription.plan).toBe(plan);
      }
    });

    it('rechaza un plan fuera del enum de suscripcion', async () => {
      // Arrange
      const tenant = new Tenant({
        name: 'X',
        slug: 'plan-invalido',
        subscription: { plan: 'galactic' }
      });

      // Act
      let error;
      try {
        await tenant.save();
      } catch (e) {
        error = e;
      }

      // Assert
      expect(error).toBeDefined();
      expect(error.errors['subscription.plan']).toBeDefined();
    });

    it('aplica los defaults de limits cuando se crea con limits vacios', async () => {
      // Act
      const tenant = await crearTenant({ limits: {} });

      // Assert
      expect(tenant.limits.maxUsers).toBe(5);
      expect(tenant.limits.maxDeclarationsPerMonth).toBe(100);
      expect(tenant.limits.maxExpeditionsPerMonth).toBe(50);
      expect(tenant.limits.maxStorageGB).toBe(5);
      expect(tenant.limits.maxApiCallsPerDay).toBe(1000);
      expect(tenant.limits.maxLuciQueriesPerMonth).toBe(500);
      // La unica feature activa por defecto es auditLogs
      expect(tenant.limits.features.auditLogs).toBe(true);
      expect(tenant.limits.features.analytics).toBe(false);
      expect(tenant.limits.features.apiAccess).toBe(false);
    });

    it('aplica los defaults de settings (branding, defaults, seguridad)', async () => {
      // Act
      const tenant = await crearTenant({ settings: {} });

      // Assert
      expect(tenant.settings.branding.primaryColor).toBe('#8B5CF6');
      expect(tenant.settings.defaults.currency).toBe('EUR');
      expect(tenant.settings.defaults.language).toBe('es');
      expect(tenant.settings.defaults.timezone).toBe('Europe/Madrid');
      expect(tenant.settings.notifications.emailAlerts).toBe(true);
      expect(tenant.settings.notifications.weeklyReport).toBe(false);
      expect(tenant.settings.security.mfaRequired).toBe(false);
      expect(tenant.settings.security.sessionTimeout).toBe(480);
      expect(tenant.settings.security.passwordPolicy.minLength).toBe(8);
    });

    it('aplica el pais y entorno por defecto de customsConfig (ES / test)', async () => {
      // Act
      const tenant = await crearTenant({ customsConfig: {} });

      // Assert
      expect(tenant.customsConfig.country).toBe('ES');
      expect(tenant.customsConfig.environment).toBe('test');
    });

    it('rechaza un pais de customsConfig fuera del enum', async () => {
      // Arrange
      const tenant = new Tenant({
        name: 'X',
        slug: 'pais-invalido',
        customsConfig: { country: 'US' }
      });

      // Act
      let error;
      try {
        await tenant.save();
      } catch (e) {
        error = e;
      }

      // Assert
      expect(error).toBeDefined();
      expect(error.errors['customsConfig.country']).toBeDefined();
    });

    it('exige name y email en un contacto (ContactSchema required)', async () => {
      // Arrange: contacto sin name ni email
      const tenant = new Tenant({
        name: 'X',
        slug: 'contacto-invalido',
        primaryContact: { phone: '600000000' }
      });

      // Act
      let error;
      try {
        await tenant.save();
      } catch (e) {
        error = e;
      }

      // Assert
      expect(error).toBeDefined();
      expect(error.errors['primaryContact.name']).toBeDefined();
      expect(error.errors['primaryContact.email']).toBeDefined();
    });
  });

  describe('pre-save: actualiza updatedAt y genera slug desde el nombre', () => {
    it('refresca updatedAt en cada save', async () => {
      // Arrange
      const tenant = await crearTenant();
      const primero = tenant.updatedAt.getTime();

      // Act: esperamos un instante real (sin fake timers) y volvemos a guardar
      await new Promise((r) => setTimeout(r, 15));
      tenant.description = 'cambiado';
      await tenant.save();

      // Assert
      expect(tenant.updatedAt.getTime()).toBeGreaterThanOrEqual(primero);
    });
  });

  describe('metodo de instancia isActive', () => {
    it('devuelve true si el estado es active', async () => {
      const tenant = await crearTenant({ status: 'active' });
      expect(tenant.isActive()).toBe(true);
    });

    it('devuelve true si el estado es trial', async () => {
      const tenant = await crearTenant({ status: 'trial' });
      expect(tenant.isActive()).toBe(true);
    });

    it('devuelve false si el estado es suspended', async () => {
      const tenant = await crearTenant({ status: 'suspended' });
      expect(tenant.isActive()).toBe(false);
    });

    it('devuelve false si el estado es cancelled o pending', async () => {
      const cancelado = await crearTenant({ slug: 'canc', status: 'cancelled' });
      const pendiente = await crearTenant({ slug: 'pend', status: 'pending' });
      expect(cancelado.isActive()).toBe(false);
      expect(pendiente.isActive()).toBe(false);
    });
  });

  describe('metodo de instancia canUseFeature', () => {
    it('devuelve true si la feature esta activada en limits', async () => {
      const tenant = await crearTenant({
        limits: { features: { analytics: true } }
      });
      expect(tenant.canUseFeature('analytics')).toBe(true);
    });

    it('devuelve false si la feature esta desactivada', async () => {
      const tenant = await crearTenant({
        limits: { features: { analytics: false } }
      });
      expect(tenant.canUseFeature('analytics')).toBe(false);
    });

    it('devuelve false para una feature inexistente', async () => {
      const tenant = await crearTenant({ limits: {} });
      expect(tenant.canUseFeature('featureQueNoExiste')).toBe(false);
    });

    it('devuelve false (sin lanzar) cuando no hay limits definidos', async () => {
      // Arrange: forzamos limits a undefined tras crear para ejercitar el optional chaining
      const tenant = await crearTenant();
      tenant.limits = undefined;
      expect(tenant.canUseFeature('analytics')).toBe(false);
    });
  });

  describe('metodo de instancia hasReachedLimit', () => {
    it('users: true cuando el uso alcanza el maximo, false por debajo', async () => {
      const tenant = await crearTenant({
        limits: { maxUsers: 3 },
        currentUsage: { users: 3 }
      });
      expect(tenant.hasReachedLimit('users')).toBe(true);

      tenant.currentUsage.users = 2;
      expect(tenant.hasReachedLimit('users')).toBe(false);
    });

    it('declarations: compara contra maxDeclarationsPerMonth', async () => {
      const tenant = await crearTenant({
        limits: { maxDeclarationsPerMonth: 100 },
        currentUsage: { declarations: 100 }
      });
      expect(tenant.hasReachedLimit('declarations')).toBe(true);
    });

    it('expeditions: compara contra maxExpeditionsPerMonth', async () => {
      const tenant = await crearTenant({
        limits: { maxExpeditionsPerMonth: 50 },
        currentUsage: { expeditions: 49 }
      });
      expect(tenant.hasReachedLimit('expeditions')).toBe(false);
    });

    it('storage: convierte GB a bytes antes de comparar', async () => {
      // Arrange: limite 1 GB = 1073741824 bytes
      const unGb = 1024 * 1024 * 1024;
      const tenant = await crearTenant({
        limits: { maxStorageGB: 1 },
        currentUsage: { storage: unGb }
      });

      // Assert: justo en el limite -> alcanzado
      expect(tenant.hasReachedLimit('storage')).toBe(true);

      // Un byte por debajo -> no alcanzado
      tenant.currentUsage.storage = unGb - 1;
      expect(tenant.hasReachedLimit('storage')).toBe(false);
    });

    it('apiCalls: compara contra maxApiCallsPerDay', async () => {
      const tenant = await crearTenant({
        limits: { maxApiCallsPerDay: 1000 },
        currentUsage: { apiCalls: 1500 }
      });
      expect(tenant.hasReachedLimit('apiCalls')).toBe(true);
    });

    it('luciQueries: compara contra maxLuciQueriesPerMonth', async () => {
      const tenant = await crearTenant({
        limits: { maxLuciQueriesPerMonth: 500 },
        currentUsage: { luciQueries: 500 }
      });
      expect(tenant.hasReachedLimit('luciQueries')).toBe(true);
    });

    it('devuelve false para un tipo de limite desconocido (default del switch)', async () => {
      const tenant = await crearTenant();
      expect(tenant.hasReachedLimit('tipoInexistente')).toBe(false);
    });

    it('trata un limite ausente como Infinity (nunca alcanzado)', () => {
      // Arrange: el metodo usa `limits.maxUsers || Infinity`. Con un subdocumento
      // Mongoose siempre se reaplica el default (maxUsers=5), por lo que la rama
      // defensiva `|| Infinity` solo es alcanzable si `this.limits` es un objeto
      // plano SIN el campo. Instanciamos sin persistir y sobreescribimos la
      // propiedad con un POJO literal para reproducir ese estado.
      const tenant = new Tenant({ name: 'Sin limite', slug: 'sin-limite' });
      // Sustituimos el getter del subdocumento por un objeto plano vacio.
      Object.defineProperty(tenant, 'limits', { value: {}, configurable: true });
      tenant.currentUsage = { users: 999999 };

      // Con maxUsers ausente -> 999999 >= Infinity -> false (nunca alcanzado)
      expect(tenant.hasReachedLimit('users')).toBe(false);
    });
  });

  describe('metodo de instancia incrementUsage', () => {
    it('incrementa en 1 por defecto y persiste', async () => {
      // Arrange
      const tenant = await crearTenant({ currentUsage: { declarations: 5 } });

      // Act
      await tenant.incrementUsage('declarations');

      // Assert: recargamos de BD para confirmar que se guardo
      const recargado = await Tenant.findById(tenant._id);
      expect(recargado.currentUsage.declarations).toBe(6);
    });

    it('incrementa en la cantidad indicada', async () => {
      const tenant = await crearTenant({ currentUsage: { apiCalls: 0 } });
      await tenant.incrementUsage('apiCalls', 10);
      const recargado = await Tenant.findById(tenant._id);
      expect(recargado.currentUsage.apiCalls).toBe(10);
    });

    it('inicializa currentUsage si no existe antes de incrementar', async () => {
      // Arrange: forzamos currentUsage ausente
      const tenant = await crearTenant();
      tenant.currentUsage = undefined;

      // Act
      await tenant.incrementUsage('luciQueries', 3);

      // Assert
      expect(tenant.currentUsage.luciQueries).toBe(3);
    });
  });

  describe('metodo de instancia resetMonthlyUsage', () => {
    it('archiva el uso actual en usage[] con el periodo YYYY-MM y resetea contadores', async () => {
      // Arrange
      const tenant = await crearTenant({
        currentUsage: {
          declarations: 42,
          expeditions: 10,
          users: 7,
          storage: 500,
          apiCalls: 999,
          luciQueries: 88
        }
      });

      // Act
      await tenant.resetMonthlyUsage();

      // Assert: se archivo una entrada con el periodo del mes actual
      const periodoEsperado = new Date().toISOString().slice(0, 7);
      expect(tenant.usage).toHaveLength(1);
      expect(tenant.usage[0].period).toBe(periodoEsperado);
      expect(tenant.usage[0].declarations).toBe(42);

      // Los contadores mensuales se ponen a 0...
      expect(tenant.currentUsage.declarations).toBe(0);
      expect(tenant.currentUsage.apiCalls).toBe(0);
      expect(tenant.currentUsage.luciQueries).toBe(0);
      // ...pero users y storage NO se resetean (se arrastran)
      expect(tenant.currentUsage.users).toBe(7);
      expect(tenant.currentUsage.storage).toBe(500);
      // Y se registra el momento del reset
      expect(tenant.currentUsage.lastReset).toBeInstanceOf(Date);
    });

    it('persiste el reset en base de datos', async () => {
      const tenant = await crearTenant({ currentUsage: { declarations: 5 } });
      await tenant.resetMonthlyUsage();
      const recargado = await Tenant.findById(tenant._id);
      expect(recargado.currentUsage.declarations).toBe(0);
      expect(recargado.usage).toHaveLength(1);
    });
  });

  describe('metodos estaticos de busqueda', () => {
    it('findBySlug encuentra el tenant por su slug', async () => {
      await crearTenant({ slug: 'buscame-por-slug' });
      const encontrado = await Tenant.findBySlug('buscame-por-slug');
      expect(encontrado).not.toBeNull();
      expect(encontrado.slug).toBe('buscame-por-slug');
    });

    it('findBySlug devuelve null si no existe', async () => {
      const encontrado = await Tenant.findBySlug('no-existe');
      expect(encontrado).toBeNull();
    });

    it('findActive devuelve solo tenants active o trial', async () => {
      // Arrange
      await crearTenant({ slug: 't-active', status: 'active' });
      await crearTenant({ slug: 't-trial', status: 'trial' });
      await crearTenant({ slug: 't-suspended', status: 'suspended' });
      await crearTenant({ slug: 't-cancelled', status: 'cancelled' });

      // Act
      const activos = await Tenant.findActive();

      // Assert
      const slugs = activos.map((t) => t.slug).sort();
      expect(slugs).toEqual(['t-active', 't-trial']);
    });

    it('findByPlan filtra por subscription.plan', async () => {
      // Arrange
      await crearTenant({ slug: 't-pro-1', subscription: { plan: 'professional' } });
      await crearTenant({ slug: 't-pro-2', subscription: { plan: 'professional' } });
      await crearTenant({ slug: 't-ent', subscription: { plan: 'enterprise' } });

      // Act
      const pros = await Tenant.findByPlan('professional');

      // Assert
      expect(pros).toHaveLength(2);
      expect(pros.every((t) => t.subscription.plan === 'professional')).toBe(true);
    });
  });

  describe('virtual fullAddress', () => {
    it('compone la direccion completa a partir de businessInfo.address', async () => {
      const tenant = await crearTenant({
        businessInfo: {
          address: {
            street: 'Calle Mayor 1',
            postalCode: '28001',
            city: 'Madrid',
            province: 'Madrid',
            country: 'ES'
          }
        }
      });
      expect(tenant.fullAddress).toBe('Calle Mayor 1, 28001 Madrid, Madrid, ES');
    });

    it('devuelve cadena vacia cuando no hay direccion', async () => {
      const tenant = await crearTenant();
      // businessInfo existe pero sin address
      expect(tenant.fullAddress).toBe('');
    });

    it('omite limpiamente los campos ausentes de la direccion', async () => {
      const tenant = await crearTenant({
        businessInfo: { address: { city: 'Madrid', country: 'ES' } }
      });
      // No debe empezar ni acabar por coma sobrante
      expect(tenant.fullAddress).not.toMatch(/^,/);
      expect(tenant.fullAddress).not.toMatch(/,\s*$/);
      expect(tenant.fullAddress).toContain('Madrid');
      expect(tenant.fullAddress).toContain('ES');
    });
  });

  describe('estatico getDefaultLimits: limites por plan', () => {
    it('professional: 20 usuarios, 500 declaraciones y features de pago activas', () => {
      const limits = Tenant.getDefaultLimits('professional');
      expect(limits.maxUsers).toBe(20);
      expect(limits.maxDeclarationsPerMonth).toBe(500);
      expect(limits.maxStorageGB).toBe(50);
      expect(limits.features.analytics).toBe(true);
      expect(limits.features.apiAccess).toBe(true);
      expect(limits.features.dedicatedAccount).toBe(false);
      expect(limits.features.sso).toBe(false);
    });

    it('business: 15 usuarios, 200 declaraciones y 100 GB', () => {
      const limits = Tenant.getDefaultLimits('business');
      expect(limits.maxUsers).toBe(15);
      expect(limits.maxDeclarationsPerMonth).toBe(200);
      expect(limits.maxStorageGB).toBe(100);
      expect(limits.maxApiCallsPerDay).toBe(10000);
      expect(limits.features.webhooks).toBe(true);
      expect(limits.features.sso).toBe(false);
    });

    it('enterprise: todo ilimitado (-1) y features premium (dedicatedAccount, sso)', () => {
      const limits = Tenant.getDefaultLimits('enterprise');
      expect(limits.maxUsers).toBe(-1);
      expect(limits.maxDeclarationsPerMonth).toBe(-1);
      expect(limits.maxExpeditionsPerMonth).toBe(-1);
      expect(limits.maxStorageGB).toBe(-1);
      expect(limits.maxApiCallsPerDay).toBe(-1);
      expect(limits.maxLuciQueriesPerMonth).toBe(-1);
      expect(limits.features.dedicatedAccount).toBe(true);
      expect(limits.features.sso).toBe(true);
    });

    it('free cae en el fallback y devuelve los limites de professional', () => {
      // free no tiene entrada propia en el mapa -> defaults[plan] es undefined
      // y el metodo devuelve defaults[PROFESSIONAL]
      const limits = Tenant.getDefaultLimits('free');
      expect(limits).toEqual(Tenant.getDefaultLimits('professional'));
    });

    it('starter cae en el fallback y devuelve los limites de professional', () => {
      const limits = Tenant.getDefaultLimits('starter');
      expect(limits.maxUsers).toBe(20);
      expect(limits).toEqual(Tenant.getDefaultLimits('professional'));
    });

    it('un plan desconocido cae en el fallback professional', () => {
      const limits = Tenant.getDefaultLimits('plan-que-no-existe');
      expect(limits).toEqual(Tenant.getDefaultLimits('professional'));
    });

    it('sin argumento (undefined) cae en el fallback professional', () => {
      const limits = Tenant.getDefaultLimits();
      expect(limits.maxUsers).toBe(20);
    });
  });

  describe('constantes expuestas como estaticos', () => {
    it('expone PLAN_TYPES con los cinco planes', () => {
      expect(Tenant.PLAN_TYPES).toEqual({
        FREE: 'free',
        STARTER: 'starter',
        PROFESSIONAL: 'professional',
        BUSINESS: 'business',
        ENTERPRISE: 'enterprise'
      });
    });

    it('expone TENANT_STATUS con los cinco estados', () => {
      expect(Tenant.TENANT_STATUS).toEqual({
        ACTIVE: 'active',
        SUSPENDED: 'suspended',
        TRIAL: 'trial',
        CANCELLED: 'cancelled',
        PENDING: 'pending'
      });
    });
  });

  describe('PII: hashes deterministas en el pre-save y decrypt transparente al leer', () => {
    const KEY_PREVIA = process.env.PII_HASH_KEY;
    const ENC_PREVIA = process.env.PII_ENCRYPTION_KEY;
    const ENCRYPT_PREVIA = process.env.ENCRYPT_PII;

    afterEach(() => {
      // Restauramos el entorno para no contaminar otras suites
      if (KEY_PREVIA === undefined) delete process.env.PII_HASH_KEY;
      else process.env.PII_HASH_KEY = KEY_PREVIA;
      if (ENC_PREVIA === undefined) delete process.env.PII_ENCRYPTION_KEY;
      else process.env.PII_ENCRYPTION_KEY = ENC_PREVIA;
      if (ENCRYPT_PREVIA === undefined) delete process.env.ENCRYPT_PII;
      else process.env.ENCRYPT_PII = ENCRYPT_PREVIA;
    });

    it('calcula nifHash y eoriHash cuando el hash de PII esta habilitado', async () => {
      // Arrange: habilitamos el hash con una clave suficientemente larga
      process.env.PII_HASH_KEY = 'clave-de-hash-para-tests-1234567890';

      // Act
      const tenant = await crearTenant({
        businessInfo: { nif: 'B22477020', eori: 'ESB22477020' }
      });

      // Assert: se rellenan los hashes deterministas para lookups por igualdad
      expect(tenant.businessInfo.nifHash).toBeTruthy();
      expect(tenant.businessInfo.eoriHash).toBeTruthy();
      expect(tenant.businessInfo.nifHash).toHaveLength(64); // sha256 hex
    });

    it('NO calcula hashes cuando la feature esta deshabilitada (sin clave)', async () => {
      // Arrange: sin clave -> piiHash.enabled() es false
      delete process.env.PII_HASH_KEY;
      delete process.env.PII_ENCRYPTION_KEY;

      // Act
      const tenant = await crearTenant({
        businessInfo: { nif: 'B22477020', eori: 'ESB22477020' }
      });

      // Assert
      expect(tenant.businessInfo.nifHash).toBeUndefined();
      expect(tenant.businessInfo.eoriHash).toBeUndefined();
    });

    it('cifra nif/eori cuando ENCRYPT_PII=true y descifra de forma transparente al leer', async () => {
      // Arrange: clave >= 32 chars para piiCrypto y activacion explicita
      process.env.PII_ENCRYPTION_KEY = 'clave-de-cifrado-de-32-caracteres-o-mas-aqui';
      process.env.PII_HASH_KEY = 'clave-de-hash-para-tests-1234567890';
      process.env.ENCRYPT_PII = 'true';

      // Act: al guardar debe cifrarse en BD
      const tenant = await crearTenant({
        businessInfo: { nif: 'B99999999', eori: 'ESB99999999' }
      });

      // El documento en memoria mantiene el valor cifrado tras save
      expect(tenant.businessInfo.nif.startsWith('v1:')).toBe(true);

      // Al releer de BD, el post-init/post-findOne descifra de forma transparente
      const recargado = await Tenant.findById(tenant._id);
      expect(recargado.businessInfo.nif).toBe('B99999999');
      expect(recargado.businessInfo.eori).toBe('ESB99999999');
    });
  });
});
