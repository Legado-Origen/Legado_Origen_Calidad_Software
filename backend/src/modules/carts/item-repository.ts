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

export interface ItemRepository {
  buyerExists(buyerId: number): Promise<boolean>;
  tryReserve(
    itemId: number,
    buyerId: number,
    now: Date,
    minutes: number,
  ): Promise<ReservationRow | null>;
  findById(itemId: number): Promise<ItemRow | null>;
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
  };
}