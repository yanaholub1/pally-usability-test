/**
 * Private results page (/?results). Email sign-in; only addresses in `researchers` can read data.
 * Overview of all sessions → one page per participant with answers, audio, transcripts, and
 * task timelines synced to the think-aloud audio with a replay of the screen they were on.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import JSZip from 'jszip'
import './results.css'
import {
  QUESTIONS, decisions, deleteAudio, deleteSession, deviceOf, extOf, fileLabel, genderOf, loadAudio, loadDetail,
  loadOverview, playerName, rs, saveNote, taskSpan, type Detail, type Ev, type Summary,
} from './data'
import { requestersFor } from '../data'

const AUDIO_KEPT_DAYS = 14
const fmtDate = (s: string) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const mmss = (sec: number) => { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const dur = (ms: number | null) => (ms == null ? '—' : mmss(ms / 1000))
const daysSince = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000)

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ───────── Shell: sign-in and routing ───────── */
export default function ResultsApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [route, setRoute] = useState(() => new URLSearchParams(location.hash.slice(1)).get('p'))

  useEffect(() => {
    document.title = 'Pally study results'
    document.documentElement.classList.add('results-root')
    rs.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = rs.auth.onAuthStateChange((_e, s) => setSession(s))
    const onHash = () => setRoute(new URLSearchParams(location.hash.slice(1)).get('p'))
    window.addEventListener('hashchange', onHash)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('hashchange', onHash) }
  }, [])
  useEffect(() => {
    if (!session) { setAllowed(null); return }
    rs.from('researchers').select('email').then(({ data }) => setAllowed(!!data?.length))
  }, [session])

  if (session === undefined) return <div className="rs-center">Loading…</div>
  if (!session) return <SignIn />
  if (allowed === null) return <div className="rs-center">Checking access…</div>
  if (!allowed) return (
    <div className="rs-center rs-stack">
      <p><b>{session.user.email}</b> doesn’t have access to these results.</p>
      <button className="rs-btn" onClick={() => rs.auth.signOut()}>Sign out</button>
    </div>
  )
  return (
    <div className="rs">
      <header className="rs-top">
        <a className="rs-brand" href="#">Pally study results</a>
        <span className="rs-muted">{session.user.email}</span>
        <button className="rs-link" onClick={() => rs.auth.signOut()}>Sign out</button>
      </header>
      {route ? <ParticipantPage key={route} id={route} /> : <Overview />}
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const send = async () => {
    setState('sending')
    const { error } = await rs.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/?results` } })
    if (error) { setState('error'); setMsg(error.message) } else setState('sent')
  }
  return (
    <div className="rs-center">
      <form className="rs-card rs-signin" onSubmit={(e) => { e.preventDefault(); void send() }}>
        <h1>Pally study results</h1>
        {state === 'sent' ? (
          <p>Check <b>{email}</b> for a sign-in link. Open it on this device.</p>
        ) : (
          <>
            <p className="rs-muted">Private. We’ll email you a sign-in link.</p>
            <input className="rs-input" type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="rs-btn rs-btn--primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Email me a link'}</button>
            {state === 'error' && <p className="rs-error">{msg}</p>}
          </>
        )}
      </form>
    </div>
  )
}

/* ───────── Overview ───────── */
function Overview() {
  const [rows, setRows] = useState<Summary[] | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'real' | 'pilot' | 'all'>(() => (localStorageGet('rs-filter') as 'real' | 'pilot' | 'all') || 'all')
  const [busy, setBusy] = useState('')
  const load = () => loadOverview().then(setRows).catch((e) => setErr(String(e.message ?? e)))
  useEffect(() => { void load() }, [])
  useEffect(() => { localStorageSet('rs-filter', filter) }, [filter])

  const shown = (rows ?? []).filter((r) => !r.empty && (filter === 'all' || (filter === 'pilot' ? r.p.mode === 'pilot' : r.p.mode !== 'pilot')))
    .sort((a, b) => b.p.created_at.localeCompare(a.p.created_at))
  const due = shown.filter((r) => r.audioSince && daysSince(r.audioSince) >= AUDIO_KEPT_DAYS)

  const downloadAll = async () => {
    const zip = new JSZip()
    for (const r of shown) {
      setBusy(`Preparing ${r.label}…`)
      const d = await loadDetail(r.p.id)
      await addParticipantToZip(zip.folder(fileLabel(r.label))!, d)
    }
    setBusy('Zipping…')
    saveBlob(await zip.generateAsync({ type: 'blob' }), `pally-results-${filter}.zip`)
    setBusy('')
  }

  if (err) return <div className="rs-page"><p className="rs-error">{err}</p></div>
  if (!rows) return <div className="rs-page rs-muted">Loading sessions…</div>
  return (
    <div className="rs-page">
      <div className="rs-row rs-between">
        <div className="rs-seg" role="tablist">
          {(['all', 'real', 'pilot'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'real' ? 'Participants' : 'Pilots'}
            </button>
          ))}
        </div>
        <div className="rs-row">
          {busy && <span className="rs-muted">{busy}</span>}
          <button className="rs-btn" disabled={!!busy || !shown.length} onClick={() => void downloadAll().catch((e) => { setBusy(''); alert(e.message) })}>Download all ({shown.length}) as zip</button>
        </div>
      </div>
      {due.length > 0 && (
        <p className="rs-banner">Audio for {due.map((r) => r.label).join(', ')} is {AUDIO_KEPT_DAYS}+ days old. You promised participants to delete it within {AUDIO_KEPT_DAYS} days: transcribe, then delete it on their page.</p>
      )}
      <div className="rs-tablewrap">
        <table className="rs-table">
          <thead>
            <tr><th>Who</th><th>Started</th><th>Device</th><th>Mic</th><th>Task 1</th><th>Task 2</th><th>Admitted</th><th>Profiles opened</th><th>Answers</th><th>Audio</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.p.id} onClick={() => { location.hash = `p=${r.p.id}` }}>
                <td><a href={`#p=${r.p.id}`}><b>{r.label}</b></a>{!r.completed && <span className="rs-tag rs-tag--warn">not finished</span>}</td>
                <td>{fmtDate(r.p.created_at)}</td>
                <td>{r.device}</td>
                <td>{r.thinkAloud ? 'Think-aloud' : r.thinkAloud === false ? 'Typing' : '—'}</td>
                <td><Outcome how={r.tasks.task1.how} ms={r.tasks.task1.ms} /></td>
                <td><Outcome how={r.tasks.task2.how} ms={r.tasks.task2.ms} /></td>
                <td>{r.admitted.length ? r.admitted.join(', ') : '—'}</td>
                <td>{r.tasks.task2.how ? (r.profilesOpened === 0 ? <span className="rs-tag rs-tag--warn">0 · cards only</span> : r.profilesOpened) : '—'}</td>
                <td>{r.answers}{r.voiceAnswers ? <span className="rs-muted"> · {r.voiceAnswers} voice</span> : ''}</td>
                <td>{r.audioFiles ? <span className={r.audioSince && daysSince(r.audioSince) >= AUDIO_KEPT_DAYS ? 'rs-danger' : ''}>{daysSince(r.audioSince!)}d old</span> : <span className="rs-muted">none</span>}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={10} className="rs-muted">No sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="rs-muted rs-small">Player key for task 2: {requestersFor('any').map((r) => `${r.id} ${r.status === 'New to Pally' ? 'new, no scores' : `attendance ${r.attendance}%, sportsmanship ${r.sportsmanship}%`}`).join(' · ')}. Names depend on the gender setting they chose.</p>
    </div>
  )
}

