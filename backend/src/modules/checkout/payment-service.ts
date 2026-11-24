import { validateCardNumber, validateCvc, validateExpirationDate } from './checkout-service.js';

const BINS = new Map<string, { bank: string; brand: 'VISA' | 'MASTERCARD' | 'AMEX' }>([
  ['491691', { bank: 'Banco Nacional', brand: 'VISA' }],
  ['410272', { bank: 'Banco de Costa Rica', brand: 'VISA' }],
  ['404010', { bank: 'BAC Credomatic', brand: 'VISA' }],
  ['376412', { bank: 'BAC Credomatic', brand: 'AMEX' }],
  ['519665', { bank: 'Banco Nacional', brand: 'MASTERCARD' }],
]);

export interface PaymentValidation {
  valid: boolean;
  reason: string;
  brand: 'VISA' | 'MASTERCARD' | 'AMEX' | null;
  cardBin: string;
  cardLast4: string;
}

export function validatePayment(payment: {
  cardNumber?: unknown;
  expirationDate?: unknown;
  cvc?: unknown;
  currency?: unknown;
}): PaymentValidation {
  const cardNumber = typeof payment.cardNumber === 'string' ? payment.cardNumber : '';
  const cardBin = cardNumber.slice(0, 6);
  const cardLast4 = cardNumber.slice(-4);
  if (!validateCardNumber(cardNumber)) {
    return {
      valid: false,
      reason: 'El número de tarjeta debe tener 16 dígitos',
      brand: null,
      cardBin,
      cardLast4,
    };
  }
  const bin = BINS.get(cardBin);
  if (!bin) {
    return {
      valid: false,
      reason: 'El BIN no corresponde a un banco autorizado',
      brand: null,
      cardBin,
      cardLast4,
    };
  }
  if (!validateExpirationDate(payment.expirationDate)) {
    return {
      valid: false,
      reason: 'La tarjeta está vencida',
      brand: bin.brand,
      cardBin,
      cardLast4,
    };
  }
  if (!validateCvc(payment.cvc, bin.brand)) {
    return {
      valid: false,
      reason: `CVC inválido para ${bin.brand}`,
      brand: bin.brand,
      cardBin,
      cardLast4,
    };
  }
  if (
    typeof payment.currency !== 'string' ||
    !['CRC', 'USD'].includes(payment.currency.toUpperCase())
  ) {
    return { valid: false, reason: 'Moneda inválida', brand: bin.brand, cardBin, cardLast4 };
  }
  return { valid: true, reason: 'Transacción aprobada', brand: bin.brand, cardBin, cardLast4 };
}
