import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { formatCRC } from '../domain/pricing';
import type {
  CheckoutApi,
  CheckoutConfirmation,
  CheckoutPreview,
  PaymentData,
  ShippingData,
} from '../services/checkout-api';
import type { Buyer, Reservation } from '../services/reservationApi';

type Step = 'summary' | 'shipping' | 'payment' | 'confirmation';

interface Props {
  api: CheckoutApi;
  buyer: Buyer;
  reservations: Reservation[];
  onBack: () => void;
  onCompleted: (confirmation: CheckoutConfirmation) => void;
}

const emptyShipping: ShippingData = {
  name: '',
  email: '',
  phone: '',
  provincia: '',
  canton: '',
  distrito: '',
  direccion: '',
  currency: 'CRC',
};

const emptyPayment: PaymentData = {
  cardNumber: '',
  expirationDate: '',
  cvc: '',
  currency: 'CRC',
  amount: 0,
};

const shippingFields: Array<{
  key: Exclude<keyof ShippingData, 'currency'>;
  label: string;
}> = [
  { key: 'name', label: 'Nombre completo' },
  { key: 'email', label: 'Correo de entrega' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'canton', label: 'Cantón' },
  { key: 'distrito', label: 'Distrito' },
  { key: 'direccion', label: 'Dirección' },
];

function getShippingField(index: number): (typeof shippingFields)[number] {
  if (index === 0) return shippingFields[0];
  if (index === 1) return shippingFields[1];
  if (index === 2) return shippingFields[2];
  if (index === 3) return shippingFields[3];
  if (index === 4) return shippingFields[4];
  if (index === 5) return shippingFields[5];
  return shippingFields[6];
}

function getPaymentField(index: number) {
  if (index === 0) return { key: 'cardNumber' as const, label: 'Número de tarjeta' };
  if (index === 1) return { key: 'expirationDate' as const, label: 'Vencimiento MM/AA' };
  return { key: 'cvc' as const, label: 'CVC' };
}

function getShippingValue(shipping: ShippingData, key: Exclude<keyof ShippingData, 'currency'>) {
  if (key === 'name') return shipping.name;
  if (key === 'email') return shipping.email;
  if (key === 'phone') return shipping.phone;
  if (key === 'provincia') return shipping.provincia;
  if (key === 'canton') return shipping.canton;
  if (key === 'distrito') return shipping.distrito;
  return shipping.direccion;
}

function updateShipping(
  shipping: ShippingData,
  key: Exclude<keyof ShippingData, 'currency'>,
  value: string,
): ShippingData {
  if (key === 'name') return { ...shipping, name: value };
  if (key === 'email') return { ...shipping, email: value };
  if (key === 'phone') return { ...shipping, phone: value };
  if (key === 'provincia') return { ...shipping, provincia: value };
  if (key === 'canton') return { ...shipping, canton: value };
  if (key === 'distrito') return { ...shipping, distrito: value };
  return { ...shipping, direccion: value };
}

function getPaymentValue(payment: PaymentData, key: 'cardNumber' | 'expirationDate' | 'cvc') {
  if (key === 'cardNumber') return payment.cardNumber;
  if (key === 'expirationDate') return payment.expirationDate;
  return payment.cvc;
}

function updatePayment(
  payment: PaymentData,
  key: 'cardNumber' | 'expirationDate' | 'cvc',
  value: string,
): PaymentData {
  if (key === 'cardNumber') return { ...payment, cardNumber: value };
  if (key === 'expirationDate') return { ...payment, expirationDate: value };
  return { ...payment, cvc: value };
}

