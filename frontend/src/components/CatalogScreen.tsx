import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Menu, type MenuOption } from './Menu';
import { formatCRC } from '../domain/pricing';
import type { CatalogItem } from '../services/reservationApi';
import type { ReservationApiError } from '../services/reservationApi';

interface Props {
  buyerName: string;
  items: CatalogItem[];
  ownReservationIds: number[];
  onReserve: (item: CatalogItem) => Promise<void>;
  onOpenCart: () => void;
  onLogout: () => void;
  cartSize: number;
}

const statusLabel: Record<CatalogItem['status'], string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  pending_approval: 'Pendiente de aprobación',
  rejected: 'No aprobado',
  sold: 'Vendido',
};

export function toOptions(items: CatalogItem[]): MenuOption[] {
  return items.map((item) => ({
    value: String(item.id),
    color: item.status === 'available' ? 'green' : 'yellow',
    label: `${item.title} — ${formatCRC(Number(item.price))} [${statusLabel[item.status]}]`,
  }));
}

export function CatalogScreen({ buyerName, items, ownReservationIds, onReserve, onOpenCart, onLogout, cartSize }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useInput((input) => {
    if (input === 'c') onOpenCart();
    else if (input === 'l') onLogout();
  });

  const select = async (option: MenuOption): Promise<void> => {
    const item = items.find((candidate) => String(candidate.id) === option.value)!;
    if (item.status !== 'available') {
      if (ownReservationIds.includes(item.id)) {
        onOpenCart();
        return;
      }
      setError('Este artículo no está disponible para reservar.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onReserve(item);
    } catch (cause) {
      setError((cause as ReservationApiError).message ?? 'No se pudo reservar el artículo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box flexDirection="column">
      <Text color="cyan">Bienvenido, {buyerName}</Text>
      <Text bold>Artículos disponibles</Text>
      {items.length === 0
        ? <Text>No hay artículos cargados.</Text>
        : <Menu options={toOptions(items)} onSelect={select} isActive={!busy} />}
      {error && <Text color="red">{error}</Text>}
      {busy && <Text color="yellow">Reservando…</Text>}
      <Text dimColor>↑/↓ elegir · Enter reservar · c ver carrito ({cartSize}) · l cerrar sesión</Text>
    </Box>
  );
}
