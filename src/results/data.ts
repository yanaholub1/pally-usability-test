/**
 * Data access for the private results page. Uses its own Supabase client with a persisted login;
 * row-level security only lets emails in the `researchers` table read anything.
 */
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../test/supabase'
import { ABOUT_YOU, BETWEEN, FINAL, type Question } from '../test/content'
import { requestersFor } from '../data'
import type { GenderPref } from '../data'

export const rs = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'pally-results-auth' },
})

export type Participant = { id: string; created_at: string; mode: string; user_agent: string | null; viewport: string | null }
export type Answer = { participant_id: string; question_id: string; value: Record<string, unknown> | null; created_at: string }
export type Ev = { participant_id: string; t_ms: number; client_ts: string; type: string; screen: string | null; target: string | null; data: Record<string, unknown> | null }
export type Rec = { participant_id: string; segment: string; chunk_index: number; start_ms: number; duration_ms: number; mime_type: string; storage_path: string; created_at: string }
export type Note = { participant_id: string; key: string; text: string; updated_at: string }

/** Supabase returns at most 1000 rows per request: page through */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

/** Going Back can save a question again: keep the latest answer per participant + question */
export function latest(answers: Answer[]) {
  const m = new Map<string, Answer>()
  for (const a of [...answers].sort((x, y) => x.created_at.localeCompare(y.created_at))) m.set(`${a.participant_id}|${a.question_id}`, a)
  return [...m.values()]
}

/* ───────── Overview ───────── */
const SUMMARY_TYPES = ['task_start', 'task_end', 'request_admitted', 'request_declined', 'request_undo', 'profile_open', 'consent_given', 'config_change', 'tap_dead']

export type Summary = {
  p: Participant
  label: string
  device: string
  thinkAloud: boolean | null
  completed: boolean
  tasks: Record<'task1' | 'task2', { how: string | null; ms: number | null }>
  admitted: string[]
  profilesOpened: number
  deadTaps: number
  answers: number
  version: string
  voiceAnswers: number
  audioFiles: number
  audioSince: string | null
  empty: boolean
}

export function deviceOf(ua: string | null) {
  if (!ua) return 'Unknown'
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other'
  const br = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Safari\//.test(ua) ? 'Safari' : ''
  return br ? `${os} · ${br}` : os
}

/** P01, P02… for real sessions and Pilot 1, Pilot 2… for pilots, in the order they started */
export function labelsFor(ps: Participant[]) {
  const out: Record<string, string> = {}
  const sorted = [...ps].sort((a, b) => a.created_at.localeCompare(b.created_at))
  let real = 0, pilot = 0
  for (const p of sorted) out[p.id] = p.mode === 'pilot' ? `Pilot ${++pilot}` : `P${String(++real).padStart(2, '0')}`
  return out
}
export const fileLabel = (label: string) => label.replace(/\s+/g, '-')

export function genderOf(evs: Ev[]): GenderPref {
  let g: GenderPref = 'any'
  for (const e of evs) if (e.type === 'config_change' && e.data && typeof e.data.gender === 'string') g = e.data.gender as GenderPref
  return g
}
export function playerName(id: string, gender: GenderPref) {
  const r = requestersFor(gender).find((x) => x.id === id)
  return r ? r.name : id
}
/** Final decision per request (admitted / declined), applying undos */
export function decisions(evs: Ev[]) {
  const d: Record<string, 'admitted' | 'declined'> = {}
  for (const e of evs) {
    if (!e.target) continue
    if (e.type === 'request_admitted') d[e.target] = 'admitted'
    else if (e.type === 'request_declined') d[e.target] = 'declined'
    else if (e.type === 'request_undo') delete d[e.target]
  }
  return d
}
/** A task restarted after a page reload is recorded as task1-r1, task1-r2…: use the last attempt */
export function taskSpan(evs: Ev[], seg: 'task1' | 'task2') {
  const isSeg = (t: string | null) => t === seg || !!t?.startsWith(`${seg}-r`)
  const starts = evs.filter((e) => e.type === 'task_start' && isSeg(e.target))
  const start = starts[starts.length - 1]
  const end = start ? evs.find((e) => e.type === 'task_end' && e.target === start.target && e.t_ms >= start.t_ms) : undefined
  return {
    start: start?.t_ms ?? null, end: end?.t_ms ?? null,
    how: (end?.data?.how as string | undefined) ?? (start ? 'left early' : null),
    segment: start?.target ?? seg, attempts: starts.length,
  }
}

