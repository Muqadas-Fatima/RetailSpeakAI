-- RetailSpeak AI — NLU/grounding half schema
-- TDD §13.1: Supabase-managed Postgres with pgvector enabled.
-- This file covers only the tables this half reads/writes (stores, products).
-- Order/Khata/Inventory-reservation/PurchaseOrder/Rider tables are owned by
-- the fulfillment half's own migration set (Foundation Plan §2.2).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS stores (
    store_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                        VARCHAR(255) NOT NULL,
    timezone                    VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
    rag_similarity_floor        NUMERIC(4,3),   -- NULL -> use process-wide default (0.72)
    rag_auto_accept_threshold   NUMERIC(4,3),   -- NULL -> use process-wide default (0.85)
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    product_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id         UUID NOT NULL REFERENCES stores(store_id),
    name_en          VARCHAR(255) NOT NULL,
    name_ur          VARCHAR(255),
    name_roman_ur    VARCHAR(255),
    aliases          TEXT,
    unit             VARCHAR(32) NOT NULL,
    price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    in_stock_qty     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (in_stock_qty >= 0),
    max_order_qty    NUMERIC(10,2),
    is_active        BOOLEAN NOT NULL DEFAULT true,
    embedding        VECTOR(384),  -- BGE-Small-EN-v1.5 (TDD §2.4, §14)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(store_id, is_active);

-- ivfflat cosine-distance index for RAG retrieval (TDD §2.4).
-- `lists` should scale with catalog size (~sqrt(n) rows is a common
-- starting heuristic); rebuild/ANALYZE after large catalog imports.
CREATE INDEX IF NOT EXISTS idx_products_embedding
    ON products USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ---------------------------------------------------------------------
-- Seed fixture for local/dev/CI — small bilingual kiryana catalog.
-- Embeddings are NOT populated here; run the reindex script
-- (scripts/backfill_embeddings.py) after loading this fixture so
-- RAG retrieval has real vectors to search against.
-- ---------------------------------------------------------------------
INSERT INTO stores (store_id, name, timezone)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Kiryana Store', 'Asia/Karachi')
ON CONFLICT DO NOTHING;

INSERT INTO products (store_id, name_en, name_ur, name_roman_ur, aliases, unit, price, in_stock_qty, max_order_qty)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Basmati Rice 1kg', 'باسمتی چاول', 'basmati chawal', 'rice, chawal, sela chawal', 'kg', 320.00, 150, 20),
    ('11111111-1111-1111-1111-111111111111', 'Basmati Rice 5kg', 'باسمتی چاول', 'basmati chawal bori', 'rice bag, chawal bori', 'bag', 1500.00, 40, 5),
    ('11111111-1111-1111-1111-111111111111', 'Eggs (Dozen)', 'انڈے', 'anda, anday', 'egg tray, farm eggs', 'dozen', 360.00, 80, 10),
    ('11111111-1111-1111-1111-111111111111', 'Sunlight Soap 500g', 'صابن', 'sunlight sabun', 'soap, washing soap', 'pcs', 145.00, 200, 24),
    ('11111111-1111-1111-1111-111111111111', 'Ghee Tin 5kg', 'گھی', 'ghee tin', 'cooking ghee, banaspati', 'tin', 2650.00, 25, 3),
    ('11111111-1111-1111-1111-111111111111', 'Chakki Atta 1kg', 'چکی آٹا', 'ata, atta', 'flour, gehu ka atta, gandum atta', 'kg', 140.00, 200, 50),
    ('11111111-1111-1111-1111-111111111111', 'Olper''s Milk 1L', 'اولپرز دودھ', 'olper milk, olpers', 'olpher milk, olper doodh, milk', 'litre', 290.00, 120, 24),
    ('11111111-1111-1111-1111-111111111111', 'Sprite 1L', 'سپرائٹ', 'sprite', 'cold drink, soda, sprite bottle', 'bottle', 120.00, 80, 12),
    ('11111111-1111-1111-1111-111111111111', '7UP 500ml', 'سیون اپ', '7up', 'seven up, 7 up, soda', 'bottle', 80.00, 100, 12)
ON CONFLICT DO NOTHING;
