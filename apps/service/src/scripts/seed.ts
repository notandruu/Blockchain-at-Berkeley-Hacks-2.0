import { supabaseAdmin } from "../auth.js";
import { loadConfig } from "../config.js";
import { connect } from "../db.js";

// Creates the demo operator account and a fictional merchant. The venue is fictional on
// purpose: public research about a real business must not look like that business
// launched the generated campaign (PRD section 18).
const cfg = loadConfig();
const db = connect(cfg.DATABASE_URL);
const admin = supabaseAdmin(cfg.SUPABASE_URL, cfg.SUPABASE_SECRET_KEY);

const email = process.env.DEMO_USER_EMAIL ?? "operator@riskpilot.test";
const password = process.env.DEMO_USER_PASSWORD;
if (!password) {
  console.error("set DEMO_USER_PASSWORD in .env");
  process.exit(1);
}

const { data: list } = await admin.auth.admin.listUsers();
let user = list?.users.find((u) => u.email === email) ?? null;
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}
const merchantName = process.env.DEMO_MERCHANT_NAME ?? "Golden Bear Taproom";
let [m] = await db<{ id: string }[]>`select id from merchants where name = ${merchantName}`;
if (!m) [m] = await db<{ id: string }[]>`insert into merchants (name) values (${merchantName}) returning id`;
await db`insert into memberships (merchant_id, user_id, role) values (${m!.id}, ${user!.id}, 'owner') on conflict do nothing`;
console.log(JSON.stringify({ user: email, merchantId: m!.id, merchant: merchantName }));
await db.end();
