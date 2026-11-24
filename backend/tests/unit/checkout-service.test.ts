import { describe, expect, it } from 'vitest';
import {
  calculateCommission,
  calculateTotals,
  generateOrderCode,
  roundMoney,
  validateShipping,
} from '../../src/modules/checkout/checkout-service.js';

describe('checkout service', () => {
  it('rounds money and calculates totals with tax', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(calculateTotals(100.005)).toEqual({ subtotal: 100.01, tax: 13, total: 113.01 });
  });

  it('calculates seller commissions and leaves unsold-platform items commission free', () => {
    expect(calculateCommission(null, 100, 0.2)).toEqual({
      commissionAmount: 0,
      sellerNet: 100,
      commissionRate: 0,
    });
    expect(calculateCommission(7, 100, 0.2)).toEqual({
      commissionAmount: 20,
      sellerNet: 80,
      commissionRate: 0.2,
    });
    expect(calculateCommission(7, 100, -1)).toMatchObject({
      commissionAmount: 0,
      sellerNet: 100,
      commissionRate: 0,
    });
    expect(calculateCommission(7, 100, 2)).toMatchObject({
      commissionAmount: 100,
      sellerNet: 0,
      commissionRate: 1,
    });
  });

  it('generates order codes in the expected format', () => {
    expect(generateOrderCode()).toMatch(/^LO-[A-F0-9]{8}$/);
  });

  it('accepts complete shipping details and rejects missing or blank fields', () => {
    const shipping = {
      name: 'Ana',
      email: 'ana@example.test',
      phone: '88887777',
      provincia: 'San José',
      canton: 'Central',
      distrito: 'Carmen',
      direccion: 'Avenida Central',
    };

    expect(validateShipping(shipping)).toBe(true);
    expect(validateShipping(null)).toBe(false);
    expect(validateShipping('shipping')).toBe(false);

    for (const field of Object.keys(shipping)) {
      expect(validateShipping({ ...shipping, [field]: '  ' })).toBe(false);
      const incomplete = { ...shipping };
      delete (incomplete as Partial<typeof shipping>)[field as keyof typeof shipping];
      expect(validateShipping(incomplete)).toBe(false);
    }
  });
});
