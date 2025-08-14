-- Create or update core tables for jobs, work orders, entries, frames and doors

-- Jobs hold high level information and are unique per job number
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    job_number VARCHAR(50) UNIQUE,
    job_name VARCHAR(255),
    pm VARCHAR(255),
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If jobs table exists from a previous version, ensure old work_order column is removed
ALTER TABLE jobs DROP COLUMN IF EXISTS work_order;

-- Work orders belong to a job and can be archived individually
CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    work_order VARCHAR(50),
    archived BOOLEAN DEFAULT FALSE,
    UNIQUE(job_id, work_order)
);

-- Entries represent an opening and will generate frames and doors
CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    handing VARCHAR(10),
    data JSONB
);

-- Frames now reference an entry rather than the job
CREATE TABLE IF NOT EXISTS frames (
    id SERIAL PRIMARY KEY,
    entry_id INT REFERENCES entries(id) ON DELETE CASCADE,
    data JSONB
);

-- Migrate existing frames table if present
ALTER TABLE frames DROP COLUMN IF EXISTS job_id;
ALTER TABLE frames ADD COLUMN IF NOT EXISTS entry_id INT REFERENCES entries(id) ON DELETE CASCADE;

-- Doors reference an entry and can store a leaf identifier for pairs
CREATE TABLE IF NOT EXISTS doors (
    id SERIAL PRIMARY KEY,
    entry_id INT REFERENCES entries(id) ON DELETE CASCADE,
    leaf VARCHAR(1),
    data JSONB
);

-- Migrate existing doors table if present
ALTER TABLE doors DROP COLUMN IF EXISTS job_id;
ALTER TABLE doors ADD COLUMN IF NOT EXISTS entry_id INT REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE doors ADD COLUMN IF NOT EXISTS leaf VARCHAR(1);

