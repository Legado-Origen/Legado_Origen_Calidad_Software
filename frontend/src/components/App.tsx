import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { LoginScreen } from './LoginScreen';
import { CatalogScreen } from './CatalogScreen';
import { CartScreen } from './CartScreen';
import {
  createReservationApi,
  type Buyer,
  type CatalogItem,
  type Reservation,
  type ReservationApi,
} from '../services/reservationApi';

const defaultApi = createReservationApi();
type View = 'catalog' | 'cart';

export function App({ api = defaultApi }: { api?: ReservationApi }): React.ReactElement {
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [view, setView] = useState<View>('catalog');
  const { exit } = useApp();

  const login = async (loggedInBuyer: Buyer): Promise<void> => {
    try {
      const [catalog, activeReservations] = await Promise.all([
        api.listItems(),
        api.getCart(loggedInBuyer.id),
      ]);
      setBuyer(loggedInBuyer);
      setItems(catalog);
      setReservations(activeReservations);
      setView(activeReservations.length > 0 ? 'cart' : 'catalog');
    } catch (error) {
      await api.logout(loggedInBuyer);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    if (!buyer) return;
    try {
      await api.logout(buyer);
      setBuyer(null);
      setItems([]);
      setReservations([]);
      setView('catalog');
    } catch {
      // Keep the session open if the backend could not release it.
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      void (async () => {
        await logout();
        exit();
      })();
    }
  });

  const reserve = async (buyerId: number, item: CatalogItem): Promise<void> => {
    const reservation = await api.reserveItem(buyerId, item.id);
    setReservations((current) => [
      ...current.filter((saved) => saved.itemId !== reservation.itemId),
      { ...reservation, title: item.title, price: item.price },
    ]);
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, status: 'reserved', reservedUntil: reservation.reservedUntil }
          : candidate,
      ),
    );
    setView('cart');
  };

  const cancelReservation = async (buyerId: number, itemId: number): Promise<void> => {
    await api.cancelReservation(buyerId, itemId);
    setReservations((current) => current.filter((reservation) => reservation.itemId !== itemId));
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: 'available', reservedUntil: null } : item,
      ),
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="magenta">
        Legado &amp; Origen
      </Text>
      {!buyer ? (
        <LoginScreen api={api} onLogin={login} />
      ) : view === 'cart' ? (
        <CartScreen
          reservations={reservations}
          onBack={() => setView('catalog')}
          onLogout={() => {
            void logout();
          }}
          onCancel={(itemId) => cancelReservation(buyer.id, itemId)}
        />
      ) : (
        <CatalogScreen
          buyerName={buyer.name}
          items={items}
          ownReservationIds={reservations.map(({ itemId }) => itemId)}
          onReserve={(item) => reserve(buyer.id, item)}
          cartSize={reservations.length}
          onOpenCart={() => setView('cart')}
          onLogout={() => {
            void logout();
          }}
        />
      )}
    </Box>
  );
}
