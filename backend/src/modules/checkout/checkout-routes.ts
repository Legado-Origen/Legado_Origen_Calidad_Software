import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { HttpError } from '../../shared/http-error.js';
import {
  calculateCommission,
  calculateTotals,
  generateOrderCode,
  roundMoney,
  validateShipping,
} from './checkout-service.js';
import { validatePayment } from './payment-service.js';

interface CheckoutItem {
  itemId: number;
  quantity: number;
}
type Shipping = Record<string, string>;

// eslint-disable-next-line complexity
function itemsFrom(body: unknown): CheckoutItem[] {
  if (!Array.isArray(body)) throw new HttpError(400, 'Solicitud inválida');
  const items = body as unknown[];
  if (items.length === 0) throw new HttpError(400, 'Solicitud inválida');
  const result: CheckoutItem[] = [];
  for (const value of items) {
    if (typeof value !== 'object' || value === null) throw new HttpError(400, 'Solicitud inválida');
    const item = value as Record<string, unknown>;
    if (
      typeof item.itemId !== 'number' ||
      !Number.isInteger(item.itemId) ||
      item.itemId < 1 ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      throw new HttpError(400, 'Solicitud inválida');
    }
    result.push({ itemId: item.itemId, quantity: item.quantity });
  }
  return result;
}

