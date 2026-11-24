import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, createBuyer, createExternalSellerItem, resetDatabase } from '../helpers/db.js';

let app: ReturnType<typeof createApp>;

function validShipping() {
  return {
    name: 'Comprador Prueba',
    email: 'comprador@test.cr',
    phone: '88888888',
    provincia: 'San José',
    canton: 'San José',
    distrito: 'Carmen',
    direccion: 'Calle Central 123',
  };
}

function validPayment(amount: number) {
  return {
    cardNumber: '4916911234567890',
    expirationDate: '12/30',
    cvc: '123',
    currency: 'CRC',
    amount,
  };
}

beforeEach(async () => {
  await resetDatabase();
  app = createApp();
});

afterAll(closePool);

describe('checkout HU-09 y HU-10', () => {
  it('calcula el resumen sin crear una orden', async () => {
    await createBuyer();
    const external = await createExternalSellerItem(500, 3);

    const response = await request(app)
      .post('/api/checkout/preview')
      .send({
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      step: 'summary',
      subtotal: 500,
      tax: 65,
      total: 565,
      currency: 'CRC',
    });
  });

  it('rechaza el resumen con datos incompletos', async () => {
    const response = await request(app).post('/api/checkout/preview').send({
      items: [],
      shipping: {},
    });
    expect(response.status).toBe(400);
  });

  it('rechaza una moneda no soportada en el resumen', async () => {
    const external = await createExternalSellerItem(200, 2);
    const response = await request(app)
      .post('/api/checkout/preview')
      .send({
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: { ...validShipping(), currency: 'EUR' },
      });
    expect(response.status).toBe(400);
  });

  it('rechaza checkout con buyerId inválido', async () => {
    const external = await createExternalSellerItem(200, 2);
    const response = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-invalid-buyer')
      .send({
        buyerId: 'abc',
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: validPayment(226),
      });
    expect(response.status).toBe(400);
  });

  it('rechaza checkout sin datos de pago', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(200, 2);
    const response = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-no-payment')
      .send({
        buyerId,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
      });
    expect(response.status).toBe(400);
  });

  it('calcula el resumen con moneda USD y buyerId en la ruta', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(200, 2);

    const response = await request(app)
      .post(`/api/checkouts/${buyerId}/preview`)
      .send({
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: { ...validShipping(), currency: 'USD' },
      });

    expect(response.status).toBe(200);
    expect(response.body.currency).toBe('USD');
  });

  it('rechaza stock insuficiente', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(500, 1);

    const response = await request(app)
      .post(`/api/checkouts/${buyerId}/complete`)
      .set('Idempotency-Key', 'checkout-stock')
      .send({
        items: [{ itemId: external.itemId, quantity: 2 }],
        shipping: validShipping(),
        payment: validPayment(1130),
      });

    expect(response.status).toBe(409);
  });

  it('rechaza un pago inválido sin crear una orden', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(500, 3);

    const response = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-payment')
      .send({
        buyerId,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: {
          ...validPayment(565),
          cardNumber: '0000001234567890',
        },
      });

    expect(response.status).toBe(400);
  });

  it('rechaza un monto distinto al total', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(500, 3);

    const response = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-amount')
      .send({
        buyerId,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: validPayment(1),
      });

    expect(response.status).toBe(400);
  });

  it('crea una orden, descuenta stock y registra comisión', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(500, 3);

    const first = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-success')
      .send({
        buyerId,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: validPayment(565),
      });

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      approved: true,
      status: 'paid',
      subtotal: 500,
      tax: 65,
      total: 565,
      currency: 'CRC',
    });
    expect(first.body.orderCode).toMatch(/^LO-[A-F0-9]{8}$/);
    expect(first.body.commissions).toEqual([
      { sellerId: external.sellerId, commissionRate: 0.1, commissionAmount: 50 },
    ]);

    const repeated = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-success')
      .send({
        buyerId,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: validPayment(565),
      });

    expect(repeated.status).toBe(200);
    expect(repeated.body.idempotent).toBe(true);
  });

  it('rechaza checkout sin llave de idempotencia', async () => {
    const buyerId = await createBuyer();
    const external = await createExternalSellerItem(500, 3);

    const response = await request(app)
      .post('/api/checkout/complete')
      .send({
        buyerId,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: validPayment(565),
      });

    expect(response.status).toBe(400);
  });

  it('rechaza checkout sin comprador existente', async () => {
    const external = await createExternalSellerItem(500, 3);

    const response = await request(app)
      .post('/api/checkout/complete')
      .set('Idempotency-Key', 'checkout-buyer')
      .send({
        buyerId: 999,
        items: [{ itemId: external.itemId, quantity: 1 }],
        shipping: validShipping(),
        payment: validPayment(565),
      });

    expect(response.status).toBe(404);
  });
});
