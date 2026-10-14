import { useEffect, useRef, useState, type ReactNode } from 'react'
import Prototype from '../App'
import { Icon } from '../components/Icon'
import { Badge, Button, ProgressRing, Smiley, TButton } from '../components/ui'
import { setCurrentScreen, track } from '../log'
import { defaultConfig, type MatchConfig } from '../state'
import { ABOUT_YOU, BETWEEN, FINAL, TASK_1, TASK_2, type Question, type Visual } from './content'
import { Segment, hasMic, micSupported, requestMic } from './recorder'
import { saveAnswer, startSession } from './session'

/** Promised on the consent screen: audio is deleted this many days after the session (transcripts are kept) */
const AUDIO_KEPT_DAYS = 14

type Step = 'welcome' | 'consent' | 'about' | 'thinkaloud' | 'task1-intro' | 'task1' | 'between' | 'task2-intro' | 'task2' | 'final' | 'thanks'
const mode = ((): 'unmoderated' | 'moderated' | 'pilot' => {
  const m = new URLSearchParams(location.search).get('mode')
  return m === 'moderated' || m === 'pilot' ? m : 'unmoderated'
})()

/** Renders **bold** segments in task copy */
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))
}

/* ───────── Layout shells ───────── */
function Page({ children, footer, progress }: { children: ReactNode; footer: ReactNode; progress?: number }) {
  return (
    <div className="stage">
      <div className="device test-page">
        {progress !== undefined && <div className="test-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
        <div className="test-page__scroll">{children}</div>
        <div className="bottom-bar test-page__footer">{footer}</div>
      </div>
    </div>
  )
}

/* ───────── Answers ───────── */
type Answer = { mode: 'text'; text: string } | { mode: 'voice'; segment: string; duration_ms: number } | { mode: 'skipped' }

function VoiceAnswer({ qid, onChange }: { qid: string; onChange: (a: Answer | null) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle')
  const [secs, setSecs] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [tooShort, setTooShort] = useState(false)
  const seg = useRef<Segment | null>(null)
  const take = useRef(0)
  useEffect(() => {
    if (state !== 'recording') return
    const t0 = Date.now()
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250)
    return () => clearInterval(id)
  }, [state])
  useEffect(() => () => { void seg.current?.stop(); if (url) URL.revokeObjectURL(url) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    take.current++
    const s = new Segment(`ans-${qid.replace(/^(about|between|final)_/, '')}-${take.current}`.slice(0, 32))
    if (!s.start()) return
    seg.current = s
    setSecs(0); setState('recording'); onChange(null)
  }
  const stop = async () => {
    const s = seg.current
    if (!s) return
    const res = await s.stop()
    // Very short or empty recordings (a known iPhone quirk) aren't accepted: ask to try again
    if (!res || res.blob.size < 2000 || res.durationMs < 1200) {
      track('voice_answer_too_short', qid, { bytes: res?.blob.size ?? 0, duration_ms: res?.durationMs ?? 0 })
      setTooShort(true); setState('idle'); onChange(null)
      return
    }
    setTooShort(false)
    setState('done')
    if (url) URL.revokeObjectURL(url)
    setUrl(URL.createObjectURL(res.blob))
    onChange({ mode: 'voice', segment: s.name, duration_ms: res.durationMs })
  }
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  return (
    <div className="voice-answer">
      {state === 'idle' && (
        <div className="stack gap8" style={{ alignItems: 'center' }}>
          <TButton className="voice-btn" trackId={`answer:${qid}:record`} onClick={start}><Icon name="mic" size={28} /><span>Tap to record</span></TButton>
          {tooShort && <p className="body14" style={{ color: 'var(--danger, #bd2705)', textAlign: 'center' }}>That one didn’t come through. Please try again and speak for a few seconds, or type instead.</p>}
        </div>
      )}
      {state === 'recording' && (
        <TButton className="voice-btn voice-btn--rec" trackId={`answer:${qid}:stop`} onClick={stop}><span className="voice-btn__stop" /><span>Recording {mmss} · tap to stop</span></TButton>
      )}
      {state === 'done' && (
        <div className="stack gap12">
          {url && <audio src={url} controls className="voice-audio" />}
          <TButton className="link" trackId={`answer:${qid}:rerecord`} onClick={start}>Record again</TButton>
        </div>
      )}
    </div>
  )
}

function OpenAnswer({ q, onChange }: { q: { id: string }; onChange: (a: Answer | null) => void }) {
  const voiceOk = hasMic()
  const [how, setHow] = useState<'text' | 'voice'>('text')
  const [text, setText] = useState('')
  return (
    <div className="stack gap16">
      <div className="answer-toggle" role="tablist" aria-label="How do you want to answer?">
        {(['text', 'voice'] as const).map((m) => (
          <TButton key={m} role="tab" aria-selected={how === m} className={how === m ? 'on' : ''} disabled={m === 'voice' && !voiceOk}
            trackId={`answer:${q.id}:mode:${m}`} onClick={() => { setHow(m); onChange(m === 'text' && text.trim() ? { mode: 'text', text: text.trim() } : null) }}>
            <Icon name={m === 'text' ? 'edit' : 'mic'} size={18} /> {m === 'text' ? 'Type' : 'Record voice'}
          </TButton>
        ))}
      </div>
      {how === 'text' ? (
        <textarea className="answer-text" rows={5} placeholder="Type your answer…" value={text}
          onChange={(e) => { setText(e.target.value); onChange(e.target.value.trim() ? { mode: 'text', text: e.target.value.trim() } : null) }} />
      ) : (
        <VoiceAnswer qid={q.id} onChange={onChange} />
      )}
      {!voiceOk && <p className="body14 muted">Voice answers need microphone access. You can type instead.</p>}
    </div>
  )
}

function QuestionFlow({ questions, onDone, progressFrom, progressTo, intro }: { questions: Question[]; onDone: () => void; progressFrom: number; progressTo: number; intro?: ReactNode }) {
  const [i, setI] = useState(0)
  const q = questions[i]
  const [value, setValue] = useState<unknown>(null)
  const [other, setOther] = useState('')
  useEffect(() => { setValue(null); setOther(''); setCurrentScreen(`q:${q.id}`); track('question_view', q.id) }, [q.id])

  const next = (skipped = false) => {
    let v: unknown = value
    if (skipped) v = { mode: 'skipped' }
    else if (q.kind === 'multi') v = { selected: value ?? [], other: other.trim() || undefined }
    else if (q.kind === 'choice' || q.kind === 'scale') v = { selected: value }
    if (q.kind === 'parts') {
      const answers = (value ?? {}) as Record<string, unknown>
      q.parts.forEach((part) => saveAnswer(part.id, answers[part.id] ?? { mode: 'skipped' }))
    } else saveAnswer(q.id, v)
    track('question_answered', q.id, { skipped })
    if (i + 1 < questions.length) setI(i + 1)
    else onDone()
  }
  const ready = q.kind === 'multi'
    ? (Array.isArray(value) && value.length > 0) || !!other.trim()
    : q.kind === 'parts'
      ? q.parts.every((part) => !!(value as Record<string, unknown> | null)?.[part.id])
      : value !== null
  const progress = progressFrom + ((progressTo - progressFrom) * i) / questions.length

  return (
    <Page progress={progress} footer={
      <div className="stack gap12">
        <Button size="lg" disabled={!ready} trackId={`q:${q.id}:next`} onClick={() => next(false)}>{i + 1 < questions.length ? 'Next' : 'Continue'}</Button>
        {q.kind === 'open' && q.optional && <TButton className="link" style={{ alignSelf: 'center' }} trackId={`q:${q.id}:skip`} onClick={() => next(true)}>Skip</TButton>}
      </div>
    }>
      {i === 0 && intro}
      <p className="caption muted">Question {i + 1} of {questions.length}{q.kind === 'open' && q.optional ? ' · optional' : ''}</p>
      <h2 className="h3 test-title">{q.title}</h2>
      {'hint' in q && q.hint && <p className="body16 muted" style={{ marginTop: -8 }}>{q.hint}</p>}
      {q.kind === 'choice' && (
        <div className="stack gap8">
          {q.options.map((o) => (
            <TButton key={o} className={`test-option ${value === o ? 'on' : ''}`} role="radio" aria-checked={value === o} trackId={`q:${q.id}:${o}`} onClick={() => setValue(o)}>
              <span className="grow">{o}</span><span className={`radio ${value === o ? 'on' : ''}`} />
            </TButton>
          ))}
        </div>
      )}
      {q.kind === 'multi' && (
        <div className="stack gap8">
          {q.options.map((o) => {
            const sel = Array.isArray(value) && value.includes(o)
            return (
              <TButton key={o} className={`test-option ${sel ? 'on' : ''}`} role="checkbox" aria-checked={sel} trackId={`q:${q.id}:${o}`}
                onClick={() => setValue(sel ? (value as string[]).filter((x) => x !== o) : [...((value as string[]) ?? []), o])}>
                <span className="grow">{o}</span><span className={`check ${sel ? 'on' : ''}`}>{sel && <Icon name="checkmark" size={16} />}</span>
              </TButton>
            )
          })}
          {q.other && <input className="answer-input" placeholder="Something else? Type it here" value={other} onChange={(e) => setOther(e.target.value)} />}
        </div>
      )}
      {q.kind === 'scale' && (
        <div className="stack gap8">
          <div className="scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <TButton key={n} className={`scale__n ${value === n ? 'on' : ''}`} role="radio" aria-checked={value === n} trackId={`q:${q.id}:${n}`} onClick={() => setValue(n)}>{n}</TButton>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="body14 muted">{q.low}</span><span className="body14 muted">{q.high}</span></div>
        </div>
      )}
      {q.kind === 'open' && <OpenAnswer key={q.id} q={q} onChange={setValue} />}
      {q.kind === 'parts' && q.parts.map((part, n) => (
        <div key={part.id} className="stack gap12 test-part">
          <VisualFor v={part.visual} />
          <p className="h6">{part.prompt}</p>
          <OpenAnswer q={part} onChange={(a) => setValue((prev: unknown) => ({ ...((prev as Record<string, unknown>) ?? {}), [part.id]: a }))} />
          {n < q.parts.length - 1 && <div className="divider" />}
        </div>
      ))}
    </Page>
  )
}

/** What each answer field refers to: the labels as on join-request cards (no captions),
 *  or the Reputation cards exactly as on a player's profile (Figma: ScoreCard). */
function VisualFor({ v }: { v: Visual }) {
  if (v === 'badges-attendance') return (
    <div className="test-badges" aria-label="Labels from join requests"><Badge icon="badge">Highly reliable</Badge><Badge icon="badge">Sometimes cancels late</Badge></div>
  )
  if (v === 'badges-sportsmanship') return (
    <div className="test-badges" aria-label="Labels from join requests"><Badge icon="handshake">Great teammate</Badge><Badge icon="handshake">Mixed feedback</Badge></div>
  )
  if (v === 'score-attendance') return (
    <div className="stack gap8">
      <p className="h6">Attendance</p>
      <div className="score-card">
        <div className="grow stack gap16">
          <div className="stack gap4"><span className="score-card__value">92%</span><span className="score-card__caption">Matches attended on time</span></div>
          <div><Badge icon="badge" variant="media">Highly reliable</Badge></div>
        </div>
        <ProgressRing value={92} />
      </div>
    </div>
  )
  return (
    <div className="stack gap8">
      <p className="h6">Sportsmanship</p>
      <div className="score-card">
        <div className="grow stack gap16">
          <div className="stack gap4"><span className="score-card__value">90%</span><span className="score-card__caption">Players would play with them again</span></div>
          <div><Badge icon="handshake" variant="media">Great teammate</Badge></div>
        </div>
        <Smiley mood="happy" />
      </div>
    </div>
  )
}

/* ───────── Tasks ───────── */
function TaskView({ task, segment, start, initialConfig, finishOn, onConfig, onDone }: {
  task: typeof TASK_1; segment: string; start: 'home' | 'homeMatch'; initialConfig?: Partial<MatchConfig>
  finishOn: string[]; onConfig?: (c: MatchConfig) => void; onDone: (how: 'completed' | 'skipped') => void
}) {
  const rec = useRef<Segment | null>(null)
  const [recording, setRecording] = useState<'on' | 'paused' | 'off'>('off')
  const [open, setOpen] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [finished, setFinished] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    document.documentElement.classList.add('in-task')
    track('task_start', segment)
    if (hasMic()) {
      const s = new Segment(segment)
      if (s.start()) { rec.current = s; setRecording('on') }
    }
    return () => { document.documentElement.classList.remove('in-task'); void rec.current?.stop() }
  }, [segment])

  const end = (how: 'completed' | 'skipped') => {
    if (doneRef.current) return
    doneRef.current = true
    track('task_end', segment, { how })
    void rec.current?.stop()
    onDone(how)
  }
  const onMilestone = (name: string) => {
    if (name === 'task1_complete' && finishOn.includes(name)) end('completed')
    else if (finishOn.includes(name)) setFinished(true)
  }
  const togglePause = () => {
    const s = rec.current
    if (!s) return
    if (s.paused) { s.resume(); setRecording('on') } else { s.pause(); setRecording('paused') }
  }

  return (
    <div className="task-shell">
      <div className="task-bar">
        <div className="task-bar__row">
          {recording !== 'off' ? (
            <TButton className={`rec-pill ${recording === 'paused' ? 'rec-pill--paused' : ''}`} trackId={`taskbar:${recording === 'on' ? 'pause' : 'resume'}`} onClick={togglePause} aria-label={recording === 'on' ? 'Pause recording' : 'Resume recording'}>
              <Icon name="mic" size={16} />{recording === 'on' ? 'On' : 'Paused'}
            </TButton>
          ) : null}
          <TButton className="task-bar__task" trackId="taskbar:instructions" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="caption muted">{task.label}</span>
            <span className="label14 ellipsis">{task.short}</span>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} />
          </TButton>
          {finished
            ? <Button size="sm" trackId="taskbar:done" onClick={() => end('completed')}>Done</Button>
            : <TButton className="link task-bar__skip" trackId="taskbar:stuck" onClick={() => setConfirmSkip(true)}>I’m stuck</TButton>}
        </div>
        {open && <p className="body14 task-bar__text">{rich(task.text)}</p>}
        {finished && <p className="body14 task-bar__text">That’s everything. Tap <b>Done</b> when you’re ready to move on.</p>}
        {confirmSkip && (
          <div className="task-bar__confirm">
            <p className="body14">No problem, getting stuck is useful for us too. Move on to the next part?</p>
            <div className="row gap8">
              <Button variant="secondary" size="sm" trackId="taskbar:stuck:stay" onClick={() => setConfirmSkip(false)}>Keep trying</Button>
              <Button size="sm" trackId="taskbar:stuck:move-on" onClick={() => end('skipped')}>Move on</Button>
            </div>
          </div>
        )}
      </div>
      <div className="stage task-stage">
        <Prototype start={start} initialConfig={initialConfig} onMilestone={onMilestone} onConfig={onConfig} />
      </div>
    </div>
  )
}

