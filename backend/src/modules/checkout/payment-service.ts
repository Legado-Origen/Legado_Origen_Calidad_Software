const BINS = new Map([
  ['491691', { bank: 'Banco Nacional', brand: 'VISA' }],
  ['410272', { bank: 'Banco de Costa Rica', brand: 'VISA' }],
  ['404010', { bank: 'BAC Credomatic', brand: 'VISA' }],
  ['376412', { bank: 'BAC Credomatic', brand: 'AMEX' }],
  ['519665', { bank: 'Banco Nacional', brand: 'MASTERCARD' }],
]);

// eslint-disable-next-line complexity
export function validatePayment(payment: Record<string, unknown>) {
  const cardNumber = typeof payment.cardNumber === 'string' ? payment.cardNumber : '';
  const cardBin = cardNumber.slice(0, 6);
  const cardLast4 = cardNumber.slice(-4);
  if (!/^\d{16}$/.test(cardNumber)) {
    return { valid: false, reason: 'Número de tarjeta inválido', brand: null, cardBin, cardLast4 };
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
  if (
    typeof payment.expirationDate !== 'string' ||
    !/^\d{2}\/\d{2}$/.test(payment.expirationDate)
  ) {
    return {
      valid: false,
      reason: 'Fecha de vencimiento inválida',
      brand: bin.brand,
      cardBin,
      cardLast4,
    };
  }
  const [month, year] = payment.expirationDate.split('/').map(Number);
  const expiration = new Date(2000 + year, month, 1);
  if (month < 1 || month > 12 || expiration <= new Date()) {
    return {
      valid: false,
      reason: 'La tarjeta está vencida',
      brand: bin.brand,
      cardBin,
      cardLast4,
    };
  }
  const cvc = payment.cvc;
  const cvcValid =
    typeof cvc === 'string' && (bin.brand === 'AMEX' ? /^\d{4}$/.test(cvc) : /^\d{3}$/.test(cvc));
  if (!cvcValid) {
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