export async function loadOverview(): Promise<Summary[]> {
  const [ps, answers, recs, evs] = await Promise.all([
    all<Participant>((a, b) => rs.from('participants').select('id, created_at, mode, user_agent, viewport').order('created_at').range(a, b)),
    all<Answer>((a, b) => rs.from('answers').select('participant_id, question_id, value, created_at').range(a, b)),
    all<Rec>((a, b) => rs.from('recordings').select('participant_id, segment, chunk_index, start_ms, duration_ms, mime_type, storage_path, created_at').range(a, b)),
    all<Ev>((a, b) => rs.from('events').select('participant_id, t_ms, client_ts, type, screen, target, data').in('type', SUMMARY_TYPES).order('t_ms').range(a, b)),
  ])
  const labels = labelsFor(ps)
  const latestAnswers = latest(answers)
  return ps.map((p) => {
    const a = latestAnswers.filter((x) => x.participant_id === p.id)
    const e = evs.filter((x) => x.participant_id === p.id)
    const r = recs.filter((x) => x.participant_id === p.id)
    const t1 = taskSpan(e, 'task1'), t2 = taskSpan(e, 'task2')
    const g = genderOf(e)
    // Decisions made during task 2 only
    const t2evs = t2.start != null ? e.filter((x) => x.t_ms >= t2.start! && (t2.end == null || x.t_ms <= t2.end)) : []
    const dec = decisions(t2evs)
    const opt = a.find((x) => x.question_id === 'think_aloud_opt_in')?.value?.selected
    return {
      p, label: labels[p.id], device: deviceOf(p.user_agent),
      thinkAloud: typeof opt === 'boolean' ? opt : null,
      completed: a.some((x) => x.question_id === 'completed'),
      tasks: {
        task1: { how: t1.how, ms: t1.start != null && t1.end != null ? t1.end - t1.start : null },
        task2: { how: t2.how, ms: t2.start != null && t2.end != null ? t2.end - t2.start : null },
      },
      admitted: Object.entries(dec).filter(([, v]) => v === 'admitted').map(([id]) => `${playerName(id, g)} (${id})`),
      profilesOpened: t2evs.filter((x) => x.type === 'profile_open' && x.target !== 'me').length,
      deadTaps: e.filter((x) => x.type === 'tap_dead').length,
      answers: a.filter((x) => !['think_aloud_opt_in', 'completed', 'prototype_version'].includes(x.question_id)).length,
      version: String(a.find((x) => x.question_id === 'prototype_version')?.value?.selected ?? 'v1'),
      voiceAnswers: a.filter((x) => x.value?.mode === 'voice').length,
      audioFiles: r.length,
      audioSince: r.length ? r.map((x) => x.created_at).sort()[0] : null,
      empty: !a.length && !e.length,
    }
  })
}

/* ───────── One participant ───────── */
export type Detail = { p: Participant; label: string; answers: Answer[]; events: Ev[]; recs: Rec[]; notes: Record<string, string> }

