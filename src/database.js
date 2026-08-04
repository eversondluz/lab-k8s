const { Pool } = require('pg');

const schemaSql = `
  CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS messages_created_at_idx
    ON messages (created_at DESC);
`;

function numberFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDatabaseConfig(env = process.env) {
  return {
    host: env.DB_HOST || 'localhost',
    port: numberFromEnv(env.DB_PORT, 5432),
    database: env.DB_NAME || 'k8slab',
    user: env.DB_USER || 'k8slab',
    password: env.DB_PASSWORD || 'kubernetes-lab-password',
    initRetries: numberFromEnv(env.DB_INIT_RETRIES, 30),
    initDelayMs: numberFromEnv(env.DB_INIT_DELAY_MS, 2000),
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDatabase({
  PoolClass = Pool,
  config = getDatabaseConfig(),
  logger = console,
  sleep = wait,
} = {}) {
  const pool = new PoolClass({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });

  let initialized = false;

  pool.on('error', (error) => {
    logger.error(`[database] erro inesperado no pool: ${error.message}`);
  });

  async function initialize() {
    await pool.query('SELECT 1');
    await pool.query(schemaSql);
    initialized = true;
    logger.info('[database] conexão estabelecida e schema verificado');
  }

  async function connectWithRetry() {
    for (let attempt = 1; attempt <= config.initRetries; attempt += 1) {
      try {
        await initialize();
        return;
      } catch (error) {
        initialized = false;
        const lastAttempt = attempt === config.initRetries;

        if (lastAttempt) {
          logger.error(`[database] falha após ${attempt} tentativa(s): ${error.message}`);
          throw error;
        }

        logger.warn(
          `[database] PostgreSQL indisponível (tentativa ${attempt}/${config.initRetries}); ` +
            `nova tentativa em ${config.initDelayMs}ms`,
        );
        await sleep(config.initDelayMs);
      }
    }
  }

  async function withDatabase(operation) {
    if (!initialized) {
      await connectWithRetry();
    }

    try {
      return await operation();
    } catch (error) {
      initialized = false;
      throw error;
    }
  }

  async function listMessages() {
    return withDatabase(async () => {
      const result = await pool.query(
        'SELECT id, name, message, created_at FROM messages ORDER BY created_at DESC, id DESC',
      );
      return result.rows;
    });
  }

  async function createMessage(name, message) {
    return withDatabase(async () => {
      const result = await pool.query(
        'INSERT INTO messages (name, message) VALUES ($1, $2) RETURNING id, name, message, created_at',
        [name, message],
      );
      return result.rows[0];
    });
  }

  async function checkReady() {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.warn(`[database] readiness check falhou: ${error.message}`);
      return false;
    }
  }

  async function close() {
    await pool.end();
    logger.info('[database] pool encerrado');
  }

  return {
    checkReady,
    close,
    connectWithRetry,
    createMessage,
    listMessages,
    pool,
  };
}

module.exports = {
  createDatabase,
  getDatabaseConfig,
  schemaSql,
};
