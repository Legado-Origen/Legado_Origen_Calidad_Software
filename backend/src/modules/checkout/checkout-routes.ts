import { Router } from 'express';
import { HttpError } from '../../shared/http-error.js';
import type { CheckoutRepository } from './checkout-repository.js';
import {
  INVALID_CHECKOUT,
  validateCheckoutItems,
  validateShipping,
  type PaymentData,
} from './checkout-service.js';

const MAX_ID = 2_147_483_647;

function isValidId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_ID;
}

function readBuyerId(reqBuyerId: unknown, body: Record<string, unknown>) {
  const value = reqBuyerId ?? body.buyerId;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (isValidId(parsed)) return parsed;
  }
  if (isValidId(value)) return value;
  throw new HttpError(400, INVALID_CHECKOUT);
}

function readIdempotencyKey(req: {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}) {
  const header = req.headers['idempotency-key'];
  const value = typeof header === 'string' ? header : req.body.idempotencyKey;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new HttpError(400, 'Se requiere Idempotency-Key');
  }
  return value.trim();
}

export function createCheckoutRouter(repository: CheckoutRepository): Router {
  const router = Router();

  router.post('/preview', async (req, res) => {
    if (!validateCheckoutItems(req.body?.items)) {
      throw new HttpError(400, INVALID_CHECKOUT);
    }
    const currency =
      typeof req.body?.shipping?.currency === 'string' ? req.body.shipping.currency : 'CRC';
    if (!['CRC', 'USD'].includes(currency.toUpperCase())) {
      throw new HttpError(400, 'Moneda inválida');
    }
    res.status(200).json(await repository.preview(req.body.items, currency));
  });

  router.post('/complete', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!validateCheckoutItems(body.items) || !validateShipping(body.shipping)) {
      throw new HttpError(400, INVALID_CHECKOUT);
    }
    const buyerId = readBuyerId(undefined, body);
    const idempotencyKey = readIdempotencyKey(req);
    const payment = body.payment as PaymentData | undefined;
    if (!payment) throw new HttpError(400, INVALID_CHECKOUT);
    const result = await repository.complete({
      buyerId,
      items: body.items as Parameters<CheckoutRepository['complete']>[0]['items'],
      shipping: body.shipping as Parameters<CheckoutRepository['complete']>[0]['shipping'],
      payment,
      idempotencyKey,
    });
    res.status(result.idempotent ? 200 : 201).json(result);
  });

  router.post('/:buyerId/preview', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!validateCheckoutItems(body.items)) {
      throw new HttpError(400, INVALID_CHECKOUT);
    }
    const shipping = body.shipping as unknown as Record<string, unknown>;
    const currency = typeof shipping.currency === 'string' ? shipping.currency : 'CRC';
    res
      .status(200)
      .json(
        await repository.preview(
          body.items as Parameters<CheckoutRepository['preview']>[0],
          currency,
        ),
      );
  });

  router.post('/:buyerId/complete', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!validateCheckoutItems(body.items) || !validateShipping(body.shipping)) {
      throw new HttpError(400, INVALID_CHECKOUT);
    }
    const buyerId = readBuyerId(req.params.buyerId, body);
    const idempotencyKey = readIdempotencyKey(req);
    const payment = body.payment as PaymentData | undefined;
    if (!payment) throw new HttpError(400, INVALID_CHECKOUT);
    const result = await repository.complete({
      buyerId,
      items: body.items as Parameters<CheckoutRepository['complete']>[0]['items'],
      shipping: body.shipping as Parameters<CheckoutRepository['complete']>[0]['shipping'],
      payment,
      idempotencyKey,
    });
    res.status(result.idempotent ? 200 : 201).json(result);
  });

  return router;
}
