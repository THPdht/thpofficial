export type ProtocolId = 'strength' | 'fat_loss' | 'mindset';

export type TrackerField = {
  id: string;
  label: string;
  hint?: string;
  type: 'rating' | 'textarea' | 'text' | 'boolean' | 'number' | 'upload';
  placeholder?: string;
  optional?: boolean;
  unit?: string;
};

export type Protocol = {
  id: ProtocolId;
  name: string;
  tagline: string;
  challenge: { name: string; totalDays: number };
  pillars: { name: string; description: string }[];
  trackerFields: TrackerField[];
  color: string;
};

export const PROTOCOLS: Record<ProtocolId, Protocol> = {
  strength: {
    id: 'strength',
    name: 'Strength & Power',
    tagline: 'Built to get stronger, session by session.',
    challenge: { name: 'Progressive Overload Challenge', totalDays: 7 },
    color: 'var(--color-red)',
    pillars: [
      { name: 'Progressive overload', description: 'Add weight or reps every session. No coasting.' },
      { name: 'Recovery', description: 'Sleep 7 to 9 hours. Earn your rest like you earn your gains.' },
      { name: 'Fuel', description: 'Eat to perform. Protein first, every meal.' },
      { name: 'Consistency', description: 'Show up especially when it\'s hard. That\'s when it counts.' },
    ],
    trackerFields: [
      { id: 'trained', label: 'Did you train today?', type: 'boolean' },
      { id: 'energy_in', label: 'Energy going into your session', hint: '1 = depleted · 10 = unstoppable', type: 'rating' },
      { id: 'key_lift', label: 'Key lift + numbers', hint: 'e.g. Deadlift 4×3 @ 140kg', type: 'text', placeholder: 'Exercise · sets × reps @ weight' },
      { id: 'recovery', label: 'Recovery score', hint: '1 = wrecked · 10 = fresh and ready', type: 'rating' },
      { id: 'sleep', label: 'Sleep last night', type: 'number', placeholder: '7.5', unit: 'hrs' },
      { id: 'progress_media', label: 'Progress photo or video', hint: 'Show the work. Gym selfie, form check, physique. Anything that tells the story.', type: 'upload' },
      { id: 'notes', label: 'Notes for THP', hint: 'PRs, questions, anything to flag.', type: 'textarea', optional: true },
    ],
  },
  fat_loss: {
    id: 'fat_loss',
    name: 'Fat Loss & Conditioning',
    tagline: "Every day you show up is a day you can't take back.",
    challenge: { name: '21-Day Consistency Challenge', totalDays: 21 },
    color: 'var(--color-gold)',
    pillars: [
      { name: 'Nutrition', description: 'Stick to the plan. Every meal is a choice.' },
      { name: 'Daily movement', description: '8,000 steps minimum. Walk when you can\'t train.' },
      { name: 'Recovery', description: 'Sleep is when the fat loss actually happens.' },
      { name: 'Accountability', description: 'Track it. If it\'s not logged, it didn\'t happen.' },
    ],
    trackerFields: [
      { id: 'nutrition', label: 'Nutrition adherence', hint: 'Did you stick to the plan today?', type: 'boolean' },
      { id: 'steps', label: 'Steps today', hint: 'Target: 8,000+', type: 'number', placeholder: '8000', unit: 'steps' },
      { id: 'workout', label: 'Workout completed?', type: 'boolean' },
      { id: 'water', label: 'Water intake', hint: 'Target: 2.5 to 3L', type: 'number', placeholder: '2.5', unit: 'L' },
      { id: 'energy', label: 'Energy & mood', hint: '1 = low · 10 = great', type: 'rating' },
      { id: 'progress_media', label: 'Daily progress photo', hint: 'Same time, same lighting every day.', type: 'upload' },
      { id: 'notes', label: 'Anything to flag?', hint: 'Cravings, slips, wins. Be honest.', type: 'textarea', optional: true },
    ],
  },
  mindset: {
    id: 'mindset',
    name: 'Mindset & High Performance',
    tagline: 'Between sessions is where the protocol runs. Log what actually happened.',
    challenge: { name: '30-Day Identity Shift', totalDays: 30 },
    color: 'var(--color-cream)',
    pillars: [
      { name: 'Daily reflection', description: 'Write it down. Reflection without a record disappears.' },
      { name: 'Identity habits', description: 'Build the habits before you expect the results.' },
      { name: 'Output & action', description: 'What did you actually do today? Name the action, not the intention.' },
      { name: 'Emotional mastery', description: 'Notice the urge to react. Pause. Then respond.' },
    ],
    trackerFields: [
      { id: 'focus', label: 'Focus & clarity today', hint: '1 = scattered · 10 = locked in', type: 'rating' },
      { id: 'win', label: 'One win today', hint: 'Find one specific thing you got right today. Write it down.', type: 'text', placeholder: 'Today I...' },
      { id: 'obstacle', label: 'What challenged you?', hint: 'Own the friction. Name it.', type: 'textarea', placeholder: 'I struggled with...' },
      { id: 'action', label: 'Key action toward your goal', hint: 'What did you actually do today?', type: 'text', placeholder: 'Today I took action on...' },
      { id: 'energy', label: 'Energy & presence', hint: '1 = drained · 10 = fully present', type: 'rating' },
      { id: 'progress_media', label: 'Capture the work', hint: 'A photo, screenshot, video. Proof you showed up.', type: 'upload', optional: true },
      { id: 'notes', label: 'Message to THP', hint: 'What do you need from your mentor right now?', type: 'textarea', optional: true },
    ],
  },
};

export const DEFAULT_TRACKER_FIELDS: TrackerField[] = [
  { id: 'trained', label: 'Did you train today?', type: 'boolean' },
  { id: 'energy', label: 'Energy today', hint: '1 = depleted · 10 = unstoppable', type: 'rating' },
  { id: 'sleep', label: 'Sleep last night', type: 'number', placeholder: '7.5', unit: 'hrs' },
  { id: 'recovery', label: 'Recovery score', hint: '1 = wrecked · 10 = fresh', type: 'rating' },
  { id: 'progress_media', label: 'Progress photo or video', hint: 'Show the work.', type: 'upload' },
  { id: 'notes', label: 'Notes for THP', hint: 'PRs, questions, anything to flag.', type: 'textarea', optional: true },
];
