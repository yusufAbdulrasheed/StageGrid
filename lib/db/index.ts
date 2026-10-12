import "server-only";
import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

const g = globalThis as unknown as { __sgDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const autoMigrate = process.env.AUTO_MIGRATE !== "false";
  const url = process.env.DATABASE_URL;

  let db: Db;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
    const d = drizzle(pool, { schema });
    if (autoMigrate) await (await import("drizzle-orm/node-postgres/migrator")).migrate(d, { migrationsFolder });
    db = d as unknown as Db;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pglite");
    if (dir !== "memory://") fs.mkdirSync(path.dirname(dir), { recursive: true });
    const client = new PGlite(dir === "memory://" ? undefined : dir);
    const d = drizzle(client, { schema });
    await (await import("drizzle-orm/pglite/migrator")).migrate(d, { migrationsFolder });
    db = d as unknown as Db;
  }

  if (process.env.NODE_ENV === "development" || process.env.SEED_DEMO === "true") {
    const { seedIfEmpty } = await import("@/lib/seed");
    await seedIfEmpty(db);
  }
  return db;
}

export function getDb(): Promise<Db> {
  return (g.__sgDb ??= connect().catch((err) => {
    g.__sgDb = undefined;
    throw err;
  }));
}
