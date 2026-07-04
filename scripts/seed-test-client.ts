/**
 * Creates a fully mock test client with all data populated.
 * Run: npx tsx scripts/seed-test-client.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMAIL = "test@thp.com";
const NAME = "Marcus Webb";
const PASSWORD = "THP2025!";

// ── helpers ──────────────────────────────────────────────────────────────────
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

const tsAgo = (days: number, hours = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

async function main() {
  console.log("🧪 Seeding test client:", NAME, "<" + EMAIL + ">\n");

  // ── 1. User account ────────────────────────────────────────────────────────
  const { error: userErr } = await supabase.from("users").upsert({
    name: NAME,
    email: EMAIL,
    password: PASSWORD,
    status: "active",
    streak: 6,
    longest_streak: 14,
    last_tracker_date: daysAgo(0),
    joined_at: tsAgo(45),
    diagnostic_data: {
      accountStatus: "active",
      clientType: "1on1",
      protocolStatus: "active",
      monthlyRate: 500,
      productName: "THP COACHING",
      stripeCustomerId: "cus_test_mock_001",
      payments: [
        { id: "pay_1", date: daysAgo(45), amount: 500, currency: "usd", type: "deposit", note: "Onboarding deposit" },
        { id: "pay_2", date: daysAgo(30), amount: 500, currency: "usd", type: "monthly", note: "Month 1" },
        { id: "pay_3", date: daysAgo(0), amount: 500, currency: "usd", type: "monthly", note: "Month 2" },
      ],
      // Intake fields
      fullName: "Marcus Webb",
      ageLocation: "31, Austin, TX",
      contactInfo: "test@thp.com | @marcuswebb_",
      travelPattern: "Travels 2-3x/month for work, mostly domestic US",
      whatTryingToFix: "Low energy, brain fog in afternoons, poor sleep quality, low libido, and stubborn body fat around the midsection despite training consistently",
      howAskForWhatYouWant: "Indirect — hints at what I want rather than stating it directly. Getting better but still struggle with directness",
      avoidDisappointing: "Yes — especially with high-status men. Father, boss, clients",
      validationSource: "External — I rely on external proof more than I want to admit",
      energyState: "Moderate in mornings, crashes hard at 2-3pm. Gets a second wind around 8pm but then can't sleep",
      selfPerception: "High performer in work but feel like I'm operating at 60% of what I should be. My body doesn't match my identity",
      avoidConflict: "Yes, I tend to over-accommodate to avoid friction",
      responseToCriticism: "Defensive initially, but I process it and come around",
      internalStateEnteringRoom: "Self-conscious if I'm not feeling sharp. Confident when I'm on",
      pastRelationshipPatterns: "Attracted to high-energy women but end up being too accommodating. One serious relationship of 4 years ended last year",
      trainingRecovery: "Poor — DOMS lasts 4-5 days. Feel beaten up after every session",
      heightWeightBf: "6'1 / 198lbs / ~22% BF",
      sleepDuration: "6.5-7hrs but wakes up at 3am almost every night",
      relationshipStatus: "Single",
      relationshipToRisk: "Moderate — calculated risks in business but avoidant in personal life",
      sexualConfidence: "Low. Not initiating. Going weeks without pursuing anything",
      alcoholUse: "2-3 drinks socially on weekends",
      currentMedications: "None",
      relationshipToFood: "Emotional eater. Eats clean 80% of the time then binge eats at night. Massive sweet cravings after 9pm",
      baselineInternalState: "Low-grade anxiety. Never fully relaxed",
      onTrt: "No",
      caffeineIntake: "3 coffees before noon, none after",
      nicotineSubstances: "None",
      sleepQuality: "Poor. Light sleeper. Vivid dreams, waking at 3am frequently",
      trainingFrequency: "4x/week push-pull. Has been consistent for 2 years",
      morningErections: "Rare. Maybe 2x/week",
      eyeContact: "Breaks eye contact first in most interactions",
      physiqueFeeling: "Frustrated. Training hard but no visible progress for 6 months",
      trainingApproach: "Push/Pull split. High volume. 4 working sets per exercise. Not tracking progressive overload",
      howDecompress: "Scrolling. Netflix. Occasional walks",
      libido: "Low. Present but not driving",
      travelFrequency: "Weekly",
      wakeUpRecovered: "Never. Always feel like I need another 2 hours",
      recentHormonePanel: "Done 8 months ago. Total T was 380 ng/dL. That was it",
    },
  }, { onConflict: "email" });

  if (userErr) { console.error("❌ User:", userErr.message); process.exit(1); }
  console.log("✅ User account created\n");

  // ── 2. Diagnosis document ─────────────────────────────────────────────────
  const { error: diagErr } = await supabase.from("diagnostics").insert({
    user_email: EMAIL,
    stage: 1,
    title: "Initial Hormonal & Metabolic Diagnosis — Marcus Webb",
    published: true,
    content: {
      sections: [
        {
          heading: "Where You Actually Are",
          text: "Marcus, you're sitting at what I'd call a low-intermediate baseline. You've got the discipline and the structure — 4x/week training for 2 years is real work — but your biology is fighting you at every turn. Total T at 380 ng/dL eight months ago tells part of the story. That's not a number that produces the man you're trying to be. Combined with 3am wake-ups, afternoon crashes, night-time cravings, and near-zero morning erections, we're looking at a system that's under genuine metabolic stress. Your cortisol is running the show right now, and it's doing it at the expense of your testosterone and your recovery. The body fat sitting around your midsection despite consistent training is the most obvious symptom of chronically elevated cortisol and compromised insulin sensitivity. This isn't a training problem. It's a hormonal environment problem.",
        },
        {
          heading: "Root Cause Assessment",
          text: "The 3am waking pattern is a textbook cortisol spike — your liver glycogen is dropping too low overnight and your adrenals are firing cortisol to compensate and raise blood sugar. That spike is waking you up. The afternoon crash at 2-3pm is a blood sugar collapse, compounded by over-reliance on caffeine in the morning which is pushing cortisol even higher. The night-time sugar cravings are your body screaming for glucose to restore what the cortisol has depleted. You've been in a cortisol-dominant state for probably 12-18 months. It's suppressing your LH output, which is directly suppressing your testosterone production. The low libido, rare morning erections, poor recovery, and emotional eating are all downstream symptoms of this same root cause. The good news: this is fixable, and relatively quickly once we address the drivers in the right order.",
        },
        {
          heading: "Psychological Diagnostic",
          text: "What stood out to me most in your intake was the pattern of indirect communication, external validation-seeking, and conflict avoidance. These aren't character flaws. They're nervous system adaptations that are directly suppressing your testosterone output at the behavioral level. Every time you swallow what you actually want to say, your body registers that as a submission signal. Over time, those submission signals compound and literally lower your androgen output. The 60% feeling you described — that's real. Your identity is ahead of your biology right now. The work we do on the calls will bridge that gap. But understand that the psychological piece isn't separate from the hormonal piece. They're the same system.",
        },
      ],
    },
  });

  if (diagErr) { console.error("❌ Diagnosis:", diagErr.message); }
  else console.log("✅ Diagnosis document created");

  // ── 3. Protocol document ──────────────────────────────────────────────────
  const { error: protoErr } = await supabase.from("protocols").insert({
    user_email: EMAIL,
    stage: 1,
    title: "THP Protocol — Marcus Webb — Stage 1",
    content: {
      sections: [
        {
          heading: "What Is Actually Happening",
          text: "Marcus, let me be straight with you about where you're at. You're low-intermediate across the board. Your training discipline is real — 4 years of consistency means your nervous system knows how to work — but your hormonal environment is actively working against everything you're putting in. Total T at 380 eight months ago, 3am wake-ups every night, afternoon crashes, rare morning erections, no visible progress for six months despite consistent training. All of this is one problem with one root cause: you're in a chronic cortisol-dominant state. Your adrenals are running the show. LH is suppressed. Testosterone is low. Recovery is shot. And your body is holding fat specifically around the midsection as a direct result. This is fixable. Here's your protocol.",
        },
        {
          heading: "Nutrition",
          text: "Your entire nutrition strategy right now is working against your biology. The night-time cravings and the 3am wake-ups are the same problem: your liver glycogen is crashing overnight and your adrenals are compensating with cortisol. We fix this with food timing first.\n\nBreakfast within 30 minutes of waking: 3-4 whole eggs scrambled in butter, 200-250ml whole raw milk or full-fat A2 milk, 1 tablespoon raw honey mixed into the milk. This sets your metabolic tone for the day and stops your cortisol from spiking further in the morning.\n\nLunch is your biggest meal: red meat is the anchor here. 200-250g of ground beef or ribeye cooked in butter or tallow, white rice or potatoes as your carb source, a glass of fresh orange juice. This is not optional. Orange juice at lunch is a direct metabolic signal — the combination of fructose and Vitamin C supports your adrenal recovery and cortisol clearance.\n\nDinner: 2-3 hours before bed. Another protein-forward meal. Eggs, meat, fish — your choice. The critical addition is 1-2 tablespoons of raw honey 30-45 minutes before sleep. This refills your liver glycogen and stops the 3am cortisol spike. This one change alone will transform your sleep within 7-10 days.\n\nEliminate seed oils completely. Check every label. No canola, sunflower, vegetable, soybean, or corn oil anywhere in your diet. This isn't negotiable. Seed oils directly impair mitochondrial function and hormone production.",
        },
        {
          heading: "Training",
          text: "Your current approach — 4 sets per exercise, 4 sessions per week — is generating more cortisol than it is testosterone. You're accumulating fatigue faster than you're recovering. Here's what we're switching to:\n\n3 sessions per week. Monday, Wednesday, Friday — or any variation with rest days between.\n\nSession A (Push): Flat barbell or dumbbell press — 1 warm-up set, 1 working set to absolute failure (target 6-8 reps). Incline press — 1 working set to failure. Overhead press — 1 working set to failure. Lateral raises — 1 working set to failure. Tricep pushdown — 1 working set to failure.\n\nSession B (Pull): Weighted pull-ups or lat pulldown — 1 warm-up, 1 working set to failure. Seated cable rows — 1 working set to failure. Face pulls — 1 working set to failure. Barbell or dumbbell curl — 1 working set to failure.\n\nSession C (Legs): Leg press — 1 warm-up, 1 working set to absolute failure. Romanian deadlift — 1 working set to failure. Leg curl — 1 working set to failure. Calf raises — 1 working set to failure.\n\nOn rest days: 10,000-12,000 steps. No structured cardio. The walking is your recovery tool and it's non-negotiable.",
        },
        {
          heading: "Sleep",
          text: "Your 3am wake-up pattern ends with the honey protocol. Here's the full sleep stack:\n\n1-2 tablespoons raw honey 30-45 minutes before bed — this is the single most important change you make this week.\n\nScreens off 90 minutes before sleep. Not dimmed. Off. The blue light is directly suppressing your melatonin and fragmenting your sleep architecture.\n\nRoom temperature: 65-68°F. Your body needs to drop its core temperature to enter deep sleep. If your room is too warm, your cortisol stays elevated.\n\nYour target bedtime based on your schedule is 10-10:30pm. Protect it. The 8pm second wind you described is cortisol re-spiking in response to the evening blood sugar dip. The honey at dinner will begin to flatten this pattern within the first week.",
        },
        {
          heading: "Mitochondrial Optimization",
          text: "Morning sunlight within 30 minutes of waking. Get outside, face the sun, no sunglasses for the first 10-15 minutes. This resets your circadian cortisol curve and is one of the most powerful free tools available to you. It directly supports testosterone production by regulating your LH pulsatility.\n\nCold water finish on your shower — 60-90 seconds of cold water at the end. Not a cold plunge, just the end of your normal shower. This improves mitochondrial density, reduces inflammation, and sharpens your nervous system response.\n\nSeed oil elimination is mitochondrial work as much as it is hormonal. Seed oils embed into your cell membranes and directly impair the electron transport chain. Every gram of seed oil you remove is a direct upgrade to your energy production.",
        },
        {
          heading: "Mental Testosterone & Psychological Optimization",
          text: "This is where your real leverage is, Marcus. Your intake made it clear: you're operating in indirect communication, external validation loops, and conflict avoidance. These behavioral patterns are not just psychological habits. They are testosterone suppression mechanisms. Every time you don't say what you actually mean, every time you go along with something to avoid friction, every time you look to someone else to confirm your own read on a situation — your body registers that as subordination. Your hypothalamus responds to social and behavioral dominance signals. Subordination signals lower LH output. Lower LH means lower testosterone. The physiology is direct.\n\nThe work starts with one practice: say the real thing once a day. Not everything, not aggressively — just identify one moment per day where you would normally soften or redirect what you actually mean, and instead say the direct version. Watch what happens. The discomfort you feel is your nervous system recalibrating. That discomfort is the work.\n\nThe external validation seeking is a threat-detection pattern. You're scanning for approval before you feel safe to act. What you need to build is internal confirmation as your primary signal — the ability to read a situation, form your own assessment, and act on that assessment without needing external confirmation. We'll build this systematically on the calls. Start by noticing every time you ask a question that's actually a request for permission rather than information.\n\nYour 60% feeling is real and accurate. You are operating well below your output capacity. But understand this: that gap isn't a discipline gap. You've got discipline. It's a biology and psychology gap. We close it together.",
        },
        {
          heading: "Bloodwork",
          text: "Your panel from 8 months ago was incomplete. Total T at 380 ng/dL tells me you're low, but I need the full picture to work with precision. Here's what I need you to get done in the next 2 weeks:\n\nTotal testosterone, Free testosterone, SHBG, LH, FSH, Estradiol (sensitive assay), Prolactin, TSH, Free T3, Free T4, Cortisol (morning, 8am), DHEA-S, Complete metabolic panel, CBC, Fasting insulin, HbA1c.\n\nThe markers I'm most focused on for you: Free testosterone is more important than total. With elevated cortisol and the pattern you've described, I expect your SHBG to be elevated — which means a significant portion of your total testosterone is bound and unavailable. LH will tell me how hard your pituitary is trying to drive production. Prolactin elevation can directly suppress LH and is associated with low libido and brain fog. TSH and thyroid markers will explain the afternoon crash pattern if your metabolism is running slow. Morning cortisol will quantify what we already know is happening.",
        },
        {
          heading: "Your Daily System",
          text: "Here's how your days run from this point forward:\n\n6:30-7am: Wake up. Sunlight immediately — 10-15 minutes outside before anything else.\n\n7am: Breakfast. Eggs + butter + raw milk + raw honey. This is non-negotiable.\n\n7:30am: Training days — train here, fasted is fine for sessions under 60 minutes. Rest days — take a 30-minute walk.\n\n12:30-1pm: Biggest meal of the day. Red meat + carbs + OJ. Eat until satisfied.\n\n2-3pm: If the crash comes, it's a carb signal — have a piece of fruit or a small amount of honey in water. Do not reach for a coffee here.\n\n7pm: Dinner. Protein forward. Normal meal.\n\n9pm: 1-2 tablespoons raw honey.\n\n9:30pm: Screens off. Wind down.\n\n10-10:30pm: In bed.\n\nSimple. Repeatable. Every day the same. This is where the results come from.",
        },
      ],
      todos: [
        "Eliminate all seed oils from your kitchen this week — check every label",
        "Start the raw honey before bed tonight — 1-2 tablespoons, 30-45 minutes before sleep",
        "Get morning sunlight tomorrow — outside within 30 minutes of waking",
        "Book your full bloodwork panel this week — use the markers list above",
        "Switch to 3x/week training starting next Monday",
        "Track progressive overload — write down weights and reps every session",
        "Say the real thing once a day — identify one moment of indirect communication and redirect it",
        "10,000 steps on rest days — set a step tracker",
        "Screens off by 9:30pm starting tonight",
      ],
    },
  });

  if (protoErr) { console.error("❌ Protocol:", protoErr.message); }
  else console.log("✅ Protocol document created");

  // ── 4. Daily trackers (14 days of data) ──────────────────────────────────
  console.log("\n📊 Inserting tracker submissions...");

  const trackers = [
    {
      date: daysAgo(13),
      circadian: { wake_time: "6:45", sunlight: true, sleep_duration: 6.5, sleep_quality: 4, night_wakings: 2 },
      training: { trained: false, feel: "Poor", notes: "Rest day. Legs still wrecked from Monday." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Slipped on lunch, had a sandwich from work." },
      vitals: { overall_feeling: 4, energy_am: 5, energy_pm: 3, libido: 3, morning_erection: false },
      psychological: { focus_quality: 5, mood: 4, anxiety_level: 6, social_confidence: 4, notes: "Avoided a direct conversation with my manager again. Noticed it this time at least." },
      business: { work_session_quality: 6, deep_work_hours: 3, focus_type: "Admin", notes: "" },
    },
    {
      date: daysAgo(12),
      circadian: { wake_time: "6:30", sunlight: true, sleep_duration: 7, sleep_quality: 5, night_wakings: 1 },
      training: { trained: true, feel: "Good", session: "Push A", top_set: "Bench 185lbs x 7", notes: "First session on new protocol. Felt weird doing just 1 working set but I was actually gassed." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Had the OJ at lunch. Felt noticeably better in the afternoon." },
      vitals: { overall_feeling: 6, energy_am: 7, energy_pm: 5, libido: 4, morning_erection: true },
      psychological: { focus_quality: 6, mood: 6, anxiety_level: 5, social_confidence: 5, notes: "Said the real thing once today. Told my colleague I disagreed with his plan directly. Felt uncomfortable but nothing bad happened." },
      business: { work_session_quality: 7, deep_work_hours: 4, focus_type: "Deep work", notes: "Productive morning." },
    },
    {
      date: daysAgo(11),
      circadian: { wake_time: "6:35", sunlight: true, sleep_duration: 7.5, sleep_quality: 6, night_wakings: 1 },
      training: { trained: false, feel: "Good", notes: "12,000 steps. Felt genuinely recovered." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Full pro-metabolic day. Ribeye at lunch. Feeling less bloated." },
      vitals: { overall_feeling: 6, energy_am: 7, energy_pm: 6, libido: 4, morning_erection: true },
      psychological: { focus_quality: 7, mood: 6, anxiety_level: 4, social_confidence: 5, notes: "Afternoon crash was way less severe today. Attributed it to the OJ at lunch." },
      business: { work_session_quality: 7, deep_work_hours: 5, focus_type: "Deep work", notes: "" },
    },
    {
      date: daysAgo(10),
      circadian: { wake_time: "6:20", sunlight: true, sleep_duration: 7, sleep_quality: 6, night_wakings: 0 },
      training: { trained: true, feel: "Great", session: "Pull B", top_set: "Weighted pull-ups +25lbs x 6", notes: "Slept through for the first time in months. No 3am wakeup. Honey is working." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Ground beef + rice + OJ at lunch. Cravings at night were about 50% less intense." },
      vitals: { overall_feeling: 7, energy_am: 8, energy_pm: 6, libido: 5, morning_erection: true },
      psychological: { focus_quality: 7, mood: 7, anxiety_level: 4, social_confidence: 6, notes: "Something is shifting. Hard to explain. Feel more settled." },
      business: { work_session_quality: 8, deep_work_hours: 5, focus_type: "Strategy", notes: "Closed a deal I'd been sitting on for 2 weeks. Asked directly. They said yes." },
    },
    {
      date: daysAgo(9),
      circadian: { wake_time: "6:30", sunlight: false, sleep_duration: 6.5, sleep_quality: 5, night_wakings: 1, notes: "Overcast, skipped sunlight. Noticed the difference." },
      training: { trained: false, feel: "Okay", notes: "Rest day. 10k steps." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "" },
      vitals: { overall_feeling: 5, energy_am: 6, energy_pm: 5, libido: 4, morning_erection: false },
      psychological: { focus_quality: 6, mood: 5, anxiety_level: 5, social_confidence: 5, notes: "Grayer day overall. Correlated to no sunlight I think." },
      business: { work_session_quality: 6, deep_work_hours: 3, focus_type: "Admin", notes: "" },
    },
    {
      date: daysAgo(8),
      circadian: { wake_time: "6:25", sunlight: true, sleep_duration: 7.5, sleep_quality: 7, night_wakings: 0 },
      training: { trained: true, feel: "Great", session: "Legs C", top_set: "Leg press 360lbs x 9", notes: "Pushed hard. Single working set felt like I'd done 5. This protocol hits different." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Steak + potatoes + OJ. Night time cravings almost gone." },
      vitals: { overall_feeling: 8, energy_am: 8, energy_pm: 7, libido: 6, morning_erection: true },
      psychological: { focus_quality: 8, mood: 8, anxiety_level: 3, social_confidence: 7, notes: "Had a difficult conversation with a client today. Held my frame. Didn't back down. Client respected it." },
      business: { work_session_quality: 8, deep_work_hours: 6, focus_type: "Sales", notes: "Best work day in months." },
    },
    {
      date: daysAgo(7),
      circadian: { wake_time: "7:30", sunlight: true, sleep_duration: 8.5, sleep_quality: 8, night_wakings: 0, notes: "Weekend. Slept in. First time I've woken up naturally in I don't know how long." },
      training: { trained: false, feel: "Great", notes: "Rest day. Long walk, 14k steps." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Went out for dinner. Ordered steak, asked for butter on the side. Avoided the bread." },
      vitals: { overall_feeling: 8, energy_am: 9, energy_pm: 8, libido: 7, morning_erection: true },
      psychological: { focus_quality: 7, mood: 9, anxiety_level: 2, social_confidence: 8, notes: "Went out socially. Held eye contact without thinking about it. Just happened naturally." },
      business: { work_session_quality: 0, deep_work_hours: 0, focus_type: "Learning", notes: "Weekend." },
    },
    {
      date: daysAgo(6),
      circadian: { wake_time: "6:30", sunlight: true, sleep_duration: 7.5, sleep_quality: 7, night_wakings: 0 },
      training: { trained: true, feel: "Great", session: "Push A", top_set: "Bench 185lbs x 9 — added weight next set", notes: "Hit ceiling on bench. Added 5lbs next session." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "" },
      vitals: { overall_feeling: 8, energy_am: 8, energy_pm: 7, libido: 7, morning_erection: true },
      psychological: { focus_quality: 8, mood: 8, anxiety_level: 3, social_confidence: 7, notes: "" },
      business: { work_session_quality: 8, deep_work_hours: 5, focus_type: "Deep work", notes: "" },
    },
    {
      date: daysAgo(5),
      circadian: { wake_time: "6:40", sunlight: true, sleep_duration: 7, sleep_quality: 7, night_wakings: 0 },
      training: { trained: false, feel: "Good", notes: "10k steps. Feeling genuinely recovered between sessions." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Organ meats for the first time — chicken liver pâté. Not as bad as expected." },
      vitals: { overall_feeling: 7, energy_am: 8, energy_pm: 7, libido: 6, morning_erection: true },
      psychological: { focus_quality: 7, mood: 7, anxiety_level: 3, social_confidence: 7, notes: "" },
      business: { work_session_quality: 7, deep_work_hours: 4, focus_type: "Strategy", notes: "" },
    },
    {
      date: daysAgo(4),
      circadian: { wake_time: "6:30", sunlight: true, sleep_duration: 7.5, sleep_quality: 8, night_wakings: 0 },
      training: { trained: true, feel: "Great", session: "Pull B", top_set: "Pull-ups +30lbs x 6", notes: "+5lbs from last week. Strength going up fast." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Had orange juice at breakfast too. Felt great." },
      vitals: { overall_feeling: 9, energy_am: 9, energy_pm: 8, libido: 8, morning_erection: true },
      psychological: { focus_quality: 9, mood: 8, anxiety_level: 2, social_confidence: 8, notes: "Two weeks in. This is the clearest my head has been in over a year. Something has genuinely shifted." },
      business: { work_session_quality: 9, deep_work_hours: 6, focus_type: "Deep work", notes: "Best output week I've had. Not forcing it." },
    },
    {
      date: daysAgo(3),
      circadian: { wake_time: "6:35", sunlight: true, sleep_duration: 7, sleep_quality: 7, night_wakings: 0 },
      training: { trained: false, feel: "Good", notes: "12k steps." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "" },
      vitals: { overall_feeling: 8, energy_am: 8, energy_pm: 7, libido: 7, morning_erection: true },
      psychological: { focus_quality: 8, mood: 8, anxiety_level: 3, social_confidence: 7, notes: "" },
      business: { work_session_quality: 8, deep_work_hours: 4, focus_type: "Networking", notes: "" },
    },
    {
      date: daysAgo(2),
      circadian: { wake_time: "6:30", sunlight: true, sleep_duration: 7.5, sleep_quality: 8, night_wakings: 0 },
      training: { trained: true, feel: "Great", session: "Legs C", top_set: "Leg press 380lbs x 8", notes: "+20lbs in 2 weeks." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "" },
      vitals: { overall_feeling: 9, energy_am: 9, energy_pm: 8, libido: 8, morning_erection: true },
      psychological: { focus_quality: 9, mood: 9, anxiety_level: 2, social_confidence: 9, notes: "Someone at the gym asked me what I'm doing differently. First time that's happened." },
      business: { work_session_quality: 9, deep_work_hours: 5, focus_type: "Sales", notes: "" },
    },
    {
      date: daysAgo(1),
      circadian: { wake_time: "6:25", sunlight: true, sleep_duration: 8, sleep_quality: 8, night_wakings: 0 },
      training: { trained: false, feel: "Great", notes: "Rest day. 13k steps." },
      nutrition: { honey_before_bed: true, seed_oils_avoided: true, breakfast_had: true, notes: "Bone broth in the afternoon. Feeling good." },
      vitals: { overall_feeling: 9, energy_am: 9, energy_pm: 9, libido: 8, morning_erection: true },
      psychological: { focus_quality: 9, mood: 9, anxiety_level: 2, social_confidence: 9, notes: "Two week check-in tomorrow. Excited to show the numbers." },
      business: { work_session_quality: 8, deep_work_hours: 4, focus_type: "Content", notes: "" },
    },
    {
      date: daysAgo(0),
      circadian: { wake_time: "6:30", sunlight: true, sleep_duration: 7.5, sleep_quality: 8, night_wakings: 0 },
      training: { trained: true, feel: "Great", session: "Push A", top_set: "Bench 190lbs x 7", notes: "+5lbs. Progressive overload is real." },
      nutrition: { honey_before_bed: false, seed_oils_avoided: true, breakfast_had: true, notes: "Today still in progress." },
      vitals: { overall_feeling: 9, energy_am: 9, energy_pm: 8, libido: 8, morning_erection: true },
      psychological: { focus_quality: 9, mood: 9, anxiety_level: 2, social_confidence: 9, notes: "14 days in. Before: 3am wake-ups, energy crashes, low libido, 60% feeling. Now: sleeping through, energy stable all day, libido back, feeling like myself." },
      business: { work_session_quality: 9, deep_work_hours: 5, focus_type: "Deep work", notes: "" },
    },
  ];

  let trackerOk = 0;
  for (const t of trackers) {
    const { error } = await supabase.from("daily_trackers").upsert({
      user_email: EMAIL,
      date: t.date,
      circadian: t.circadian,
      training: t.training,
      nutrition: t.nutrition,
      vitals: t.vitals,
      psychological: t.psychological,
      business: t.business,
      submitted_at: tsAgo(trackers.indexOf(t), 9),
    }, { onConflict: "user_email,date" });
    if (error) console.error(`  ❌ Tracker ${t.date}: ${error.message}`);
    else { process.stdout.write("."); trackerOk++; }
  }
  console.log(`\n✅ ${trackerOk} tracker submissions created`);

  // ── 5. Blood work entries ─────────────────────────────────────────────────
  console.log("\n🩸 Inserting blood work entries...");

  const bloodWorkEntries = [
    {
      user_email: EMAIL,
      test_date: daysAgo(40),
      uploaded_at: tsAgo(40),
      image_url: "https://placehold.co/600x400?text=Blood+Work+Scan",
      markers: {
        total_t: { value: 382, flag: "low", ref_range: "400-1200" },
        free_t: { value: 8.2, flag: "low", ref_range: "9-30" },
        shbg: { value: 48, flag: "high", ref_range: "10-40" },
        lh: { value: 3.1, flag: "normal", ref_range: "1.7-8.6" },
        fsh: { value: 2.8, flag: "normal", ref_range: "1.5-12.4" },
        estradiol: { value: 28, flag: "normal", ref_range: "10-40" },
        prolactin: { value: 14.2, flag: "normal", ref_range: "2-18" },
        tsh: { value: 2.8, flag: "normal", ref_range: "0.4-4.0" },
        free_t3: { value: 2.8, flag: "low-normal", ref_range: "2.3-4.2" },
        cortisol_am: { value: 22.1, flag: "high", ref_range: "6-18" },
        dhea_s: { value: 180, flag: "low-normal", ref_range: "150-500" },
        fasting_insulin: { value: 11.2, flag: "high-normal", ref_range: "2-8" },
        hba1c: { value: 5.6, flag: "normal", ref_range: "4.0-5.6" },
        rbc: { value: 4.8, flag: "normal", ref_range: "4.5-5.9" },
        hematocrit: { value: 44, flag: "normal", ref_range: "40-52" },
      },
    },
    {
      user_email: EMAIL,
      test_date: daysAgo(5),
      uploaded_at: tsAgo(5),
      image_url: "https://placehold.co/600x400?text=Blood+Work+Scan",
      markers: {
        total_t: { value: 524, flag: "normal", ref_range: "400-1200" },
        free_t: { value: 13.8, flag: "normal", ref_range: "9-30" },
        shbg: { value: 38, flag: "normal", ref_range: "10-40" },
        lh: { value: 5.2, flag: "normal", ref_range: "1.7-8.6" },
        fsh: { value: 3.4, flag: "normal", ref_range: "1.5-12.4" },
        estradiol: { value: 26, flag: "normal", ref_range: "10-40" },
        prolactin: { value: 11.8, flag: "normal", ref_range: "2-18" },
        tsh: { value: 1.9, flag: "normal", ref_range: "0.4-4.0" },
        free_t3: { value: 3.4, flag: "normal", ref_range: "2.3-4.2" },
        cortisol_am: { value: 14.8, flag: "normal", ref_range: "6-18" },
        dhea_s: { value: 245, flag: "normal", ref_range: "150-500" },
        fasting_insulin: { value: 6.1, flag: "normal", ref_range: "2-8" },
        hba1c: { value: 5.4, flag: "normal", ref_range: "4.0-5.6" },
        rbc: { value: 5.1, flag: "normal", ref_range: "4.5-5.9" },
        hematocrit: { value: 47, flag: "normal", ref_range: "40-52" },
      },
    },
  ];

  for (const bw of bloodWorkEntries) {
    const { error } = await supabase.from("blood_work").insert(bw);
    if (error) console.error(`  ❌ Blood work ${bw.test_date}: ${error.message}`);
    else console.log(`  ✅ Blood work entry: ${bw.test_date}`);
  }

  // ── 6. Update user with streak data ──────────────────────────────────────
  await supabase.from("users").update({
    streak: 14,
    longest_streak: 14,
    last_tracker_date: daysAgo(0),
  }).eq("email", EMAIL);

  console.log("\n✅ All done!");
  console.log(`\nTest client login:`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Name:     ${NAME}`);
  console.log(`\nData created:`);
  console.log(`  - User account (active, $500/mo, 14-day streak)`);
  console.log(`  - Full intake diagnostic data (40 fields)`);
  console.log(`  - Diagnosis document (3 sections)`);
  console.log(`  - Protocol document (8 sections + 9 todos)`);
  console.log(`  - 14 daily tracker submissions (2 weeks, shows clear progression)`);
  console.log(`  - 2 blood work entries (before: low T, after: normalized)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
