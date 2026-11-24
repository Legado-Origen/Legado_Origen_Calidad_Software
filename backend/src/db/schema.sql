CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'available', 'rejected', 'sold')),
  reserved_by INTEGER REFERENCES users (id),
  reserved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT items_reservation_consistency
    CHECK ((reserved_by IS NULL) = (reserved_until IS NULL))
);