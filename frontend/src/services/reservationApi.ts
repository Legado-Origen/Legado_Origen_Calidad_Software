export interface Buyer { id: number; name: string; sessionToken: string }

export type ItemStatus = 'available' | 'reserved' | 'pending_approval' | 'rejected' | 'sold';

export interface CatalogItem {
  id: number;
  title: string;
  price: number | string;
  status: ItemStatus;
  reservedUntil: string | null;
}

export interface Reservation {
  itemId: number;
  buyerId: number;
  title: string;
  price: number | string;
  reservedUntil: string;
}

export interface ReservationApi {
  login(name: string): Promise<Buyer>;
  logout(buyer: Buyer): Promise<void>;
  listItems(): Promise<CatalogItem[]>;
  getCart(buyerId: number): Promise<Reservation[]>;
  reserveItem(buyerId: number, itemId: number): Promise<Reservation>;
  cancelReservation(buyerId: number, itemId: number): Promise<void>;
}

export class ReservationApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ReservationApiError';
  }
}

type FetchFn = typeof fetch;

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export function createReservationApi(
  baseUrl = process.env.API_URL ?? 'http://localhost:3000/api',
  fetchFn: FetchFn = fetch,
): ReservationApi {
  const root = baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(`${root}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      });
    } catch {
      throw new ReservationApiError(0, 'No se pudo conectar con el backend.');
    }

    const body = await responseBody(response);
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'message' in body
        && typeof body.message === 'string'
        ? body.message
        : `Error HTTP ${response.status}`;
      throw new ReservationApiError(response.status, message);
    }
    return body as T;
  }

  return {
    login: (name) => request<Buyer>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
    async logout(buyer) {
      await request<null>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ buyerId: buyer.id, sessionToken: buyer.sessionToken }),
      });
    },
    listItems: () => request<CatalogItem[]>('/items'),
    getCart: (buyerId) => request<Reservation[]>(`/carts/${buyerId}`),
    reserveItem: (buyerId, itemId) => request<Reservation>(`/carts/${buyerId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),
    async cancelReservation(buyerId, itemId) {
      await request<null>(`/carts/${buyerId}/items/${itemId}`, { method: 'DELETE' });
    },
  };
}
