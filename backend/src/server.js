// Entry point for the Express application.
// Sets up middleware and mounts the API routes.
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Enable CORS and JSON request parsing
app.use(cors());
app.use(express.json());

// Attach the API router under the `/api` prefix
app.use('/api', routes);

// When executed directly, start the HTTP server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

module.exports = app;
