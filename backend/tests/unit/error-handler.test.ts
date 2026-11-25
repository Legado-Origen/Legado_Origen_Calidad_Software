import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/error-handler.js';

function createResponse(headersSent = false) {
  const res = { headersSent, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const req = { method: 'POST', originalUrl: '/api/carts/1/items' } as Request;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('responde 500 con un mensaje genérico ante un error inesperado', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createResponse();
    const next = vi.fn();

    errorHandler(new Error('detalle interno'), req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('delega en Express si la respuesta ya se envió', () => {
    const res = createResponse(true);
    const next = vi.fn() as NextFunction;
    const error = new Error('tardío');

    errorHandler(error, req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
