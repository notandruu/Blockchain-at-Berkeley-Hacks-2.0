import postgres from "postgres";

// numeric columns come back as strings (postgres.js default), which is what we want: money
// never becomes a JS float on the way out of the database.
export type Sql = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>>;

export function connect(url: string): Sql {
  return postgres(url, {
    max: 10,
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
