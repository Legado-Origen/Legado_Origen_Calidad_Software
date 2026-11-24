import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCheckoutRouter } from '../../src/modules/checkout/checkout-routes.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { pool } from '../../src/db/pool.js';
import { closePool, createBuyer, resetDatabase } from '../helpers/db.js';

const app = express();
app.use(express.json());
app.use('/api/checkout', createCheckoutRouter(pool, 0.1));
app.use(errorHandler);

const shipping = {
  name: 'Ana Compradora',
  email: 'ana@example.test',
  phone: '88887777',
  provincia: 'San José',
  canton: 'Central',
  distrito: 'Carmen',
  direccion: 'Avenida Central',
};

const validPayment = {
  cardNumber: '4916911234567890',
  expirationDate: '12/99',
  cvc: '123',
  currency: 'CRC',
  amount: 113,
};

async function createStockItem({
  price = 100,
  stock = 2,
  status = 'available',
  sellerId = null,
}: {
  price?: number;
  stock?: number;
  status?: string;
  sellerId?: number | null;
} = {}) {
  const result = await pool.query<{ id: number }>(
    'INSERT INTO items (title, price, stock, status, seller_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    ['Test item', price, stock, status, sellerId],
  );
  return result.rows[0].id;
}

function complete(body: object, key = 'checkout-test-key') {
  return request(app).post('/api/checkout/complete').set('Idempotency-Key', key).send(body);
}

function validCheckout(buyerId: number, itemId: number, overrides: Record<string, unknown> = {}) {
  return {
    buyerId,
    items: [{ itemId, quantity: 1 }],
    shipping,
    payment: validPayment,
    ...overrides,
  };
}

beforeEach(resetDatabase);
afterAll(closePool);

describe('POST /api/checkout/preview', () => {
  it('rejects malformed item lists and unsupported currencies', async () => {
    for (const items of [
      undefined,
      'not an array',
      [],
      [null],
      [{}],
      [{ itemId: 0, quantity: 1 }],
      [{ itemId: 1.5, quantity: 1 }],
      [{ itemId: 1, quantity: 0 }],
      [{ itemId: 1, quantity: 1.5 }],
    ]) {
      const response = await request(app).post('/api/checkout/preview').send({ items });
      expect(response.status).toBe(400);
    }

    const invalidCurrency = await request(app)
      .post('/api/checkout/preview')
      .send({ items: [{ itemId: 1, quantity: 1 }], shipping: { currency: 'EUR' } });
    expect(invalidCurrency.status).toBe(400);
  });

  it('checks item existence and stock, then returns a summary without committing', async () => {
    const availableId = await createStockItem({ price: 100, stock: 3 });
    const unavailableId = await createStockItem({ status: 'pending_approval' });

    const missing = await request(app)
      .post('/api/checkout/preview')
      .send({ items: [{ itemId: 999, quantity: 1 }] });
    expect(missing.status).toBe(404);

    const unavailable = await request(app)
      .post('/api/checkout/preview')
      .send({ items: [{ itemId: unavailableId, quantity: 1 }] });
    expect(unavailable.status).toBe(409);

    const insufficient = await request(app)
      .post('/api/checkout/preview')
      .send({ items: [{ itemId: availableId, quantity: 4 }] });
    expect(insufficient.status).toBe(409);

    const preview = await request(app)
      .post('/api/checkout/preview')
      .send({
        items: [{ itemId: availableId, quantity: 2 }],
        shipping: { currency: 'usd' },
      });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({
      step: 'summary',
      subtotal: 200,
      tax: 26,
      total: 226,
      currency: 'USD',
      items: [{ itemId: availableId, title: 'Test item', price: 100, quantity: 2 }],
    });
    const item = await pool.query('SELECT stock FROM items WHERE id=$1', [availableId]);
    expect(item.rows[0].stock).toBe(3);
  });
});

