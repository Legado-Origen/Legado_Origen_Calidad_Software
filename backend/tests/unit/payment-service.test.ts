import { describe, expect, it } from 'vitest';
import { validatePayment } from '../../src/modules/checkout/payment-service.js';

const validVisa = {
  cardNumber: '4916911234567890',
  expirationDate: '12/99',
  cvc: '123',
  currency: 'CRC',
};

describe('validatePayment', () => {
  it.each([undefined, 123, '1234'])('rejects a malformed card number: %s', (cardNumber) => {
    expect(validatePayment({ ...validVisa, cardNumber })).toMatchObject({
      valid: false,
      reason: 'Número de tarjeta inválido',
    });
  });

  it('rejects card numbers from unauthorized banks', () => {
    expect(validatePayment({ ...validVisa, cardNumber: '0000001234567890' })).toMatchObject({
      valid: false,
      reason: 'El BIN no corresponde a un banco autorizado',
    });
  });

  it.each([undefined, '1299', '12-99'])('rejects malformed expiration dates: %s', (date) => {
    expect(validatePayment({ ...validVisa, expirationDate: date })).toMatchObject({
      valid: false,
      reason: 'Fecha de vencimiento inválida',
    });
  });

  it.each(['01/20', '13/99', '00/99'])('rejects expired or out-of-range dates: %s', (date) => {
    expect(validatePayment({ ...validVisa, expirationDate: date })).toMatchObject({
      valid: false,
      reason: 'La tarjeta está vencida',
    });
  });

  it('validates VISA and AMEX CVC lengths', () => {
    expect(validatePayment({ ...validVisa, cvc: '12' })).toMatchObject({
      valid: false,
      reason: 'CVC inválido para VISA',
    });
    expect(
      validatePayment({
        ...validVisa,
        cardNumber: '3764121234567890',
        cvc: '123',
      }),
    ).toMatchObject({ valid: false, reason: 'CVC inválido para AMEX' });
  });

  it.each([undefined, 'eur'])('rejects unsupported currencies: %s', (currency) => {
    expect(validatePayment({ ...validVisa, currency })).toMatchObject({
      valid: false,
      reason: 'Moneda inválida',
    });
  });

  it('approves supported cards and currencies', () => {
    expect(validatePayment(validVisa)).toMatchObject({
      valid: true,
      reason: 'Transacción aprobada',
      brand: 'VISA',
      cardBin: '491691',
      cardLast4: '7890',
    });
    expect(
      validatePayment({
        ...validVisa,
        cardNumber: '3764121234567890',
        expirationDate: '01/99',
        cvc: '1234',
        currency: 'usd',
      }),
    ).toMatchObject({ valid: true, brand: 'AMEX' });
  });
});
