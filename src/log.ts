/**
 * Behaviour log. Every screen view, tap and decision goes through `track`.
 * For now events are kept in memory (and printed in dev); the test wrapper
 * plugs in a sink that sends them to Supabase.
 */
export type LogEvent = {
  t_ms: number
  client_ts: string
  type: string
  screen?: string
  target?: string
  data?: Record<string, unknown>
}

type Sink = (e: LogEvent) => void

// Time zero for t_ms. A test session keeps the same zero across a page reload (saved per tab),
// so events from before and after a refresh stay in order.
const epoch = (() => {
  try { const v = sessionStorage.getItem('pally-t0'); if (v) return Number(v) } catch { /* no storage */ }
  return Date.now()
})()
export function persistLogEpoch() { try { sessionStorage.setItem('pally-t0', String(epoch)) } catch { /* no storage */ } }
const buffer: LogEvent[] = []
const sinks = new Set<Sink>()
let currentScreen = 'unknown'
// Where the last finger/mouse press landed, in device pixels (set by the prototype frame).
// Taps get it attached so the results view can show a dot where each tap happened.
let lastPointer: { x: number; y: number; w: number; h: number; at: number } | null = null
export function setLastPointer(x: number, y: number, w: number, h: number) {
  lastPointer = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), at: performance.now() }
}

export function setCurrentScreen(name: string) {
  currentScreen = name
}

export function track(type: string, target?: string, data?: Record<string, unknown>) {
  if ((type === 'tap' || type === 'tap_disabled') && lastPointer && performance.now() - lastPointer.at < 1500) {
    data = { ...data, x: lastPointer.x, y: lastPointer.y, w: lastPointer.w, h: lastPointer.h }
  }
  const e: LogEvent = {
    t_ms: Date.now() - epoch,
    client_ts: new Date().toISOString(),
    type,
    screen: currentScreen,
    target,
    data,
  }
  buffer.push(e)
  sinks.forEach((s) => {
    try {
      s(e)
    } catch {
      /* a failing sink must never break the prototype */
    }
  })
  if (import.meta.env.DEV) console.debug('[track]', e)
}

export function addSink(sink: Sink) {
  sinks.add(sink)
  return () => sinks.delete(sink)
}

export function getBufferedEvents() {
  return buffer.slice()
}

export function msSinceStart() {
  return Date.now() - epoch
}
