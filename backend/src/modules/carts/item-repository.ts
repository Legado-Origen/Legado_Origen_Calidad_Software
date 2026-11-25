import type { Pool } from 'pg';

export interface ReservationRow {
  id: number;
  reserved_by: number;
  reserved_until: Date;
}

export interface ItemRow {
  id: number;
  status: string;
  reserved_by: number | null;
  reserved_until: Date | null;
}

export interface CatalogItemRow {
  id: number;
  title: string;
  price: string;
  status: string;
  reserved_until: Date | null;
}

export interface BuyerReservationRow {
  item_id: number;
  title: string;
  price: string;
  reserved_until: Date;
}

export interface ItemRepository {
  buyerExists(buyerId: number): Promise<boolean>;
  tryReserve(
    itemId: number,
    buyerId: number,
    now: Date,
    minutes: number,
  ): Promise<ReservationRow | null>;
  findById(itemId: number): Promise<ItemRow | null>;
  listItems(now: Date): Promise<CatalogItemRow[]>;
  listBuyerReservations(buyerId: number, now: Date): Promise<BuyerReservationRow[]>;
  releaseReservation(itemId: number, buyerId: number, now: Date): Promise<boolean>;
}

export function createItemRepository(pool: Pool): ItemRepository {
  return {
    async buyerExists(buyerId) {
      const result = await pool.query('SELECT 1 FROM users WHERE id = $1', [buyerId]);
      return result.rowCount === 1;
    },

    async tryReserve(itemId, buyerId, now, minutes) {
      const result = await pool.query<ReservationRow>(
        `UPDATE items
         SET reserved_by = $1,
             reserved_until = $2::timestamptz + make_interval(mins => $3)
         WHERE id = $4
           AND status = 'available'
           AND (reserved_by IS NULL OR reserved_until <= $2::timestamptz)
         RETURNING id, reserved_by, reserved_until`,
        [buyerId, now, minutes, itemId],
      );
      return result.rows[0] ?? null;
    },

    async findById(itemId) {
      const result = await pool.query<ItemRow>(
        'SELECT id, status, reserved_by, reserved_until FROM items WHERE id = $1',
        [itemId],
      );
      return result.rows[0] ?? null;
    },

    async listItems(now) {
      const result = await pool.query<CatalogItemRow>(
        `SELECT id, title, price,
                CASE WHEN status = 'available' AND reserved_until > $1 THEN 'reserved' ELSE status END AS status,
                CASE WHEN reserved_until > $1 THEN reserved_until ELSE NULL END AS reserved_until
         FROM items
         ORDER BY id`,
        [now],
      );
      return result.rows;
    },

    async listBuyerReservations(buyerId, now) {
      const result = await pool.query<BuyerReservationRow>(
        `SELECT id AS item_id, title, price, reserved_until
         FROM items
         WHERE reserved_by = $1
           AND status = 'available'
           AND reserved_until > $2
         ORDER BY reserved_until, id`,
        [buyerId, now],
      );
      return result.rows;
    },

    async releaseReservation(itemId, buyerId, now) {
      const result = await pool.query(
        `UPDATE items
         SET reserved_by = NULL, reserved_until = NULL
         WHERE id = $1
           AND reserved_by = $2
           AND status = 'available'
           AND reserved_until > $3
         RETURNING id`,
        [itemId, buyerId, now],
      );
      return result.rowCount === 1;
    },
  };
}
