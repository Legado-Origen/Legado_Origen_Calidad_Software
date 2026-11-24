import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/components/App';
import {
  ReservationApiError,
  type Buyer,
  type CatalogItem,
  type Reservation,
  type ReservationApi,
} from '../src/services/reservationApi';

const wait = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
const buyer: Buyer = { id: 4, name: 'Ana', sessionToken: 'session-ana' };
const catalog: CatalogItem[] = [
  {
    id: 11,
    title: 'Reloj de bolsillo',
    price: '185000.00',
    status: 'available',
    reservedUntil: null,
  },
  {
    id: 12,
    title: 'Gramófono antiguo',
    price: '240000.00',
    status: 'reserved',
    reservedUntil: '2026-11-25T12:00:00Z',
  },
];
const savedReservations: Reservation[] = [
  {
    itemId: 22,
    buyerId: buyer.id,
    title: 'Carreta de Sarchí',
    price: '320000.00',
    reservedUntil: '2026-11-25T12:00:00Z',
  },
  {
    itemId: 23,
    buyerId: buyer.id,
    title: 'Máquina de coser',
    price: '240000.00',
    reservedUntil: '2026-11-25T12:30:00Z',
  },
];

function createApi(overrides: Partial<ReservationApi> = {}): ReservationApi {
  return {
    login: vi.fn().mockResolvedValue(buyer),
    logout: vi.fn().mockResolvedValue(undefined),
    listItems: vi.fn().mockResolvedValue(catalog),
    getCart: vi.fn().mockResolvedValue([]),
    reserveItem: vi
      .fn()
      .mockResolvedValue({ ...savedReservations[0], itemId: 11, title: catalog[0].title }),
    cancelReservation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function typeAndSubmit(
  stdin: { write: (input: string) => void },
  value: string,
): Promise<void> {
  await wait();
  for (const character of value) {
    stdin.write(character);
    await wait(30);
  }
  stdin.write('\r');
  await wait();
}

describe('frontend de reservas', () => {
  it('inicia sesión por nombre y muestra nombres y estados recibidos del backend', async () => {
    const api = createApi();
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');

    expect(api.login).toHaveBeenCalledWith('Ana');
    expect(api.getCart).toHaveBeenCalledWith(buyer.id);
    expect(app.lastFrame()).toContain('Bienvenido, Ana');
    expect(app.lastFrame()).toContain('Reloj de bolsillo');
    expect(app.lastFrame()).toContain('Disponible');
    expect(app.lastFrame()).toContain('Gramófono antiguo');
    expect(app.lastFrame()).toContain('Reservado');
    expect(app.lastFrame()).not.toContain('reservado por');
  });

  it('restaura todas las reservas activas y permite volver al catálogo', async () => {
    const api = createApi({ getCart: vi.fn().mockResolvedValue(savedReservations) });
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');

    expect(app.lastFrame()).toContain('Carrito — reservas activas');
    expect(app.lastFrame()).toContain('Carreta de Sarchí');
    expect(app.lastFrame()).toContain('Máquina de coser');
    app.stdin.write('\u001B[B');
    await wait();
    app.stdin.write('\u001B[A');
    await wait();
    app.stdin.write('b');
    await wait();
    expect(app.lastFrame()).toContain('Artículos disponibles');
    app.stdin.write('c');
    await wait();
    app.stdin.write('l');
    await wait();
    expect(app.lastFrame()).toContain('Inicio de sesión');
  });

  it('reserva un artículo disponible y abre el carrito con su nombre', async () => {
    const api = createApi();
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    app.stdin.write('\r');
    await wait();

    expect(api.reserveItem).toHaveBeenCalledWith(buyer.id, catalog[0].id);
    expect(app.lastFrame()).toContain('Carrito — reservas activas');
    expect(app.lastFrame()).toContain('Reloj de bolsillo');
  });

  it('no permite seleccionar un artículo que ya está reservado', async () => {
    const api = createApi();
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    app.stdin.write('\u001B[A');
    await wait();
    app.stdin.write('\r');
    await wait();
    expect(app.lastFrame()).toContain('no está disponible para reservar');
    app.stdin.write('\u001B[B');
    await wait();
    expect(api.reserveItem).not.toHaveBeenCalled();
  });

  it('al seleccionar un artículo propio ya reservado vuelve al carrito', async () => {
    const ownReservation = {
      ...savedReservations[0],
      itemId: catalog[1].id,
      title: catalog[1].title,
    };
    const api = createApi({
      getCart: vi.fn().mockResolvedValue([ownReservation]),
    });
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    app.stdin.write('b');
    await wait();
    app.stdin.write('\u001B[A');
    await wait();
    app.stdin.write('\r');
    await wait();
    expect(app.lastFrame()).toContain('Carrito — reservas activas');
    expect(api.reserveItem).not.toHaveBeenCalled();
  });

  it('cancela una reserva activa desde el carrito y actualiza la pieza', async () => {
    const reservedItem = {
      ...catalog[0],
      id: savedReservations[0].itemId,
      title: savedReservations[0].title,
      status: 'reserved' as const,
    };
    const api = createApi({
      listItems: vi.fn().mockResolvedValue([reservedItem, catalog[1]]),
      getCart: vi.fn().mockResolvedValue([savedReservations[0]]),
    });
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    expect(app.lastFrame()).toContain('Carreta de Sarchí');
    app.stdin.write('x');
    await wait();
    expect(api.cancelReservation).toHaveBeenCalledWith(buyer.id, savedReservations[0].itemId);
    expect(app.lastFrame()).toContain('No tienes reservas activas');
    app.stdin.write('\u001B[A');
    await wait();
    app.stdin.write('\u001B[B');
    await wait();
    app.stdin.write('b');
    await wait();
    expect(app.lastFrame()).toContain('Disponible');
  });

  it('muestra errores al cancelar si la reserva ya venció', async () => {
    const api = createApi({
      getCart: vi.fn().mockResolvedValue([savedReservations[0]]),
      cancelReservation: vi
        .fn()
        .mockRejectedValue(new ReservationApiError(410, 'La reserva ya venció o no está activa')),
    });
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    app.stdin.write('x');
    await wait();
    expect(app.lastFrame()).toContain('La reserva ya venció o no está activa');

    const unknownApi = createApi({
      getCart: vi.fn().mockResolvedValue([savedReservations[0]]),
      cancelReservation: vi.fn().mockRejectedValue('fallo inesperado'),
    });
    const unknownApp = render(<App api={unknownApi} />);
    await typeAndSubmit(unknownApp.stdin, 'Ana');
    unknownApp.stdin.write('x');
    await wait();
    expect(unknownApp.lastFrame()).toContain('No se pudo cancelar la reserva.');
  });

  it('permite volver a reservar y actualiza el estado del artículo en el catálogo', async () => {
    const ownReservation = {
      ...savedReservations[0],
      itemId: catalog[0].id,
      title: catalog[0].title,
    };
    const api = createApi({
      getCart: vi.fn().mockResolvedValue([ownReservation]),
    });
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    app.stdin.write('b');
    await wait();
    app.stdin.write('\r');
    await wait();
    expect(app.lastFrame()).toContain('Carrito — reservas activas');
    expect(api.reserveItem).toHaveBeenCalledWith(buyer.id, catalog[0].id);
  });

  it('muestra errores de login y de reserva', async () => {
    const loginApi = createApi({
      login: vi.fn().mockRejectedValue(new ReservationApiError(404, 'Usuario no encontrado')),
    });
    const loginApp = render(<App api={loginApi} />);
    await typeAndSubmit(loginApp.stdin, 'Desconocido');
    expect(loginApp.lastFrame()).toContain('Usuario no encontrado');

    const reserveApi = createApi({
      reserveItem: vi
        .fn()
        .mockRejectedValue(new ReservationApiError(409, 'La pieza no está disponible')),
    });
    const reserveApp = render(<App api={reserveApi} />);
    await typeAndSubmit(reserveApp.stdin, 'Ana');
    appEnter(reserveApp.stdin);
    await wait();
    expect(reserveApp.lastFrame()).toContain('La pieza no está disponible');

    const unexpectedLoginApi = createApi({
      login: vi.fn().mockRejectedValue(new Error('internal detail')),
    });
    const unexpectedLoginApp = render(<App api={unexpectedLoginApi} />);
    await typeAndSubmit(unexpectedLoginApp.stdin, 'Ana');
    expect(unexpectedLoginApp.lastFrame()).toContain('No se pudo iniciar sesión.');
  });

  it('rechaza un nombre vacío', async () => {
    const api = createApi();
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, '');
    expect(app.lastFrame()).toContain('Ingresa tu nombre.');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('informa cuando el catálogo está vacío y permite cerrar sesión', async () => {
    const api = createApi({ listItems: vi.fn().mockResolvedValue([]) });
    const app = render(<App api={api} />);
    await typeAndSubmit(app.stdin, 'Ana');
    expect(app.lastFrame()).toContain('No hay artículos cargados');
    app.stdin.write('l');
    await wait();
    expect(app.lastFrame()).toContain('Inicio de sesión');
    expect(api.logout).toHaveBeenCalledWith(buyer);
  });
});

function appEnter(stdin: { write: (input: string) => void }): void {
  stdin.write('\r');
}
