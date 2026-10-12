import postgres from "postgres";

// numeric columns come back as strings (postgres.js default), which is what we want: money
// never becomes a JS float on the way out of the database.
export type Sql = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;

export function connect(url: string, max = 10): Sql {
  // Supabase's transaction pooler (port 6543) cannot keep prepared statements across
  // transactions, so they are off there.
  const pooled = new URL(url).port === "6543";
  return postgres(url, {
    max,
    prepare: !pooled,
    idle_timeout: 30,
    // bigint ids from the exchange are stored as text; keep int8 as string if one appears.
    types: { bigint: postgres.BigInt },
    onnotice: () => {},
  }) as unknown as Sql;
}

// postgres.js returns a RowList; most call sites want the first row or null.
export function first<T>(rows: readonly T[]): T | null {
  return rows.length ? rows[0]! : null;
}
