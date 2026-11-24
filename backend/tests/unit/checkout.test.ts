import { describe, expect, it } from 'vitest';
import {
  calculateCommission,
  calculateTotals,
  generateOrderCode,
  roundMoney,
  validateCurrency,
  validateCheckoutItems,
  validateCvc,
  validateExpirationDate,
  validateShipping,
} from '../../src/modules/checkout/checkout-service.js';
import { validatePayment } from '../../src/modules/checkout/payment-service.js';
import { loadCommissionRate } from '../../src/config/index.js';

function payment(overrides: Record<string, unknown> = {}) {
  return {
    cardNumber: '4916911234567890',
    expirationDate: '12/30',
    cvc: '123',
    currency: 'CRC',
    ...overrides,
  };
}

describe('checkout service', () => {
  it('rechaza un carrito vacío', () => {
    expect(validateCheckoutItems([])).toBe(false);
  });

  it('valida items y cantidades', () => {
    expect(validateCheckoutItems([{ itemId: 1, quantity: 2 }])).toBe(true);
    expect(validateCheckoutItems([{ itemId: 1, quantity: 0 }])).toBe(false);
  });

  it('valida datos de envío completos', () => {
    expect(
      validateShipping({
        name: 'Ana',
        email: 'ana@test.cr',
        phone: '8888',
        provincia: 'San José',
        canton: 'Central',
        distrito: 'Carmen',
        direccion: 'Calle 1',
      }),
    ).toBe(true);
  });

  it('rechaza datos de envío incompletos', () => {
    expect(validateShipping({ name: 'Ana' })).toBe(false);
    expect(validateShipping(null)).toBe(false);
  });

  it('rechaza formatos no válidos de checkout', () => {
    expect(validateCheckoutItems(null)).toBe(false);
    expect(validateCheckoutItems([null])).toBe(false);
    expect(validateCheckoutItems([{ itemId: '1', quantity: 1 }])).toBe(false);
  });

  it('calcula subtotal, impuesto y total', () => {
    expect(calculateTotals(500)).toEqual({ subtotal: 500, tax: 65, total: 565 });
  });

  it('genera un código con formato LO-XXXXXXXX', () => {
    expect(generateOrderCode()).toMatch(/^LO-[A-F0-9]{8}$/);
  });

  it('redondea importes monetarios', () => {
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it('calcula comisión de vendedor externo', () => {
    expect(calculateCommission(7, 500, 0.1)).toEqual({
      commissionAmount: 50,
      sellerNet: 450,
      commissionRate: 0.1,
    });
  });

  it('no calcula comisión para inventario propio', () => {
    expect(calculateCommission(null, 500, 0.1)).toEqual({
      commissionAmount: 0,
      sellerNet: 500,
      commissionRate: 0,
    });
  });

  it('aplica los límites 0% y 100%', () => {
    expect(calculateCommission(7, 500, 0).commissionAmount).toBe(0);
    expect(calculateCommission(7, 500, 1).commissionAmount).toBe(500);
  });

  it('lee el porcentaje configurable', () => {
    expect(loadCommissionRate({ COMMISSION_RATE: '0.10' })).toBe(0.1);
    expect(loadCommissionRate({})).toBe(0.1);
    expect(loadCommissionRate({ COMMISSION_RATE: '-1' })).toBe(0);
    expect(loadCommissionRate({ COMMISSION_RATE: '2' })).toBe(1);
    expect(() => loadCommissionRate({ COMMISSION_RATE: 'abc' })).toThrow(
      'La variable de entorno COMMISSION_RATE debe ser un número entre 0 y 1',
    );
  });

  it('valida vencimiento, CVC y moneda', () => {
    expect(validateExpirationDate('01/20')).toBe(false);
    expect(validateExpirationDate('2026')).toBe(false);
    expect(validateExpirationDate('12/30')).toBe(true);
    expect(validateCvc('123', 'VISA')).toBe(true);
    expect(validateCvc('1234', 'AMEX')).toBe(true);
    expect(validateCvc('123', 'AMEX')).toBe(false);
    expect(validateCurrency('CRC')).toBe(true);
    expect(validateCurrency('USD')).toBe(true);
    expect(validateCurrency('EUR')).toBe(false);
  });
});

describe('payment validation', () => {
  it('rechaza una tarjeta no formada por 16 dígitos', () => {
    expect(validatePayment(payment({ cardNumber: '123' })).valid).toBe(false);
  });

  it('rechaza un BIN desconocido', () => {
    expect(validatePayment(payment({ cardNumber: '0000001234567890' })).valid).toBe(false);
  });

  it('rechaza tarjetas vencidas', () => {
    expect(validatePayment(payment({ expirationDate: '01/20' })).valid).toBe(false);
  });

  it('rechaza CVC y moneda inválidos', () => {
    expect(validatePayment(payment({ cvc: '12' })).valid).toBe(false);
    expect(validatePayment(payment({ currency: 'EUR' })).valid).toBe(false);
  });

  it('aprueba una tarjeta válida', () => {
    expect(validatePayment(payment()).valid).toBe(true);
  });

  it('valida CVC de AMEX con cuatro dígitos', () => {
    expect(validatePayment(payment({ cardNumber: '3764121234567890', cvc: '1234' })).valid).toBe(
      true,
    );
  });
});