export async function loadDetail(id: string): Promise<Detail> {
  const [ps, answers, events, recs, notes] = await Promise.all([
    all<Participant>((a, b) => rs.from('participants').select('id, created_at, mode, user_agent, viewport').order('created_at').range(a, b)),
    all<Answer>((a, b) => rs.from('answers').select('participant_id, question_id, value, created_at').eq('participant_id', id).order('created_at').range(a, b)),
    all<Ev>((a, b) => rs.from('events').select('participant_id, t_ms, client_ts, type, screen, target, data').eq('participant_id', id).order('t_ms').order('id').range(a, b)),
    all<Rec>((a, b) => rs.from('recordings').select('participant_id, segment, chunk_index, start_ms, duration_ms, mime_type, storage_path, created_at').eq('participant_id', id).order('chunk_index').range(a, b)),
    all<Note>((a, b) => rs.from('notes').select('participant_id, key, text, updated_at').eq('participant_id', id).range(a, b)),
  ])
  const p = ps.find((x) => x.id === id)
  if (!p) throw new Error('This session doesn’t exist (it may have been deleted).')
  return { p, label: labelsFor(ps)[id], answers: latest(answers), events, recs, notes: Object.fromEntries(notes.map((n) => [n.key, n.text])) }
}

export async function saveNote(participant_id: string, key: string, text: string) {
  const { error } = await rs.from('notes').upsert({ participant_id, key, text, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

/* ───────── Audio ───────── */
const bucket = () => rs.storage.from('recordings')
const audioCache = new Map<string, Promise<Blob | null>>()

/** All files of one recording, in order. Listing storage (not the table) also finds pieces whose row didn't save. */
async function filesOf(pid: string, segment: string) {
  const { data, error } = await bucket().list(`${pid}/${segment}`, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw new Error(error.message)
  return (data ?? []).filter((f) => f.id).map((f) => `${pid}/${segment}/${f.name}`)
}

/** Joins a recording's pieces into one playable file (the first piece carries the header) */
export function loadAudio(pid: string, segment: string): Promise<Blob | null> {
  const key = `${pid}/${segment}`
  if (!audioCache.has(key)) {
    audioCache.set(key, (async () => {
      const paths = await filesOf(pid, segment)
      if (!paths.length) return null
      const parts = await Promise.all(paths.map(async (p) => {
        const { data, error } = await bucket().download(p)
        if (error) throw new Error(error.message)
        return data
      }))
      const type = paths[0].endsWith('.m4a') ? 'audio/mp4' : 'audio/webm'
      return new Blob(parts, { type })
    })().catch((e) => { audioCache.delete(key); throw e }))
  }
  return audioCache.get(key)!
}
export const extOf = (b: Blob) => (b.type.includes('mp4') ? 'm4a' : 'webm')

/** Deletes every audio file for a participant (storage + rows). Answers and transcripts stay. */
export async function deleteAudio(pid: string) {
  const { data: folders, error } = await bucket().list(pid, { limit: 1000 })
  if (error) throw new Error(error.message)
  for (const f of folders ?? []) {
    const paths = f.id ? [`${pid}/${f.name}`] : await filesOf(pid, f.name)
    for (let i = 0; i < paths.length; i += 100) {
      const { error: e } = await bucket().remove(paths.slice(i, i + 100))
      if (e) throw new Error(e.message)
    }
  }
  const { error: e2 } = await rs.from('recordings').delete().eq('participant_id', pid)
  if (e2) throw new Error(e2.message)
  for (const k of [...audioCache.keys()]) if (k.startsWith(pid)) audioCache.delete(k)
}
export async function deleteSession(pid: string) {
  await deleteAudio(pid)
  const { error } = await rs.from('participants').delete().eq('id', pid)
  if (error) throw new Error(error.message)
}

/* ───────── Questions (titles from the test copy) ───────── */
export type QItem = { id: string; group: string; title: string; prompt?: string }
export const QUESTIONS: QItem[] = (() => {
  const out: QItem[] = []
  const add = (qs: Question[], group: string) => qs.forEach((q) => {
    if (q.kind === 'parts') q.parts.forEach((part) => out.push({ id: part.id, group, title: q.title, prompt: part.prompt }))
    else out.push({ id: q.id, group, title: q.title })
  })
  add(ABOUT_YOU, 'About them')
  add(BETWEEN, 'After task 1')
  add(FINAL, 'After task 2')
  return out
})()
