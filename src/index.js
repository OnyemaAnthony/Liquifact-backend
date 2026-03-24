/**
 * LiquiFact API Gateway
 * Standard Entry Point for the API server.
 */

require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`LiquiFact API running at http://localhost:${PORT}`);
});
