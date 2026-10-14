/**
 * Survives a page reload (same tab): which participant this is and where they were, so a refresh
 * resumes the test instead of starting a new, half-empty session. sessionStorage is per tab and
 * is cleared when the tab closes. Every access is guarded: private modes can throw.
 */
import type { MatchConfig } from '../state'

const KEY = 'pally-test'
export type Saved = {
  pid: string
  mode: 'unmoderated' | 'moderated' | 'pilot'
  step: string
  mic: 'unknown' | 'granted' | 'denied'
  config: MatchConfig
  task1Done: boolean
  profilesOpened: number
  reloads: number
  qIndex: Record<string, number>
}

export function loadSaved(): Saved | null {
  try { const v = sessionStorage.getItem(KEY); return v ? (JSON.parse(v) as Saved) : null } catch { return null }
}
export function save(patch: Partial<Saved>) {
  try {
    const cur = loadSaved()
    if (!cur && !patch.pid) return
    sessionStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch }))
  } catch { /* private mode: no resume, the test still works */ }
}