export function createCheckoutRouter(pool: Pool, commissionRate: number): Router {
  const router = Router();

  // eslint-disable-next-line complexity
  router.post('/preview', async (req, res) => {
    const items = itemsFrom(req.body?.items);
    const shipping = req.body?.shipping;
    const currency = typeof shipping?.currency === 'string' ? shipping.currency : 'CRC';
    if (!['CRC', 'USD'].includes(currency.toUpperCase()))
      throw new HttpError(400, 'Moneda inválida');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let subtotal = 0;
      const previewItems: Array<{
        itemId: number;
        title: string;
        price: number;
        quantity: number;
      }> = [];
      for (const requested of items) {
        const result = await client.query(
          'SELECT id, title, price, stock, status FROM items WHERE id=$1 FOR UPDATE',
          [requested.itemId],
        );
        const item = result.rows[0];
        if (!item) throw new HttpError(404, 'Recurso no encontrado');
        if (item.status !== 'available' || item.stock < requested.quantity) {
          throw new HttpError(409, 'La pieza no está disponible o no tiene stock suficiente');
        }
        const price = Number(item.price);
        subtotal += price * requested.quantity;
        previewItems.push({
          itemId: item.id,
          title: item.title,
          price,
          quantity: requested.quantity,
        });
      }
      await client.query('ROLLBACK');
      res.status(200).json({
        step: 'summary',
        ...calculateTotals(subtotal),
        currency: currency.toUpperCase(),
        items: previewItems,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // eslint-disable-next-line complexity
  router.post('/complete', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const items = itemsFrom(body.items);
    if (!validateShipping(body.shipping)) throw new HttpError(400, 'Solicitud inválida');
    const shipping = body.shipping as Shipping;
    const payment =
      typeof body.payment === 'object' && body.payment !== null
        ? (body.payment as Record<string, unknown>)
        : {};
    const buyerId = body.buyerId;
    if (typeof buyerId !== 'number' || !Number.isSafeInteger(buyerId) || buyerId < 1) {
      throw new HttpError(400, 'Solicitud inválida');
    }
    const idempotencyKey =
      typeof req.headers['idempotency-key'] === 'string'
        ? req.headers['idempotency-key'].trim()
        : '';
    if (!idempotencyKey) throw new HttpError(400, 'Se requiere Idempotency-Key');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT o.* FROM checkout_sessions c JOIN orders o ON o.id=c.order_id
         WHERE c.idempotency_key=$1`,
        [idempotencyKey],
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        const order = existing.rows[0];
        res.status(200).json({
          idempotent: true,
          orderCode: order.order_code,
          status: order.status,
          total: Number(order.total),
          currency: order.currency,
        });
        return;
      }

      const buyer = await client.query('SELECT 1 FROM users WHERE id=$1', [buyerId]);
      if (buyer.rowCount !== 1) throw new HttpError(404, 'Recurso no encontrado');

      let subtotal = 0;
      const resolved: Array<{
        id: number;
        title: string;
        price: number;
        stock: number;
        seller_id: number | null;
        quantity: number;
      }> = [];
      for (const requested of items) {
        const result = await client.query(
          'SELECT id, title, price, stock, status, seller_id FROM items WHERE id=$1 FOR UPDATE',
          [requested.itemId],
        );
        const item = result.rows[0];
        if (!item) throw new HttpError(404, 'Recurso no encontrado');
        if (item.status !== 'available' || item.stock < requested.quantity) {
          throw new HttpError(409, 'La pieza no está disponible o no tiene stock suficiente');
        }
        const price = Number(item.price);
        subtotal += price * requested.quantity;
        resolved.push({ ...item, price, quantity: requested.quantity });
      }
      const totals = calculateTotals(subtotal);
      const currency =
        typeof payment.currency === 'string' ? payment.currency.toUpperCase() : 'CRC';
      const paymentResult = validatePayment({ ...payment, currency });
      if (!paymentResult.valid) {
        await client.query(
          `INSERT INTO payment_transactions (card_bin,card_last4,card_brand,amount,currency,approved,reason)
           VALUES ($1,$2,$3,$4,$5,false,$6)`,
          [
            paymentResult.cardBin,
            paymentResult.cardLast4,
            paymentResult.brand,
            totals.total,
            currency,
            paymentResult.reason,
          ],
        );
        await client.query('COMMIT');
        throw new HttpError(400, paymentResult.reason);
      }
      if (roundMoney(Number(payment.amount)) !== totals.total) {
        throw new HttpError(400, 'El monto del pago no coincide con el total');
      }

      let orderCode = generateOrderCode();
      let order: Record<string, unknown> | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        orderCode = generateOrderCode();
        try {
          const result = await client.query(
            `INSERT INTO orders (order_code,user_id,status,subtotal,tax,total,currency,
             shipping_name,shipping_email,shipping_phone,shipping_provincia,shipping_canton,shipping_distrito,shipping_direccion)
             VALUES ($1,$2,'paid',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [
              orderCode,
              buyerId,
              totals.subtotal,
              totals.tax,
              totals.total,
              currency,
              shipping.name,
              shipping.email,
              shipping.phone,
              shipping.provincia,
              shipping.canton,
              shipping.distrito,
              shipping.direccion,
            ],
          );
          order = result.rows[0];
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== '23505') throw error;
        }
      }
      if (!order) throw new Error('No se pudo generar un código único');

      const commissions = new Map<number, { subtotal: number; amount: number }>();
      for (const item of resolved) {
        const sellerSubtotal = roundMoney(item.price * item.quantity);
        const commission = calculateCommission(item.seller_id, sellerSubtotal, commissionRate);
        await client.query(
          `INSERT INTO order_items (order_id,item_id,title,price,quantity,seller_id,seller_subtotal,commission_rate,commission_amount,seller_net)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            order.id,
            item.id,
            item.title,
            item.price,
            item.quantity,
            item.seller_id,
            sellerSubtotal,
            commission.commissionRate,
            commission.commissionAmount,
            commission.sellerNet,
          ],
        );
        await client.query(
          `UPDATE items SET stock=stock-$1,
           status=CASE WHEN stock-$1=0 THEN 'sold' ELSE status END,
           reserved_by=NULL, reserved_until=NULL WHERE id=$2`,
          [item.quantity, item.id],
        );
        if (item.seller_id !== null) {
          const current = commissions.get(item.seller_id) ?? { subtotal: 0, amount: 0 };
          commissions.set(item.seller_id, {
            subtotal: roundMoney(current.subtotal + sellerSubtotal),
            amount: roundMoney(current.amount + commission.commissionAmount),
          });
        }
      }
      for (const [sellerId, commission] of commissions) {
        await client.query(
          `INSERT INTO platform_commissions (order_id,seller_id,subtotal,commission_rate,commission_amount,currency)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, sellerId, commission.subtotal, commissionRate, commission.amount, currency],
        );
      }
      await client.query(
        `INSERT INTO payment_transactions (order_id,card_bin,card_last4,card_brand,amount,currency,approved,reason)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
        [
          order.id,
          paymentResult.cardBin,
          paymentResult.cardLast4,
          paymentResult.brand,
          totals.total,
          currency,
          paymentResult.reason,
        ],
      );
      await client.query(
        'INSERT INTO checkout_sessions (idempotency_key,order_id) VALUES ($1,$2)',
        [idempotencyKey, order.id],
      );
      await client.query(
        `INSERT INTO email_notifications (order_id,recipient,subject,body) VALUES ($1,$2,$3,$4)`,
        [
          order.id,
          shipping.email,
          `Confirmación de orden ${orderCode}`,
          `Código: ${orderCode}\nTotal: ${currency} ${totals.total.toFixed(2)}\nEntrega: ${shipping.direccion}, ${shipping.distrito}, ${shipping.canton}, ${shipping.provincia}`,
        ],
      );
      await client.query('COMMIT');
      res.status(201).json({
        approved: true,
        orderCode,
        status: 'paid',
        ...totals,
        currency,
        confirmation: { step: 'confirmation', deliveryEmail: shipping.email },
        commissions: Array.from(commissions, ([sellerId, value]) => ({
          sellerId,
          commissionRate,
          commissionAmount: value.amount,
        })),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  return router;
}
