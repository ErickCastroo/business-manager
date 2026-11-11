import { PrismaMssql } from '@prisma/adapter-mssql';

import { getDatabaseUrl } from '../config/database.js';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrismaClient(databaseUrl: string = getDatabaseUrl()): PrismaClient {
  const adapter = new PrismaMssql(databaseUrl);

  return new PrismaClient({ adapter });
}

let prismaClient: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  prismaClient ??= createPrismaClient();

  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (prismaClient === undefined) {
    return;
  }

  await prismaClient.$disconnect();
  prismaClient = undefined;
}
