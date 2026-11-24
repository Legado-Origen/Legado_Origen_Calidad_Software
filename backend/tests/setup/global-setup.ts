import { readFile } from 'node:fs/promises';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

export default async function setup(project: TestProject) {
  const { env } = project.config;
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  await client.connect();
  try {
    await client.query('DROP TABLE IF EXISTS items, users CASCADE');
    await client.query(await readFile('src/db/schema.sql', 'utf8'));
  } finally {
    await client.end();
  }
}
