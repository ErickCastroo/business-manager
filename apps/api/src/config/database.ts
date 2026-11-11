import { loadEnvironment } from './environment.js';

loadEnvironment();

export function getDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required to connect to SQL Server.');
  }

  if (!databaseUrl.startsWith('sqlserver://')) {
    throw new Error('DATABASE_URL must use the sqlserver:// protocol.');
  }

  if (databaseUrl.includes('{CHANGE_ME}')) {
    throw new Error('DATABASE_URL still contains the CHANGE_ME placeholder.');
  }

  return databaseUrl;
}
