require('dotenv').config();

const { createApp } = require('./app');
const { createDatabase, getDatabaseConfig } = require('./database');

const logger = console;
const port = Number.parseInt(process.env.PORT || '3000', 10);
let httpServer;
let database;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info(`[server] sinal ${signal} recebido; iniciando encerramento gracioso`);

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  if (database) {
    await database.close();
  }

  logger.info('[server] encerramento concluído');
}

async function start() {
  database = createDatabase({ config: getDatabaseConfig(), logger });
  await database.connectWithRetry();

  const app = createApp({ db: database, logger });
  httpServer = app.listen(port, () => {
    logger.info(`[server] Kubernetes Test Lab disponível na porta ${port}`);
  });

  process.once('SIGTERM', async () => {
    await shutdown('SIGTERM');
  });
  process.once('SIGINT', async () => {
    await shutdown('SIGINT');
  });

  return httpServer;
}

if (require.main === module) {
  start().catch(async (error) => {
    logger.error(`[server] não foi possível iniciar: ${error.message}`);
    await shutdown('startup-error');
    process.exitCode = 1;
  });
}

module.exports = { shutdown, start };
