import { describe, expect, it, vi } from 'vitest';
import { createReservationApi, ReservationApiError } from '../src/services/reservationApi';

describe('cliente HTTP del frontend', () => {
  it('usa las rutas y payloads del backend para login, catálogo, carrito y reserva', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const path = new URL(url).pathname;
      const body = path === '/api/auth/login'
        ? { id: 4, name: 'Ana', sessionToken: 'session-ana' }
        : path === '/api/items'
          ? [{ id: 8, title: 'Reloj', price: '150000.00', status: 'available', reservedUntil: null }]
          : path === '/api/carts/4'
            ? [{ itemId: 8, buyerId: 4, title: 'Reloj', price: '150000.00', reservedUntil: '2026-11-25T12:00:00.000Z' }]
            : { itemId: 8, buyerId: 4, reservedUntil: '2026-11-25T12:00:00.000Z' };
      const status = path === '/api/carts/4/items' && init?.method === 'POST' ? 201
        : path === '/api/auth/logout' ? 204
        : path === '/api/carts/4/items/8' ? 204 : 200;
      return status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status });
    });
    const api = createReservationApi('http://localhost:3000/api/', fetchMock as unknown as typeof fetch);

    const loggedInBuyer = { id: 4, name: 'Ana', sessionToken: 'session-ana' };
    await expect(api.login('Ana')).resolves.toEqual(loggedInBuyer);
    await expect(api.logout(loggedInBuyer)).resolves.toBeUndefined();
    await expect(api.listItems()).resolves.toHaveLength(1);
    await expect(api.getCart(4)).resolves.toHaveLength(1);
    await expect(api.reserveItem(4, 8)).resolves.toMatchObject({ itemId: 8, buyerId: 4 });
    await expect(api.cancelReservation(4, 8)).resolves.toBeUndefined();

    expect(calls.map(({ url }) => new URL(url).pathname)).toEqual([
      '/api/auth/login', '/api/auth/logout', '/api/items', '/api/carts/4', '/api/carts/4/items', '/api/carts/4/items/8',
    ]);
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ name: 'Ana' });
    expect(JSON.parse(calls[1].init?.body as string)).toEqual({ buyerId: 4, sessionToken: 'session-ana' });
    expect(JSON.parse(calls[4].init?.body as string)).toEqual({ itemId: 8 });
    expect(calls[0].init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('conserva el mensaje de error que envía el backend', async () => {
    const api = createReservationApi('http://backend/api', (async () => new Response(JSON.stringify({
      message: 'La pieza no está disponible',
    }), { status: 409 })) as typeof fetch);
    await expect(api.reserveItem(4, 8)).rejects.toMatchObject({
      status: 409,
      message: 'La pieza no está disponible',
    });
  });

  it('usa un error HTTP genérico si la respuesta no tiene JSON o mensaje', async () => {
    const noJson = createReservationApi('http://backend/api', (async () => new Response('oops', { status: 503 })) as typeof fetch);
    await expect(noJson.listItems()).rejects.toMatchObject({ status: 503, message: 'Error HTTP 503' });

    const noMessage = createReservationApi('http://backend/api', (async () => new Response('{}', { status: 500 })) as typeof fetch);
    await expect(noMessage.getCart(4)).rejects.toMatchObject({ status: 500, message: 'Error HTTP 500' });
  });

  it('traduce errores de red y expone la clase específica', async () => {
    const api = createReservationApi('http://backend/api', (() => Promise.reject(new Error('offline'))) as typeof fetch);
    const pending = api.reserveItem(4, 8);
    await expect(pending).rejects.toBeInstanceOf(ReservationApiError);
    await expect(pending).rejects.toMatchObject({ status: 0, message: 'No se pudo conectar con el backend.' });
  });

  it('acepta el URL base predeterminado y normaliza solo una barra final', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    const api = createReservationApi(undefined, fetchMock as unknown as typeof fetch);
    await api.listItems();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/items', expect.anything());
  });
});
