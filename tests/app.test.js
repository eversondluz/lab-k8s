const request = require('supertest');

const { createApp } = require('../src/app');

function buildDatabase(overrides = {}) {
  return {
    checkReady: jest.fn().mockResolvedValue(true),
    createMessage: jest.fn(),
    listMessages: jest.fn(),
    ...overrides,
  };
}

describe('Kubernetes Test Lab API', () => {
  test('GET /health retorna o health check da aplicação', async () => {
    const app = createApp({ db: buildDatabase() });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'web' });
  });

  test('POST /api/messages rejeita requisição sem nome', async () => {
    const db = buildDatabase();
    const app = createApp({ db });

    const response = await request(app)
      .post('/api/messages')
      .send({ message: 'Mensagem válida' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/nome é obrigatório/i);
    expect(db.createMessage).not.toHaveBeenCalled();
  });

  test('POST /api/messages rejeita requisição sem mensagem', async () => {
    const db = buildDatabase();
    const app = createApp({ db });

    const response = await request(app).post('/api/messages').send({ name: 'Alessandro' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/mensagem é obrigatória/i);
    expect(db.createMessage).not.toHaveBeenCalled();
  });

  test('POST /api/messages rejeita JSON inválido', async () => {
    const app = createApp({ db: buildDatabase() });

    const response = await request(app)
      .post('/api/messages')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/JSON válido/i);
  });

  test('POST /api/messages cria uma mensagem válida', async () => {
    const created = {
      id: '1',
      name: 'Alessandro',
      message: 'Meu primeiro projeto Kubernetes',
      created_at: '2026-08-04T12:00:00.000Z',
    };
    const db = buildDatabase({ createMessage: jest.fn().mockResolvedValue(created) });
    const app = createApp({ db });

    const response = await request(app).post('/api/messages').send({
      name: '  Alessandro ',
      message: ' Meu primeiro projeto Kubernetes ',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: created });
    expect(db.createMessage).toHaveBeenCalledWith(
      'Alessandro',
      'Meu primeiro projeto Kubernetes',
    );
  });

  test('GET /api/messages lista as mensagens', async () => {
    const messages = [
      { id: '1', name: 'Alessandro', message: 'Olá', created_at: '2026-08-04T12:00:00.000Z' },
    ];
    const db = buildDatabase({ listMessages: jest.fn().mockResolvedValue(messages) });
    const app = createApp({ db });

    const response = await request(app).get('/api/messages');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ messages });
  });

  test('GET /api/messages retorna 503 quando o banco recusa conexão', async () => {
    const databaseError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    databaseError.code = 'ECONNREFUSED';
    const db = buildDatabase({ listMessages: jest.fn().mockRejectedValue(databaseError) });
    const app = createApp({ db });

    const response = await request(app).get('/api/messages');

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/consultar as mensagens/i);
  });
});
