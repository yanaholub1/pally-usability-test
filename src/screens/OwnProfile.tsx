import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { asset } from '../components/assets'
import { Avatar, Badge, Button, IconButton, ProgressRing, Segmented, SectionHeader, Smiley, TButton } from '../components/ui'
import { HOST } from '../data'
import { setCurrentScreen, track } from '../log'
import { useApp } from '../state'

/** The host's own profile (Figma: Own profile — About / Stats / Reputation). Figures are the design's. */
const ME = {
  status: 'Active player', following: 30, followers: 44, // Active: 37 rated matches, played recently
  clubsVisited: 12, tournaments: 36, minutes: 900, playersMet: 24,
  languages: ['English', 'Spanish'], hand: 'Right', side: 'Right',
  matches: 37, wins: 12, levelTrend: '+0.4 over last 5 matches', confidence: 10,
  technique: [['Bandeja', 6.4], ['Vibora', 7.2], ['Smash', 4.4], ['Volley', 5.5], ['Wall shots', 8.0], ['Serve & return', 5.4]] as [string, number][],
  attendance: 96, arrivedOnTime: [27, 30], cancelledLate: [1, 32], sportsmanship: 88,
  feedback: [['Supportive', 2], ['Fair line calls', 4], ['Good attitude', 3], ['Fun to play with', 1], ['Great communication', 1]] as [string, number][],
}
const genderLabels: Record<string, string> = { woman: 'Woman', man: 'Man', nonbinary: 'Non-binary', unsaid: 'Prefer not to say' }
const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Stat({ art, value, label }: { art: string; value: string; label: string }) {
  const src = asset('illustrations', art)
  return (
    <div className="profile-stat">
      <span className="profile-stat__art">{src && <img src={src} alt="" />}</span>
      <span className="h5">{value}</span>
      <span className="profile-stat__label">{label}</span>
    </div>
  )
}

function OnlyYou() {
  return <span className="caption only-you"><span className="only-you__dot" />Only visible to you</span>
}

