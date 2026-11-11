import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../prisma/migrations/20261104223000_initial_security/migration.sql', import.meta.url),
  'utf8',
);
const migrationLock = readFileSync(
  new URL('../prisma/migrations/migration_lock.toml', import.meta.url),
  'utf8',
);

const EXPECTED_MODELS = [
  'AuditLog',
  'Branch',
  'Business',
  'BusinessUser',
  'Currency',
  'Permission',
  'RefreshToken',
  'Role',
  'RolePermission',
  'User',
  'UserBranchAccess',
] as const;

describe('Prisma SQL Server schema', () => {
  it('uses the SQL Server provider and only the Task 004 models', () => {
    const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1]).sort();

    expect(schema).toMatch(/datasource\s+db\s+\{[\s\S]*?provider\s*=\s*"sqlserver"/);
    expect(migrationLock).toMatch(/provider\s*=\s*"mssql"/);
    expect(schema).not.toContain('mysql');
    expect(models).toEqual(EXPECTED_MODELS);
  });

  it('enforces tenant-safe composite relations in membership and branch access', () => {
    expect(schema).toContain(
      '@relation(fields: [businessId, roleId], references: [businessId, id]',
    );
    expect(schema).toContain(
      '@relation(fields: [businessId, businessUserId], references: [businessId, id]',
    );
    expect(schema).toContain(
      '@relation(fields: [businessId, branchId], references: [businessId, id]',
    );
  });

  it('contains a transactional SQL Server migration for all eleven tables', () => {
    const createdTables = [...migration.matchAll(/CREATE TABLE \[dbo\]\.\[(\w+)\]/g)].map(
      (match) => match[1],
    );

    expect(migration).toContain('BEGIN TRAN;');
    expect(migration).toContain('COMMIT TRAN;');
    expect(migration).toContain('ROLLBACK TRAN;');
    expect(createdTables).toHaveLength(EXPECTED_MODELS.length);
    expect(createdTables).toEqual(
      expect.arrayContaining([
        'Currencies',
        'Users',
        'Businesses',
        'Branches',
        'Roles',
        'Permissions',
        'RolePermissions',
        'BusinessUsers',
        'UserBranchAccess',
        'RefreshTokens',
        'AuditLogs',
      ]),
    );
  });
});
