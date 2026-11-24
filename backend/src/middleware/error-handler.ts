import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../shared/http-error.js';

const GENERIC_SERVER_ERROR = 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.';
const GENERIC_CLIENT_ERROR = 'Solicitud inválida';

function isClientError(err: unknown): err is { status: number } {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (isClientError(err)) {
    res.status(err.status).json({ message: GENERIC_CLIENT_ERROR });
    return;
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ message: GENERIC_SERVER_ERROR });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Recurso no encontrado' });
}