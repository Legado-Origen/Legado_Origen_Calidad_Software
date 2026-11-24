import { Router } from 'express';
import type { ReservationService } from '../carts/reservation-service.js';

export function createItemRouter(service: ReservationService): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.status(200).json(await service.listItems());
  });
  return router;
}
