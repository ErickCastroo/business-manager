import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

const DEFAULT_GENERATION_DATABASE_URL =
  'sqlserver://not-configured.invalid:1433;database=BusinessManager;schema=dbo;user=invalid;password={CHANGE_ME};encrypt=true;trustServerCertificate=true';

loadEnv({
  path: resolve(import.meta.dirname, '../../.env'),
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // A non-working placeholder lets validation and client generation run after a clean clone.
    // Commands that connect to SQL Server still require DATABASE_URL to be configured.
    url: process.env.DATABASE_URL ?? DEFAULT_GENERATION_DATABASE_URL,
  },
});
