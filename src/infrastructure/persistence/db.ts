import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as unknown as { ieoDb?: PrismaClient };
export function db(): PrismaClient {
  if (!globalDb.ieoDb) {
    const connection = process.env.DATABASE_URL;
    if (!connection) throw new Error("DATABASE_URL es obligatoria.");
    globalDb.ieoDb = new PrismaClient({ adapter: new PrismaMariaDb(connection), log: [] });
  }
  return globalDb.ieoDb;
}
