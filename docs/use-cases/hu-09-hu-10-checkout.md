# HU-09/HU-10: checkout, pago simulado y comisión

## Objetivo

Probar el checkout de cuatro pasos desde el frontend: resumen, datos de entrega, pago y confirmación. El backend calcula un impuesto del 13%, valida el pago simulado, registra la orden y calcula la comisión cuando el artículo pertenece a un vendedor externo.

**El pago es una simulación para pruebas:** no ingreses datos de una tarjeta real. El frontend genera la llave de idempotencia automáticamente.

## Requisitos

- Git, Node.js 22 o superior, npm y Docker Compose v2.
- Linux con Docker Engine, Windows 10/11 con Docker Desktop para contenedores Linux, o macOS con Docker Desktop.
- Puertos `3000` y `5433` disponibles.

## Preparar la aplicación

Clona el proyecto y entra a su carpeta con las instrucciones del [README](../../README.md#clonar-el-repositorio). Crea `backend/.env` a partir del archivo de ejemplo:

**Linux (bash):**

```bash
cp backend/.env.example backend/.env
```

**macOS (Terminal/zsh):**

```bash
cp backend/.env.example backend/.env
```

**Windows PowerShell:**

```powershell
Copy-Item backend/.env.example backend/.env
```

**Windows CMD:**

```cmd
copy backend\.env.example backend\.env
```

Desde la raíz, inicia PostgreSQL:

```bash
docker compose up -d db
```

En un volumen de Docker existente, la inicialización no se repite automáticamente. Si el backend muestra que falta una tabla como `checkout_sessions`, aplica el esquema actual a la base `legado_origen`:

**Linux/macOS:**

```bash
docker compose exec -T db psql -U postgres -d legado_origen < backend/src/db/schema.sql
```

**Windows PowerShell:**

```powershell
Get-Content -Raw backend/src/db/schema.sql | docker compose exec -T db psql -U postgres -d legado_origen
```

**Windows CMD:**

```cmd
docker compose exec -T db psql -U postgres -d legado_origen < backend\src\db\schema.sql
```

En una terminal, carga los compradores y artículos demo e inicia el backend:

```text
cd backend
npm ci
npm run seed:demo
npm run dev
```

La seed demo deja los artículos disponibles con stock. En una segunda terminal inicia el frontend:

```text
cd frontend
npm ci
npm start
```

Los comandos anteriores son iguales en Linux, macOS, PowerShell y CMD. La URL del backend predeterminada es `http://localhost:3000/api`. Si necesitas cambiarla, ejecuta desde `frontend/`:

| Sistema            | Comando                                                 |
| ------------------ | ------------------------------------------------------- |
| Linux/macOS        | `API_URL=http://localhost:3000/api npm start`           |
| Windows PowerShell | `$env:API_URL = "http://localhost:3000/api"; npm start` |
| Windows CMD        | `set API_URL=http://localhost:3000/api&& npm start`     |

## Checkout aprobado desde la interfaz

1. Inicia sesión con `Ana`.
2. En el catálogo, elige un artículo disponible con las flechas y presiona Enter para reservarlo.
3. En el carrito, presiona `p` para pagar. Espera a que aparezca el resumen con subtotal, impuesto y total.
4. Presiona Enter para continuar a los datos de entrega.
5. Completa cada campo y presiona Enter después de cada uno:

   | Campo             | Dato de ejemplo          |
   | ----------------- | ------------------------ |
   | Nombre completo   | `Ana Demo`               |
   | Correo de entrega | `ana.prueba@example.com` |
   | Teléfono          | `88888888`               |
   | Provincia         | `San José`               |
   | Cantón            | `San José`               |
   | Distrito          | `Carmen`                 |
   | Dirección         | `Calle Central 123`      |

6. En pago, ingresa estos **datos ficticios** y presiona Enter en cada campo:

   | Campo               | Dato de prueba aprobado |
   | ------------------- | ----------------------- |
   | Número de tarjeta   | `4916911234567890`      |
   | Vencimiento (MM/AA) | `12/30`                 |
   | CVC                 | `123`                   |

7. El frontend usa el total calculado en el resumen. Si el pago se aprueba, debe aparecer una confirmación con el código de orden, el correo y el total.

## Comprobar un pago rechazado

Repite los pasos del checkout y usa el número ficticio `0000001234567890`, con vencimiento `12/30` y CVC `123`. Tiene 16 dígitos, pero su BIN no está en la lista de prueba, por lo que el backend debe rechazarlo e indicar que el BIN no corresponde a un banco autorizado.

Otras validaciones que puedes probar:

- Un vencimiento anterior al mes actual: tarjeta vencida.
- Un CVC con longitud incorrecta: CVC inválido.
- Pagar un artículo sin stock: producto no disponible o sin stock.
- Cambiar los datos para que el pago no coincida con el total: el backend rechaza la solicitud.

## Pruebas automatizadas

Desde la raíz, inicia PostgreSQL con `docker compose up -d db`. Las pruebas de integración del backend usan `legado_origen_test`; Vitest prepara el esquema de pruebas.

Desde `backend/`:

```bash
npm test -- tests/integration/checkout.test.ts tests/unit/checkout.test.ts
npm run test:coverage
```

Desde `frontend/`:

```bash
npm test
npm run test:coverage
```

## Resultado esperado

Con los datos aprobados, se registra una orden pagada con un código `LO-XXXXXXXX`, se reduce el stock y se guarda la transacción. Para un vendedor externo también se registra la comisión configurada. Con tarjeta, vencimiento, CVC, moneda o stock inválido, el checkout presenta un error y no confirma la compra.
