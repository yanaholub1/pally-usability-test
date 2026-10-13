export type GenderPref = 'any' | 'women' | 'men' | 'mixed'

export type AttendanceBucket = 'Highly reliable' | 'Reliable' | 'Sometimes cancels late' | 'Often misses matches'
export type SportsBucket = 'Great teammate' | 'Good to play with' | 'Usually positive' | 'Mixed feedback' | 'Room to grow'

export type Requester = {
  id: 'A' | 'B' | 'C' | 'D' | 'E'
  name: string
  photo: string // file name in /assets/avatars, swapped in once exported
  level: number
  levelEstimated: boolean
  status: 'Active player' | 'New to Pally'
  matches: number
  attendance: number | null // % or null = not enough data
  arrivedOnTime?: [number, number]
  cancelledLate?: [number, number]
  sportsmanship: number | null
  side: 'Right' | 'Left' | 'Either'
  mutualFriends: number
  expiresInH: number
  languages: string[]
  hand: 'Right' | 'Left'
  following: number
  followers: number
  clubsVisited: number
  tournaments: number
  minutes: number
  playersMet: number
  wins: number
}

export function attendanceBucket(p: number): AttendanceBucket {
  if (p >= 85) return 'Highly reliable'
  if (p >= 70) return 'Reliable'
  if (p >= 50) return 'Sometimes cancels late'
  return 'Often misses matches'
}

export function sportsBucket(p: number): SportsBucket {
  if (p >= 85) return 'Great teammate'
  if (p >= 70) return 'Good to play with'
  if (p >= 50) return 'Usually positive'
  if (p >= 30) return 'Mixed feedback'
  return 'Room to grow'
}

export function sportsMood(p: number): 'happy' | 'neutral' | 'unhappy' {
  if (p >= 70) return 'happy'
  if (p >= 30) return 'neutral'
  return 'unhappy'
}

type Base = Omit<Requester, 'name' | 'photo'>

const base: Base[] = [
  {
    id: 'A', level: 3.2, levelEstimated: false, status: 'Active player', matches: 34,
    attendance: 92, arrivedOnTime: [31, 34], cancelledLate: [1, 34], sportsmanship: 90,
    side: 'Right', mutualFriends: 0, expiresInH: 22, languages: ['Spanish', 'Catalan', 'English'], hand: 'Right',
    following: 41, followers: 58, clubsVisited: 7, tournaments: 4, minutes: 3060, playersMet: 52, wins: 19,
  },
  {
    id: 'B', level: 3.3, levelEstimated: false, status: 'Active player', matches: 21,
    attendance: 62, arrivedOnTime: [16, 21], cancelledLate: [5, 26], sportsmanship: 88,
    side: 'Left', mutualFriends: 1, expiresInH: 20, languages: ['Spanish', 'English'], hand: 'Right',
    following: 23, followers: 30, clubsVisited: 5, tournaments: 2, minutes: 1890, playersMet: 37, wins: 13,
  },
  {
    id: 'C', level: 3.0, levelEstimated: true, status: 'New to Pally', matches: 2,
    attendance: null, sportsmanship: null,
    side: 'Either', mutualFriends: 0, expiresInH: 24, languages: ['English', 'Spanish'], hand: 'Right',
    following: 3, followers: 2, clubsVisited: 1, tournaments: 0, minutes: 180, playersMet: 6, wins: 1,
  },
  {
    id: 'D', level: 3.1, levelEstimated: false, status: 'Active player', matches: 48,
    attendance: 90, arrivedOnTime: [44, 48], cancelledLate: [1, 49], sportsmanship: 40,
    side: 'Left', mutualFriends: 0, expiresInH: 19, languages: ['Spanish'], hand: 'Left',
    following: 12, followers: 25, clubsVisited: 9, tournaments: 6, minutes: 4320, playersMet: 71, wins: 27,
  },
  {
    id: 'E', level: 2.8, levelEstimated: false, status: 'Active player', matches: 15,
    attendance: 78, arrivedOnTime: [12, 15], cancelledLate: [2, 17], sportsmanship: 75,
    side: 'Right', mutualFriends: 3, expiresInH: 18, languages: ['Spanish', 'Catalan'], hand: 'Right',
    following: 64, followers: 71, clubsVisited: 4, tournaments: 1, minutes: 1350, playersMet: 29, wins: 6,
  },
]

/** Names and photos per gender filter. Same five profiles, different people. */
const people: Record<'mixed' | 'women' | 'men', { name: string; photo: string }[]> = {
  mixed: [
    { name: 'Laura', photo: 'laura' },
    { name: 'Marc', photo: 'marc' },
    { name: 'Sofía', photo: 'sofia' },
    { name: 'Javi', photo: 'javi' },
    { name: 'Dani', photo: 'dani' },
  ],
  women: [
    { name: 'Laura', photo: 'laura' },
    { name: 'Marta', photo: 'marta' },
    { name: 'Sofía', photo: 'sofia' },
    { name: 'Júlia', photo: 'julia' },
    { name: 'Daniela', photo: 'daniela' },
  ],
  men: [
    { name: 'Pau', photo: 'pau' },
    { name: 'Marc', photo: 'marc' },
    { name: 'Álex', photo: 'alex' },
    { name: 'Javi', photo: 'javi' },
    { name: 'Dani', photo: 'dani' },
  ],
}

export function requestersFor(gender: GenderPref): Requester[] {
  const set = gender === 'women' ? people.women : gender === 'men' ? people.men : people.mixed
  return base.map((b, i) => ({ ...b, ...set[i] }))
}

export type Club = { id: string; name: string; address: string; area: string; distanceKm: number; photo: string }

export const clubs: Club[] = [
  { id: 'cet', name: 'CET Maresme', address: 'Sant Martí, Carrer de Perú 23', area: 'Barcelona, Sant Martí', distanceKm: 3, photo: 'club-cet' },
  { id: 'padel7', name: 'Padel 7', address: 'Sant Martí, Carrer de Llull 45', area: 'Barcelona, Sant Martí', distanceKm: 2, photo: 'club-padel7' },
  { id: 'poblenou', name: 'Club Padel Poblenou', address: 'Poblenou, Carrer de Pujades 101', area: 'Barcelona, Poblenou', distanceKm: 4, photo: 'club-poblenou' },
]

export const courts = [
  { id: 'c1', name: 'Court 1', details: 'Outdoor | Crystal | Double', price: 17, short: 'Outdoors' },
  { id: 'c2', name: 'Court 2', details: 'Indoor | Crystal | Double', price: 20, short: 'Indoors' },
]

/**
 * Start times follow the clock, so participants see real, bookable times whenever they test.
 * Clubs run 08:00–22:30 (last start); the grid never crosses midnight.
 * - Today: every half hour from the next half hour to 22:30 (up to 12 times; fewer late in the evening).
 * - Other days: 12 half-hour times in the same part of the day (starting 08:00–17:00).
 */
const FIRST_START = 8 * 60
const LAST_START = 22 * 60 + 30
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export function startTimesFor(dayIndex: number, now = new Date()): string[] {
  const mins = now.getHours() * 60 + now.getMinutes()
  const next = Math.max(Math.floor(mins / 30) * 30 + 30, FIRST_START)
  const start = dayIndex === 0 ? next : Math.min(next, LAST_START - 11 * 30)
  const out: string[] = []
  for (let m = start; m <= LAST_START && out.length < 12; m += 30) out.push(hhmm(m))
  return out
}

export const BOOKING_FEE = 0.79
export const HOST = { name: 'Katerine', level: 3.2, photo: 'katerine' }