// El componente coordina de forma deliberada los estados de los cuatro pasos.
// eslint-disable-next-line complexity
export function CheckoutScreen({
  api,
  buyer,
  reservations,
  onBack,
  onCompleted,
}: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('summary');
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [shipping, setShipping] = useState<ShippingData>(emptyShipping);
  const [shippingIndex, setShippingIndex] = useState(0);
  const [payment, setPayment] = useState<PaymentData>(emptyPayment);
  const [paymentIndex, setPaymentIndex] = useState(0);
  const [confirmation, setConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const items = reservations.map((reservation) => ({
      itemId: reservation.itemId,
      quantity: 1,
    }));
    api
      .preview(items)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo calcular el resumen.');
        }
      });
    return () => {
      active = false;
    };
  }, [api, reservations]);

  useInput((input) => {
    if (input === 'b' && !busy) onBack();
  });

  if (step === 'summary') {
    return (
      <Box flexDirection="column">
        <Text bold>Checkout - 1. Resumen</Text>
        {error && <Text color="red">{error}</Text>}
        {preview ? (
          <Box flexDirection="column">
            {preview.items.map((item) => (
              <Text key={item.itemId}>
                {item.title} x{item.quantity} — {formatCRC(item.price * item.quantity)}
              </Text>
            ))}
            <Text>Subtotal: {formatCRC(preview.subtotal)}</Text>
            <Text>Impuesto: {formatCRC(preview.tax)}</Text>
            <Text bold>Total: {formatCRC(preview.total)}</Text>
          </Box>
        ) : (
          <Text color="yellow">Calculando resumen…</Text>
        )}
        <TextInput
          value=""
          onChange={() => undefined}
          placeholder="Presione Enter para continuar"
          onSubmit={() => {
            if (preview) setStep('shipping');
          }}
        />
        <Text dimColor>b volver al carrito</Text>
      </Box>
    );
  }

  if (step === 'shipping') {
    const field = getShippingField(shippingIndex);
    return (
      <Box flexDirection="column">
        <Text bold>Checkout - 2. Datos de entrega</Text>
        {error && <Text color="red">{error}</Text>}
        <Text>{field.label}: </Text>
        <TextInput
          value={getShippingValue(shipping, field.key)}
          onChange={(value) => setShipping((current) => updateShipping(current, field.key, value))}
          onSubmit={() => {
            if (getShippingValue(shipping, field.key).trim().length === 0) {
              setError(`${field.label} es requerido.`);
              return;
            }
            setError(null);
            if (shippingIndex < shippingFields.length - 1) {
              setShippingIndex((current) => current + 1);
            } else {
              setStep('payment');
            }
          }}
        />
        <Text dimColor>b volver al carrito</Text>
      </Box>
    );
  }

  if (step === 'payment') {
    const field = getPaymentField(paymentIndex);

    const submitPayment = async (): Promise<void> => {
      if (getPaymentValue(payment, field.key).trim().length === 0) {
        setError(`${field.label} es requerido.`);
        return;
      }
      setError(null);
      if (paymentIndex < 2) {
        setPaymentIndex((current) => current + 1);
        return;
      }
      if (!preview) return;
      setBusy(true);
      try {
        const result = await api.complete({
          buyerId: buyer.id,
          items: reservations.map((reservation) => ({
            itemId: reservation.itemId,
            quantity: 1,
          })),
          shipping,
          payment: { ...payment, amount: preview.total, currency: preview.currency },
        });
        setConfirmation(result);
        onCompleted(result);
        setStep('confirmation');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo completar el pago.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <Box flexDirection="column">
        <Text bold>Checkout - 3. Pago seguro</Text>
        {preview && <Text>Total: {formatCRC(preview.total)}</Text>}
        {error && <Text color="red">{error}</Text>}
        <Text>{field.label}: </Text>
        <TextInput
          value={getPaymentValue(payment, field.key)}
          onChange={(value) => setPayment((current) => updatePayment(current, field.key, value))}
          onSubmit={() => void submitPayment()}
        />
        {busy && <Text color="yellow">Procesando pago…</Text>}
        <Text dimColor>b volver al carrito</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Checkout - 4. Confirmación</Text>
      {confirmation?.approved ? (
        <>
          <Text color="green">Pago aprobado</Text>
          <Text>Código de orden: {confirmation.orderCode}</Text>
          <Text>Entrega: {confirmation.confirmation?.deliveryEmail ?? shipping.email}</Text>
          <Text>Total: {formatCRC(confirmation.total)}</Text>
        </>
      ) : (
        <Text color="red">{error ?? 'No se pudo confirmar la compra.'}</Text>
      )}
      <Text dimColor>b volver al carrito</Text>
    </Box>
  );
}
