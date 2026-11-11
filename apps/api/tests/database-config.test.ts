import { describe, expect, it } from 'vitest';

import { getDatabaseUrl } from '../src/config/database.js';

describe('SQL Server database configuration', () => {
  it('accepts a configured SQL Server URL', () => {
    const databaseUrl =
      'sqlserver://localhost:1433;database=BusinessManager;schema=dbo;user=sa;password={local-only};encrypt=true;trustServerCertificate=true';

    expect(getDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });

  it('rejects a missing database URL', () => {
    expect(() => getDatabaseUrl({})).toThrow('DATABASE_URL is required');
  });

  it('rejects a connection URL for a different database provider', () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: 'postgresql://localhost/example' })).toThrow(
      'sqlserver://',
    );
  });

  it('rejects the documented password placeholder', () => {
    expect(() =>
      getDatabaseUrl({
        DATABASE_URL:
          'sqlserver://localhost:1433;database=BusinessManager;user=sa;password={CHANGE_ME}',
      }),
    ).toThrow('CHANGE_ME');
  });
});
