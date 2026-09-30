const app = require('./app');
const env = require('./config/env');
const { pool, testConnection } = require('./config/db');
const logger = require('./utils/logger');
const scheduler = require('./services/jobs/scheduler');

async function start() {
  try {
    await testConnection();
    logger.info('Database connection established.');
  } catch (err) {
    // Deliberately no err.stack/full error object here - could contain the connection
    // string/credentials depending on the driver's error formatting.
    logger.error('Failed to connect to database. Check DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL_MODE.', {
      error: err.message,
    });
    process.exit(1);
  }

  if (env.autoMigrate) {
    try {
      // eslint-disable-next-line global-require
      await require('../database/migrate').run();
    } catch (err) {
      logger.error('AUTO_MIGRATE failed; refusing to start against an unmigrated schema.', { error: err.message });
      process.exit(1);
    }
  }

  // Render (and most PaaS hosts) sit behind a load balancer and route to the container
  // over an internal network - binding explicitly to 0.0.0.0 (rather than relying on the
  // platform-specific default) ensures the app is reachable regardless of host.
  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info(`Server listening on port ${env.port} (${env.nodeEnv})`);
    if (env.jobsEnabled) scheduler.start();
  });

  server.on('error', (err) => {
    logger.error('Server failed to start.', { error: err.message });
    process.exit(1);
  });

  // Render sends SIGTERM before restarting/redeploying a service. Without handling it,
  // in-flight requests get dropped and the MySQL pool's sockets are left to time out
  // rather than being closed cleanly.
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully.`);
    scheduler.stop();

    server.close(async () => {
      try {
        await pool.end();
        logger.info('Database pool closed. Exiting.');
        process.exit(0);
      } catch (err) {
        logger.error('Error while closing database pool.', { error: err.message });
        process.exit(1);
      }
    });

    // Safety net in case something keeps an open connection alive indefinitely.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
