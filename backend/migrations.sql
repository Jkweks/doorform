-- Schema for DoorForm application (fresh install)

CREATE TABLE IF NOT EXISTS project_managers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE
);

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    job_number VARCHAR(50) UNIQUE,
    job_name VARCHAR(255),
    pm VARCHAR(255),
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    work_order VARCHAR(50),
    archived BOOLEAN DEFAULT FALSE,
    UNIQUE (job_id, work_order)
);

CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    handing VARCHAR(10),
    data JSONB
);

CREATE TABLE IF NOT EXISTS frames (
    id SERIAL PRIMARY KEY,
    entry_id INT REFERENCES entries(id) ON DELETE CASCADE,
    data JSONB
);

CREATE TABLE IF NOT EXISTS doors (
    id SERIAL PRIMARY KEY,
    entry_id INT REFERENCES entries(id) ON DELETE CASCADE,
    leaf VARCHAR(1),
    data JSONB
);

CREATE TABLE IF NOT EXISTS door_part_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    parts JSONB
);

CREATE TABLE IF NOT EXISTS door_parts (
    id SERIAL PRIMARY KEY,
    door_id INT REFERENCES doors(id) ON DELETE CASCADE,
    part_type VARCHAR(255),
    part_lz NUMERIC,
    part_ly NUMERIC,
    data JSONB,
    requires JSONB,
    quantity INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS work_order_pdfs (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    tag VARCHAR(20),
    pdf BYTEA,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hardware_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE
);

CREATE TABLE IF NOT EXISTS hardware_items (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES hardware_categories(id) ON DELETE SET NULL,
    manufacturer VARCHAR(255),
    model_number VARCHAR(255),
    features JSONB,
    variables JSONB
);
