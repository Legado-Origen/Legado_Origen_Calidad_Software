import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatCRC } from '../domain/pricing';
import type { Reservation } from '../services/reservationApi';

interface Props {
  reservations: Reservation[];
  onBack: () => void;
  onLogout: () => void;
  onCancel: (itemId: number) => Promise<void>;
  onCheckout: () => void;
}

export function CartScreen({
  reservations,
  onBack,
  onLogout,
  onCancel,
  onCheckout,
}: Props): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelSelected = async (): Promise<void> => {
    const reservation = reservations.slice(index, index + 1)[0];
    if (!reservation || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCancel(reservation.itemId);
      setIndex(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cancelar la reserva.');
    } finally {
      setBusy(false);
    }
  };

  useInput((input, key) => {
    if (key.upArrow && reservations.length > 0)
      setIndex((current) => (current - 1 + reservations.length) % reservations.length);
    else if (key.downArrow && reservations.length > 0)
      setIndex((current) => (current + 1) % reservations.length);
    else if (input === 'x') void cancelSelected();
    else if (input === 'b') onBack();
    else if (input === 'p' && reservations.length > 0) onCheckout();
    else if (input === 'l') onLogout();
  });

  return (
    <Box flexDirection="column">
      <Text bold>Carrito — reservas activas</Text>
      {reservations.length === 0 ? (
        <Text>No tienes reservas activas.</Text>
      ) : (
        reservations.map((reservation, reservationIndex) => (
          <Box key={reservation.itemId} flexDirection="column">
            <Text color={reservationIndex === index ? 'cyan' : undefined}>
              {reservationIndex === index ? '❯ ' : '  '}
              {reservation.title} — {formatCRC(Number(reservation.price))}
            </Text>
            <Text color="yellow">
              Reservado hasta {new Date(reservation.reservedUntil).toLocaleString()}
            </Text>
          </Box>
        ))
      )}
      {error && <Text color="red">{error}</Text>}
      {busy && <Text color="yellow">Cancelando reserva…</Text>}
      <Text dimColor>
        ↑/↓ elegir · x cancelar reserva · p pagar carrito · b volver al catálogo · l cerrar sesión
      </Text>
    </Box>
  );
}
