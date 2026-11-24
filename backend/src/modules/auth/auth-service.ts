import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http-error.js';
import type { BuyerRepository } from './buyer-repository.js';

export function createAuthService(repository: BuyerRepository) {
  const activeSessions = new Map<number, string>();

  return {
    async login(name: unknown) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
        throw new HttpError(400, 'Ingresa un nombre válido');
      }
      const buyers = await repository.findByName(name);
      if (buyers.length === 0) throw new HttpError(404, 'Usuario no encontrado');
      if (buyers.length > 1) throw new HttpError(409, 'El nombre corresponde a más de un usuario');
      const buyer = buyers[0];
      if (activeSessions.has(buyer.id)) {
        throw new HttpError(409, 'Este usuario ya tiene una sesión activa');
      }
      const sessionToken = randomUUID();
      activeSessions.set(buyer.id, sessionToken);
      return { ...buyer, sessionToken };
    },

    async logout(buyerId: unknown, sessionToken: unknown): Promise<void> {
      if (!Number.isSafeInteger(buyerId) || (buyerId as number) < 1 || typeof sessionToken !== 'string') {
        throw new HttpError(400, 'Solicitud inválida');
      }
      if (activeSessions.get(buyerId as number) !== sessionToken) {
        throw new HttpError(409, 'La sesión ya no está activa');
      }
      activeSessions.delete(buyerId as number);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
