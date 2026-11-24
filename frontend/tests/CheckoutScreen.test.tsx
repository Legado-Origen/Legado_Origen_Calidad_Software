import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { CheckoutScreen } from '../src/components/CheckoutScreen';
import type { CheckoutApi } from '../src/services/checkout-api';

const wait = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

async function typeAndSubmit(
  stdin: { write: (input: string) => void },
  value: string,
): Promise<void> {
  await wait();
  for (const character of value) {
    stdin.write(character);
    await wait(20);
  }
  stdin.write('\r');
  await wait();
}

function previewApi(overrides: Partial<CheckoutApi> = {}): CheckoutApi {
  return {
    preview: vi.fn().mockResolvedValue({
      step: 'summary',
      subtotal: 500,
      tax: 65,
      total: 565,
      currency: 'CRC',
      items: [{ itemId: 11, title: 'Reloj', price: 500, quantity: 1 }],
    }),
    complete: vi.fn(),
    ...overrides,
  };
}

function reservation() {
  return {
    itemId: 11,
    buyerId: 4,
    title: 'Reloj',
    price: '500.00',
    reservedUntil: '2026-11-25T12:00:00Z',
  };
}

function renderCheckout(api: CheckoutApi) {
  return render(
    <CheckoutScreen
      api={api}
      buyer={{ id: 4, name: 'Ana', sessionToken: 'token' }}
      reservations={[reservation()]}
      onBack={vi.fn()}
      onCompleted={vi.fn()}
    />,
  );
}

describe('CheckoutScreen', () => {
  it('muestra el resumen del carrito', async () => {
    const api: CheckoutApi = {
      preview: vi.fn().mockResolvedValue({
        step: 'summary',
        subtotal: 500,
        tax: 65,
        total: 565,
        currency: 'CRC',
        items: [{ itemId: 11, title: 'Reloj', price: 500, quantity: 1 }],
      }),
      complete: vi.fn(),
    };
    const view = render(
      <CheckoutScreen
        api={api}
        buyer={{ id: 4, name: 'Ana', sessionToken: 'token' }}
        reservations={[
          {
            itemId: 11,
            buyerId: 4,
            title: 'Reloj',
            price: '500.00',
            reservedUntil: '2026-11-25T12:00:00Z',
          },
        ]}
        onBack={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(view.lastFrame()).toContain('Checkout - 1. Resumen');
    expect(view.lastFrame()).toContain('Reloj');
    expect(view.lastFrame()).toContain('₡565');
  });

  it('muestra el error del preview', async () => {
    const api: CheckoutApi = {
      preview: vi.fn().mockRejectedValue(new Error('Stock insuficiente')),
      complete: vi.fn(),
    };
    const view = render(
      <CheckoutScreen
        api={api}
        buyer={{ id: 4, name: 'Ana', sessionToken: 'token' }}
        reservations={[
          {
            itemId: 11,
            buyerId: 4,
            title: 'Reloj',
            price: '500.00',
            reservedUntil: '2026-11-25T12:00:00Z',
          },
        ]}
        onBack={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(view.lastFrame()).toContain('Stock insuficiente');
  });

  it('recorre los cuatro pasos y confirma el pago', async () => {
    const api = previewApi({
      complete: vi.fn().mockResolvedValue({
        approved: true,
        orderCode: 'LO-1234ABCD',
        status: 'paid',
        total: 565,
        currency: 'CRC',
        confirmation: { step: 'confirmation', deliveryEmail: 'ana@test.cr' },
      }),
    });
    const view = renderCheckout(api);
    await wait();

    view.stdin.write('\r');
    await wait();
    expect(view.lastFrame()).toContain('Checkout - 2. Datos de entrega');

    await typeAndSubmit(view.stdin, 'Ana');
    await typeAndSubmit(view.stdin, 'ana@test.cr');
    await typeAndSubmit(view.stdin, '8888');
    await typeAndSubmit(view.stdin, 'San Jose');
    await typeAndSubmit(view.stdin, 'Central');
    await typeAndSubmit(view.stdin, 'Carmen');
    await typeAndSubmit(view.stdin, 'Calle 1');

    expect(view.lastFrame()).toContain('Checkout - 3. Pago seguro');
    await typeAndSubmit(view.stdin, '4916911234567890');
    await typeAndSubmit(view.stdin, '12/30');
    await typeAndSubmit(view.stdin, '123');
    await wait();

    expect(api.complete).toHaveBeenCalled();
    expect(view.lastFrame()).toContain('Checkout - 4. Confirmación');
    expect(view.lastFrame()).toContain('LO-1234ABCD');
  });

  it('rechaza datos de entrega vacíos', async () => {
    const view = renderCheckout(previewApi());
    await wait();
    view.stdin.write('\r');
    await wait();
    view.stdin.write('\r');
    await wait();

    expect(view.lastFrame()).toContain('Nombre completo es requerido');
  });

  it('muestra el error cuando la pasarela rechaza el pago', async () => {
    const api = previewApi({
      complete: vi.fn().mockRejectedValue(new Error('Pago rechazado')),
    });
    const view = renderCheckout(api);
    await wait();
    view.stdin.write('\r');
    await wait();
    await typeAndSubmit(view.stdin, 'Ana');
    await typeAndSubmit(view.stdin, 'ana@test.cr');
    await typeAndSubmit(view.stdin, '8888');
    await typeAndSubmit(view.stdin, 'San Jose');
    await typeAndSubmit(view.stdin, 'Central');
    await typeAndSubmit(view.stdin, 'Carmen');
    await typeAndSubmit(view.stdin, 'Calle 1');
    await typeAndSubmit(view.stdin, '4916911234567890');
    await typeAndSubmit(view.stdin, '12/30');
    await typeAndSubmit(view.stdin, '123');
    await wait();

    expect(view.lastFrame()).toContain('Pago rechazado');
  });

  it('permite volver al carrito', async () => {
    const onBack = vi.fn();
    const view = render(
      <CheckoutScreen
        api={previewApi()}
        buyer={{ id: 4, name: 'Ana', sessionToken: 'token' }}
        reservations={[reservation()]}
        onBack={onBack}
        onCompleted={vi.fn()}
      />,
    );
    await wait();
    view.stdin.write('b');
    await wait();
    expect(onBack).toHaveBeenCalled();
  });
});
