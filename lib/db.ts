import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// Run a query with: await sql`SELECT ... WHERE id = ${id}`
// Values written as ${...} are sent separately from the SQL text, so user
// input can never be run as SQL.
export const sql = neon(process.env.DATABASE_URL);
