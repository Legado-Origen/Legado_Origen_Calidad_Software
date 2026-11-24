import { randomBytes } from 'node:crypto';

export const TAX_RATE = 0.13;
export const INVALID_CHECKOUT = 'Solicitud inválida';

export interface CheckoutItem {
  itemId: number;
  quantity: number;
}

export interface ShippingData {
  name: string;
  email: string;
  phone: string;
  provincia: string;
  canton: string;
  distrito: string;
  direccion: string;
}

export interface PaymentData {
  cardNumber: string;
  expirationDate: string;
  cvc: string;
  currency: string;
  amount: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCommission(
  sellerId: number | null,
  sellerSubtotal: number,
  commissionRate: number,
) {
  if (sellerId === null) {
    return { commissionAmount: 0, sellerNet: roundMoney(sellerSubtotal), commissionRate: 0 };
  }
  const rate = Math.min(1, Math.max(0, commissionRate));
  const commissionAmount = roundMoney(sellerSubtotal * rate);
  return {
    commissionAmount,
    sellerNet: roundMoney(sellerSubtotal - commissionAmount),
    commissionRate: rate,
  };
}

export function calculateTotals(subtotal: number) {
  const normalizedSubtotal = roundMoney(subtotal);
  const tax = roundMoney(normalizedSubtotal * TAX_RATE);
  return { subtotal: normalizedSubtotal, tax, total: roundMoney(normalizedSubtotal + tax) };
}

export function generateOrderCode(): string {
  return `LO-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function validateCardNumber(cardNumber: unknown): boolean {
  return typeof cardNumber === 'string' && /^\d{16}$/.test(cardNumber);
}

export function validateExpirationDate(expirationDate: unknown): boolean {
  if (typeof expirationDate !== 'string' || !/^\d{2}\/\d{2}$/.test(expirationDate)) {
    return false;
  }
  const [month, year] = expirationDate.split('/').map(Number);
  if (month < 1 || month > 12) return false;
  const expiration = new Date(2000 + year, month, 1);
  const now = new Date();
  const minimum = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return expiration > minimum;
}

export function validateCvc(cvc: unknown, brand: string): boolean {
  if (typeof cvc !== 'string') return false;
  if (brand === 'AMEX') return /^\d{4}$/.test(cvc);
  return /^\d{3}$/.test(cvc);
}

export function validateShipping(value: unknown): value is ShippingData {
  if (typeof value !== 'object' || value === null) return false;
  const shipping = value as Partial<ShippingData>;
  const fields = [
    shipping.name,
    shipping.email,
    shipping.phone,
    shipping.provincia,
    shipping.canton,
    shipping.distrito,
    shipping.direccion,
  ];
  return fields.every((field) => typeof field === 'string' && field.trim().length > 0);
}

export function validateCheckoutItems(value: unknown): value is CheckoutItem[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.itemId === 'number' &&
      Number.isInteger(candidate.itemId) &&
      candidate.itemId > 0 &&
      typeof candidate.quantity === 'number' &&
      Number.isInteger(candidate.quantity) &&
      candidate.quantity > 0
    );
  });
}

export function validateCurrency(currency: unknown): currency is 'CRC' | 'USD' {
  return typeof currency === 'string' && ['CRC', 'USD'].includes(currency.toUpperCase());
}
