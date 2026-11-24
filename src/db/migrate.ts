
import fs from 'fs';
import path from 'path';
import { getDbClient } from './index';
import { config } from '../config/env';

export async function runMigrations(): Promise<void> {
  const db = getDbClient();

  console.log('Using mock services:', config.useMockServices);
  console.log('Database client:', db.constructor.name);

  if (config.useMockServices) {
    throw new Error(
      'Mock services are enabled. Set USE_MOCK_SERVICES=false to run PostgreSQL migrations.',
    );
  }

  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Running database migrations...');

  await db.query(schemaSql);

  console.log('Migrations executed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      console.log('Migration complete.');
      await getDbClient().close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Migration failed:', err);

      try {
        await getDbClient().close();
      } catch {}

      process.exit(1);
    });
}
