import type { Pool, PoolClient } from 'pg';
import { HttpError } from '../../shared/http-error.js';
import { loadCommissionRate } from '../../config/index.js';
import {
  calculateCommission,
  calculateTotals,
  generateOrderCode,
  type CheckoutItem,
  type ShippingData,
  type PaymentData,
  roundMoney,
} from './checkout-service.js';
import { validatePayment } from './payment-service.js';

interface ItemRow {
  id: number;
  title: string;
  price: string;
  status: string;
  stock: number;
  seller_id: number | null;
}

export interface CheckoutPreview {
  step: 'summary';
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  items: Array<{ itemId: number; title: string; price: number; quantity: number }>;
}

export interface CheckoutRepository {
  preview(items: CheckoutItem[], currency: string): Promise<CheckoutPreview>;
  complete(input: {
    buyerId: number;
    items: CheckoutItem[];
    shipping: ShippingData;
    payment: PaymentData;
    idempotencyKey: string;
  }): Promise<Record<string, unknown>>;
}

async function findExistingOrder(client: PoolClient, idempotencyKey: string) {
  const result = await client.query(
    `SELECT o.* FROM checkout_sessions c
     JOIN orders o ON o.id = c.order_id
     WHERE c.idempotency_key = $1`,
    [idempotencyKey],
  );
  return result.rows[0] ?? null;
}

async function resolveItems(client: PoolClient, items: CheckoutItem[]) {
  const resolved: Array<{ item: ItemRow; quantity: number }> = [];
  let subtotal = 0;
  for (const requested of items) {
    const result = await client.query<ItemRow>(
      `SELECT id, title, price, status, stock, seller_id
       FROM items WHERE id = $1 FOR UPDATE`,
      [requested.itemId],
    );
    const item = result.rows[0];
    if (!item) throw new HttpError(404, 'Recurso no encontrado');
    if (item.status !== 'available' || item.stock < requested.quantity) {
      throw new HttpError(409, 'La pieza no está disponible o no tiene stock suficiente');
    }
    const price = Number(item.price);
    subtotal += price * requested.quantity;
    resolved.push({ item, quantity: requested.quantity });
  }
  return { resolved, totals: calculateTotals(subtotal) };
}

async function insertNotification(
  pool: Pool,
  orderId: number,
  shipping: ShippingData,
  orderCode: string,
  total: number,
  currency: string,
) {
  const subject = `Confirmación de orden ${orderCode}`;
  const body = [
    'Su compra fue confirmada.',
    `Código de orden: ${orderCode}`,
    `Total: ${currency} ${total.toFixed(2)}`,
    `Entrega: ${shipping.direccion}, ${shipping.distrito}, ${shipping.canton}, ${shipping.provincia}`,
  ].join('\n');
  await pool.query(
    `INSERT INTO email_notifications (order_id, recipient, subject, body)
     VALUES ($1, $2, $3, $4)`,
    [orderId, shipping.email, subject, body],
  );
}

