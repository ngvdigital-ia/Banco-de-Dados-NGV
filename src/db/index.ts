import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Reutiliza a conexão HTTP entre requests serverless: -20-50ms por request.
// Depreciado mas ainda funcional no @neondatabase/serverless instalado.
neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
