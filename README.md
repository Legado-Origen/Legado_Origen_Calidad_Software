# Proyecto de Calidad de Software - Sistema POS

<p align="center">
  <img src="logo.jpg" alt="Logo de Legado & Origen" width="280">
</p>

**Legado & Origen** es una aplicación de demostración para comprar y vender piezas de colección y antigüedades. Este repositorio implementa una interfaz interactiva de terminal, una API REST y una base de datos relacional.

## Equipo

| Integrante           | Carné  |
| -------------------- | ------ |
| Henry Rojas          | C16812 |
| Lelis Salazar        | C17168 |
| Eduardo Sancho Selva | C17343 |

## Estructura del proyecto

```text
Legado_Origen_Calidad_Software/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuración del servidor
│   │   ├── db/              # Esquema, conexión y datos de demostración
│   │   ├── middleware/      # Manejo centralizado de errores
│   │   ├── modules/
│   │   │   ├── auth/        # Inicio y cierre de sesión
│   │   │   ├── carts/       # Carrito y reservas
│   │   │   ├── checkout/    # Compra, pago simulado y comisiones
│   │   │   └── items/       # Catálogo de artículos
│   │   ├── shared/          # Tipos y utilidades compartidas
│   │   ├── app.ts           # Configuración de rutas y middleware
│   │   └── server.ts        # Inicio del servidor HTTP
│   └── tests/
│       ├── helpers/         # Utilidades para las pruebas
│       ├── integration/     # Pruebas de API y PostgreSQL
│       ├── setup/           # Preparación de la base de pruebas
│       └── unit/            # Pruebas unitarias
├── frontend/
│   ├── src/
│   │   ├── components/      # Pantallas de terminal
│   │   ├── domain/          # Lógica de dominio del frontend
│   │   ├── services/        # Clientes HTTP para el backend
│   │   └── index.tsx        # Entrada de la aplicación de terminal
│   └── tests/               # Pruebas del frontend
├── docker/
│   └── 02-create-test-database.sql
├── docs/
│   ├── pull-requests/       # Documentación de propuestas de cambio
│   ├── use-cases/           # Guías de los casos de uso
│   └── design-and-architecture.md
├── docker-compose.yml       # PostgreSQL local y configuración de pruebas
└── README.md
```

## Arquitectura

- **Frontend:** Node.js, TypeScript, React e Ink. Es una aplicación de terminal, no una página web.
- **Backend:** Node.js 22+, TypeScript y Express 5. Expone la API en `http://localhost:3000/api`.
- **Base de datos:** PostgreSQL 16, ejecutado con Docker Compose.
- **Pruebas:** Vitest y Supertest; cobertura con V8.

El frontend permite ingresar con un comprador demo, ver el catálogo, reservar y cancelar artículos, recuperar el carrito y completar el checkout. El backend valida las operaciones y persiste la información en PostgreSQL. El pago es simulado: no se procesa ningún cargo real.

## Sistemas operativos compatibles

El proyecto se puede ejecutar en:

- Linux (por ejemplo, Ubuntu), con Docker Engine y Docker Compose v2.
- Windows 10/11, con Docker Desktop configurado para contenedores Linux; se recomienda PowerShell o Windows Terminal.
- macOS, con Docker Desktop.

Los comandos de Node y npm son los mismos en los tres sistemas. Para copiar archivos `.env` y aplicar el esquema SQL se incluyen las variantes de PowerShell y CMD cuando difieren del shell de Linux/macOS.

## Requisitos

- Git.
- Node.js 22 o superior y npm.
- Docker con Docker Compose v2.
- Puertos locales `3000` (API) y `5433` (PostgreSQL) disponibles.
- Conexión a internet para clonar el repositorio y descargar dependencias e imagen de PostgreSQL.

## Clonar el repositorio

```bash
git clone https://github.com/Legado-Origen/Legado_Origen_Calidad_Software.git
cd Legado_Origen_Calidad_Software
```

## Preparar el entorno

### 1. Crear la configuración local del backend

Desde la raíz del repositorio:

**Linux/macOS (bash o zsh):**

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

El archivo de ejemplo conecta el backend al contenedor local y configura el puerto `3000`. No uses estas credenciales de demostración fuera de tu equipo local.

### 2. Iniciar PostgreSQL

Desde la raíz:

```bash
docker compose up -d db
```

En un volumen nuevo, Docker crea las tablas de `backend/src/db/schema.sql` y la base de pruebas. Si ya tienes un volumen anterior al esquema actual, aplica el esquema actualizado a la base de desarrollo:

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

### 3. Instalar dependencias y cargar los datos demo

Abre una terminal en `backend/` y ejecuta:

```bash
npm ci
npm run seed:demo
```

La seed crea los compradores demo **Ana**, **Luis** y **María**, un vendedor demo y artículos disponibles con stock. Luego inicia el backend en esa terminal:

```bash
npm run dev
```

Abre otra terminal en `frontend/` y ejecuta:

```bash
npm ci
npm start
```

El frontend usa `http://localhost:3000/api` de forma predeterminada. Para cambiarlo, configura la variable `API_URL` antes de `npm start`:

**Linux/macOS:** `API_URL=http://localhost:3000/api npm start`

**PowerShell:** `$env:API_URL = "http://localhost:3000/api"; npm start`

**CMD:** `set API_URL=http://localhost:3000/api&& npm start`

## Ejecutar las pruebas

Inicia PostgreSQL primero para las pruebas de integración del backend:

```bash
docker compose up -d db
```

Las pruebas backend usan la base `legado_origen_test`; Vitest prepara su esquema antes de ejecutarlas. Desde `backend/`:

```bash
npm test
npm run test:coverage
```

Desde `frontend/` (no necesita conexión a PostgreSQL):

```bash
npm test
npm run test:coverage
```

Para revisar también tipos, lint y formato, ejecuta `npm run typecheck`, `npm run lint` y `npm run format:check` en cada carpeta. Los umbrales de cobertura configurados para backend y frontend son 90% en líneas, funciones, ramas y sentencias.

## Instrucciones para probar los casos de uso

- [Probar HU-08: reservar y cancelar un artículo](docs/use-cases/hu-08-reserva-de-articulo.md)
- [Probar HU-09/HU-10: checkout, pago y comisión](docs/use-cases/hu-09-hu-10-checkout.md)
- [Diseño y arquitectura](docs/design-and-architecture.md)
