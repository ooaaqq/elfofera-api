import { z } from "zod";

const databaseConfigSchema = z.object({
  PGHOST: z.string().min(1),
  PGDATABASE: z.string().min(1),
  PGUSER: z.string().min(1),
  PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
});

export function readDatabaseConfig() {
  const result = databaseConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      "PGHOST, PGDATABASE and PGUSER are required; PGPORT must be a valid port",
    );
  }
  return {
    host: result.data.PGHOST,
    database: result.data.PGDATABASE,
    user: result.data.PGUSER,
    port: result.data.PGPORT,
  };
}
