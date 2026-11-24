import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  closePool,
  createBuyer,
  createItem,
  findReservation,
  resetDatabase,
} from '../helpers/db.js';
import { FakeClock } from '../helpers/fake-clock.js';

const START = new Date('2026-11-24T16:00:00.000Z');
let app: ReturnType<typeof createApp>;
let clock: FakeClock;

beforeEach(async () => {
  await resetDatabase();
  clock = new FakeClock(START);
  app = createApp({ clock });
});

afterAll(closePool);

describe('API para el frontend', () => {
  it('permite ingresar por nombre y reporta usuarios inexistentes o nombres ambiguos', async () => {
    const anaId = await createBuyer('Ana');
    const login = await request(app).post('/api/auth/login').send({ name: ' ana ' });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ id: anaId, name: 'Ana' });
    expect(login.body.sessionToken).toEqual(expect.any(String));

    await createBuyer('Ana');
    const ambiguous = await request(app).post('/api/auth/login').send({ name: 'Ana' });
    expect(ambiguous.status).toBe(409);

    const missing = await request(app).post('/api/auth/login').send({ name: 'No existe' });
    expect(missing.status).toBe(404);
    const invalid = await request(app).post('/api/auth/login').send({ name: '   ' });
    expect(invalid.status).toBe(400);
  });

  it('mantiene una sola sesión por comprador y no permite que un token viejo cierre la nueva', async () => {
    const buyerId = await createBuyer('Sesión Única');
    const login = () => request(app).post('/api/auth/login').send({ name: 'Sesión Única' });
    const first = await login();
    expect(first.status).toBe(200);
    const duplicate = await login();
    expect(duplicate.status).toBe(409);

    const loggedOut = await request(app).post('/api/auth/logout').send({
      buyerId,
      sessionToken: first.body.sessionToken,
    });
    expect(loggedOut.status).toBe(204);

    const second = await login();
    expect(second.status).toBe(200);
    expect(second.body.sessionToken).not.toBe(first.body.sessionToken);
    const staleLogout = await request(app).post('/api/auth/logout').send({
      buyerId,
      sessionToken: first.body.sessionToken,
    });
    expect(staleLogout.status).toBe(409);
    expect((await login()).status).toBe(409);

    expect(
      (
        await request(app).post('/api/auth/logout').send({
          buyerId,
          sessionToken: second.body.sessionToken,
        })
      ).status,
    ).toBe(204);
    expect((await login()).status).toBe(200);
  });

  it('lista artículos con nombre y estado sin exponer quién los reservó', async () => {
    const buyerId = await createBuyer('Comprador');
    const reservedItemId = await createItem('available');
    const availableItemId = await createItem('available');
    await request(app).post(`/api/carts/${buyerId}/items`).send({ itemId: reservedItemId });

    const response = await request(app).get('/api/items');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reservedItemId,
          status: 'reserved',
          title: 'Reloj de bolsillo',
        }),
        expect.objectContaining({ id: availableItemId, status: 'available' }),
      ]),
    );
    expect(response.body[0]).not.toHaveProperty('reserved_by');
    expect(response.body[0]).not.toHaveProperty('reservedBy');
  });

  it('recupera todas las reservas activas del comprador que inició sesión', async () => {
    const buyerId = await createBuyer('Ana');
    const otherBuyerId = await createBuyer('Luis');
    const firstItemId = await createItem('available');
    const secondItemId = await createItem('available');
    const otherItemId = await createItem('available');
    await request(app).post(`/api/carts/${buyerId}/items`).send({ itemId: firstItemId });
    await request(app).post(`/api/carts/${buyerId}/items`).send({ itemId: secondItemId });
    await request(app).post(`/api/carts/${otherBuyerId}/items`).send({ itemId: otherItemId });

    const response = await request(app).get(`/api/carts/${buyerId}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((item: { itemId: number }) => item.itemId)).toEqual([
      firstItemId,
      secondItemId,
    ]);
    expect(response.body[0]).toHaveProperty('title');
    expect(response.body[0]).not.toHaveProperty('reservedBy');

    const missing = await request(app).get('/api/carts/999');
    expect(missing.status).toBe(404);
    const invalid = await request(app).get('/api/carts/not-a-number');
    expect(invalid.status).toBe(400);

    clock.advance(16);
    const expired = await request(app).get(`/api/carts/${buyerId}`);
    expect(expired.body).toEqual([]);
    expect((await findReservation(firstItemId)).reserved_by).toBe(buyerId);
  });

  it('cancela una reserva propia, libera el artículo y protege reservas ajenas', async () => {
    const buyerId = await createBuyer('Ana');
    const otherBuyerId = await createBuyer('Luis');
    const itemId = await createItem('available');
    await request(app).post(`/api/carts/${buyerId}/items`).send({ itemId });

    const cancelled = await request(app).delete(`/api/carts/${buyerId}/items/${itemId}`);
    expect(cancelled.status).toBe(204);
    expect(await findReservation(itemId)).toEqual({ reserved_by: null, reserved_until: null });

    const available = await request(app).post(`/api/carts/${otherBuyerId}/items`).send({ itemId });
    expect(available.status).toBe(201);
    const forbidden = await request(app).delete(`/api/carts/${buyerId}/items/${itemId}`);
    expect(forbidden.status).toBe(403);
    const missing = await request(app).delete(`/api/carts/${otherBuyerId}/items/999`);
    expect(missing.status).toBe(404);

    clock.advance(16);
    const expired = await request(app).delete(`/api/carts/${otherBuyerId}/items/${itemId}`);
    expect(expired.status).toBe(410);
    const invalid = await request(app).delete(`/api/carts/nope/items/${itemId}`);
    expect(invalid.status).toBe(400);
  });
});
