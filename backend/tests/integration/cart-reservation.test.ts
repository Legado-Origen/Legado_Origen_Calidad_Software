import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  closePool,
  createBuyer,
  createItem,
  findReservation,
  resetDatabase,
  type ItemStatus,
} from '../helpers/db.js';
import { FakeClock } from '../helpers/fake-clock.js';

const START = new Date('2026-11-24T16:00:00.000Z');
const FIFTEEN_MINUTES_LATER = '2026-11-24T16:15:00.000Z';

let clock: FakeClock;
let app: ReturnType<typeof createApp>;

function reserve(buyerId: number | string, body: unknown) {
  return request(app)
    .post(`/api/carts/${buyerId}/items`)
    .send(body as object);
}

beforeEach(async () => {
  await resetDatabase();
  clock = new FakeClock(START);
  app = createApp({ clock });
});

afterAll(closePool);

describe('POST /api/carts/:buyerId/items (HU-08)', () => {
  it('CP-01: reserva una pieza disponible por 15 minutos', async () => {
    const buyerId = await createBuyer();
    const itemId = await createItem('available');

    const response = await reserve(buyerId, { itemId });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ itemId, buyerId, reservedUntil: FIFTEEN_MINUTES_LATER });
    const stored = await findReservation(itemId);
    expect(stored.reserved_by).toBe(buyerId);
    expect(stored.reserved_until?.toISOString()).toBe(FIFTEEN_MINUTES_LATER);
  });

  it('CP-02: rechaza la reserva de una pieza reservada por otro comprador', async () => {
    const firstBuyer = await createBuyer('Ana');
    const secondBuyer = await createBuyer('Luis');
    const itemId = await createItem('available');
    await reserve(firstBuyer, { itemId });

    const response = await reserve(secondBuyer, { itemId });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'La pieza no está disponible' });
    expect((await findReservation(itemId)).reserved_by).toBe(firstBuyer);
  });

  describe('CP-03: libera la reserva al cumplirse los 15 minutos', () => {
    it.each([
      { label: '14:59', minutes: 14, seconds: 59, expectedStatus: 409 },
      { label: '15:00', minutes: 15, seconds: 0, expectedStatus: 201 },
      { label: '15:01', minutes: 15, seconds: 60, expectedStatus: 201 },
    ])(
      'a los $label minutos otro comprador obtiene $expectedStatus',
      async ({ minutes, seconds, expectedStatus }) => {
        const firstBuyer = await createBuyer('Ana');
        const secondBuyer = await createBuyer('Luis');
        const itemId = await createItem('available');
        await reserve(firstBuyer, { itemId });

        clock.advance(minutes, seconds);
        const response = await reserve(secondBuyer, { itemId });

        expect(response.status).toBe(expectedStatus);
      },
    );
  });

  it('CP-04: entre diez solicitudes simultáneas solo una reserva la pieza', async () => {
    const itemId = await createItem('available');
    const buyers = await Promise.all(
      Array.from({ length: 10 }, (_, index) => createBuyer(`Comprador ${index}`)),
    );

    const responses = await Promise.all(buyers.map((buyerId) => reserve(buyerId, { itemId })));
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(9);
  });

  it.each<ItemStatus>(['sold', 'pending_approval', 'rejected'])(
    'CP-05: rechaza una pieza con estado %s',
    async (status) => {
      const buyerId = await createBuyer();
      const itemId = await createItem(status);

      const response = await reserve(buyerId, { itemId });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: 'La pieza no está disponible' });
    },
  );

  it('CP-06: mantiene la reserva vigente del mismo comprador sin extenderla', async () => {
    const buyerId = await createBuyer();
    const itemId = await createItem('available');
    await reserve(buyerId, { itemId });

    clock.advance(5);
    const response = await reserve(buyerId, { itemId });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ itemId, buyerId, reservedUntil: FIFTEEN_MINUTES_LATER });
  });

  it('crea una nueva reserva si la del mismo comprador ya venció', async () => {
    const buyerId = await createBuyer();
    const itemId = await createItem('available');
    await reserve(buyerId, { itemId });

    clock.advance(20);
    const response = await reserve(buyerId, { itemId });

    expect(response.status).toBe(201);
    expect(response.body.reservedUntil).toBe('2026-11-24T16:35:00.000Z');
  });

  describe('validación de la entrada', () => {
    it.each(['abc', '0', '-1', '1.5', '2147483648'])(
      'responde 400 si buyerId es %s',
      async (buyerId) => {
        const itemId = await createItem('available');

        const response = await reserve(buyerId, { itemId });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'Solicitud inválida' });
      },
    );

    it.each([
      { label: 'ausente', body: {} },
      { label: 'cero', body: { itemId: 0 } },
      { label: 'decimal', body: { itemId: 1.5 } },
      { label: 'texto', body: { itemId: '12' } },
      { label: 'fuera de rango', body: { itemId: 2_147_483_648 } },
    ])('responde 400 si itemId es $label', async ({ body }) => {
      const buyerId = await createBuyer();

      const response = await reserve(buyerId, body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Solicitud inválida' });
    });

    it('responde 400 si el cuerpo no es JSON válido', async () => {
      const buyerId = await createBuyer();

      const response = await request(app)
        .post(`/api/carts/${buyerId}/items`)
        .set('Content-Type', 'application/json')
        .send('{"itemId":');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Solicitud inválida' });
    });
  });

  describe('recursos inexistentes', () => {
    it('responde 404 si el comprador no existe', async () => {
      const itemId = await createItem('available');

      const response = await reserve(999, { itemId });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Recurso no encontrado' });
    });

    it('responde 404 si la pieza no existe', async () => {
      const buyerId = await createBuyer();

      const response = await reserve(buyerId, { itemId: 999 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Recurso no encontrado' });
    });
  });
});
