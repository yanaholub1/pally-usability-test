import { createContext, useContext } from 'react'
import type { GenderPref } from './data'

export type ScreenId =
  | 'home'
  | 'find'
  | 'bookCourt'
  | 'club'
  | 'visibility'
  | 'matchType'
  | 'gender'
  | 'approval'
  | 'review'
  | 'payment'
  | 'booked'
  | 'homeMatch'
  | 'matchDetails'
  | 'requests'

export type MatchConfig = {
  clubId: string
  dayIndex: number // 0 = today
  duration: 60 | 90 | 120
  time: string | null
  courtId: string | null
  visibility: 'open' | 'private'
  type: 'competitive' | 'casual'
  casualRange: [number, number]
  gender: GenderPref | null
  hostGender: 'woman' | 'man' | 'nonbinary' | 'unsaid' | null
  approval: 'instant' | 'approve'
  payMode: 'share' | 'full'
}

export const defaultConfig: MatchConfig = {
  clubId: 'cet',
  dayIndex: 1,
  duration: 90,
  time: null,
  courtId: 'c1',
  visibility: 'open',
  type: 'competitive',
  casualRange: [2.5, 4.5],
  gender: null,
  hostGender: null,
  approval: 'approve',
  payMode: 'share',
}

export type Decision = 'admitted' | 'declined'

export type AppCtx = {
  config: MatchConfig
  setConfig: (patch: Partial<MatchConfig>) => void
  push: (id: ScreenId) => void
  back: () => void
  reset: (id: ScreenId) => void
  /** Tab bar: Home returns to the current Home state (empty, or with the booked match); Find opens Find */
  goTab: (tab: 'home' | 'find' | 'messages' | 'profile') => void
  requestsArrived: boolean
  setRequestsArrived: (v: boolean) => void
  decisions: Record<string, Decision>
  decide: (id: string, d: Decision | null) => void
  openProfile: (requesterId: string) => void
  /** Hook for the test wrapper: called when the prototype reaches a milestone */
  milestone: (name: string) => void
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx)
export const useApp = () => useContext(Ctx)

export const SPOTS = 3

/** Dates relative to today, so the prototype never shows a past match */
export function dayAt(index: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + index)
  return d
}
export const fmt = {
  weekdayShort: (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' }),
  monthShort: (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' }),
  long: (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  short: (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
}

export function endTime(start: string, minutes: number) {
  const [h, m] = start.split(':').map(Number)
  const t = h * 60 + m + minutes
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export function levelRange(cfg: MatchConfig, hostLevel: number): [number, number] {
  if (cfg.type === 'casual') return cfg.casualRange
  return [Math.round((hostLevel - 0.2) * 10) / 10, Math.round((hostLevel + 0.2) * 10) / 10]
}

export const genderLabel: Record<string, string> = { any: 'Any', women: 'Women', men: 'Men', mixed: 'Mixed' }

/** Start times already gone for the given day (only today has any) */
export function isPastTime(dayIndex: number, time: string) {
  if (dayIndex !== 0) return false
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
}

/** Club page preselection: today and the closest upcoming start time (tomorrow's first if today is over) */
export function closestSlot(times: string[]): { dayIndex: number; time: string } {
  const next = times.find((t) => !isPastTime(0, t))
  return next ? { dayIndex: 0, time: next } : { dayIndex: 1, time: times[0] }
}
