
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

export interface Config {
  port: number;
  nodeEnv: string;
  database: {
    url?: string;
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
    ssl?: boolean;
  };
  firebase: {
    projectId?: string;
    serviceAccountPath?: string;
    clientEmail?: string;
    privateKey?: string;
    emulatorHost?: string;
  };
  useMockServices: boolean;
}

export const config: Config = {
  port: process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 3000,

  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: parseInt(
      process.env.PGPORT || process.env.DB_PORT || '5432',
      10,
    ),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password:
      process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
    database:
      process.env.PGDATABASE || process.env.DB_NAME || 'chat_db',
    ssl: process.env.DB_SSL === 'true',
  },

  firebase: {
    projectId:
      process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,

    serviceAccountPath:
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,

    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,

    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  },

  useMockServices:
    process.env.USE_MOCK_SERVICES === 'true' ||
    process.env.NODE_ENV === 'test',
};