describe('POST /api/checkout/complete', () => {
  it('validates the request before starting checkout', async () => {
    const buyerId = await createBuyer();
    const itemId = await createStockItem();

    expect((await complete(validCheckout(buyerId, itemId, { items: [] }))).status).toBe(400);
    expect((await complete(validCheckout(buyerId, itemId, { shipping: null }))).status).toBe(400);
    expect((await complete(validCheckout(Number.MAX_SAFE_INTEGER + 1, itemId))).status).toBe(400);
    expect(
      (await request(app).post('/api/checkout/complete').send(validCheckout(buyerId, itemId)))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/checkout/complete')
          .set('Idempotency-Key', '   ')
          .send(validCheckout(buyerId, itemId))
      ).status,
    ).toBe(400);
  });

  it('rejects missing buyers, missing items, and unavailable stock', async () => {
    const buyerId = await createBuyer();

    expect((await complete(validCheckout(999, 999))).status).toBe(404);
    expect((await complete(validCheckout(buyerId, 999))).status).toBe(404);

    const unavailableId = await createStockItem({ status: 'sold' });
    expect((await complete(validCheckout(buyerId, unavailableId))).status).toBe(409);

    const insufficientId = await createStockItem({ stock: 0 });
    expect((await complete(validCheckout(buyerId, insufficientId))).status).toBe(409);
  });

  it('records declined payments and rejects totals that do not match', async () => {
    const buyerId = await createBuyer();
    const itemId = await createStockItem();

    const declined = await complete(
      validCheckout(buyerId, itemId, {
        payment: { ...validPayment, cardNumber: 'bad' },
      }),
      'declined-payment',
    );
    expect(declined.status).toBe(400);
    expect(declined.body.message).toBe('Número de tarjeta inválido');
    const declinedTransactions = await pool.query(
      'SELECT approved, card_bin, card_last4 FROM payment_transactions',
    );
    expect(declinedTransactions.rows).toEqual([
      { approved: false, card_bin: 'bad', card_last4: 'bad' },
    ]);

    const mismatched = await complete(
      validCheckout(buyerId, itemId, {
        payment: { ...validPayment, amount: 1 },
      }),
      'mismatched-total',
    );
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.message).toBe('El monto del pago no coincide con el total');
    const orders = await pool.query('SELECT id FROM orders');
    expect(orders.rows).toEqual([]);
  });

  it('creates an order, updates stock, records commissions, and supports idempotent retries', async () => {
    const buyerId = await createBuyer('Buyer');
    const sellerId = await createBuyer('Seller');
    const soldItemId = await createStockItem({ price: 100, stock: 1, sellerId });
    const remainingItemId = await createStockItem({ price: 50, stock: 3, sellerId });
    const platformItemId = await createStockItem({ price: 25, stock: 2 });
    const payload = {
      buyerId,
      items: [
        { itemId: soldItemId, quantity: 1 },
        { itemId: remainingItemId, quantity: 2 },
        { itemId: platformItemId, quantity: 1 },
      ],
      shipping,
      payment: { ...validPayment, amount: 254.25, currency: 'usd' },
    };

    const response = await complete(payload, 'successful-checkout');
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      approved: true,
      status: 'paid',
      subtotal: 225,
      tax: 29.25,
      total: 254.25,
      currency: 'USD',
      confirmation: { step: 'confirmation', deliveryEmail: shipping.email },
      commissions: [{ sellerId, commissionRate: 0.1, commissionAmount: 20 }],
    });
    expect(response.body.orderCode).toMatch(/^LO-[A-F0-9]{8}$/);

    const stock = await pool.query('SELECT id, stock, status FROM items ORDER BY id');
    expect(stock.rows).toEqual([
      { id: soldItemId, stock: 0, status: 'sold' },
      { id: remainingItemId, stock: 1, status: 'available' },
      { id: platformItemId, stock: 1, status: 'available' },
    ]);
    const relatedRecords = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM orders) AS orders,
         (SELECT count(*)::int FROM order_items) AS order_items,
         (SELECT count(*)::int FROM platform_commissions) AS commissions,
         (SELECT count(*)::int FROM payment_transactions WHERE approved) AS approved_payments,
         (SELECT count(*)::int FROM email_notifications) AS notifications,
         (SELECT count(*)::int FROM checkout_sessions) AS sessions`,
    );
    expect(relatedRecords.rows[0]).toEqual({
      orders: 1,
      order_items: 3,
      commissions: 1,
      approved_payments: 1,
      notifications: 1,
      sessions: 1,
    });

    const retry = await complete(payload, 'successful-checkout');
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({
      idempotent: true,
      orderCode: response.body.orderCode,
      status: 'paid',
      total: 254.25,
      currency: 'USD',
    });
    expect((await pool.query('SELECT id FROM orders')).rows).toHaveLength(1);
  });
});
