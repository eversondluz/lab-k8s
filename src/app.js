const express = require('express');
const path = require('path');

const { createMessageRouter } = require('./routes/messages');

function createApp({ db, logger = console } = {}) {
  if (!db) {
    throw new Error('A instância do banco de dados é obrigatória.');
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'web' });
  });

  app.get('/ready', async (_request, response) => {
    try {
      const ready = await db.checkReady();

      if (!ready) {
        response.status(503).json({ status: 'not_ready', service: 'web' });
        return;
      }

      response.json({ status: 'ready', service: 'web' });
    } catch (error) {
      logger.error(`[ready] erro ao verificar dependência: ${error.message}`);
      response.status(503).json({ status: 'not_ready', service: 'web' });
    }
  });

  app.use('/api/messages', createMessageRouter({ db, logger }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'O corpo da requisição deve conter JSON válido.' });
      return;
    }

    logger.error(`[app] erro não tratado: ${error.message}`);
    response.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = { createApp };