export function OwnProfileOverlay({ returnScreen, onClose }: { returnScreen: string; onClose: () => void }) {
  const { config } = useApp()
  const [tab, setTab] = useState('About')
  const [leaving, setLeaving] = useState(false)
  const [opened] = useState(() => performance.now())

  useEffect(() => {
    setCurrentScreen('profile:me')
    track('profile_open', 'me', { name: HOST.name, own: true })
  }, [])
  useEffect(() => { track('profile_tab', `me:${tab}`) }, [tab])

  const close = () => {
    track('profile_close', 'me', { dwell_ms: Math.round(performance.now() - opened) })
    setCurrentScreen(returnScreen)
    setLeaving(true)
    setTimeout(onClose, 300)
  }

  return (
    <div className={`overlay-page ${leaving ? 'leaving' : ''}`} role="dialog" aria-label="Your profile">
      <div className="screen__scroll">
        <div className="profile-hdr brand-bg">
          <div className="hdr__row">
            <IconButton icon="chevron-left" label="Back" onClick={close} trackId="profile:back" />
            <div className="hdr__spacer" />
            <IconButton icon="settings" label="Settings" trackId="profile:me:settings" />
          </div>
          <div className="stack gap20 pad20" style={{ marginTop: 16 }}>
            <div className="row gap16">
              <Avatar name={HOST.name} photo={HOST.photo} size={64} />
              <div className="stack gap4">
                <div className="row gap8" style={{ alignItems: 'baseline' }}>
                  <p className="h2">{HOST.name}</p>
                  <span className="caption">{ME.status}</span>
                </div>
                <p className="h6">{ME.following} following &nbsp; {ME.followers} followers</p>
              </div>
            </div>
            <div className="row">
              <Stat art="stat-clubs" value={String(ME.clubsVisited)} label="Clubs visited" />
              <Stat art="stat-tournaments" value={String(ME.tournaments)} label="Tournaments" />
              <Stat art="stat-minutes" value={String(ME.minutes)} label="Min sweating" />
              <Stat art="stat-players" value={String(ME.playersMet)} label="Players met" />
            </div>
            <div className="row gap8">
              <Button variant="on-brand-solid" fill trackId="profile:me:edit">Edit profile</Button>
              <Button variant="on-brand-solid" fill trackId="profile:me:pally-plus">Unlock Pally+</Button>
            </div>
          </div>
        </div>
        <div className="sheet-body stack gap24" style={{ padding: '24px 20px 40px' }}>
          <Segmented items={['About', 'Stats', 'Reputation']} value={tab} onChange={setTab} trackPrefix="profile:me:tab" />

          {tab === 'About' && (
            <>
              <div className="stack gap12">
                <SectionHeader title="Play area" />
                <div className="row gap8"><span className="chip">Barcelona, Spain</span></div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Languages spoken" />
                <div className="row gap8" style={{ flexWrap: 'wrap' }}>{ME.languages.map((l) => <span key={l} className="chip">{l}</span>)}</div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Gender" />
                <div className="row gap8"><span className="chip">{genderLabels[config.hostGender ?? 'woman'] ?? 'Woman'}</span></div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Preferences" />
                <div className="row gap8">
                  <div className="metric"><span className="metric__label">Best hand</span><span className="h6">{ME.hand}</span></div>
                  <div className="metric"><span className="metric__label">Court side</span><span className="h6">{ME.side}</span></div>
                </div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Availability" />
                <div className="stack gap16">
                  {days.map((d, i) => (
                    <div key={i} className="avail-row">
                      <span className={`avail-day ${i === 0 ? '' : 'avail-day--on'}`}>{d}</span>
                      {i === 0 ? (
                        <>
                          <span className="label16 muted">Unavailable</span>
                          <TButton className="avail-btn" aria-label="Add time" trackId={`profile:me:avail:${i}:add`}><Icon name="plus" size={20} /></TButton>
                        </>
                      ) : (
                        <>
                          <span className="avail-range">
                            <TButton className="avail-time" trackId={`profile:me:avail:${i}:from`}>7:00</TButton>
                            <span className="avail-dash" />
                            <TButton className="avail-time" trackId={`profile:me:avail:${i}:to`}>21:00</TButton>
                          </span>
                          <span className="row gap12" style={{ marginLeft: 'auto' }}>
                            <TButton className="avail-btn" aria-label="Remove time" trackId={`profile:me:avail:${i}:remove`}><Icon name="close" size={20} /></TButton>
                            <TButton className="avail-btn" aria-label="Add time" trackId={`profile:me:avail:${i}:add`}><Icon name="plus" size={20} /></TButton>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'Stats' && (
            <>
              <div className="stack gap12">
                <SectionHeader title="Activity" />
                <div className="row gap8" style={{ alignItems: 'stretch' }}>
                  <div className="metric metric--featured">
                    <span className="metric__label">Level</span>
                    <span className="row gap8"><Icon name="level" size={32} /><span className="metric__value" style={{ fontWeight: 500, fontSize: 32, lineHeight: '38px' }}>{HOST.level.toFixed(1)}</span></span>
                    <span style={{ fontSize: 12, lineHeight: '16px' }}>{ME.levelTrend}</span>
                  </div>
                  <div className="metric metric--featured">
                    <span className="row" style={{ justifyContent: 'space-between', gap: 4 }}>
                      <span className="metric__label" style={{ paddingTop: 6 }}>Confidence</span>
                      <span className="badge badge--media">Low</span>
                    </span>
                    <span className="row gap8"><Icon name="pulse" size={32} /><span className="metric__value" style={{ fontWeight: 500, fontSize: 32, lineHeight: '38px' }}>{ME.confidence}%</span></span>
                    <span style={{ fontSize: 12, lineHeight: '16px' }}>Based on 5 matches</span>
                  </div>
                </div>
                <div className="row gap8">
                  <div className="metric"><span className="metric__label">Matches</span><span className="metric__value">{ME.matches}</span></div>
                  <div className="metric"><span className="metric__label">Wins</span><span className="metric__value">{ME.wins}</span></div>
                  <div className="metric"><span className="metric__label">Win rate</span><span className="metric__value">{Math.round((ME.wins / ME.matches) * 100)}%</span></div>
                </div>
              </div>
              <div className="stack gap12">
                <div className="section-header"><p className="h5">Technique</p><OnlyYou /></div>
                <div className="tech-grid">
                  {ME.technique.map(([k, v]) => (
                    <div key={k} className="metric"><span className="metric__label">{k}</span><span className="metric__value">{v.toFixed(1)}<span className="metric__suffix">/10</span></span></div>
                  ))}
                </div>
              </div>
              <div className="stack gap16" style={{ alignItems: 'center' }}>
                <Button variant="secondary" size="lg" trackId="profile:me:upload-video">Upload a new video</Button>
                <TButton className="link" trackId="profile:me:uploads">See my uploads</TButton>
              </div>
            </>
          )}

          {tab === 'Reputation' && (
            <>
              <div className="stack gap12">
                <SectionHeader title="Attendance" info />
                <div className="score-card">
                  <div className="grow stack gap16">
                    <div className="stack gap4">
                      <span className="score-card__value">{ME.attendance}%</span>
                      <span className="score-card__caption">Matches attended on time</span>
                    </div>
                    <div><Badge icon="badge" variant="media">Highly reliable</Badge></div>
                  </div>
                  <ProgressRing value={ME.attendance} />
                </div>
                <div className="row gap8">
                  <div className="metric"><span className="metric__label">Arrived on time</span><span className="metric__value">{ME.arrivedOnTime[0]}<span className="metric__suffix">/{ME.arrivedOnTime[1]}</span></span></div>
                  <div className="metric"><span className="metric__label">Cancelled late</span><span className="metric__value">{ME.cancelledLate[0]}<span className="metric__suffix">/{ME.cancelledLate[1]}</span></span></div>
                </div>
              </div>
              <div className="stack gap12">
                <SectionHeader title="Sportsmanship" info />
                <div className="score-card">
                  <div className="grow stack gap16">
                    <div className="stack gap4">
                      <span className="score-card__value">{ME.sportsmanship}%</span>
                      <span className="score-card__caption">Players would play with you again</span>
                    </div>
                    <div><Badge icon="handshake" variant="media">Great teammate</Badge></div>
                  </div>
                  <Smiley mood="happy" />
                </div>
                <div className="feedback-card">
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span className="metric__label">What players said</span>
                    <OnlyYou />
                  </div>
                  <div className="row gap8" style={{ flexWrap: 'wrap' }}>
                    {ME.feedback.map(([t, n]) => <span key={t} className="feedback-tag">{t} <span className="feedback-tag__n">×{n}</span></span>)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