export function createCheckoutRepository(pool: Pool): CheckoutRepository {
  return {
    async preview(items, currency) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { resolved, totals } = await resolveItems(client, items);
        await client.query('ROLLBACK');
        return {
          step: 'summary',
          ...totals,
          currency: currency.toUpperCase(),
          items: resolved.map(({ item, quantity }) => ({
            itemId: item.id,
            title: item.title,
            price: Number(item.price),
            quantity,
          })),
        };
      } finally {
        client.release();
      }
    },

    // eslint-disable-next-line complexity
    async complete(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await findExistingOrder(client, input.idempotencyKey);
        if (existing) {
          await client.query('COMMIT');
          return {
            idempotent: true,
            orderCode: existing.order_code,
            status: existing.status,
            total: Number(existing.total),
            currency: existing.currency,
          };
        }

        const buyer = await client.query('SELECT 1 FROM users WHERE id = $1', [input.buyerId]);
        if (buyer.rowCount !== 1) throw new HttpError(404, 'Recurso no encontrado');

        const { resolved, totals } = await resolveItems(client, input.items);
        const currency = input.payment.currency.toUpperCase();
        const payment = validatePayment(input.payment);
        if (!payment.valid) {
          await client.query(
            `INSERT INTO payment_transactions
             (card_bin, card_last4, card_brand, amount, currency, approved, reason)
             VALUES ($1, $2, $3, $4, $5, false, $6)`,
            [
              payment.cardBin,
              payment.cardLast4,
              payment.brand,
              totals.total,
              currency,
              payment.reason,
            ],
          );
          await client.query('COMMIT');
          throw new HttpError(400, payment.reason);
        }
        if (roundMoney(Number(input.payment.amount)) !== totals.total) {
          throw new HttpError(400, 'El monto del pago no coincide con el total');
        }

        const commissionRate = loadCommissionRate(process.env);
        let orderCode = generateOrderCode();
        let order: Record<string, unknown> | undefined;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          orderCode = generateOrderCode();
          try {
            const result = await client.query(
              `INSERT INTO orders (
                 order_code, user_id, status, subtotal, tax, total, currency,
                 shipping_name, shipping_email, shipping_phone,
                 shipping_provincia, shipping_canton, shipping_distrito, shipping_direccion
               ) VALUES ($1,$2,'paid',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
               RETURNING *`,
              [
                orderCode,
                input.buyerId,
                totals.subtotal,
                totals.tax,
                totals.total,
                currency,
                input.shipping.name,
                input.shipping.email,
                input.shipping.phone,
                input.shipping.provincia,
                input.shipping.canton,
                input.shipping.distrito,
                input.shipping.direccion,
              ],
            );
            order = result.rows[0];
            break;
          } catch (error) {
            if ((error as { code?: string }).code !== '23505') throw error;
          }
        }
        if (!order) throw new Error('No se pudo generar un código de orden único');

        const commissions = new Map<number, { subtotal: number; amount: number }>();
        for (const { item, quantity } of resolved) {
          const sellerSubtotal = roundMoney(Number(item.price) * quantity);
          const sellerId = item.seller_id;
          const commission = calculateCommission(sellerId, sellerSubtotal, commissionRate);
          await client.query(
            `INSERT INTO order_items (
               order_id, item_id, title, price, quantity, seller_id,
               seller_subtotal, commission_rate, commission_amount, seller_net
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              order.id,
              item.id,
              item.title,
              item.price,
              quantity,
              sellerId,
              sellerSubtotal,
              commission.commissionRate,
              commission.commissionAmount,
              commission.sellerNet,
            ],
          );
          await client.query(
            `UPDATE items SET stock = stock - $1, status = CASE
               WHEN stock - $1 = 0 THEN 'sold' ELSE status END
             WHERE id = $2`,
            [quantity, item.id],
          );
          if (sellerId !== null) {
            const current = commissions.get(sellerId) ?? { subtotal: 0, amount: 0 };
            commissions.set(sellerId, {
              subtotal: roundMoney(current.subtotal + sellerSubtotal),
              amount: roundMoney(current.amount + commission.commissionAmount),
            });
          }
        }
        for (const [sellerId, commission] of commissions) {
          await client.query(
            `INSERT INTO platform_commissions
             (order_id, seller_id, subtotal, commission_rate, commission_amount, currency)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [order.id, sellerId, commission.subtotal, commissionRate, commission.amount, currency],
          );
        }
        await client.query(
          `INSERT INTO payment_transactions
           (order_id, card_bin, card_last4, card_brand, amount, currency, approved, reason)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
          [
            order.id,
            payment.cardBin,
            payment.cardLast4,
            payment.brand,
            totals.total,
            currency,
            payment.reason,
          ],
        );
        await client.query(
          'INSERT INTO checkout_sessions (idempotency_key, order_id) VALUES ($1,$2)',
          [input.idempotencyKey, order.id],
        );
        await client.query('COMMIT');

        await insertNotification(
          pool,
          Number(order.id),
          input.shipping,
          orderCode,
          totals.total,
          currency,
        );
        return {
          approved: true,
          orderCode,
          status: 'paid',
          ...totals,
          currency,
          confirmation: { step: 'confirmation', deliveryEmail: input.shipping.email },
          commissions: Array.from(commissions, ([sellerId, value]) => ({
            sellerId,
            commissionRate,
            commissionAmount: value.amount,
          })),
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
