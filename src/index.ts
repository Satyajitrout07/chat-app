import { createApp } from './app';
import { config } from './config/env';
import { getDbClient } from './db';
import { runMigrations } from './db/migrate';

async function startServer(): Promise<void> {
  const app = createApp();

  // Test DB connection and run migrations if connected
  try {
    const db = getDbClient();
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('Connected to relational database. Running migrations...');
      await runMigrations();
    } else {
      console.warn('Relational database not reachable. Proceeding with configured client.');
    }
  } catch (err) {
    console.warn('Database initialization warning:', (err as Error).message);
  }

  const server = app.listen(config.port, () => {
    console.log(`Chat backend server running on port ${config.port} (${config.nodeEnv})`);
  });

  const shutdown = async () => {
    console.log('Shutting down server gracefully...');
    server.close(async () => {
      try {
        const db = getDbClient();
        await db.close();
      } catch {}
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
