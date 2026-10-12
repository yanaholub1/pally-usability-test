import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { asset } from '../components/assets'
import { Avatar, Badge, Button, IconButton, ProgressRing, Segmented, SectionHeader, Smiley } from '../components/ui'
import { attendanceBucket, sportsBucket, sportsMood, type Requester } from '../data'
import { setCurrentScreen, track } from '../log'

function Stat({ art, fallback, value, label }: { art: string; fallback: string; value: string; label: string }) {
  const src = asset('illustrations', art)
  return (
    <div className="profile-stat">
      <span className="profile-stat__art">{src ? <img src={src} width={64} height={64} alt="" /> : <Icon name={fallback} size={44} strokeWidth={1.2} />}</span>
      <span className="h5">{value}</span>
      <span style={{ fontSize: 12, lineHeight: '16px' }}>{label}</span>
    </div>
  )
}

function NotEnoughData({ title }: { title: string }) {
  return (
    <div className="score-card score-card--empty">
      <div className="grow stack gap8">
        <p className="h6">Not enough data</p>
        <p className="body14 muted">{title} appears after 5 rated matches.</p>
        <div><Badge icon="profile">New to Pally</Badge></div>
      </div>
    </div>
  )
}

export function ProfileOverlay({ r, returnScreen, onClose }: { r: Requester; returnScreen: string; onClose: () => void }) {
  const [tab, setTab] = useState('About')
  const [leaving, setLeaving] = useState(false)
  const [opened] = useState(() => performance.now())

  useEffect(() => {
    setCurrentScreen(`profile:${r.id}`)
    track('profile_open', r.id, { name: r.name })
  }, [r.id, r.name])

  useEffect(() => {
    track('profile_tab', `${r.id}:${tab}`)
  }, [tab, r.id])

  const close = () => {
    track('profile_close', r.id, { dwell_ms: Math.round(performance.now() - opened) })
    setCurrentScreen(returnScreen)
    setLeaving(true)
    setTimeout(onClose, 300)
  }

  return (
    <div className={`overlay-page ${leaving ? 'leaving' : ''}`} role="dialog" aria-label={`${r.name}'s profile`}>
      <div className="screen__scroll">
        <div className="profile-hdr brand-bg">
          <div className="hdr__row">
            <IconButton icon="chevron-left" label="Back" onClick={close} trackId="profile:back" />
            <div className="hdr__spacer" />
            <IconButton icon="share" label="Share" trackId="profile:share" />
          </div>
          <div className="stack gap20 pad20" style={{ marginTop: 16 }}>
            <div className="row gap16">
              <Avatar name={r.name} photo={r.photo} size={64} level={r.levelEstimated ? `~${r.level.toFixed(1)}` : r.level.toFixed(1)} />
              <div className="stack gap4">
                <div className="row gap8" style={{ alignItems: 'baseline' }}>
                  <p className="h2">{r.name}</p>
                  <span className="caption">{r.status}</span>
                </div>
                <p className="h6">{r.following} following &nbsp; {r.followers} followers</p>
              </div>
            </div>
            <div className="row">
              <Stat art="stat-clubs" fallback="field" value={String(r.clubsVisited)} label="Clubs visited" />
              <Stat art="stat-tournaments" fallback="trophy" value={String(r.tournaments)} label="Tournaments" />
              <Stat art="stat-minutes" fallback="racket" value={String(r.minutes)} label="Min sweating" />
              <Stat art="stat-players" fallback="handshake" value={String(r.playersMet)} label="Players met" />
            </div>
            <div className="row gap8">
              <Button variant="on-brand" icon="follow" fill trackId="profile:follow">Follow</Button>
              <Button variant="on-brand" icon="chat" fill trackId="profile:message">Message</Button>
            </div>
          </div>
        </div>
        <div className="sheet-body stack gap24" style={{ padding: '24px 20px 40px' }}>
          <Segmented items={['About', 'Stats', 'Reputation']} value={tab} onChange={setTab} trackPrefix={`profile:${r.id}:tab`} />

          {tab === 'About' && (
            <>
              <div className="stack gap12">
                <SectionHeader title="Play area" />
                <div className="row gap8"><span className="chip">Barcelona, Spain</span></div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Languages spoken" />
                <div className="row gap8" style={{ flexWrap: 'wrap' }}>{r.languages.map((l) => <span key={l} className="chip">{l}</span>)}</div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Preferences" />
                <div className="row gap8">
                  <div className="metric"><span className="metric__label">Best hand</span><span className="h6">{r.hand}</span></div>
                  <div className="metric"><span className="metric__label">Court side</span><span className="h6">{r.side === 'Either' ? 'Both' : r.side}</span></div>
                </div>
              </div>
            </>
          )}

          {tab === 'Stats' && (
            <div className="stack gap12">
              <SectionHeader title="Activity" />
              <div className="row gap8" style={{ alignItems: 'stretch' }}>
                <div className="metric metric--featured">
                  <span className="metric__label">Level</span>
                  <span className="row gap8"><Icon name="level" /><span className="metric__value" style={{ fontWeight: 500, fontSize: 32 }}>{r.levelEstimated ? '~' : ''}{r.level.toFixed(1)}</span></span>
                  <span style={{ fontSize: 12 }}>{r.levelEstimated ? 'Estimated from the onboarding quiz' : `Confirmed over ${r.matches} matches`}</span>
                </div>
              </div>
              <div className="row gap8">
                <div className="metric"><span className="metric__label">Matches</span><span className="metric__value">{r.matches}</span></div>
                <div className="metric"><span className="metric__label">Wins</span><span className="metric__value">{r.wins}</span></div>
                <div className="metric"><span className="metric__label">Win rate</span><span className="metric__value">{Math.round((r.wins / r.matches) * 100)}%</span></div>
              </div>
            </div>
          )}

          {tab === 'Reputation' && (
            <>
              <div className="stack gap12">
                <SectionHeader title="Attendance" info />
                {r.attendance === null ? (
                  <NotEnoughData title="This score" />
                ) : (
                  <>
                    <div className="score-card">
                      <div className="grow stack gap16">
                        <div className="stack gap4">
                          <span className="score-card__value">{r.attendance}%</span>
                          <span className="score-card__caption">Matches attended on time</span>
                        </div>
                        <div><Badge icon="badge" variant="media">{attendanceBucket(r.attendance)}</Badge></div>
                      </div>
                      <ProgressRing value={r.attendance} />
                    </div>
                    <div className="row gap8">
                      <div className="metric"><span className="metric__label">Arrived on time</span><span className="metric__value">{r.arrivedOnTime![0]}<span className="metric__suffix">/{r.arrivedOnTime![1]}</span></span></div>
                      <div className="metric"><span className="metric__label">Cancelled late</span><span className="metric__value">{r.cancelledLate![0]}<span className="metric__suffix">/{r.cancelledLate![1]}</span></span></div>
                    </div>
                  </>
                )}
              </div>
              <div className="stack gap12">
                <SectionHeader title="Sportsmanship" info />
                {r.sportsmanship === null ? (
                  <NotEnoughData title="This score" />
                ) : (
                  <div className="score-card">
                    <div className="grow stack gap16">
                      <div className="stack gap4">
                        <span className="score-card__value">{r.sportsmanship}%</span>
                        <span className="score-card__caption">Players would play with them again</span>
                      </div>
                      <div><Badge icon="handshake" variant="media">{sportsBucket(r.sportsmanship)}</Badge></div>
                    </div>
                    <Smiley mood={sportsMood(r.sportsmanship)} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
