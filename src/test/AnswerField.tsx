/**
 * Written-question answer field (Figma "Survey answer — alternative B: switch inside the field").
 * One answer per question: typed OR recorded. The field itself turns into the recorder.
 *
 * States: typing (B1/B2) → recording (B3) → recorded (B4) → saving on Next (B6) / save failed (B9).
 * Delete → empty field + "Recording deleted · Undo" toast (B5). Mic denied → back to typing with a
 * notice (B8); denied again → expanded notice with steps (B10). Recordings stay on the device until Next,
 * so deleted or replaced takes are never uploaded.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Button, TButton } from '../components/ui'
import { track } from '../log'
import { Take, hasMic, micLevel, micSupported, requestMic, wakeMeter } from './recorder'

export type Answer = { mode: 'text'; text: string } | { mode: 'voice'; segment: string; duration_ms: number } | { mode: 'skipped' }

const MAX_MS = 120_000
const LIVE_BARS = 44
const DONE_BARS = 34
const takeCounts: Record<string, number> = {}
/** Finished recordings by question, so going Back to a question shows its recording again */
const recordedCache: Record<string, Recorded> = {}

type Recorded = { take: Take; durationMs: number; url: string; bars: number[] }
type Notice = null | 'denied' | 'blocked' | 'too-short' | 'empty' | 'save-failed'

const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
/** Gentle stand-in when the browser gives us no mic level (e.g. iOS before the audio context wakes) */
const idleLevel = (t: number) => 0.18 + 0.32 * Math.abs(Math.sin(t / 170) * Math.cos(t / 410))

function downsample(levels: number[], n: number) {
  if (!levels.length) return Array.from({ length: n }, (_, i) => idleLevel(i * 300))
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * levels.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / n))
    return Math.max(...levels.slice(a, b))
  })
}

