# HU-08: reservar y cancelar un artículo

## Objetivo

Probar desde la aplicación de terminal el catálogo, la reserva temporal de un artículo, la privacidad del comprador que reservó y la recuperación o cancelación de una reserva.

Una reserva dura **15 minutos**. El mismo artículo no se puede reservar al mismo tiempo para dos compradores. El catálogo informa que está reservado, pero no revela quién lo reservó.

## Requisitos

- Git, Node.js 22 o superior, npm y Docker Compose v2.
- Linux con Docker Engine, Windows 10/11 con Docker Desktop para contenedores Linux, o macOS con Docker Desktop.
- Puertos `3000` y `5433` disponibles.

## Preparar la aplicación

Clona el proyecto y entra a su carpeta siguiendo las instrucciones del [README](../../README.md#clonar-el-repositorio). Crea `backend/.env` desde `backend/.env.example`:

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

Desde la raíz del repositorio, inicia PostgreSQL:

```bash
docker compose up -d db
```

Si ya tenías un volumen de Docker creado con una versión anterior del esquema, aplica el esquema actual una vez:

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

En una terminal, instala dependencias, carga los compradores/artículos demo e inicia el backend:

```text
cd backend
npm ci
npm run seed:demo
npm run dev
```

En una segunda terminal, inicia el frontend:

```text
cd frontend
npm ci
npm start
```

Estos comandos sirven en Linux, macOS, PowerShell y CMD. El frontend se conecta por defecto a `http://localhost:3000/api`. Si necesitas otra dirección, desde `frontend/` establece `API_URL` así:

| Sistema            | Comando                                                 |
| ------------------ | ------------------------------------------------------- |
| Linux/macOS        | `API_URL=http://localhost:3000/api npm start`           |
| Windows PowerShell | `$env:API_URL = "http://localhost:3000/api"; npm start` |
| Windows CMD        | `set API_URL=http://localhost:3000/api&& npm start`     |

## Pasos para probar

1. En el frontend, escribe `Ana` y presiona Enter. Debe aparecer `Bienvenido, Ana` y el catálogo con nombres, precios y estados.
2. Usa las flechas para elegir un artículo disponible y presiona Enter. Debe abrirse el carrito con la reserva y su vencimiento.
3. Presiona `b` para volver al catálogo. El artículo debe aparecer como reservado, sin el nombre de Ana.
4. Presiona `l` para cerrar sesión. Inicia sesión como `Luis`, localiza el mismo artículo e intenta seleccionarlo. Debe indicar que no está disponible, sin revelar quién lo reservó.
5. Cierra sesión con `l` e ingresa de nuevo como `Ana`. Como tiene una reserva activa, debe aparecer su carrito.
6. En el carrito, selecciona la reserva con las flechas y presiona `x`. Debe cancelarse y retirarse del carrito. Regresa al catálogo con `b` y confirma que el artículo figura disponible.
7. Opcional: reserva otra pieza como Ana y presiona `Ctrl+C`. Al iniciar de nuevo como Ana, su reserva activa debe seguir en el carrito. La sesión anterior se libera al salir.
8. Opcional: mantén abierta una sesión como Ana e intenta iniciar sesión como Ana en otra terminal. El segundo inicio debe rechazarse mientras exista una sesión activa.

Los compradores demo disponibles son `Ana`, `Luis` y `María`. El catálogo se vuelve a cargar desde la base de datos al iniciar sesión.

## Pruebas automatizadas

Inicia Docker con `docker compose up -d db` desde la raíz. Desde `backend/` ejecuta las pruebas de reserva y del API que usa el frontend:

```bash
npm test -- tests/integration/cart-reservation.test.ts tests/integration/frontend-api.test.ts
```

Para ejecutar las pruebas de interfaz y cliente, desde `frontend/`:

```bash
npm test
npm run test:coverage
```

## Resultado esperado

La reserva es exclusiva y temporal; Ana puede recuperar o cancelar la suya. Luis solo ve el estado reservado y no puede deducir la identidad de Ana. Una vez cancelada, la pieza queda disponible para reservarla de nuevo.
