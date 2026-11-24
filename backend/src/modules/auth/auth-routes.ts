import { Router } from 'express';
import type { AuthService } from './auth-service.js';

export function createAuthRouter(service: AuthService): Router {
  const router = Router();
  router.post('/login', async (req, res) => {
    const buyer = await service.login(req.body?.name);
    res.status(200).json(buyer);
  });
  router.post('/logout', async (req, res) => {
    await service.logout(req.body?.buyerId, req.body?.sessionToken);
    res.status(204).end();
  });
  return router;
}
