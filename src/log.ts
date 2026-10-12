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

const startedAt = performance.now()
const buffer: LogEvent[] = []
const sinks = new Set<Sink>()
let currentScreen = 'unknown'

export function setCurrentScreen(name: string) {
  currentScreen = name
}

export function track(type: string, target?: string, data?: Record<string, unknown>) {
  const e: LogEvent = {
    t_ms: Math.round(performance.now() - startedAt),
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
  return Math.round(performance.now() - startedAt)
}
