const express = require('express');

function validateMessagePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'O corpo da requisição deve ser um objeto JSON.' };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name) {
    return { error: 'O nome é obrigatório.' };
  }

  if (name.length > 100) {
    return { error: 'O nome deve ter no máximo 100 caracteres.' };
  }

  if (!message) {
    return { error: 'A mensagem é obrigatória.' };
  }

  if (message.length > 2000) {
    return { error: 'A mensagem deve ter no máximo 2000 caracteres.' };
  }

  return { value: { name, message } };
}

function databaseErrorStatus(error) {
  const unavailableCodes = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    '57P01',
    '57P02',
    '57P03',
  ]);

  return unavailableCodes.has(error.code) ? 503 : 500;
}

function createMessageRouter({ db, logger = console }) {
  const messagesRouter = express.Router();

  messagesRouter.get('/', async (_request, response) => {
    try {
      const messages = await db.listMessages();
      response.json({ messages });
    } catch (error) {
      logger.error(`[api] não foi possível listar mensagens: ${error.message}`);
      response.status(databaseErrorStatus(error)).json({
        error: 'Não foi possível consultar as mensagens.',
      });
    }
  });

  messagesRouter.post('/', async (request, response) => {
    const validation = validateMessagePayload(request.body);

    if (validation.error) {
      response.status(400).json({ error: validation.error });
      return;
    }

    try {
      const createdMessage = await db.createMessage(
        validation.value.name,
        validation.value.message,
      );
      response.status(201).json({ message: createdMessage });
    } catch (error) {
      logger.error(`[api] não foi possível salvar mensagem: ${error.message}`);
      response.status(databaseErrorStatus(error)).json({
        error: 'Não foi possível salvar a mensagem.',
      });
    }
  });

  return messagesRouter;
}

module.exports = {
  createMessageRouter,
  validateMessagePayload,
};
