import type { Pool } from 'pg';

export interface Buyer {
  id: number;
  name: string;
}

export interface BuyerRepository {
  findByName(name: string): Promise<Buyer[]>;
}

export function createBuyerRepository(pool: Pool): BuyerRepository {
  return {
    async findByName(name) {
      const result = await pool.query<Buyer>(
        `SELECT id, name
         FROM users
         WHERE lower(btrim(name)) = lower($1)
         ORDER BY id
         LIMIT 2`,
        [name.trim()],
      );
      return result.rows;
    },
  };
}
