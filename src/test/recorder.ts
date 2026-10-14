/**
 * Microphone recording. One mic stream for the session; each part of the test is its own "segment"
 * (task1, task2, one per voice answer). A segment is a single audio file uploaded in 5-second pieces:
 * piece 0 carries the file header, so the pieces joined in order play as one file. Uploading as we go
 * means a closed tab loses at most the last few seconds.
 */
import { msSinceStart, track } from '../log'
import { participantId, saveRecordingRow } from './session'
import { supabase } from './supabase'

let stream: MediaStream | null = null

export function micSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

/** Ask for the microphone once. Returns false if the participant says no or the browser can't record. */
export async function requestMic(): Promise<boolean> {
  if (stream) return true
  if (!micSupported()) return false
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    track('mic_granted')
    return true
  } catch (e) {
    track('mic_denied', String((e as Error)?.name ?? e))
    return false
  }
}
export const hasMic = () => !!stream

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
}
const extFor = (mime: string) => (mime.includes('mp4') || mime.includes('aac') ? 'm4a' : 'webm')

/** Uploads with retry; storage only allows adding files, so each piece has its own path */
async function upload(path: string, blob: Blob, mime: string, tries = 0, maxTries = 6): Promise<boolean> {
  const { error } = await supabase.storage.from('recordings').upload(path, blob, { contentType: mime.split(';')[0] || 'audio/webm', upsert: false })
  // "Already exists" means an earlier attempt got through (only the response was lost)
  if (!error || /exist|duplicate/i.test(error.message)) return true
  if (tries >= maxTries) { track('upload_failed', path, { message: error.message }); return false }
  await new Promise((r) => setTimeout(r, Math.min(15000, 600 * 2 ** tries)))
  return upload(path, blob, mime, tries + 1, maxTries)
}

/* ───── Mic level (for the live waveform) ───── */
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
/** Call from a tap so iOS lets the audio context run */
export function wakeMeter() {
  if (!stream) return
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new Ctx()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      audioCtx.createMediaStreamSource(stream).connect(analyser)
    }
    void audioCtx.resume()
  } catch { /* no meter: the waveform falls back to a gentle idle animation */ }
}
const levelBuf = new Uint8Array(512)
/** 0..1 loudness right now, or null if there's no meter */
export function micLevel(): number | null {
  if (!analyser || audioCtx?.state !== 'running') return null
  analyser.getByteTimeDomainData(levelBuf)
  let sum = 0
  for (let i = 0; i < levelBuf.length; i++) { const v = (levelBuf[i] - 128) / 128; sum += v * v }
  return Math.min(1, Math.sqrt(sum / levelBuf.length) * 4)
}

/**
 * One recorded answer. Unlike task segments it stays on the device until the participant taps Next,
 * so a deleted or replaced recording is never uploaded. Saved as a single file: <pid>/<name>/0000.<ext>
 */
export class Take {
  readonly name: string
  private rec: MediaRecorder | null = null
  private chunks: Blob[] = []
  private mime = ''
  private startMs = 0
  private stopping: Promise<{ blob: Blob; durationMs: number } | null> | null = null
  private result: { blob: Blob; durationMs: number } | null = null
  private saved = false
  constructor(name: string) { this.name = name.slice(0, 32) }

