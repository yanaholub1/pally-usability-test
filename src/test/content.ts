/** All participant-facing copy for the test, in one place so it is easy to edit. */

export type Question =
  | { id: string; kind: 'choice'; title: string; options: string[] }
  | { id: string; kind: 'multi'; title: string; hint?: string; options: string[]; other?: boolean }
  | { id: string; kind: 'scale'; title: string; low: string; high: string }
  | { id: string; kind: 'open'; title: string; hint?: string; optional?: boolean; /** show the profile's score cards above the answer */ visual?: 'scores' | 'badges' }

export const ABOUT_YOU: Question[] = [
  { id: 'about_frequency', kind: 'choice', title: 'How often do you play padel?', options: ['Weekly or more', '1–3 times a month', 'Less than once a month', 'I haven’t played yet'] },
  {
    id: 'about_find_players', kind: 'multi', title: 'How do you usually find people to play with?', hint: 'Choose all that apply.',
    options: ['Friends or group chats', 'People at my club', 'Playtomic', 'Another app', 'I only play with people I know'], other: true,
  },
]

export const TASK_1 = {
  label: 'Task 1 of 2',
  short: 'Set up a match',
  text: 'Imagine you want to set up a match and find players to play with. Go ahead and set up the match. In this example, the app only lets you choose the settings where you’ll review and admit players yourself.',
}

export const BETWEEN: Question[] = [
  { id: 'between_expect_find', kind: 'open', title: 'How did you expect to find players for your match?' },
  { id: 'between_confusing', kind: 'open', title: 'Was anything confusing or unexpected while setting it up?', optional: true },
]

export const TASK_2 = {
  label: 'Task 2 of 2',
  short: 'Choose 3 of 5 players',
  // **…** shows in bold
  text: 'Your match is booked, and people have started asking to join. **5 players want in, but there are only 3 spots.** Decide who you’d actually want on court with you, taking the time you’d take in real life. Afterwards, we’ll ask you about your choices.',
}

export const FINAL: Question[] = [
  { id: 'final_why_chose', kind: 'open', title: 'Why did you choose these players?' },
  { id: 'final_profile_helpful', kind: 'open', title: 'When you checked their profiles, what information was helpful?' },
  { id: 'final_badges_meaning', kind: 'open', title: 'On the requests, you saw labels like these. What does each one tell you about the player?', hint: 'In your own words, there’s no right answer.', visual: 'badges' },
  { id: 'final_scores_meaning', kind: 'open', title: 'What do you think these two scores mean?', hint: 'You saw them on players’ profiles. In your own words, there’s no right answer.', visual: 'scores' },
  { id: 'final_profile_not_helpful', kind: 'open', title: 'Was anything on the profiles not helpful, or missing?', optional: true },
  { id: 'final_confidence', kind: 'scale', title: 'How confident do you feel about who you’ll be playing with?', low: 'Not at all', high: 'Very' },
  { id: 'final_anything_else', kind: 'open', title: 'Anything else you’d change?', optional: true },
]
