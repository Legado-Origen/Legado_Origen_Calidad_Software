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

export interface CatalogItem {
  id: number;
  title: string;
  price: string;
  status: string;
  reservedUntil: Date | null;
}

export interface BuyerReservation {
  itemId: number;
  buyerId: number;
  title: string;
  price: string;
  reservedUntil: Date;
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
    async listItems(): Promise<CatalogItem[]> {
      const rows = await repository.listItems(clock.now());
      return rows.map(({ id, title, price, status, reserved_until }) => ({
        id,
        title,
        price,
        status,
        reservedUntil: reserved_until,
      }));
    },

    async listBuyerReservations(buyerId: number): Promise<BuyerReservation[]> {
      if (!(await repository.buyerExists(buyerId))) {
        throw new HttpError(404, NOT_FOUND);
      }
      const rows = await repository.listBuyerReservations(buyerId, clock.now());
      return rows.map(({ item_id, title, price, reserved_until }) => ({
        itemId: item_id,
        buyerId,
        title,
        price,
        reservedUntil: reserved_until,
      }));
    },

    async releaseReservation(buyerId: number, itemId: number): Promise<void> {
      if (!(await repository.buyerExists(buyerId))) {
        throw new HttpError(404, NOT_FOUND);
      }
      if (await repository.releaseReservation(itemId, buyerId, clock.now())) return;

      const item = await repository.findById(itemId);
      if (!item) throw new HttpError(404, NOT_FOUND);
      if (item.reserved_by !== buyerId) {
        throw new HttpError(403, 'La reserva no pertenece a este comprador');
      }
      throw new HttpError(410, 'La reserva ya venció o no está activa');
    },

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
