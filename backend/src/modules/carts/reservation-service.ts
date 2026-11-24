import type { Clock } from '../../shared/clock.js';
import { HttpError } from '../../shared/http-error.js';
import type { ItemRepository } from './item-repository.js';

export interface Reservation {
  itemId: number;
  buyerId: number;
  reservedUntil: Date;
}

export interface ReservationResult {
  created: boolean;
  reservation: Reservation;
}

interface ReservationServiceDeps {
  repository: ItemRepository;
  clock: Clock;
  reservationMinutes: number;
}

const NOT_FOUND = 'Recurso no encontrado';
const NOT_AVAILABLE = 'La pieza no está disponible';

export function createReservationService({
  repository,
  clock,
  reservationMinutes,
}: ReservationServiceDeps) {
  return {
    async reserveItem(buyerId: number, itemId: number): Promise<ReservationResult> {
      if (!(await repository.buyerExists(buyerId))) {
        throw new HttpError(404, NOT_FOUND);
      }

      const now = clock.now();
      const reserved = await repository.tryReserve(itemId, buyerId, now, reservationMinutes);
      if (reserved) {
        return {
          created: true,
          reservation: { itemId, buyerId, reservedUntil: reserved.reserved_until },
        };
      }

      const item = await repository.findById(itemId);
      if (!item) {
        throw new HttpError(404, NOT_FOUND);
      }

      const hasOwnActiveReservation =
        item.status === 'available' &&
        item.reserved_by === buyerId &&
        item.reserved_until !== null &&
        item.reserved_until > now;
      if (hasOwnActiveReservation) {
        return {
          created: false,
          reservation: { itemId, buyerId, reservedUntil: item.reserved_until as Date },
        };
      }

      throw new HttpError(409, NOT_AVAILABLE);
    },
  };
}

export type ReservationService = ReturnType<typeof createReservationService>;
