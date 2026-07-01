/**
 * One-time import of existing THP clients from Notion intake database.
 * Run with: npx tsx scripts/import-notion-clients.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const clients = [
  {
    name: "Vasilije Radovanovic",
    email: "copyvasirado@gmail.com",
    password: "THP2024!",
    intake: {
      fullName: "Vasilije Radovanovic",
      ageLocation: "17, Netherlands",
      contactInfo: "copyvasirado@gmail.com | 0628854608 | @Vasirado_",
      travelPattern: "Based in Netherlands, travels to Serbia 1-2x/year",
      whatTryingToFix: "ALT levels in liver, overall gut health, overweight (losing bodyfat is a byproduct of fixing gut)",
      howAskForWhatYouWant: "Direct — doesn't hesitate to ask",
      avoidDisappointing: "Occasionally - specific people or situations",
      validationSource: "Mixed - internal confirmation but seek external proof",
      energyState: "High but comes in ups and downs. Crashes. Detox has helped slightly.",
      selfPerception: "Disciplined guy (gym-school-work-sleep) but hasn't reached full potential because of health",
      avoidConflict: "Depends on the situation",
      responseToCriticism: "Takes it from those doing better than him. Gets frustrated from those doing worse.",
      internalStateEnteringRoom: "Sometimes confident, sometimes not — depends on how he feels",
      pastRelationshipPatterns: "Leader in relationships, makes decisions, but controls emotions during conflict",
      trainingRecovery: "Adequate",
      heightWeightBf: "190cm / 100.5kg / 26.5% BF",
      sleepDuration: "7-8 hours but can't wake up from alarms — sleeps too deep",
      relationshipStatus: "Single",
      relationshipToRisk: "Risks make him excited. High risk = high ROI. Go for it.",
      sexualConfidence: "Functional but mental interference",
      alcoholUse: "Used to drink 1-2x/week with friends. Since detox — stopped.",
      currentMedications: "None",
      relationshipToFood: "Never hungry. Jojo dieting — keto, IF, then overeating. Metabolism likely compromised.",
      baselineInternalState: "Low-level anxiety/vigilance",
      onTrt: "No",
      whatStaysSolidTraveling: "Diet actually improves (more natural foods in Serbia)",
      caffeineIntake: "2-3 Red Bulls/day previously. Since detox — none.",
      nicotineSubstances: "Nicotine pouches — was 40mg, now 13mg, trying max 2-3/day",
      sleepQuality: "Deep and restorative",
      trainingFrequency: "Targeting 3x/week mornings but sometimes only 2 due to sleep issues",
      morningErections: "Not frequent. Sometimes. High libido (craving sexual interactions) + decent erections during day.",
      eyeContact: "Comfortable but break first",
      sexualDynamic: "Leader in past relationships. Takes long to make first move — 1hr in bed before initiating.",
      physiqueFeeling: "Not satisfied. Looks like shit.",
      trainingApproach: "Push/Pull (no legs). Push: DB press, incline, cable laterals, rear delt fly, tricep ext. Pull: hammer curls, preacher, seated rows, lat pulldown, T-bar. 3 sets x 6 reps to failure on 7th.",
      howDecompress: "Writes everything down, attacks each point",
      libido: "Present but lower than it should be",
      travelFrequency: "Occasional (quarterly)",
      wakeUpRecovered: "Sometimes",
      recentHormonePanel: "No",
    },
  },
  {
    name: "Jay Algoe",
    email: "jayalgoe74@gmail.com",
    password: "THP2024!",
    intake: {
      fullName: "Jay Algoe",
      ageLocation: "17, Netherlands",
      contactInfo: "jayalgoe74@gmail.com | +31 639748587 | @Jay_Algoe",
      travelPattern: "Barely travels",
      whatTryingToFix: "Testosterone, discipline, overcoming lust, financial freedom",
      howAskForWhatYouWant: "Indirect — wants to learn how others did it first",
      avoidDisappointing: "Occasionally - specific people or situations",
      validationSource: "External - I need others to acknowledge it",
      energyState: "Comes and goes — sometimes high, sometimes low",
      selfPerception: "Has potential but keeps running away from it",
      avoidConflict: "Depends on the situation",
      responseToCriticism: "Depends on situation — hard truth accepted if genuine",
      internalStateEnteringRoom: "Quiet, not nervous",
      pastRelationshipPatterns: "Wants to be a leader but isn't yet",
      trainingRecovery: "Adequate",
      heightWeightBf: "185cm / 85-90kg / 25% BF",
      sleepDuration: "7-9 hours",
      relationshipStatus: "Single",
      relationshipToRisk: "Makes him both excited and scared",
      sexualConfidence: "Low - anxiety or avoidance present",
      alcoholUse: "No",
      currentMedications: "No",
      relationshipToFood: "Binge eating. Can't stay consistent with diet.",
      baselineInternalState: "Low-level anxiety/vigilance",
      onTrt: "No",
      whatStaysSolidTraveling: "Sleep, body habits",
      caffeineIntake: "1-2 cups in morning",
      nicotineSubstances: "No",
      sleepQuality: "Light or fragmented",
      trainingFrequency: "2-3 hard sessions/week",
      morningErections: "Often, but rarely when feeling low",
      eyeContact: "Comfortable but break first",
      sexualDynamic: "No sexual experience yet (17)",
      physiqueFeeling: "Has more in him but can't figure out how to fully transform",
      trainingApproach: "Anterior, posterior, legs — daily walks, sprints, martial arts",
      howDecompress: "Doesn't know",
      libido: "Present but lower than it should be",
      travelFrequency: "Occasional (quarterly)",
      wakeUpRecovered: "Sometimes",
      recentHormonePanel: "No",
    },
  },
  {
    name: "Elias Christensen",
    email: "Elias22christensen@gmail.com",
    password: "THP2024!",
    intake: {
      fullName: "Elias Christensen",
      ageLocation: "23, Oslo Norway",
      contactInfo: "Elias22christensen@gmail.com | +47 46978930 | @eliasbchristensen",
      travelPattern: "Based in Oslo. Travels ~2x/year to Mediterranean.",
      whatTryingToFix: "1. Optimizing hormones 2. Best shape of his life 3. Big D energy mentality",
      howAskForWhatYouWant: "Direct — always better to be direct",
      avoidDisappointing: "Rarely - I mostly do what I want",
      validationSource: "Mixed - internal confirmation but seek external proof",
      energyState: "Depends on environment. High in USA trip, lower at job he dislikes. Drive absent at current job.",
      selfPerception: "Ton of potential. Pissed off he hasn't come further. Good genes. Capable of everything.",
      avoidConflict: "Depends on the situation",
      responseToCriticism: "Not criticized often. Better now at extracting value from it and moving on. Riding own wave.",
      internalStateEnteringRoom: "Nervous and confident simultaneously. Wants to be liked but knows he's masculine and social.",
      pastRelationshipPatterns: "Football team pusher. Military leader for soldiers. Knows when to give and take space with friends.",
      trainingRecovery: "Full recovery between sessions",
      heightWeightBf: "192cm / 88kg / 15-20% BF",
      sleepDuration: "8+ hours",
      relationshipStatus: "Single for 1.5 years",
      relationshipToRisk: "Both. Wants to feel all emotions life throws at him.",
      sexualConfidence: "Functional but mental interference",
      alcoholUse: "2x per month",
      currentMedications: "None",
      relationshipToFood: "Always hungry. Less food cravings since cutting cheap dopamine.",
      baselineInternalState: "Calm and grounded / confident",
      onTrt: "Nothing",
      whatStaysSolidTraveling: "Sleep and lifestyle habits. Eats more on vacation.",
      caffeineIntake: "None",
      nicotineSubstances: "Rarely smokes cigarettes",
      sleepQuality: "Light or fragmented",
      trainingFrequency: "Gym 2x/week + football 2x/week",
      morningErections: "Adequate. More aware now. Libido varies — some low days but mostly good. Less confident than before.",
      eyeContact: "Strong and sustained",
      sexualDynamic: "Balances it well. Both show what they want. Leads enough. Won't pursue disinterested girls.",
      physiqueFeeling: "Not satisfied. Was in great shape a year ago. Needs body recomp. Too much fat now.",
      trainingApproach: "Full body 2x/week",
      howDecompress: "Doesn't really decompress — looks for action and excitement every day",
      libido: "Present but lower than it should be",
      travelFrequency: "Occasional (quarterly)",
      wakeUpRecovered: "Sometimes",
      recentHormonePanel: "Yes - values below",
    },
  },
];

async function importClients() {
  console.log(`Importing ${clients.length} clients...\n`);

  for (const client of clients) {
    const email = client.email.toLowerCase().trim();

    // Check if already exists
    const { data: existing } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️  SKIP ${client.name} — already exists (${email})`);
      continue;
    }

    const { error } = await supabase.from("users").insert({
      name: client.name,
      email,
      password: client.password,
      status: "active",
      streak: 0,
      longest_streak: 0,
      joined_at: new Date().toISOString().split("T")[0],
      diagnostic_data: client.intake,
    });

    if (error) {
      console.error(`❌ FAILED ${client.name}: ${error.message}`);
    } else {
      console.log(`✅ IMPORTED ${client.name} (${email}) — password: ${client.password}`);
    }
  }

  console.log("\nDone.");
  console.log("\nClients missing emails (need THP to provide):");
  console.log("  - Jonah Campbell (instagram: j6nahh, phone: 443-473-1087)");
  console.log("  - Diego Zavala (instagram: Diegozavala_10, phone: 5596445422)");
  console.log("\nAll imported clients use temporary password: THP2024!");
  console.log("THP should have each client reset their password after first login.");
}

importClients().catch(console.error);
