import { randomBytes } from 'node:crypto';

export const TAX_RATE = 0.13;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTotals(subtotal: number) {
  const normalized = roundMoney(subtotal);
  const tax = roundMoney(normalized * TAX_RATE);
  return { subtotal: normalized, tax, total: roundMoney(normalized + tax) };
}

export function calculateCommission(sellerId: number | null, subtotal: number, rate: number) {
  if (sellerId === null) {
    return { commissionAmount: 0, sellerNet: roundMoney(subtotal), commissionRate: 0 };
  }
  const normalizedRate = Math.min(1, Math.max(0, rate));
  const commissionAmount = roundMoney(subtotal * normalizedRate);
  return {
    commissionAmount,
    sellerNet: roundMoney(subtotal - commissionAmount),
    commissionRate: normalizedRate,
  };
}

export function generateOrderCode(): string {
  return `LO-${randomBytes(4).toString('hex').toUpperCase()}`;
}

// eslint-disable-next-line complexity
export function validateShipping(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false;
  const shipping = value as Partial<Record<string, string>>;
  return (
    typeof shipping.name === 'string' &&
    shipping.name.trim().length > 0 &&
    typeof shipping.email === 'string' &&
    shipping.email.trim().length > 0 &&
    typeof shipping.phone === 'string' &&
    shipping.phone.trim().length > 0 &&
    typeof shipping.provincia === 'string' &&
    shipping.provincia.trim().length > 0 &&
    typeof shipping.canton === 'string' &&
    shipping.canton.trim().length > 0 &&
    typeof shipping.distrito === 'string' &&
    shipping.distrito.trim().length > 0 &&
    typeof shipping.direccion === 'string' &&
    shipping.direccion.trim().length > 0
  );
}
