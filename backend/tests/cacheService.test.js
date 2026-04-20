describe('cacheService', () => {
  let cache;
  beforeEach(() => {
    jest.resetModules();
    const { getCache } = require('../src/services/cacheService');
    cache = getCache();
    return cache.flushAll();
  });

  test('stores and retrieves a value', async () => {
    await cache.set('k1', { foo: 'bar' });
    expect(await cache.get('k1')).toEqual({ foo: 'bar' });
  });

  test('returns null for missing key', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  test('respects TTL', async () => {
    await cache.set('k2', 'v', 0.05); // 50ms
    expect(await cache.get('k2')).toBe('v');
    await new Promise(r => setTimeout(r, 80));
    expect(await cache.get('k2')).toBeNull();
  });

  test('del removes a key', async () => {
    await cache.set('k3', 'v');
    await cache.del('k3');
    expect(await cache.get('k3')).toBeNull();
  });

  test('delPattern removes keys by prefix', async () => {
    await cache.set('user:1', 'a');
    await cache.set('user:2', 'b');
    await cache.set('tenant:1', 'c');
    await cache.delPattern('user:');
    expect(await cache.get('user:1')).toBeNull();
    expect(await cache.get('user:2')).toBeNull();
    expect(await cache.get('tenant:1')).toBe('c');
  });
});
