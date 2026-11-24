import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCheckoutApi } from '../src/services/checkout-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkout API', () => {
  it('envía el resumen al endpoint de preview', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        step: 'summary',
        subtotal: 500,
        tax: 65,
        total: 565,
        currency: 'CRC',
        items: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createCheckoutApi('http://api.test');

    const result = await api.preview([{ itemId: 12, quantity: 1 }]);

    expect(result.total).toBe(565);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/checkout/preview',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('envía el pago con Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        approved: true,
        orderCode: 'LO-1234ABCD',
        status: 'paid',
        total: 565,
        currency: 'CRC',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createCheckoutApi('http://api.test');

    const result = await api.complete({
      buyerId: 3,
      items: [{ itemId: 12, quantity: 1 }],
      shipping: {
        name: 'Ana',
        email: 'ana@test.cr',
        phone: '8888',
        provincia: 'San José',
        canton: 'San José',
        distrito: 'Carmen',
        direccion: 'Calle 1',
        currency: 'CRC',
      },
      payment: {
        cardNumber: '4916911234567890',
        expirationDate: '12/30',
        cvc: '123',
        currency: 'CRC',
        amount: 565,
      },
    });

    expect(result.orderCode).toBe('LO-1234ABCD');
    const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(options.headers['Idempotency-Key']).toBeTruthy();
  });

  it('propaga el mensaje del backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: 'Stock insuficiente' }),
      }),
    );
    const api = createCheckoutApi('http://api.test');

    await expect(api.preview([{ itemId: 12, quantity: 2 }])).rejects.toThrow('Stock insuficiente');
  });

  it('usa mensajes de respaldo ante respuestas inválidas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('JSON inválido')),
      }),
    );
    const api = createCheckoutApi('http://api.test');
    await expect(api.preview([{ itemId: 12, quantity: 1 }])).rejects.toThrow(
      'No se pudo calcular el resumen',
    );
  });

  it('usa el respaldo de pago ante respuestas sin mensaje', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      }),
    );
    const api = createCheckoutApi('http://api.test');
    await expect(
      api.complete({
        buyerId: 3,
        items: [{ itemId: 12, quantity: 1 }],
        shipping: {
          name: 'Ana',
          email: 'ana@test.cr',
          phone: '8888',
          provincia: 'San José',
          canton: 'San José',
          distrito: 'Carmen',
          direccion: 'Calle 1',
          currency: 'CRC',
        },
        payment: {
          cardNumber: '4916911234567890',
          expirationDate: '12/30',
          cvc: '123',
          currency: 'CRC',
          amount: 565,
        },
      }),
    ).rejects.toThrow('No se pudo completar el pago');
  });
});
