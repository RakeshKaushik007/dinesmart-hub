import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const TEST_EMAIL = Deno.env.get("TEST_USER_EMAIL");
const TEST_PASSWORD = Deno.env.get("TEST_USER_PASSWORD");

async function getAccessToken(): Promise<string> {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env to a staff account (super_admin/admin/owner/branch_manager/employee)."
    );
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Auth failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

Deno.test("inventory deduction trigger deducts exact recipe qty on order completion", async () => {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_inventory_deduction_check`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const body = await res.json();
  console.log("inventory check result:", body);
  assertEquals(res.status, 200);
  assertEquals(body.passed, true, `Expected stock to be ${body.expected_final}, got ${body.actual_final}`);
});