/* ───────── The whole test ───────── */
export default function TestApp() {
  const [step, setStep] = useState<Step>('welcome')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const config = useRef<MatchConfig>({ ...defaultConfig })
  const task1Done = useRef(false)

  useEffect(() => { setCurrentScreen(`test:${step}`); track('test_step', step); window.scrollTo(0, 0) }, [step])

  const go = (s: Step) => setStep(s)

  if (step === 'welcome') return (
    <Page footer={<Button size="lg" trackId="test:start" onClick={() => go('consent')}>Start</Button>}>
      <img src={new URL('../assets/illustrations/logo-primary.svg', import.meta.url).href} width={56} height={56} alt="" style={{ borderRadius: 14 }} />
      <h1 className="h2 test-title">Help us test Pally</h1>
      <p className="body16">Pally is a padel app for finding people to play with. We’d love to see how it works for you.</p>
      <ul className="test-list">
        <li><Icon name="clock" size={20} /><span>Takes about <b>10–15 minutes</b></span></li>
        <li><Icon name="profile" size={20} /><span>Best on your <b>phone</b>, somewhere quiet</span></li>
        <li><Icon name="heart" size={20} /><span>We’re testing the app, <b>not you</b>. There are no wrong answers.</span></li>
      </ul>
    </Page>
  )

  const begin = async (thinkAloud: boolean) => {
    setBusy(true); setError(null)
    try {
      await startSession(mode)
      track('consent_given', mode, { think_aloud: thinkAloud })
      saveAnswer('think_aloud_opt_in', { selected: thinkAloud })
      const ok = thinkAloud && micSupported() ? await requestMic() : false
      setMic(ok ? 'granted' : 'denied')
      go('about')
    } catch {
      setError('We couldn’t connect. Check your internet and try again.')
    } finally { setBusy(false) }
  }

  if (step === 'consent') return (
    <Page footer={
      <div className="stack gap8">
        {error && <p className="body14" style={{ color: 'var(--danger, #bd2705)' }}>{error}</p>}
        <Button size="lg" disabled={busy} trackId="test:consent:think-aloud" onClick={() => begin(true)}>{busy ? 'One moment…' : 'Sounds good, I’ll think out loud'}</Button>
        <Button size="lg" variant="secondary" disabled={busy} trackId="test:consent:type-only" onClick={() => begin(false)}>I’d rather just type my answers</Button>
        <p className="caption muted" style={{ textAlign: 'center', textTransform: 'none', fontSize: 12 }}>By continuing, you agree to take part as described above.</p>
      </div>
    }>
      <h1 className="h2 test-title">How this works</h1>
      <ul className="test-list">
        <li><Icon name="checkmark" size={20} /><span>We’ll see <b>what you tap</b> in the app, so we learn what’s easy and what’s tricky.</span></li>
        <li><Icon name="edit" size={20} /><span>You’ll answer <b>a few short questions</b>.</span></li>
        <li><Icon name="mic" size={20} /><span><b>If you like, think out loud as you go.</b> We’ll capture what you say so we don’t miss anything. Only the written notes are kept: the audio is deleted within {AUDIO_KEPT_DAYS} days.</span></li>
      </ul>
      <p className="body16 muted">We don’t see your screen, camera or name. Everything is stored in the EU and used only for this design project.</p>
    </Page>
  )

  if (step === 'about') return (
    <QuestionFlow questions={ABOUT_YOU} progressFrom={0.05} progressTo={0.15} onDone={() => go('thinkaloud')}
      intro={<p className="h5" style={{ marginBottom: 4 }}>First, a little about you</p>} />
  )

  if (step === 'thinkaloud') return (
    <Page progress={0.15} footer={<Button size="lg" trackId="test:thinkaloud:continue" onClick={() => go('task1-intro')}>Got it</Button>}>
      <h1 className="h2 test-title">{mic === 'granted' ? 'Think out loud' : 'Tips before you start'}</h1>
      <p className="body16">{mic === 'granted' ? 'As you use the app, please say what’s on your mind:' : 'As you use the app, notice:'}</p>
      <ul className="test-list">
        <li><Icon name="search" size={20} /><span>what you’re <b>looking for</b></span></li>
        <li><Icon name="sparkle" size={20} /><span>what you <b>expect</b> to happen</span></li>
        <li><Icon name="info" size={20} /><span>anything that <b>surprises or confuses</b> you</span></li>
      </ul>
      {mic === 'granted'
        ? <p className="body16">A small <b>mic</b> button at the top shows it’s on. Tap it any time to pause.</p>
        : <p className="body16">The microphone is off, so you can simply type your answers. What you tap still helps us a lot.</p>}
      <p className="body16">It’s a prototype, so some buttons won’t do anything. That’s fine, just carry on.</p>
    </Page>
  )

  if (step === 'task1-intro') return (
    <Page progress={0.2} footer={<Button size="lg" trackId="test:task1:begin" onClick={() => go('task1')}>Start task 1</Button>}>
      <p className="caption muted">{TASK_1.label}</p>
      <h1 className="h2 test-title">{TASK_1.short}</h1>
      <p className="body18 test-task-text">{rich(TASK_1.text)}</p>
      <p className="body14 muted">You can reread this any time by tapping the task at the top of the screen.</p>
    </Page>
  )

  if (step === 'task1') return (
    <TaskView task={TASK_1} segment="task1" start="home" finishOn={['task1_complete']}
      onConfig={(c) => { config.current = c }}
      onDone={(how) => { task1Done.current = how === 'completed'; go('between') }} />
  )

  if (step === 'between') return <QuestionFlow questions={BETWEEN} progressFrom={0.45} progressTo={0.55} onDone={() => go('task2-intro')} intro={<p className="h5" style={{ marginBottom: 4 }}>Nice work. Two quick questions</p>} />

  if (step === 'task2-intro') return (
    <Page progress={0.55} footer={<Button size="lg" trackId="test:task2:begin" onClick={() => go('task2')}>Start task 2</Button>}>
      <p className="caption muted">{TASK_2.label}</p>
      <h1 className="h2 test-title">Choose your players</h1>
      <p className="body18 test-task-text">{rich(TASK_2.text)}</p>
      <p className="body14 muted">You’ll start on the home screen with your match booked.</p>
    </Page>
  )

  if (step === 'task2') {
    // Task 2 shows the participant's own match from Task 1 (or a ready-made one if they moved on early)
    const c = config.current
    const cfg: Partial<MatchConfig> = task1Done.current && c.time && c.courtId ? c : { ...c, time: c.time ?? '18:30', courtId: c.courtId ?? 'c1', gender: c.gender ?? 'any' }
    return <TaskView task={TASK_2} segment="task2" start="homeMatch" initialConfig={cfg} finishOn={['all_requests_decided', 'match_full']} onDone={() => go('final')} />
  }

  if (step === 'final') return <QuestionFlow questions={FINAL} progressFrom={0.8} progressTo={1} onDone={() => { saveAnswer('completed', { at: new Date().toISOString() }); go('thanks') }} intro={<p className="h5" style={{ marginBottom: 4 }}>Last few questions</p>} />

  return (
    <Page progress={1} footer={<p className="body14 muted" style={{ textAlign: 'center' }}>You can close this page now.</p>}>
      <img src={new URL('../assets/illustrations/booked-heart.png', import.meta.url).href} width={76} height={66} alt="" />
      <h1 className="h2 test-title">Thank you!</h1>
      <p className="body16">Your answers and recording have been saved. They’ll help make Pally better at helping people find who to play with.</p>
    </Page>
  )
}
