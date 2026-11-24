import { Router, type Request, type Response } from 'express';
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

  const preview = async (body: Record<string, unknown>, res: Response) => {
    if (!validateCheckoutItems(body.items)) {
      throw new HttpError(400, INVALID_CHECKOUT);
    }
    const shipping = body.shipping as Record<string, unknown> | undefined;
    const currency = typeof shipping?.currency === 'string' ? shipping.currency : 'CRC';
    if (!['CRC', 'USD'].includes(currency.toUpperCase())) {
      throw new HttpError(400, 'Moneda inválida');
    }
    res
      .status(200)
      .json(
        await repository.preview(
          body.items as Parameters<CheckoutRepository['preview']>[0],
          currency,
        ),
      );
  };

  const complete = async (
    buyerIdParam: unknown,
    body: Record<string, unknown>,
    req: Request,
    res: Response,
  ) => {
    if (!validateCheckoutItems(body.items) || !validateShipping(body.shipping)) {
      throw new HttpError(400, INVALID_CHECKOUT);
    }
    const buyerId = readBuyerId(buyerIdParam, body);
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
  };

  router.post('/preview', async (req, res) => {
    await preview(req.body as Record<string, unknown>, res);
  });

  router.post('/complete', async (req, res) => {
    await complete(undefined, req.body as Record<string, unknown>, req, res);
  });

  router.post('/:buyerId/preview', async (req, res) => {
    await preview(req.body as Record<string, unknown>, res);
  });

  router.post('/:buyerId/complete', async (req, res) => {
    await complete(req.params.buyerId, req.body as Record<string, unknown>, req, res);
  });

  return router;
}