export function AnswerField({ qid, initial, onChange, onRecording, registerSave, saving }: {
  qid: string
  /** The answer given earlier, when the participant comes Back to this question */
  initial?: Answer | null
  onChange: (a: Answer | null) => void
  onRecording: (recording: boolean) => void
  /** Hands the parent a function that uploads this answer's audio when Next is tapped (null = nothing to upload) */
  registerSave: (fn: (() => Promise<boolean>) | null) => void
  saving: boolean
}) {
  const canRecord = micSupported()
  const restored = initial?.mode === 'voice' && recordedCache[qid]?.take.name === initial.segment ? recordedCache[qid] : null
  const [mode, setMode] = useState<'text' | 'recording' | 'recorded'>(restored ? 'recorded' : 'text')
  const [text, setText] = useState(initial?.mode === 'text' ? initial.text : '')
  const [focused, setFocused] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirm, setConfirm] = useState<null | 'record' | 'retry'>(null)
  const [cur, setCur] = useState<Recorded | null>(restored)
  const [deleted, setDeleted] = useState<Recorded | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [live, setLive] = useState<number[]>([])
  const [announce, setAnnounce] = useState('')
  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const takeRef = useRef<Take | null>(null)
  const prevRef = useRef<Recorded | null>(null) // kept while re-recording
  const levelsRef = useRef<number[]>([])
  const t0 = useRef(0)
  const stoppingRef = useRef(false)

  const micBlocked = notice === 'denied' || notice === 'blocked'
  const showRecord = canRecord && !micBlocked

  // Live timer + waveform while recording; auto-stop at 2:00
  useEffect(() => {
    if (mode !== 'recording') return
    const id = setInterval(() => {
      const ms = Date.now() - t0.current
      const v = micLevel() ?? idleLevel(ms)
      levelsRef.current.push(v)
      setElapsed(ms)
      setLive((l) => [...l.slice(-(LIVE_BARS - 1)), v])
      if (ms >= MAX_MS) void stop('max')
    }, 100)
    return () => clearInterval(id)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (cur) recordedCache[qid] = cur }, [cur, qid])

  // Tell the parent what (if anything) to upload on Next
  useEffect(() => {
    if (mode === 'recorded' && cur) {
      registerSave(async () => {
        const ok = await cur.take.save()
        setNotice(ok ? null : 'save-failed')
        setAnnounce(ok ? '' : 'We couldn’t save your recording.')
        return ok
      })
    } else registerSave(null)
  }, [mode, cur]) // eslint-disable-line react-hooks/exhaustive-deps

  // The Undo toast lasts 4.7 s; after that the deleted recording is dropped for good
  useEffect(() => {
    if (!deleted) return
    const id = setTimeout(() => { URL.revokeObjectURL(deleted.url); setDeleted(null) }, 4700)
    return () => clearTimeout(id)
  }, [deleted])

  useEffect(() => () => { void takeRef.current?.stop(0) }, [])

  const begin = async (from: 'record' | 'retry' | 'rerecord') => {
    if (!hasMic()) {
      track('mic_requested_for_answer', qid, { from })
      const ok = await requestMic()
      if (!ok) {
        // First refusal: back to typing with a way to change their mind. Asking again and still refused
        // (browsers remember a denial without showing the prompt): spell out how to allow it.
        setNotice(from === 'record' ? 'denied' : 'blocked')
        setAnnounce(from === 'record' ? 'Microphone access is off. You can type your answer instead.' : 'Your browser is still blocking the microphone.')
        setTimeout(() => textRef.current?.focus(), 50)
        return
      }
    }
    wakeMeter()
    takeCounts[qid] = (takeCounts[qid] ?? 0) + 1
    const take = new Take(`ans-${qid.replace(/^(about|between|final)_/, '')}-${takeCounts[qid]}`)
    if (!take.start()) return
    takeRef.current = take
    if (from === 'rerecord') prevRef.current = cur
    else prevRef.current = null
    if (deleted) { URL.revokeObjectURL(deleted.url); setDeleted(null) }
    levelsRef.current = []
    t0.current = Date.now()
    stoppingRef.current = false
    setElapsed(0); setLive([]); setNotice(null); setText('')
    setMode('recording'); onRecording(true); onChange(null)
    setAnnounce('Recording started')
  }

  const record = () => {
    if (text.trim()) { setConfirm('record'); return }
    void begin('record')
  }
  const retryMic = () => {
    if (text.trim()) { setConfirm('retry'); return }
    void begin('retry')
  }

  const stop = async (why: 'tap' | 'max') => {
    const take = takeRef.current
    if (!take || stoppingRef.current) return
    stoppingRef.current = true
    const res = await take.stop()
    onRecording(false)
    if (why === 'max') track('recording_max_length', qid)
    const prev = prevRef.current
    prevRef.current = null
    // Very short or empty recordings (a known iPhone quirk) aren't accepted
    if (!res || res.blob.size < 2000 || res.durationMs < 2000 /* incl. the 0.8 s tail */) {
      track('voice_answer_too_short', qid, { bytes: res?.blob.size ?? 0, duration_ms: res?.durationMs ?? 0 })
      // Too short to be an answer vs. long enough but nothing captured (a known iPhone quirk)
      const short = !res || res.durationMs < 2000
      setNotice(short ? 'too-short' : 'empty')
      setAnnounce(short ? 'We didn’t get that, the recording was too short.' : 'That recording didn’t come through.')
      if (prev) { setCur(prev); setMode('recorded'); onChange({ mode: 'voice', segment: prev.take.name, duration_ms: prev.durationMs }) }
      else { setCur(null); setMode('text') }
      return
    }
    if (prev) URL.revokeObjectURL(prev.url)
    const rec: Recorded = { take, durationMs: res.durationMs, url: URL.createObjectURL(res.blob), bars: downsample(levelsRef.current, DONE_BARS) }
    setCur(rec); setPlayed(0); setPlaying(false)
    setMode('recorded')
    onChange({ mode: 'voice', segment: take.name, duration_ms: res.durationMs })
    setAnnounce(`Recording stopped, ${Math.round(res.durationMs / 1000)} seconds`)
  }

  const remove = () => {
    if (!cur) return
    audioRef.current?.pause()
    track('voice_answer_deleted', qid)
    setDeleted(cur); setCur(null); setNotice(null)
    setMode('text'); onChange(null)
    setAnnounce('Recording deleted')
  }
  const undo = () => {
    if (!deleted) return
    track('voice_answer_undo', qid)
    setCur(deleted); setDeleted(null); setText('')
    setMode('recorded'); onChange({ mode: 'voice', segment: deleted.take.name, duration_ms: deleted.durationMs })
  }

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { void a.play(); track('voice_answer_play', qid) } else a.pause()
  }

  const device = rootRef.current?.closest('.device') ?? null
  const footer = device?.querySelector('.test-page__footer') ?? null

  return (
    <div ref={rootRef} className="stack gap12">
      {notice === 'denied' && (
        <div className="notice notice--warning">
          <Icon name="alert" size={20} />
          <div className="notice__body">
            <p>Microphone access is off. You can type your answer instead.</p>
            <TButton className="notice__link" trackId={`answer:${qid}:mic-turn-on`} onClick={retryMic}>Turn on microphone</TButton>
          </div>
        </div>
      )}
      {notice === 'blocked' && (
        <div className="notice notice--warning">
          <Icon name="alert" size={20} />
          <div className="notice__body">
            <p style={{ fontWeight: 600 }}>Your browser is still blocking the microphone.</p>
            <p>1. Tap <b>aA</b> (Safari) or the icon next to the address (Chrome).<br />2. Set Microphone to Allow.<br />3. Come back and tap Try again.<br />Or just type your answer below.</p>
            <TButton className="notice__link" trackId={`answer:${qid}:mic-try-again`} onClick={retryMic}>Try again</TButton>
          </div>
        </div>
      )}
      {notice === 'too-short' && (
        <div className="notice notice--error">
          <Icon name="alert" size={20} />
          <p>We didn’t get that, the recording was too short. Please record for at least a few seconds, or type instead.</p>
        </div>
      )}
      {notice === 'empty' && (
        <div className="notice notice--error">
          <Icon name="alert" size={20} />
          <p>That recording didn’t come through. Please try again, or type instead.</p>
        </div>
      )}
      {notice === 'save-failed' && (
        <div className="notice notice--error">
          <Icon name="alert" size={20} />
          <p>We couldn’t save your recording. It’s still here — check your connection and try again.</p>
        </div>
      )}

      {mode === 'text' && (
        <div className={`answer-field ${focused ? 'is-focused' : ''} ${showRecord ? '' : 'answer-field--plain'}`} onClick={() => textRef.current?.focus()}>
          <textarea ref={textRef} className="answer-field__input" aria-label="Your answer"
            placeholder={showRecord ? 'Type or tap Record to answer' : 'Type your answer…'} value={text}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onChange={(e) => {
              setText(e.target.value)
              if (deleted) { URL.revokeObjectURL(deleted.url); setDeleted(null) }
              if (notice === 'too-short' || notice === 'empty') setNotice(null)
              onChange(e.target.value.trim() ? { mode: 'text', text: e.target.value.trim() } : null)
            }} />
          {showRecord && (
            <div className="answer-field__bar">
              <Button className="btn--m" variant="ghost" icon="record-mic" trackId={`answer:${qid}:record`} ariaLabel="Start recording" onClick={record}>Record</Button>
            </div>
          )}
        </div>
      )}

      {mode === 'recording' && (
        <div className="answer-field answer-field--rec">
          <div className="row" style={{ justifyContent: 'space-between', height: 20 }}>
            <span className="rec-status"><span className="rec-status__dot" aria-hidden />Recording</span>
            <span className="rec-timer">{mmss(elapsed)} / 2:00</span>
          </div>
          <div className="wave wave--live" aria-hidden>
            {live.map((v, i) => <i key={i} style={{ height: Math.round(4 + v * 36) }} />)}
          </div>
          <div className="rec-limit" aria-hidden><i style={{ width: `${Math.min(100, (elapsed / MAX_MS) * 100)}%` }} /></div>
          <div className="answer-field__bar">
            <Button className="btn--m" variant="danger" icon="stop" trackId={`answer:${qid}:stop`} ariaLabel="Stop recording" onClick={() => void stop('tap')}>Stop</Button>
          </div>
        </div>
      )}

      {mode === 'recorded' && cur && (
        <div className={`answer-field answer-field--rec ${saving ? 'is-saving' : ''}`} aria-busy={saving || undefined}>
          <div className="player">
            <TButton className="player__play" trackId={`answer:${qid}:${playing ? 'pause' : 'play'}`}
              aria-label={`${playing ? 'Pause' : 'Play'} recording, ${Math.round(cur.durationMs / 1000)} seconds`} onClick={togglePlay}>
              <Icon name={playing ? 'pause' : 'play'} size={24} />
            </TButton>
            <div className="wave wave--done" aria-hidden>
              {cur.bars.map((v, i) => <i key={i} className={i < played * DONE_BARS ? 'on' : ''} style={{ height: Math.round(4 + v * 24) }} />)}
            </div>
            <span className="player__time">{mmss(cur.durationMs)}</span>
            <audio ref={audioRef} src={cur.url} preload="auto"
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setPlayed(0) }}
              onTimeUpdate={(e) => setPlayed(Math.min(1, e.currentTarget.currentTime / (cur.durationMs / 1000)))} />
          </div>
          <div className="answer-field__bar">
            <Button className="btn--m" variant="ghost" trackId={`answer:${qid}:rerecord`} onClick={() => { audioRef.current?.pause(); void begin('rerecord') }}>Re-record</Button>
            <Button className="btn--m btn--ghost-danger" variant="ghost" trackId={`answer:${qid}:delete`} onClick={remove}>Delete</Button>
          </div>
        </div>
      )}

      {mode === 'text' && showRecord && !hasMic() && (
        <p className="body14" style={{ color: 'var(--gray-700)' }}>We’ll ask for microphone access when you tap Record.</p>
      )}
      {!canRecord && <p className="body14" style={{ color: 'var(--gray-700)' }}>Your browser can’t record audio, so please type your answer.</p>}

      <span className="sr-only" aria-live="polite">{announce}</span>

      {deleted && footer && createPortal(
        <div className="toast-inverse" role="status">
          <span className="grow">Recording deleted</span>
          <TButton className="toast-inverse__action" trackId={`answer:${qid}:undo`} onClick={undo}>Undo</TButton>
        </div>, footer)}

      {confirm && device && createPortal(
        <div className="dialog-overlay" onClick={() => setConfirm(null)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={`dlg-${qid}`} onClick={(e) => e.stopPropagation()}>
            <p id={`dlg-${qid}`} className="dialog__title">Discard your typed answer?</p>
            <p className="dialog__text">Your text will be deleted so you can record instead.</p>
            <div className="dialog__actions">
              <Button size="lg" variant="danger" trackId={`answer:${qid}:discard-and-record`} onClick={() => { const from = confirm; setConfirm(null); void begin(from) /* the text is cleared only once recording really starts */ }}>Discard and record</Button>
              <Button size="lg" variant="secondary" trackId={`answer:${qid}:keep-typing`} onClick={() => { setConfirm(null); setTimeout(() => textRef.current?.focus(), 50) }}>Keep typing</Button>
            </div>
          </div>
        </div>, device)}
    </div>
  )
}
