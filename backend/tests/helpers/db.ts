import { pool } from '../../src/db/pool.js';

export type ItemStatus = 'pending_approval' | 'available' | 'rejected' | 'sold';

export async function resetDatabase() {
  await pool.query(
    `TRUNCATE orders, order_items, payment_transactions, platform_commissions,
     checkout_sessions, email_notifications, items, users RESTART IDENTITY CASCADE`,
  );
}

export async function createBuyer(name = 'Comprador'): Promise<number> {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}.${Math.random()}@test.cr`;
  const result = await pool.query<{ id: number }>(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
    [name, email],
  );
  return result.rows[0].id;
}

export async function createItem(status: ItemStatus = 'available'): Promise<number> {
  const result = await pool.query<{ id: number }>(
    'INSERT INTO items (title, price, status) VALUES ($1, $2, $3) RETURNING id',
    ['Reloj de bolsillo', 150000, status],
  );
  return result.rows[0].id;
}

export async function findReservation(itemId: number) {
  const result = await pool.query<{ reserved_by: number | null; reserved_until: Date | null }>(
    'SELECT reserved_by, reserved_until FROM items WHERE id = $1',
    [itemId],
  );
  return result.rows[0];
}

export async function closePool() {
  await pool.end();
}
