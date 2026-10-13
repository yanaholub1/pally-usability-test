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
async function upload(path: string, blob: Blob, mime: string, tries = 0): Promise<boolean> {
  const { error } = await supabase.storage.from('recordings').upload(path, blob, { contentType: mime.split(';')[0] || 'audio/webm', upsert: false })
  if (!error) return true
  if (tries >= 6) { track('upload_failed', path, { message: error.message }); return false }
  await new Promise((r) => setTimeout(r, Math.min(15000, 600 * 2 ** tries)))
  return upload(path, blob, mime, tries + 1)
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

  /** Stops and returns a local copy (for playback) once the last piece is in */
  async stop(): Promise<{ blob: Blob; durationMs: number } | null> {
    if (!this.rec) return null
    const durationMs = msSinceStart() - this.startMs
    if (this.rec.state !== 'inactive') this.rec.stop()
    await this.stopped
    track('recording_stop', this.name, { duration_ms: durationMs, pieces: this.index })
    return { blob: new Blob(this.chunks, { type: this.mime }), durationMs }
  }

  /** Waits for uploads (used before leaving the last screen) */
  settle() { return Promise.allSettled(this.uploads) }
}
