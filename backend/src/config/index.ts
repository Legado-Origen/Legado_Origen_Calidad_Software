const DEFAULT_PORT = 3000;
const DEFAULT_DB_PORT = 5432;
const DEFAULT_RESERVATION_MINUTES = 15;

export interface AppConfig {
  port: number;
  db: {
    host: string | undefined;
    port: number;
    database: string | undefined;
    user: string | undefined;
    password: string | undefined;
  };
  reservationMinutes: number;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`La variable de entorno ${name} debe ser un entero positivo`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: parsePositiveInteger(env.PORT, DEFAULT_PORT, 'PORT'),
    db: {
      host: env.DB_HOST,
      port: parsePositiveInteger(env.DB_PORT, DEFAULT_DB_PORT, 'DB_PORT'),
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    reservationMinutes: parsePositiveInteger(
      env.RESERVATION_MINUTES,
      DEFAULT_RESERVATION_MINUTES,
      'RESERVATION_MINUTES',
    ),
  };
}

export const config = loadConfig(process.env);