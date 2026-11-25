import { Router } from 'express';
import { HttpError } from '../../shared/http-error.js';
import type { ReservationService } from './reservation-service.js';

const MAX_ID = 2_147_483_647;
const INVALID_REQUEST = 'Solicitud inválida';

function isValidId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_ID;
}

function parseIdParam(value: string): number {
  const id = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!isValidId(id)) {
    throw new HttpError(400, INVALID_REQUEST);
  }
  return id;
}

export function createCartRouter(service: ReservationService): Router {
  const router = Router();

  router.get('/:buyerId', async (req, res) => {
    const buyerId = parseIdParam(req.params.buyerId);
    res.status(200).json(await service.listBuyerReservations(buyerId));
  });

  router.delete('/:buyerId/items/:itemId', async (req, res) => {
    const buyerId = parseIdParam(req.params.buyerId);
    const itemId = parseIdParam(req.params.itemId);
    await service.releaseReservation(buyerId, itemId);
    res.status(204).end();
  });

  router.post('/:buyerId/items', async (req, res) => {
    const buyerId = parseIdParam(req.params.buyerId);
    const itemId: unknown = req.body?.itemId;
    if (!isValidId(itemId)) {
      throw new HttpError(400, INVALID_REQUEST);
    }

    const { created, reservation } = await service.reserveItem(buyerId, itemId);
    res.status(created ? 201 : 200).json(reservation);
  });

  return router;
}
