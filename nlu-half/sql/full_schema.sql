-- =====================================================================
-- RetailSpeak AI — Comprehensive Database Schema (TDD §3 & §13.1)
-- Covers both NLU/Grounding Half and Fulfillment/Khata Half
-- Engine: PostgreSQL 15+ with pgvector and uuid-ossp
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. STORES & CONFIGURATION (TDD §3.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
    store_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                        VARCHAR(255) NOT NULL,
    address                     TEXT,
    phone                       VARCHAR(32),
    timezone                    VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
    rag_similarity_floor        NUMERIC(4,3) DEFAULT 0.720,
    rag_auto_accept_threshold   NUMERIC(4,3) DEFAULT 0.850,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. PRODUCTS & RAG EMBEDDINGS (TDD §3.2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    product_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id            UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    name_en             VARCHAR(255) NOT NULL,
    name_ur             VARCHAR(255),
    name_roman_ur       VARCHAR(255),
    aliases             TEXT,
    category            VARCHAR(64) NOT NULL DEFAULT 'general',
    unit                VARCHAR(32) NOT NULL DEFAULT 'pcs',
    price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    in_stock_qty        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (in_stock_qty >= 0),
    low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    max_order_qty       NUMERIC(10,2) DEFAULT 50,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    image_url           TEXT,
    embedding           VECTOR(384),  -- BAAI/bge-small-en-v1.5
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_embedding
    ON products USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ---------------------------------------------------------------------
-- 3. CUSTOMERS & KHATA LEDGER (TDD §3.3, §3.5)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id            UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    phone_number        VARCHAR(32) NOT NULL, -- E.164 (+923001234567)
    name                VARCHAR(255),
    preferred_language  VARCHAR(16) NOT NULL DEFAULT 'ur',
    khata_enabled       BOOLEAN NOT NULL DEFAULT false,
    khata_credit_limit  NUMERIC(10,2) DEFAULT 10000.00,
    current_balance     NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_store_customer_phone UNIQUE (store_id, phone_number)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    address_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    label               VARCHAR(64) DEFAULT 'Home',
    address_line        TEXT NOT NULL,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    is_default          BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS khata_entries (
    entry_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id             UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    store_id                UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    order_id                UUID,
    entry_type              VARCHAR(32) NOT NULL, -- 'credit_sale', 'repayment', 'adjustment'
    amount                  NUMERIC(10,2) NOT NULL, -- Positive = owed increase, negative = repayment
    running_balance_after   NUMERIC(10,2) NOT NULL,
    note                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              VARCHAR(64) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_khata_customer ON khata_entries(customer_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. ORDERS & HMAC SIGNED LINES (TDD §3.4, §8.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    order_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL,
    store_id            UUID NOT NULL REFERENCES stores(store_id),
    customer_id         UUID REFERENCES customers(customer_id),
    stage               VARCHAR(32) NOT NULL DEFAULT 'PENDING_VALIDATION',
    total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method      VARCHAR(32), -- 'cod', 'khata', 'gateway'
    confirmed           BOOLEAN NOT NULL DEFAULT false,
    confirmed_at        TIMESTAMPTZ,
    hmac_signature      VARCHAR(128), -- Tamper-proof validation seal
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_line_items (
    line_id             VARCHAR(64) NOT NULL,
    order_id            UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(product_id),
    matched_name        VARCHAR(255) NOT NULL,
    raw_mention         VARCHAR(255) NOT NULL,
    quantity            NUMERIC(10,2) NOT NULL CHECK (quantity > 0 AND quantity <= 500),
    unit                VARCHAR(32) NOT NULL,
    unit_price          NUMERIC(10,2) NOT NULL,
    confidence          NUMERIC(4,3) NOT NULL,
    PRIMARY KEY (order_id, line_id)
);

-- ---------------------------------------------------------------------
-- 5. INVENTORY RESERVATIONS & LOCKS (TDD §3.6)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_reservations (
    reservation_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id            UUID NOT NULL REFERENCES stores(store_id),
    order_id            UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(product_id),
    quantity            NUMERIC(10,2) NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'HELD', -- 'HELD', 'COMMITTED', 'RELEASED'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_res_status ON inventory_reservations(store_id, status);

-- ---------------------------------------------------------------------
-- 6. SUPPLIER & PURCHASE ORDERS (TDD §3.8)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id            UUID NOT NULL REFERENCES stores(store_id),
    supplier_name       VARCHAR(255) NOT NULL,
    product_id          UUID NOT NULL REFERENCES products(product_id),
    reorder_quantity    NUMERIC(10,2) NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FULFILLED'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- 7. RIDERS & DISPATCH (TDD §3.7)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS riders (
    rider_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id            UUID NOT NULL REFERENCES stores(store_id),
    name                VARCHAR(255) NOT NULL,
    phone               VARCHAR(32) NOT NULL,
    is_available        BOOLEAN NOT NULL DEFAULT true,
    current_lat         DOUBLE PRECISION,
    current_lng         DOUBLE PRECISION,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_assignments (
    assignment_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id            UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    rider_id            UUID NOT NULL REFERENCES riders(rider_id),
    status              VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED', -- 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED'
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at        TIMESTAMPTZ
);
