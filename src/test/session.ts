/**
 * One test session = one participant row. Everything else (events, answers, recordings) hangs off its id.
 * Writes are queued and retried so a flaky connection never loses data or blocks the participant.
 */
import { addSink, persistLogEpoch, type LogEvent } from '../log'
import { loadSaved, save } from './resume'
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'

// After a page reload in the same tab, keep the same participant (see resume.ts)
export const participantId: string = loadSaved()?.pid ?? crypto.randomUUID()
let started = false

type Job = { table: string; rows: Record<string, unknown>[]; tries: number }
const queue: Job[] = []
let flushing = false

async function flush() {
  if (flushing || !started) return
  flushing = true
  try {
    while (queue.length) {
      const job = queue[0]
      const { error } = await supabase.from(job.table).insert(job.rows)
      if (error) {
        job.tries++
        if (job.tries > 8) { queue.shift(); console.warn('dropped', job.table, error); continue }
        await new Promise((r) => setTimeout(r, Math.min(15000, 500 * 2 ** job.tries)))
        continue
      }
      queue.shift()
    }
  } finally {
    flushing = false
  }
}

function enqueue(table: string, rows: Record<string, unknown>[]) {
  queue.push({ table, rows, tries: 0 })
  void flush()
}

// Events are batched: one insert every 2 s (or 25 events)
let pendingEvents: Record<string, unknown>[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const clip = (v: string | undefined, n: number) => (v == null ? null : v.slice(0, n))
function onEvent(e: LogEvent) {
  pendingEvents.push({
    participant_id: participantId, t_ms: e.t_ms, client_ts: e.client_ts,
    type: e.type.slice(0, 48), screen: clip(e.screen, 64), target: clip(e.target, 128), data: e.data ?? null,
  })
  if (pendingEvents.length >= 25) sendEvents()
  else if (!timer) timer = setTimeout(sendEvents, 2000)
}
function sendEvents() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!pendingEvents.length) return
  enqueue('events', pendingEvents)
  pendingEvents = []
}

/** Last-chance save when the tab closes: fetch with keepalive survives page unload */
function flushOnExit() {
  if (!started) return
  const rows = [...pendingEvents, ...queue.filter((j) => j.table === 'events').flatMap((j) => j.rows)]
  pendingEvents = []
  if (!rows.length) return
  void fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST', keepalive: true,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  }).catch(() => {})
}

/** Called once the participant has agreed to take part (the table only accepts consent = true) */
export async function startSession(mode: 'unmoderated' | 'moderated' | 'pilot') {
  if (started) return
  const { error } = await supabase.from('participants').insert({
    id: participantId, mode, consent: true,
    user_agent: navigator.userAgent.slice(0, 400), viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
  })
  if (error) throw error
  persistLogEpoch()
  save({ pid: participantId, mode })
  attach()
}

/** After a reload: the participant row already exists, just start sending again */
export function resumeSession() {
  if (started) return
  attach()
}

function attach() {
  started = true
  addSink(onEvent)
  addEventListener('pagehide', flushOnExit)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { sendEvents(); flushOnExit() } })
  void flush()
}

export function saveAnswer(questionId: string, value: unknown) {
  enqueue('answers', [{ participant_id: participantId, question_id: questionId.slice(0, 64), value }])
}

export function saveRecordingRow(row: { segment: string; chunk_index: number; start_ms: number; duration_ms: number; mime_type: string; storage_path: string }) {
  enqueue('recordings', [{ participant_id: participantId, ...row }])
}

export function isStarted() { return started }
