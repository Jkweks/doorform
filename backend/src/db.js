// Initialize a PostgreSQL connection pool using the DATABASE_URL
// environment variable. The pool is shared across requests so that
// each query doesn't create a new database connection.
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Export the pool for use in route handlers and tests.
module.exports = pool;
