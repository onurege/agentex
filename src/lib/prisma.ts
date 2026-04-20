import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === "then" || prop === Symbol.toPrimitive) return undefined;
        throw new Error(
          `PrismaClient: DATABASE_URL is not set. Cannot access .${String(prop)}`,
        );
      },
    });
  }
  const adapter = new PrismaPg(url);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
