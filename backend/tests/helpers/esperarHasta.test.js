const { esperarHasta } = require('./esperarHasta');

describe('esperarHasta', () => {
  it('devuelve el valor en cuanto la lectura coincide con lo esperado', async () => {
    const leer = jest.fn().mockResolvedValue(11);

    const valor = await esperarHasta(leer, 11);

    expect(valor).toBe(11);
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it('reintenta hasta ver el valor esperado', async () => {
    const leer = jest
      .fn()
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11);

    const valor = await esperarHasta(leer, 11, { intervalMs: 5 });

    expect(valor).toBe(11);
    expect(leer).toHaveBeenCalledTimes(3);
  });

  it('lanza un error claro al agotar el tiempo, con lo esperado y el último valor', async () => {
    const leer = jest.fn().mockResolvedValue(10);

    await expect(
      esperarHasta(leer, 11, { timeoutMs: 60, intervalMs: 10, descripcion: 'currentUsage.declarations' })
    ).rejects.toThrow(/currentUsage\.declarations.*esperado 11.*10/s);
  });

  it('el error de tiempo agotado menciona el límite en ms', async () => {
    const leer = jest.fn().mockResolvedValue(0);

    await expect(esperarHasta(leer, 1, { timeoutMs: 40, intervalMs: 10 })).rejects.toThrow(/40 ms/);
  });

  it('no sigue sondeando una vez agotado el tiempo', async () => {
    const leer = jest.fn().mockResolvedValue(0);

    await esperarHasta(leer, 1, { timeoutMs: 50, intervalMs: 10 }).catch(() => {});
    const llamadas = leer.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(leer.mock.calls.length).toBe(llamadas);
  });

  it('propaga el error si la lectura falla', async () => {
    const leer = jest.fn().mockRejectedValue(new Error('conexión perdida'));

    await expect(esperarHasta(leer, 11)).rejects.toThrow('conexión perdida');
  });

  it('por defecto espera unos 2 s con sondeo cada 50 ms', async () => {
    const leer = jest.fn().mockResolvedValue(0);
    const inicio = Date.now();

    await expect(esperarHasta(leer, 1)).rejects.toThrow(/2000 ms/);

    const transcurrido = Date.now() - inicio;
    expect(transcurrido).toBeGreaterThanOrEqual(1900);
    expect(transcurrido).toBeLessThan(3500);
    expect(leer.mock.calls.length).toBeGreaterThan(10);
  });
});
