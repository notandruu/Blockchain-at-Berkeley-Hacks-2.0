import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@beagle/domain";
import type { Sql } from "./db.js";

export interface Principal {
  userId: string;
  email: string | null;
  merchantIds: string[];
}

export function supabaseAdmin(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Every privileged request carries the user's Supabase access token. We validate it with
// Supabase Auth (not by decoding it ourselves) and load memberships from our own table.
//
// With open access on, a visitor with no membership (an anonymous session, typically) gets
// their own copy of the demo merchant on first request. Runs, plans and campaigns stay
// scoped to that merchant, so visitors never see each other's work.
export async function authenticate(
  admin: SupabaseClient,
  db: Sql,
  header: string | undefined,
  provisionMerchant: string | null = null,
): Promise<Principal> {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new DomainError("UNAUTHORIZED", "missing bearer token");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new DomainError("UNAUTHORIZED", "invalid or expired session");
  const userId = data.user.id;
  let rows: { merchant_id: string }[] = await db<{ merchant_id: string }[]>`select merchant_id from memberships where user_id = ${userId}`;
  if (!rows.length && provisionMerchant) rows = await provision(db, userId, provisionMerchant);
  return { userId, email: data.user.email ?? null, merchantIds: rows.map((r) => r.merchant_id) };
}

async function provision(db: Sql, userId: string, merchantName: string): Promise<{ merchant_id: string }[]> {
  return db.begin(async (tx) => {
    // A first page load fires several requests at once; only one may create the merchant.
    await tx`select pg_advisory_xact_lock(hashtext(${userId}))`;
    const existing = await tx<{ merchant_id: string }[]>`select merchant_id from memberships where user_id = ${userId}`;
    if (existing.length) return existing;
    const [m] = await tx<{ id: string }[]>`insert into merchants (name) values (${merchantName}) returning id`;
    await tx`insert into memberships (merchant_id, user_id, role) values (${m!.id}, ${userId}, 'owner')`;
    return [{ merchant_id: m!.id }];
  }) as Promise<{ merchant_id: string }[]>;
}

export function requireMember(p: Principal, merchantId: string): void {
  if (!p.merchantIds.includes(merchantId)) throw new DomainError("FORBIDDEN", "not a member of this merchant");
}

// Resolve a run to its merchant and check membership in one place, so no route can forget.
export async function authorizeRun(db: Sql, p: Principal, runId: string): Promise<{ merchantId: string }> {
  const rows = await db<{ merchant_id: string }[]>`select merchant_id from runs where id = ${runId}`;
  if (!rows[0]) throw new DomainError("NOT_FOUND", "run not found");
  requireMember(p, rows[0].merchant_id);
  return { merchantId: rows[0].merchant_id };
}
