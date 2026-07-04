import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/t8z1/thpofficial/.env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EMAIL = "test@thp.com";
const PH = "https://placehold.co/600x400?text=Blood+Work+Scan";
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; };
const tsago = (n: number) => { const d = new Date(); d.setDate(d.getDate()-n); d.setHours(10,0,0,0); return d.toISOString(); };

async function run() {
  const entries = [
    { user_email: EMAIL, test_date: ago(40), uploaded_at: tsago(40), image_url: PH,
      markers: { total_t:{value:382,flag:"low",ref_range:"400-1200"}, free_t:{value:8.2,flag:"low",ref_range:"9-30"}, shbg:{value:48,flag:"high",ref_range:"10-40"}, lh:{value:3.1,flag:"normal",ref_range:"1.7-8.6"}, cortisol_am:{value:22.1,flag:"high",ref_range:"6-18"}, estradiol:{value:28,flag:"normal",ref_range:"10-40"}, prolactin:{value:14.2,flag:"normal",ref_range:"2-18"}, tsh:{value:2.8,flag:"normal",ref_range:"0.4-4.0"}, free_t3:{value:2.8,flag:"low-normal",ref_range:"2.3-4.2"}, dhea_s:{value:180,flag:"low-normal",ref_range:"150-500"}, fasting_insulin:{value:11.2,flag:"high-normal",ref_range:"2-8"} } },
    { user_email: EMAIL, test_date: ago(5), uploaded_at: tsago(5), image_url: PH,
      markers: { total_t:{value:524,flag:"normal",ref_range:"400-1200"}, free_t:{value:13.8,flag:"normal",ref_range:"9-30"}, shbg:{value:38,flag:"normal",ref_range:"10-40"}, lh:{value:5.2,flag:"normal",ref_range:"1.7-8.6"}, cortisol_am:{value:14.8,flag:"normal",ref_range:"6-18"}, estradiol:{value:26,flag:"normal",ref_range:"10-40"}, prolactin:{value:11.8,flag:"normal",ref_range:"2-18"}, tsh:{value:1.9,flag:"normal",ref_range:"0.4-4.0"}, free_t3:{value:3.4,flag:"normal",ref_range:"2.3-4.2"}, dhea_s:{value:245,flag:"normal",ref_range:"150-500"}, fasting_insulin:{value:6.1,flag:"normal",ref_range:"2-8"} } },
  ];
  for (const e of entries) {
    const { error } = await sb.from("blood_work").insert(e);
    console.log(error ? "ERR " + e.test_date + ": " + error.message : "OK  " + e.test_date);
  }
}
run();
