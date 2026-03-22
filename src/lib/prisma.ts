import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // During build time, return a dummy client — real connections happen at runtime
    return new PrismaClient();
  }

  // Supabase pooler port 5432 = Session mode (holds connection per client — exhausts pool on serverless).
  // Port 6543 = Transaction mode (releases connection after each query — correct for serverless).
  // Auto-switch so deployments work even if the env var wasn't updated.
  if (connectionString.includes("pooler.supabase.com:5432")) {
    connectionString = connectionString.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543");
  }

  return new PrismaClient({
    // max:3 — allows Promise.all to run 3 queries in parallel (vs max:1 which serialises
    // everything). Transaction mode (port 6543) releases each connection immediately after
    // the statement, so 3 per-instance is safe even with 15 concurrent team requests.
    adapter: new PrismaPg({ connectionString, max: 3 }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
