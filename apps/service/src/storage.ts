import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecodedScreenshot } from "@beagle/provider-context";
import type { Sql } from "./db.js";

const BUCKET = "captures";

// Screenshots go to a private bucket keyed by content hash. The browser gets a signed URL
// that expires; the base64 payload never appears in a run event.
export async function storeScreenshot(admin: SupabaseClient, db: Sql, runId: string, shot: DecodedScreenshot): Promise<string> {
  const path = `${runId}/${shot.sha256}.${shot.extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, shot.bytes, { contentType: shot.mime, upsert: true });
  if (error) throw new Error(`capture upload failed: ${error.message}`);
  const [row] = await db<{ id: string }[]>`
    insert into artifacts (run_id, kind, storage_path, mime, sha256, bytes)
    values (${runId}, 'screenshot', ${path}, ${shot.mime}, ${shot.sha256}, ${shot.bytes.length})
    returning id`;
  return row!.id;
}

export async function signedArtifactUrl(admin: SupabaseClient, db: Sql, artifactId: string, ttlSeconds = 300): Promise<string | null> {
  const rows = await db<{ storage_path: string }[]>`select storage_path from artifacts where id = ${artifactId}`;
  if (!rows[0]) return null;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(rows[0].storage_path, ttlSeconds);
  return error ? null : data.signedUrl;
}
