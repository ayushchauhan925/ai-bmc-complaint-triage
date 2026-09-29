const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/db');
const logger = require('./utils/logger');

async function start() {
  try {
    await testConnection();
    logger.info('Database connection established.');
  } catch (err) {
    logger.error('Failed to connect to database.', { error: err.message });
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start();
