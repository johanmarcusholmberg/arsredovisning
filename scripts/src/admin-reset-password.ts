import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const targetEmail = process.argv[2];
if (!targetEmail) {
  throw new Error("Usage: tsx admin-reset-password.ts <email>");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let foundUser: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>["data"]["users"][number] | null = null;
let page = 1;
const perPage = 200;
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) throw error;
  const match = data.users.find(
    (u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase(),
  );
  if (match) {
    foundUser = match;
    break;
  }
  if (data.users.length < perPage) break;
  page += 1;
}

if (!foundUser) {
  console.log(`NO_USER_FOUND for ${targetEmail}`);
  process.exit(2);
}

console.log("Found user:", {
  id: foundUser.id,
  email: foundUser.email,
  email_confirmed_at: foundUser.email_confirmed_at,
  created_at: foundUser.created_at,
  last_sign_in_at: foundUser.last_sign_in_at,
});

const tempPassword = `${crypto.randomBytes(12).toString("base64url")}A9!`;

const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(
  foundUser.id,
  { password: tempPassword, email_confirm: true },
);
if (updErr) throw updErr;

console.log("\n=== PASSWORD RESET SUCCESSFUL ===");
console.log("Email:    ", updated.user.email);
console.log("Temp pwd: ", tempPassword);
console.log("User ID:  ", updated.user.id);
console.log("Email confirmed at:", updated.user.email_confirmed_at);
