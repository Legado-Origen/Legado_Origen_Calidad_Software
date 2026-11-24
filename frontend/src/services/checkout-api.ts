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
  currency: 'CRC' | 'USD';
}

export interface PaymentData {
  cardNumber: string;
  expirationDate: string;
  cvc: string;
  currency: 'CRC' | 'USD';
  amount: number;
}

export interface CheckoutPreview {
  step: 'summary';
  subtotal: number;
  tax: number;
  total: number;
  currency: 'CRC' | 'USD';
  items: Array<{
    itemId: number;
    title: string;
    price: number;
    quantity: number;
  }>;
}

export interface CheckoutConfirmation {
  approved: boolean;
  idempotent?: boolean;
  orderCode: string;
  status: string;
  subtotal?: number;
  tax?: number;
  total: number;
  currency: 'CRC' | 'USD';
  confirmation?: {
    step: 'confirmation';
    deliveryEmail: string;
  };
  commissions?: Array<{
    sellerId: number;
    commissionRate: number;
    commissionAmount: number;
  }>;
}

export interface CheckoutApi {
  preview(items: CheckoutItem[], shipping?: Partial<ShippingData>): Promise<CheckoutPreview>;
  complete(input: {
    buyerId: number;
    items: CheckoutItem[];
    shipping: ShippingData;
    payment: PaymentData;
  }): Promise<CheckoutConfirmation>;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function createCheckoutApi(
  apiUrl = process.env.API_URL ?? 'http://localhost:3000/api',
): CheckoutApi {
  const root = apiUrl.replace(/\/$/, '');
  const apiRoot = root.endsWith('/api') ? root : `${root}/api`;
  return {
    async preview(items, shipping) {
      const response = await fetch(`${apiRoot}/checkout/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, shipping }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'No se pudo calcular el resumen'));
      }
      return payload as CheckoutPreview;
    },

    async complete(input) {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch(`${apiRoot}/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(input),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'No se pudo completar el pago'));
      }
      return payload as CheckoutConfirmation;
    },
  };
}
