import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@riskpilot/domain";
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
export async function authenticate(admin: SupabaseClient, db: Sql, header: string | undefined): Promise<Principal> {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new DomainError("UNAUTHORIZED", "missing bearer token");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new DomainError("UNAUTHORIZED", "invalid or expired session");
  const rows = await db<{ merchant_id: string }[]>`select merchant_id from memberships where user_id = ${data.user.id}`;
  return { userId: data.user.id, email: data.user.email ?? null, merchantIds: rows.map((r) => r.merchant_id) };
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
