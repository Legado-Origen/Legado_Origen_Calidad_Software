import { pool } from '../../src/db/pool.js';

export type ItemStatus = 'pending_approval' | 'available' | 'rejected' | 'sold';

export async function resetDatabase() {
  await pool.query(
    `TRUNCATE checkout_sessions, email_notifications, payment_transactions,
     platform_commissions, order_items, orders, items, users
     RESTART IDENTITY CASCADE`,
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

export async function createExternalSellerItem(
  price: number,
  stock = 5,
): Promise<{ sellerId: number; itemId: number }> {
  const sellerEmail = `seller.${Date.now()}.${Math.random()}@test.cr`;
  const seller = await pool.query<{ id: number }>(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
    ['Vendedor Prueba', sellerEmail],
  );
  const sellerId = seller.rows[0].id;
  const item = await pool.query<{ id: number }>(
    `INSERT INTO items (title, price, status, stock, seller_id)
     VALUES ($1, $2, 'available', $3, $4) RETURNING id`,
    ['Pieza externa', price, stock, sellerId],
  );
  return { sellerId, itemId: item.rows[0].id };
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
