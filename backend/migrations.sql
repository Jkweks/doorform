CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    job_number VARCHAR(50),
    job_name VARCHAR(255),
    pm VARCHAR(255),
    work_order VARCHAR(50),
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (job_number, work_order)
);

CREATE TABLE IF NOT EXISTS frames (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    data JSONB
);

CREATE TABLE IF NOT EXISTS doors (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    data JSONB
);