function Outcome({ how, ms }: { how: string | null; ms: number | null }) {
  if (!how) return <span className="rs-muted">—</span>
  return <span className={how === 'completed' ? '' : 'rs-warn'}>{how === 'completed' ? '✓' : how === 'skipped' ? 'Stuck' : how} {dur(ms)}</span>
}

/* ───────── One participant ───────── */
function ParticipantPage({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const load = () => loadDetail(id).then(setD).catch((e) => setErr(String(e.message ?? e)))
  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="rs-page"><a href="#">← All sessions</a><p className="rs-error">{err}</p></div>
  if (!d) return <div className="rs-page rs-muted">Loading…</div>

  const ans = (qid: string) => d.answers.find((a) => a.question_id === qid)?.value ?? null
  const opt = ans('think_aloud_opt_in')?.selected
  const g = genderOf(d.events)
  const hasAudio = d.recs.length > 0
  const oldest = hasAudio ? d.recs.map((r) => r.created_at).sort()[0] : null

  const zipOne = async () => {
    setBusy('Preparing zip…')
    const zip = new JSZip()
    await addParticipantToZip(zip, d)
    saveBlob(await zip.generateAsync({ type: 'blob' }), `${fileLabel(d.label)}.zip`)
    setBusy('')
  }
  const delAudio = async () => {
    if (!confirm(`Delete all audio for ${d.label}? Answers and your transcripts stay. This can’t be undone.`)) return
    setBusy('Deleting audio…'); await deleteAudio(d.p.id); setBusy(''); await load()
  }
  const delSession = async () => {
    if (!confirm(`Delete ${d.label} completely (answers, taps, audio, transcripts)? This can’t be undone.`)) return
    setBusy('Deleting…'); await deleteSession(d.p.id); location.hash = ''
  }

  return (
    <div className="rs-page">
      <a href="#">← All sessions</a>
      <div className="rs-row rs-between rs-head">
        <div>
          <h1>{d.label}</h1>
          <p className="rs-muted">
            {fmtDate(d.p.created_at)} · {deviceOf(d.p.user_agent)} · {d.p.viewport ?? ''} · {opt ? 'Thinking aloud' : opt === false ? 'Typing only' : 'Mic unknown'} · {d.p.mode}
            {!d.answers.some((a) => a.question_id === 'completed') && <span className="rs-tag rs-tag--warn">not finished</span>}
          </p>
        </div>
        <div className="rs-row">
          {busy && <span className="rs-muted">{busy}</span>}
          <button className="rs-btn" disabled={!!busy} onClick={() => void zipOne().catch((e) => { setBusy(''); alert(e.message) })}>Download all as zip</button>
          {hasAudio && <button className="rs-btn rs-btn--danger" disabled={!!busy} onClick={() => void delAudio().catch((e) => { setBusy(''); alert(e.message) })}>Delete audio</button>}
          <button className="rs-btn rs-btn--ghost-danger" disabled={!!busy} onClick={() => void delSession().catch((e) => { setBusy(''); alert(e.message) })}>Delete session</button>
        </div>
      </div>
      {oldest && <p className={daysSince(oldest) >= AUDIO_KEPT_DAYS ? 'rs-banner' : 'rs-muted rs-small'}>Audio recorded {daysSince(oldest)} days ago. Delete it by {new Date(new Date(oldest).getTime() + AUDIO_KEPT_DAYS * 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ({AUDIO_KEPT_DAYS}-day promise).</p>}

      <QuestionGroup d={d} group="About them" />
      <TaskSection d={d} seg="task1" title="Task 1 · Set up a match" />
      <QuestionGroup d={d} group="After task 1" />
      <TaskSection d={d} seg="task2" title="Task 2 · Choose 3 of 5 players" summary={<Task2Summary d={d} gender={g} />} />
      <QuestionGroup d={d} group="After task 2" />
    </div>
  )
}

function QuestionGroup({ d, group }: { d: Detail; group: string }) {
  const qs = QUESTIONS.filter((q) => q.group === group)
  let lastTitle = ''
  return (
    <section className="rs-section">
      <h2>{group}</h2>
      {qs.map((q) => {
        const v = d.answers.find((a) => a.question_id === q.id)?.value ?? null
        const showTitle = q.title !== lastTitle
        lastTitle = q.title
        return (
          <div key={q.id} className="rs-q">
            {showTitle && <p className="rs-q__title">{q.title}</p>}
            {q.prompt && <p className="rs-q__prompt">{q.prompt}</p>}
            <AnswerView d={d} qid={q.id} v={v} />
          </div>
        )
      })}
    </section>
  )
}

function AnswerView({ d, qid, v }: { d: Detail; qid: string; v: Record<string, unknown> | null }) {
  if (!v) return <p className="rs-muted">No answer</p>
  if (v.mode === 'skipped') return <p className="rs-muted">Skipped</p>
  if (v.mode === 'text') return <p className="rs-a">“{String(v.text)}”</p>
  if (v.mode === 'voice') return (
    <div className="rs-stack">
      <AudioFile pid={d.p.id} segment={String(v.segment)} name={`${fileLabel(d.label)}-${qid}`} />
      <NoteBox pid={d.p.id} k={qid} initial={d.notes[qid] ?? ''} placeholder="Paste the transcript here…" />
    </div>
  )
  if ('selected' in v) {
    const sel = Array.isArray(v.selected) ? (v.selected as string[]).join(', ') : String(v.selected)
    return <p className="rs-a">{sel || '—'}{v.other ? <> · Other: “{String(v.other)}”</> : null}</p>
  }
  return <pre className="rs-small">{JSON.stringify(v)}</pre>
}

/** One recording: player + download. Loads on demand. */
function AudioFile({ pid, segment, name, audioRef, onTime, onBlob }: {
  pid: string; segment: string; name: string
  audioRef?: React.RefObject<HTMLAudioElement | null>; onTime?: (t: number) => void; onBlob?: (ok: boolean) => void
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'none' | 'error'>('idle')
  const [url, setUrl] = useState('')
  const blob = useRef<Blob | null>(null)
  const ownRef = useRef<HTMLAudioElement>(null)
  const ref = audioRef ?? ownRef
  const load = () => {
    setState('loading')
    loadAudio(pid, segment).then((b) => {
      if (!b) { setState('none'); onBlob?.(false); return }
      blob.current = b; setUrl(URL.createObjectURL(b)); setState('ready'); onBlob?.(true)
    }).catch(() => setState('error'))
  }
  useEffect(() => { load() }, [pid, segment]) // eslint-disable-line react-hooks/exhaustive-deps
  // Recordings made in the browser often report no duration until the end is read: force it so seeking works
  const fixDuration = (a: HTMLAudioElement) => {
    if (a.duration === Infinity || Number.isNaN(a.duration)) {
      const back = () => { a.removeEventListener('timeupdate', back); a.currentTime = 0 }
      a.addEventListener('timeupdate', back)
      a.currentTime = 1e7
    }
  }
  if (state === 'loading' || state === 'idle') return <p className="rs-muted rs-small">Loading audio…</p>
  if (state === 'none') return <p className="rs-muted rs-small">No audio (deleted, or nothing was saved)</p>
  if (state === 'error') return <p className="rs-error rs-small">Couldn’t load the audio. <button className="rs-link" onClick={load}>Try again</button></p>
  return (
    <div className="rs-row rs-audio">
      <audio ref={ref} src={url} controls preload="metadata" onLoadedMetadata={(e) => fixDuration(e.currentTarget)} onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)} />
      <button className="rs-btn rs-btn--sm" onClick={() => blob.current && saveBlob(blob.current, `${name}.${extOf(blob.current)}`)}>Download</button>
    </div>
  )
}

function NoteBox({ pid, k, initial, placeholder }: { pid: string; k: string; initial: string; placeholder: string }) {
  const [text, setText] = useState(initial)
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const timer = useRef<number | undefined>(undefined)
  const change = (t: string) => {
    setText(t); setState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { saveNote(pid, k, t).then(() => setState('saved')).catch(() => setState('error')) }, 700)
  }
  return (
    <div className="rs-note">
      <textarea className="rs-input" rows={text ? Math.min(12, 2 + Math.ceil(text.length / 90)) : 2} placeholder={placeholder} value={text} onChange={(e) => change(e.target.value)} />
      <span className={`rs-small ${state === 'error' ? 'rs-error' : 'rs-muted'}`}>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Not saved, check your connection' : ''}</span>
    </div>
  )
}

/* ───────── Tasks: audio + timeline + screen replay ───────── */
type Item = { t: number; audio: number; text: ReactNode; kind: string; e: Ev }
const ROUTABLE = new Set(['home', 'find', 'bookCourt', 'club', 'visibility', 'matchType', 'gender', 'approval', 'review', 'payment', 'booked', 'homeMatch', 'matchDetails', 'requests'])
const SCREEN_NAMES: Record<string, string> = {
  home: 'Home', homeMatch: 'Home (match booked)', find: 'Find', bookCourt: 'Find courts', club: 'Club page', visibility: 'Visibility',
  matchType: 'Match type', gender: 'Gender', approval: 'Approval', review: 'Review', payment: 'Payment', booked: 'Court booked',
  matchDetails: 'Match details', requests: 'Join requests',
}
const screenName = (s: string | null) => (s ? SCREEN_NAMES[s] ?? s : '')

function TaskSection({ d, seg, title, summary }: { d: Detail; seg: 'task1' | 'task2'; title: string; summary?: ReactNode }) {
  const span = taskSpan(d.events, seg)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [now, setNow] = useState<number>(-1) // audio seconds
  const [hasAudio, setHasAudio] = useState<boolean | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const g = genderOf(d.events)

  // Where the recording starts and when the mic was paused, to turn event times into audio times
  const startMs = useMemo(() => {
    const rows = d.recs.filter((r) => r.segment === seg)
    if (rows.length) return Math.min(...rows.map((r) => r.start_ms))
    return d.events.find((e) => e.type === 'recording_start' && e.target === seg)?.t_ms ?? span.start ?? 0
  }, [d, seg, span.start])
  const pauses = useMemo(() => {
    const out: [number, number][] = []
    let open: number | null = null
    for (const e of d.events) {
      if (e.target !== seg) continue
      if (e.type === 'recording_paused') open = e.t_ms
      if (e.type === 'recording_resumed' && open != null) { out.push([open, e.t_ms]); open = null }
    }
    if (open != null) out.push([open, Number.MAX_SAFE_INTEGER])
    return out
  }, [d, seg])
  const toAudio = (t: number) => {
    let off = t - startMs
    for (const [a, b] of pauses) { if (t > b) off -= b - a; else if (t > a) off -= t - a }
    return off / 1000
  }

  const items: Item[] = useMemo(() => {
    if (span.start == null) return []
    const end = span.end ?? Number.MAX_SAFE_INTEGER
    const evs = d.events.filter((e) => e.t_ms >= span.start! && e.t_ms <= end)
    const out: Item[] = []
    for (const e of evs) {
      const base = { t: e.t_ms, audio: toAudio(e.t_ms), e }
      const last = out[out.length - 1]
      switch (e.type) {
        case 'screen_view': out.push({ ...base, kind: 'screen', text: <>Screen: <b>{screenName(e.screen)}</b></> }); break
        case 'tap': out.push({ ...base, kind: 'tap', text: <>Tap <code>{e.target}</code></> }); break
        case 'tap_dead': out.push({ ...base, kind: 'dead', text: <>Tap on nothing <code>{e.target ?? ''}</code></> }); break
        case 'scroll':
          if (Number(e.data?.deepest ?? e.data?.depth ?? 0) < 5) break
          if (last?.kind === 'scroll' && last.e.screen === e.screen) { last.text = <>Scrolled {screenName(e.screen)} to {String(e.data?.deepest ?? e.data?.depth)}%</>; last.e = e }
          else out.push({ ...base, kind: 'scroll', text: <>Scrolled {screenName(e.screen)} to {String(e.data?.deepest ?? e.data?.depth)}%</> })
          break
        case 'request_admitted': case 'request_declined': case 'request_undo':
          out.push({ ...base, kind: 'decision', text: <><b>{e.type === 'request_admitted' ? 'Admitted' : e.type === 'request_declined' ? 'Declined' : 'Undid decision on'}</b> {playerName(e.target ?? '', g)} ({e.target})</> }); break
        case 'profile_open': out.push({ ...base, kind: 'profile', text: <>Opened <b>{String(e.data?.name ?? e.target)}</b>’s profile</> }); break
        case 'profile_close': out.push({ ...base, kind: 'profile', text: <>Closed profile after {mmss(Number(e.data?.dwell_ms ?? 0) / 1000)}</> }); break
        case 'profile_tab': out.push({ ...base, kind: 'profile', text: <>Profile tab: {e.target?.split(':')[1]}</> }); break
        case 'milestone': out.push({ ...base, kind: 'milestone', text: <>★ {e.target}</> }); break
        case 'recording_paused': if (e.target === seg) out.push({ ...base, kind: 'mic', text: <>Mic paused</> }); break
        case 'recording_resumed': if (e.target === seg) out.push({ ...base, kind: 'mic', text: <>Mic back on</> }); break
        case 'task_end': out.push({ ...base, kind: 'end', text: <>Task ended: {String(e.data?.how)}</> }); break
        case 'sheet_open': out.push({ ...base, kind: 'tap', text: <>Opened sheet {e.target}</> }); break
        case 'notification_shown': out.push({ ...base, kind: 'screen', text: <>Notification shown</> }); break
        default: break
      }
    }
    return out
  }, [d, seg, span.start, span.end, startMs, pauses]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeIdx = now < 0 ? -1 : items.reduce((acc, it, i) => (it.audio <= now + 0.05 ? i : acc), -1)
  useEffect(() => {
    if (activeIdx < 0) return
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIdx])

  // Replay: the screen they were on at this moment, the profile on top if open, and their last tap
  const replay = useMemo(() => {
    const cut = activeIdx >= 0 ? items[activeIdx].t : items[0]?.t ?? 0
    let screen = seg === 'task1' ? 'home' : 'homeMatch'
    let profile: string | null = null
    let tap: Ev | null = null
    for (const e of d.events) {
      if (span.start == null || e.t_ms < span.start || e.t_ms > cut) continue
      if (e.type === 'screen_view' && e.screen && ROUTABLE.has(e.screen)) { screen = e.screen; profile = null; tap = null }
      if (e.type === 'profile_open') profile = String(e.data?.name ?? e.target)
      if (e.type === 'profile_close') profile = null
      if ((e.type === 'tap' || e.type === 'tap_dead') && e.data && typeof e.data.x === 'number') tap = e
    }
    const freshTap = tap && cut - tap.t_ms < 1500 ? tap : null
    return { screen, profile, tap: freshTap }
  }, [activeIdx, items, d, seg, span.start])

  const seek = (it: Item) => {
    const a = audioRef.current
    if (a && hasAudio) { a.currentTime = Math.max(0, it.audio - 0.5); void a.play() }
    setNow(it.audio)
  }

  if (span.start == null) return <section className="rs-section"><h2>{title}</h2><p className="rs-muted">Didn’t reach this task.</p></section>
  const scale = 0.62
  const tapData = replay.tap?.data as { x: number; y: number; w: number } | undefined
  return (
    <section className="rs-section">
      <h2>{title}</h2>
      <p className="rs-muted">
        {span.how === 'completed' ? 'Completed' : span.how === 'skipped' ? 'Moved on via “I’m stuck”' : span.how} in {dur(span.end != null ? span.end - span.start : null)} · {items.filter((i) => i.kind === 'dead').length} taps on nothing
      </p>
      {summary}
      <div className="rs-task">
        <div className="rs-stack rs-task__main">
          <AudioFile pid={d.p.id} segment={seg} name={`${fileLabel(d.label)}-${seg}`} audioRef={audioRef} onTime={setNow} onBlob={setHasAudio} />
          {hasAudio === false && <p className="rs-muted rs-small">No think-aloud audio for this task. The timeline still shows what they did; click a row to see the screen.</p>}
          <ol ref={listRef} className="rs-timeline">
            {items.map((it, i) => (
              <li key={i} className={`rs-ev rs-ev--${it.kind} ${i === activeIdx ? 'on' : ''}`} onClick={() => seek(it)}>
                <span className="rs-ev__t">{mmss(it.audio)}</span>
                <span className="rs-ev__x">{it.text}</span>
              </li>
            ))}
          </ol>
          <NoteBox pid={d.p.id} k={seg} initial={d.notes[seg] ?? ''} placeholder="Paste the think-aloud transcript here…" />
        </div>
        <div className="rs-replay">
          <div className="rs-phone" style={{ width: 390 * scale, height: 760 * scale }}>
            <iframe title="Screen replay" src={`/?screen=${replay.screen}`} style={{ width: 390, height: 760, transform: `scale(${scale})` }} tabIndex={-1} />
            {replay.profile && <div className="rs-phone__overlay">Viewing {replay.profile}’s profile</div>}
            {tapData && !replay.profile && (
              <span key={replay.tap!.t_ms} className={`rs-dot ${replay.tap!.type === 'tap_dead' ? 'rs-dot--dead' : ''}`}
                style={{ left: tapData.x * (390 / tapData.w) * scale, top: tapData.y * (390 / tapData.w) * scale }} />
            )}
          </div>
          <p className="rs-muted rs-small">{screenName(replay.screen)}. The screen as designed, not their exact state (their selections aren’t replayed). Red dot = tap on nothing.</p>
        </div>
      </div>
    </section>
  )
}

function Task2Summary({ d, gender }: { d: Detail; gender: ReturnType<typeof genderOf> }) {
  const span = taskSpan(d.events, 'task2')
  if (span.start == null) return null
  const evs = d.events.filter((e) => e.t_ms >= span.start! && (span.end == null || e.t_ms <= span.end))
  const dec = decisions(evs)
  const opened = new Map<string, number>()
  for (const e of evs) if (e.type === 'profile_close' && e.target && e.target !== 'me') opened.set(e.target, (opened.get(e.target) ?? 0) + Number(e.data?.dwell_ms ?? 0))
  for (const e of evs) if (e.type === 'profile_open' && e.target && e.target !== 'me' && !opened.has(e.target)) opened.set(e.target, 0)
  const people = requestersFor(gender)
  return (
    <table className="rs-table rs-table--compact">
      <thead><tr><th>Player</th><th>Status</th><th>Attendance</th><th>Sportsmanship</th><th>Profile opened</th><th>Decision</th></tr></thead>
      <tbody>
        {people.map((r) => (
          <tr key={r.id}>
            <td><b>{r.name}</b> ({r.id})</td>
            <td>{r.status}</td>
            <td>{r.attendance == null ? '—' : `${r.attendance}%`}</td>
            <td>{r.sportsmanship == null ? '—' : `${r.sportsmanship}%`}</td>
            <td>{opened.has(r.id) ? `Yes${opened.get(r.id) ? `, ${mmss(opened.get(r.id)! / 1000)}` : ''}` : '—'}</td>
            <td className={dec[r.id] === 'admitted' ? 'rs-ok' : dec[r.id] === 'declined' ? 'rs-danger' : 'rs-muted'}>{dec[r.id] ?? 'not decided'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ───────── Zip export ───────── */
async function addParticipantToZip(zip: JSZip, d: Detail) {
  const L = fileLabel(d.label)
  const lines: string[] = [`${d.label} · ${fmtDate(d.p.created_at)} · ${deviceOf(d.p.user_agent)} · ${d.p.mode}`, '']
  for (const seg of ['task1', 'task2'] as const) {
    const b = await loadAudio(d.p.id, seg).catch(() => null)
    if (b) zip.file(`${L}-${seg}.${extOf(b)}`, b)
    const span = taskSpan(d.events, seg)
    lines.push(`${seg}: ${span.how ?? 'not reached'} ${span.start != null && span.end != null ? dur(span.end - span.start) : ''}`)
    if (d.notes[seg]) lines.push(`  Transcript: ${d.notes[seg]}`)
  }
  lines.push('')
  for (const q of QUESTIONS) {
    const v = d.answers.find((a) => a.question_id === q.id)?.value
    let text = 'No answer'
    if (v?.mode === 'skipped') text = 'Skipped'
    else if (v?.mode === 'text') text = `"${v.text}"`
    else if (v?.mode === 'voice') {
      const b = await loadAudio(d.p.id, String(v.segment)).catch(() => null)
      if (b) zip.file(`${L}-${q.id}.${extOf(b)}`, b)
      text = `[voice: ${L}-${q.id}]${d.notes[q.id] ? ` ${d.notes[q.id]}` : ''}`
    } else if (v && 'selected' in v) text = Array.isArray(v.selected) ? (v.selected as string[]).join(', ') + (v.other ? `; Other: ${v.other}` : '') : String(v.selected)
    lines.push(`${q.title}${q.prompt ? ` / ${q.prompt}` : ''}\n  ${text}`)
  }
  zip.file(`${L}-answers.txt`, lines.join('\n'))
}

function localStorageGet(k: string) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
