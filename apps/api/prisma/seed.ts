import { logger } from '../src/lib/logger.js';
import { createPrismaClient } from '../src/lib/prisma.js';
import { type PrismaClient } from '../src/generated/prisma/client.js';
import { SEED_CURRENCIES, SEED_PERMISSIONS } from './seed-data.js';

export async function seedReferenceData(prisma: PrismaClient): Promise<{
  currencies: number;
  permissions: number;
}> {
  await prisma.$transaction(async (transaction) => {
    for (const currency of SEED_CURRENCIES) {
      await transaction.currency.upsert({
        where: { code: currency.code },
        update: {
          name: currency.name,
          symbol: currency.symbol,
          decimalPlaces: currency.decimalPlaces,
          isActive: currency.isActive,
        },
        create: currency,
      });
    }

    for (const permission of SEED_PERMISSIONS) {
      await transaction.permission.upsert({
        where: { code: permission.code },
        update: { description: permission.description },
        create: permission,
      });
    }
  });

  return {
    currencies: SEED_CURRENCIES.length,
    permissions: SEED_PERMISSIONS.length,
  };
}

const prisma = createPrismaClient();

try {
  const result = await seedReferenceData(prisma);
  logger.info(result, 'Database reference data seeded');
} catch (error: unknown) {
  logger.error({ err: error }, 'Database seed failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
