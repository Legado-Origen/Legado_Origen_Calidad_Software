import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closePool } from './helpers/db.js';

const app = createApp();

afterAll(closePool);

describe('GET /api/health', () => {
  it('responde 200 con el estado ok', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('no expone la cabecera X-Powered-By', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Rutas no registradas', () => {
  it('responde 404 con un mensaje genérico', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Recurso no encontrado' });
  });
});
