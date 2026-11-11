import { describe, expect, it } from 'vitest';

import { SEED_CURRENCIES, SEED_PERMISSIONS } from '../prisma/seed-data.js';

const EXPECTED_PERMISSION_CODES = [
  'audit.read',
  'branches.manage',
  'branches.read',
  'business.read',
  'business.settings.manage',
  'customers.manage',
  'customers.read',
  'employees.manage',
  'employees.pay',
  'employees.read',
  'finance.adjust',
  'finance.read',
  'finance.transaction.create',
  'finance.transfer',
  'inventory.adjust',
  'inventory.read',
  'inventory.transfer',
  'payables.pay',
  'payables.read',
  'products.manage',
  'products.read',
  'purchases.cancel',
  'purchases.create',
  'purchases.read',
  'receivables.collect',
  'receivables.read',
  'reports.read',
  'sales.cancel',
  'sales.change_price',
  'sales.create',
  'sales.discount',
  'sales.read',
  'suppliers.manage',
  'suppliers.read',
  'users.manage',
  'users.read',
] as const;

describe('reference seed data', () => {
  it('defines exactly the required MXN and USD currencies', () => {
    expect(SEED_CURRENCIES).toEqual([
      {
        code: 'MXN',
        name: 'Peso mexicano',
        symbol: 'MX$',
        decimalPlaces: 2,
        isActive: true,
      },
      {
        code: 'USD',
        name: 'Dólar estadounidense',
        symbol: 'US$',
        decimalPlaces: 2,
        isActive: true,
      },
    ]);
  });

  it('keeps the permission catalog complete and free of duplicate codes', () => {
    const permissionCodes = SEED_PERMISSIONS.map(({ code }) => code);

    expect(permissionCodes).toHaveLength(EXPECTED_PERMISSION_CODES.length);
    expect(new Set(permissionCodes).size).toBe(permissionCodes.length);
    expect([...permissionCodes].sort()).toEqual(EXPECTED_PERMISSION_CODES);
  });

  it('keeps permission descriptions within the SQL column limit', () => {
    expect(SEED_PERMISSIONS.every(({ description }) => description.length <= 250)).toBe(true);
  });
});
