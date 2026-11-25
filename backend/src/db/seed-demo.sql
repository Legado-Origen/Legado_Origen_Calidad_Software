INSERT INTO users (name, email)
VALUES
  ('Ana', 'ana.demo@legado-origen.test'),
  ('Luis', 'luis.demo@legado-origen.test'),
  ('María', 'maria.demo@legado-origen.test'),
  ('Vendedor Demo', 'vendedor.demo@legado-origen.test')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE items ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES users (id) ON DELETE SET NULL;

INSERT INTO items (title, price, status)
SELECT demo.title, demo.price, 'available'
FROM (VALUES
  ('Reloj de bolsillo Waltham 1912', 185000.00),
  ('Máquina de coser Singer 1920', 240000.00),
  ('Carreta típica pintada de Sarchí', 320000.00),
  ('Gramófono Victrola 1925', 410000.00)
) AS demo(title, price)
WHERE NOT EXISTS (
  SELECT 1 FROM items existing WHERE existing.title = demo.title
);

UPDATE items
SET stock = GREATEST(stock, 2),
    seller_id = (SELECT id FROM users WHERE email = 'vendedor.demo@legado-origen.test')
WHERE title IN (
  'Reloj de bolsillo Waltham 1912',
  'Máquina de coser Singer 1920',
  'Carreta típica pintada de Sarchí',
  'Gramófono Victrola 1925'
);
