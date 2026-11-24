import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { ReservationApiError, type Buyer, type ReservationApi } from '../services/reservationApi';

interface Props {
  api: ReservationApi;
  onLogin: (buyer: Buyer) => Promise<void>;
}

export function LoginScreen({ api, onLogin }: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (input: string): Promise<void> => {
    if (!input.trim()) {
      setError('Ingresa tu nombre.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onLogin(await api.login(input.trim()));
    } catch (cause) {
      setError(cause instanceof ReservationApiError ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>Inicio de sesión</Text>
      <Text dimColor>Escribe tu nombre de usuario demo (Ana, Luis o María).</Text>
      <Box>
        <Text>Nombre: </Text>
        <TextInput value={name} onChange={setName} onSubmit={submit} />
      </Box>
      {busy && <Text color="yellow">Cargando catálogo y carrito…</Text>}
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
