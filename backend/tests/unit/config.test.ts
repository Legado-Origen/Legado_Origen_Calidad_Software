import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/index.js';

describe('loadConfig', () => {
  it('usa los valores por defecto si las variables no están definidas', () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.db.port).toBe(5432);
    expect(config.reservationMinutes).toBe(15);
  });

  it('lee los valores de las variables de entorno', () => {
    const config = loadConfig({
      PORT: '4000',
      DB_HOST: 'db',
      DB_PORT: '5433',
      DB_NAME: 'legado_origen',
      DB_USER: 'app',
      DB_PASSWORD: 'secreto',
      RESERVATION_MINUTES: '30',
    });

    expect(config).toEqual({
      port: 4000,
      db: { host: 'db', port: 5433, database: 'legado_origen', user: 'app', password: 'secreto' },
      reservationMinutes: 30,
    });
  });

  it.each(['0', '-5', '1.5', 'quince'])('rechaza RESERVATION_MINUTES con el valor %s', (value) => {
    expect(() => loadConfig({ RESERVATION_MINUTES: value })).toThrow(
      'La variable de entorno RESERVATION_MINUTES debe ser un entero positivo',
    );
  });
});