  start() {
    if (!stream) return false
    this.mime = pickMime()
    try { this.rec = new MediaRecorder(stream, this.mime ? { mimeType: this.mime } : undefined) } catch { this.rec = new MediaRecorder(stream) }
    this.mime = this.rec.mimeType || this.mime || 'audio/webm'
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data) }
    this.startMs = msSinceStart()
    this.rec.start(1000)
    track('recording_start', this.name, { mime: this.mime })
    return true
  }

  stop() {
    if (this.stopping) return this.stopping
    const rec = this.rec
    if (!rec) return Promise.resolve(null)
    const durationMs = msSinceStart() - this.startMs
    this.stopping = (async () => {
      const stopped = new Promise<void>((res) => { rec.onstop = () => res(); if (rec.state === 'inactive') res() })
      // Safari can deliver the last piece just after 'stop': wait for it (or give up after 1.5 s)
      const lastPiece = new Promise<void>((res) => {
        const prev = rec.ondataavailable
        rec.ondataavailable = (e) => { prev?.call(rec, e); res() }
        setTimeout(res, 1500)
      })
      if (rec.state !== 'inactive') {
        try { rec.requestData() } catch { /* not supported everywhere */ }
        rec.stop()
      }
      await Promise.all([stopped, lastPiece])
      const blob = new Blob(this.chunks, { type: this.mime })
      track('recording_stop', this.name, { duration_ms: durationMs, bytes: blob.size })
      this.result = { blob, durationMs }
      return this.result
    })()
    return this.stopping
  }

  /** Uploads the file (tries a few times). Safe to call again after a failure. */
  async save(): Promise<boolean> {
    if (this.saved) return true
    if (!this.result) return false
    const path = `${participantId}/${this.name}/0000.${extFor(this.mime)}`
    const ok = await upload(path, this.result.blob, this.mime, 0, 3)
    if (ok) {
      this.saved = true
      saveRecordingRow({ segment: this.name, chunk_index: 0, start_ms: this.startMs, duration_ms: this.result.durationMs, mime_type: this.mime, storage_path: path })
    }
    track(ok ? 'answer_audio_saved' : 'answer_audio_save_failed', this.name)
    return ok
  }
}

export class Segment {
  readonly name: string
  private rec: MediaRecorder | null = null
  private index = 0
  private startMs = 0
  private mime = ''
  private uploads: Promise<boolean>[] = []
  private chunks: Blob[] = []
  private stopped: Promise<void> | null = null
  paused = false

  constructor(name: string) { this.name = name }

  start() {
    if (!stream) return false
    this.mime = pickMime()
    try {
      this.rec = new MediaRecorder(stream, this.mime ? { mimeType: this.mime } : undefined)
    } catch {
      this.rec = new MediaRecorder(stream)
    }
    this.mime = this.rec.mimeType || this.mime || 'audio/webm'
    this.startMs = msSinceStart()
    const folder = `${participantId}/${this.name}`
    this.rec.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return
      const i = this.index++
      this.chunks.push(e.data)
      const path = `${folder}/${String(i).padStart(4, '0')}.${extFor(this.mime)}`
      const durationMs = msSinceStart() - this.startMs
      this.uploads.push(upload(path, e.data, this.mime).then((ok) => {
        if (ok) saveRecordingRow({ segment: this.name.slice(0, 32), chunk_index: i, start_ms: this.startMs, duration_ms: durationMs, mime_type: this.mime, storage_path: path })
        return ok
      }))
    }
    this.stopped = new Promise((res) => { this.rec!.onstop = () => res() })
    this.rec.start(5000)
    track('recording_start', this.name, { mime: this.mime })
    return true
  }

  pause() {
    if (this.rec?.state === 'recording') { this.rec.pause(); this.paused = true; track('recording_paused', this.name) }
  }
  resume() {
    if (this.rec?.state === 'paused') { this.rec.resume(); this.paused = false; track('recording_resumed', this.name) }
  }

  /** Stops and returns a local copy (for playback) once the last piece is in. Safe to call twice. */
  private stopping: Promise<{ blob: Blob; durationMs: number } | null> | null = null
  stop(): Promise<{ blob: Blob; durationMs: number } | null> {
    if (this.stopping) return this.stopping
    const rec = this.rec
    if (!rec) return Promise.resolve(null)
    const durationMs = msSinceStart() - this.startMs
    this.stopping = (async () => {
      // Safari can deliver the last piece just after 'stop': wait for it (or give up after 1.5 s)
      const lastPiece = new Promise<void>((res) => {
        const prev = rec.ondataavailable
        rec.ondataavailable = (e) => { prev?.call(rec, e); res() }
        setTimeout(res, 1500)
      })
      if (rec.state !== 'inactive') {
        try { rec.requestData() } catch { /* not supported everywhere */ }
        rec.stop()
      }
      await Promise.all([this.stopped, lastPiece])
      const blob = new Blob(this.chunks, { type: this.mime })
      track('recording_stop', this.name, { duration_ms: durationMs, pieces: this.index, bytes: blob.size })
      return { blob, durationMs }
    })()
    return this.stopping
  }

  /** Waits for uploads (used before leaving the last screen) */
  settle() { return Promise.allSettled(this.uploads) }
}
