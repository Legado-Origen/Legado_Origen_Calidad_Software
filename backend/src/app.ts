import express from 'express';
import { config } from './config/index.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { createCartRouter } from './modules/carts/cart-routes.js';
import { createItemRepository } from './modules/carts/item-repository.js';
import { createReservationService } from './modules/carts/reservation-service.js';
import { type Clock, systemClock } from './shared/clock.js';

interface AppDeps {
  clock?: Clock;
}

export function createApp({ clock = systemClock }: AppDeps = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const reservationService = createReservationService({
    repository: createItemRepository(pool),
    clock,
    reservationMinutes: config.reservationMinutes,
  });
  app.use('/api/carts', createCartRouter(reservationService));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}