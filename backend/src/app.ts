import express from 'express';
import { errorHandler, notFound } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}