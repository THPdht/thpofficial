import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EMAIL = "test@thp.com";
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; };

const mockAnalysis = [
  {
    date: daysAgo(13),
    talking_points: [
      "Marcus came in rough on day 1 — energy 4/10, sleep quality at 4, two night wakings, and a self-reported poor training feel on a rest day. The 3am cortisol spike pattern is textbook. His DOMS lasting 4-5 days confirms we're in a high-cortisol, low-recovery environment. Nothing surprising here — this is exactly where the protocol starts.",
      "He acknowledged avoiding a direct conversation with his manager. That's the third time this pattern shows up in his intake. Every avoidance event is a submission signal. His nervous system is running a chronic low-grade threat-detection loop. This connects directly to the adrenal load we're seeing in his energy and sleep data. The two are not separate problems.",
      "Nutrition slipped at lunch — bread from work. Glycaemic spike mid-day followed by the predictable crash. The cortisol spike from a carb crash at 2pm compounding on an already elevated baseline is what's driving the evening cravings he described. This week the priority is locking breakfast and the pre-bed honey. Lunch compliance can tighten in week 2."
    ],
    flags: ["night_waking", "conflict_avoidance", "nutrition_slip"]
  },
  {
    date: daysAgo(12),
    talking_points: [
      "First training session on the new protocol. Marcus hit Bench 185lbs x7 as his working set — solid baseline, and importantly he noted he was genuinely gassed from one set. That's the point. His previous 4-set approach was generating cortisol faster than testosterone. Single set to failure means maximum stimulus, minimum cortisol. Watch for strength gains from week 2 — they tend to come fast when recovery improves.",
      "OJ at lunch is already producing a noticeable afternoon effect. He reported feeling noticeably better in the PM — energy up to 5 vs 3 yesterday. That's the fructose-Vitamin C combination starting to support adrenal recovery. The cortisol clearance mechanism is activating. Morning erection returned today — this is a direct LH signal. His HPG axis is already responding.",
      "He said the real thing once today — disagreed directly with a colleague, held his position. Nothing bad happened. This is the key learning: the threat his nervous system predicts from direct communication rarely materialises. Each time he tests this and survives, the threat-detection threshold recalibrates. This is biological rewiring, not just behaviour change."
    ],
    flags: ["positive_trend", "lh_signal"]
  },
  {
    date: daysAgo(11),
    talking_points: [
      "Rest day with 12k steps. Recovery is the work on off days — not more training. His DOMS is already reducing. Yesterday's session recovery is happening faster than he's used to. This is what low-volume high-intensity training does: it allows the anabolic window to stay open without cortisol suppression from excess volume. Feeling 'genuinely recovered' is the target state.",
      "Full pro-metabolic day. Ribeye at lunch. He noted less bloating. This is the seed oil elimination working — intestinal inflammation reduces within days of removing inflammatory fats from the diet. Less bloating means better gut motility, better nutrient absorption, and a downstream improvement in sex hormone production. The gut-hormone axis is real.",
      "Afternoon crash was significantly less severe — he explicitly attributed it to the OJ at lunch. He's building cause-effect awareness around his biology. This is essential. When a client understands WHY a tool works, compliance stays high even when motivation dips. Reinforce this connection on the next call."
    ],
    flags: ["recovery_improving", "positive_trend"]
  },
  {
    date: daysAgo(10),
    talking_points: [
      "Slept through the night for the first time in months. No 3am wake-up. This is the honey protocol working. Liver glycogen is staying topped up overnight — adrenals don't need to fire cortisol to raise blood sugar. This single change has the most downstream impact of anything in the protocol. His cortisol curve will begin normalising from here. Watch for morning erection frequency to increase over the next 10 days.",
      "Weighted pull-ups at +25lbs x6 on day 3 of the protocol. Strength is solid. Pull strength is often a better indicator of systemic hormonal health than push — it requires the posterior chain and core to stabilise, which demands full-body neurological recruitment. The fact that he can hit these numbers confirms his nervous system has capacity. The protocol is about unlocking it.",
      "He closed a deal he'd been sitting on for 2 weeks — asked directly, they said yes. This is not a coincidence. As cortisol drops and testosterone rises, approach behaviour increases. The biological drive to act, to move, to close, to initiate — these are androgen-dependent. His business performance is going to track his hormonal recovery in a straight line."
    ],
    flags: ["sleep_breakthrough", "positive_trend", "testosterone_signal"]
  },
  {
    date: daysAgo(9),
    talking_points: [
      "Overcast day, no sunlight — Marcus noticed the difference himself. Energy AM dropped to 6 from 8 yesterday. Mood down to 5. This is not placebo: morning sunlight directly sets the cortisol awakening response, which governs the entire day's energy arc. On days without it, the circadian clock doesn't get its reset signal. Tell him this explicitly so he invests in getting outside even on grey days.",
      "One night waking returned. Without the morning light anchor, the circadian rhythm is slightly disrupted. This is a data point, not a setback. It actually demonstrates how precisely his system is responding to the protocol — both the inputs that help and the gaps that hurt are showing up clearly within days. His biology is sensitive, which means it responds fast in both directions.",
      "Overall feeling dropped to 5 but he maintained nutrition compliance. That matters. Compliance on a low day is harder than compliance on a high day. On the call, acknowledge that he held the protocol when it would have been easy to slip. This kind of discipline in the trough is what separates men who transform from men who plateau."
    ],
    flags: ["sunlight_missed", "night_waking"]
  },
  {
    date: daysAgo(8),
    talking_points: [
      "Leg press 360lbs x9 on week 2 of the protocol. Overall feeling at 8/10 — best day so far. This is the convergence point: sleep improving, cortisol dropping, nutrition locked in, progressive overload showing up in training. Energy stable all day. No afternoon crash noted. The system is switching states from cortisol-dominant to anabolic-dominant. This is the inflection point.",
      "Night-time cravings almost gone. This is significant. The cravings were a symptom of liver glycogen depletion and elevated cortisol driving blood sugar fluctuation at night. With the honey protocol and the pro-metabolic nutrition framework stabilising his glucose rhythm, the cravings are losing their biological driver. This is not willpower — it's fixing the chemistry.",
      "Held his frame in a difficult client conversation. Didn't back down. Client respected it. This is the direct communication muscle getting stronger. Each repetition lowers the threat-detection threshold slightly more. His testosterone is rising and his psychology is following — or more accurately, they're rising together. These systems are not separate."
    ],
    flags: ["positive_trend", "testosterone_signal", "frame_held"]
  },
  {
    date: daysAgo(7),
    talking_points: [
      "First natural wake-up in months — slept 8.5 hours, no alarm, woke up recovered. Overall feeling 8/10. Libido at 7. Morning erection. This is the sleep architecture normalising. Deep sleep is where growth hormone and testosterone are primarily produced. As cortisol drops overnight, the body can finally do the repair work it's been unable to do for months. This is the turning point.",
      "Went out socially and held eye contact without thinking about it. 'Just happened naturally.' This is the most important data point this week. Confident eye contact is not a skill he practised — it's a state he arrived at. Testosterone directly regulates approach behaviour, eye contact, and social dominance signals. The biology is producing the psychology, not the other way around.",
      "Rest day 14k steps — long walk. He's integrating the protocol into his lifestyle not just his training. Men who do this outperform men who treat it as a checklist. On the call, explore what he's doing on the walks — is he getting morning light? Is he phoneless? These inputs compound."
    ],
    flags: ["sleep_restored", "testosterone_signal", "positive_trend"]
  },
  {
    date: daysAgo(6),
    talking_points: [
      "Bench 185lbs x9 — hit the ceiling of his rep range. Next session adds 5lbs. Progressive overload is the most reliable training metric. Two weeks in, strength is moving. This rate of gain in a man who was previously stagnant for 6 months confirms that the training adaptation was always there — it was being suppressed by cortisol and poor recovery. The protocol removed the brake.",
      "Overall feeling consistently at 8, energy stable morning and afternoon, libido at 7. This is no longer a single good day — it's a consistent state. When 3+ data points in a row show this profile, we're looking at a genuine biological shift rather than a good patch. His HPG axis is running differently than it was 2 weeks ago.",
      "The directness practice is compounding. He's not logging specific instances anymore because it's becoming the default. This is the goal. Psychological rewiring doesn't happen in moments — it happens when the new behaviour stops feeling like effort and starts feeling like character."
    ],
    flags: ["positive_trend", "strength_pr"]
  },
  {
    date: daysAgo(5),
    talking_points: [
      "Rest day with 10k steps, first organ meat (chicken liver pâté). He said 'not as bad as expected.' Organ meats are the most nutrient-dense foods available — liver contains more bioavailable zinc, copper, B12, and retinol than any other food. Zinc is a direct cofactor in testosterone synthesis. Retinol supports steroidogenesis. Getting liver in weekly is one of the highest-leverage nutritional moves he can make.",
      "Feeling 7 across the board, energy stable. No crashes noted. The metabolic baseline is now stable enough that he doesn't comment on the absence of a crash — it's becoming normal. Three weeks ago he was describing a daily 2-3pm collapse as fixed and inevitable. That's gone. This is the metabolic rate normalising under pro-metabolic nutrition.",
      "Strategy focus at work today, 4 hours of deep work. Cognitive performance tracks testosterone and cortisol in a predictable pattern. As T rises and cortisol drops, working memory, executive function, and strategic thinking all improve. He's not forcing deep work — it's becoming accessible. Note this pattern for the call: his professional output is a hormonal indicator."
    ],
    flags: ["positive_trend", "organ_meat_intro"]
  },
  {
    date: daysAgo(4),
    talking_points: [
      "Pull-ups +30lbs x6 — added 5lbs from last week. Consistent strength progression across two weeks. This is the anabolic environment establishing itself. Recovery between sessions is now sufficient to allow adaptation. In men with elevated cortisol, muscle protein synthesis is suppressed even with adequate training stimulus. The cortisol normalisation is now enabling the gains the training was always generating.",
      "'Two weeks in. This is the clearest my head has been in over a year. Something has genuinely shifted.' This is the client articulating what the data has been showing. Cognitive clarity is one of the first and most noticeable effects of testosterone optimisation. The brain has testosterone receptors throughout — the prefrontal cortex, hippocampus, and amygdala all respond to androgen levels. His thinking is clearer because his hormones are improving.",
      "Best output week reported. 6 hours of deep work, 9/10 session quality, not forcing it. On the call, connect this directly to the protocol. He needs to understand that his professional performance is not separate from his health work — they are the same system. When he invests in his biology, his work improves. This is leverage he can use for the rest of his life."
    ],
    flags: ["positive_trend", "cognitive_improvement", "strength_pr"]
  },
  {
    date: daysAgo(3),
    talking_points: [
      "Consistent 8s across vitals, energy, and mood. No flags. This is what a stabilised baseline looks like. Two weeks ago his average was 4-5. He's shifted an entire tier in his daily experience. The work now is protecting this baseline and building from it — not just maintaining. The protocol moves to optimisation mode from here.",
      "Networking focus at work. Social engagement is increasing naturally. This tracks with rising testosterone — approach motivation, social confidence, and willingness to put himself in competitive social environments all correlate with androgen levels. He's not forcing social activity. He's drawn to it.",
      "No specific flags or concerns noted. On the call, do a structured review of the past 2 weeks: what's working, what needs refining, and what we're adding in week 3. He's earned a detailed progress debrief. Show him the data arc — from 4/10 to 8/10 across every metric in 14 days. Men need to see their progress quantified."
    ],
    flags: ["stable_baseline"]
  },
  {
    date: daysAgo(2),
    talking_points: [
      "Leg press 380lbs x8 — +20lbs in 2 weeks. Someone at the gym asked what he's doing differently. This is external validation of internal change. The physical transformation is accelerating now that the hormonal environment supports it. At +20lbs in 2 weeks with 1 working set per exercise, he's experiencing what happens when training volume is matched to recovery capacity. Manage expectations upward — this pace is sustainable.",
      "Overall feeling 9/10, energy 9 AM / 8 PM, libido 8, morning erection. This is a man operating at or near his hormonal ceiling for the first time in over a year. The contrast with his day 1 data is stark. His 60% feeling is gone. The next phase of work is taking this foundation and building the psychological architecture that makes it permanent — not dependent on external conditions.",
      "The gym recognition moment matters psychologically. He's becoming visible in a way he wasn't before. This is not vanity — it's social proof that his identity shift is real and legible to others. Use this on the call. Men need external confirmation that the internal work is showing up in the world."
    ],
    flags: ["positive_trend", "strength_pr", "social_signal"]
  },
  {
    date: daysAgo(1),
    talking_points: [
      "Pre-call day. Overall 9/10 across all metrics. Libido 8, morning erection, zero anxiety. 13k steps. He's excited to show the numbers tomorrow. This psychological relationship to his own data — curiosity, ownership, anticipation — is itself a sign of a healthy testosterone baseline. Low-T men avoid looking at their own metrics. High-T men want to measure everything.",
      "Bone broth in the afternoon — he's adding tools independently. This is protocol ownership. When a client starts integrating related inputs without being told, it means they understand the underlying framework, not just the rules. Bone broth provides glycine, which supports cortisol clearance and sleep quality. He found this himself. Reinforce it.",
      "Preparation mode for tomorrow's call. On the call: review the full 2-week arc, introduce the week 3 additions (bloodwork follow-up, refine nutrition timing, discuss psychological work at a deeper level), and set a 30-day target. He's ready to work at a higher level. The foundation is solid."
    ],
    flags: ["positive_trend", "pre_call"]
  },
  {
    date: daysAgo(0),
    talking_points: [
      "Bench 190lbs x7 — progressive overload is continuing. Two weeks of clean data. Today's tracker summary: before protocol — 3am wake-ups every night, 2-3pm energy crashes, rare morning erections, libido low, feeling 60% of capacity. Today — sleeping through, energy stable all day, libido 8/10, morning erections daily, feeling at full capacity. This is the 14-day data arc. The transformation is measurable and it's real.",
      "Overall feeling 9/10 across all metrics, 5 hours deep work, sales focus. He's not the same man who filled out the intake 2 weeks ago. The hormonal environment has shifted. LH is likely recovering. Free testosterone is rising. Cortisol is dropping. SHBG is beginning to lower. When he retests bloodwork, expect to see Total T in the 500-600 range, cortisol significantly reduced, and SHBG coming down.",
      "Today is the call. Go in with the data. Show him exactly where he started and exactly where he is now. 14 days. Every metric improved. This is what the protocol does when a man executes it. The next phase: add bloodwork follow-up, deepen the psychological work, refine nutrition timing as his metabolism accelerates. He's ready for phase 2."
    ],
    flags: ["positive_trend", "14_day_review", "phase_2_ready"]
  }
];

async function main() {
  console.log("Inserting mock tracker analysis...");
  let ok = 0;
  for (const a of mockAnalysis) {
    const { error } = await sb.from("tracker_analysis").upsert({
      user_email: EMAIL,
      date: a.date,
      talking_points: a.talking_points,
      flags: a.flags,
      generated_at: new Date().toISOString(),
    }, { onConflict: "user_email,date" });
    if (error) console.error(`  ❌ ${a.date}: ${error.message}`);
    else { process.stdout.write("."); ok++; }
  }
  console.log(`\n✅ ${ok} analysis entries inserted`);
}
main().catch(console.error);
