import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from("users")
    .select("name, email, password, status, last_login")
    .or("name.ilike.%filali%,email.ilike.%filali%");

  if (error) { console.error("Error:", error.message); process.exit(1); }
  if (!data || data.length === 0) { console.log("No user matching 'filali' found."); return; }
  for (const u of data) {
    console.log(`Name:     ${u.name}`);
    console.log(`Email:    ${u.email}`);
    console.log(`Password: ${u.password}`);
    console.log(`Status:   ${u.status}`);
    console.log(`Last login: ${u.last_login ?? "never"}`);
    console.log("---");
  }
}

main();
