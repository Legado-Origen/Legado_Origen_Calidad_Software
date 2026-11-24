import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

async function seed() {
  await pool.query(await readFile('src/db/schema.sql', 'utf8'));

  const buyer = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email)
     VALUES ('Comprador Prueba', 'comprador@test.cr')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );

  const seller = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email)
     VALUES ('Vendedor Prueba', 'vendedor@test.cr')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );

  const item = await pool.query<{ id: number }>(
    `INSERT INTO items (title, price, status, stock, seller_id)
     SELECT 'Reloj de bolsillo vintage', 500.00, 'available', 5, $1
     WHERE NOT EXISTS (
       SELECT 1 FROM items WHERE title = 'Reloj de bolsillo vintage'
     )
     RETURNING id`,
    [seller.rows[0].id],
  );

  console.log(
    `Datos creados: comprador=${buyer.rows[0].id}, vendedor=${seller.rows[0].id}, pieza=${item.rows[0]?.id ?? 'existente'}`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
