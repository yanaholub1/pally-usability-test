import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { ClubCard, EventCard, PromoLink } from '../components/cards'
import { asset } from '../components/assets'
import {
  Badge, BottomBar, Button, Chip, IconButton, InfoRow, NavBar, RadioCard, SectionHeader, Segmented, Sheet, StepHeader, TButton, TitleHeader, BallHero, StatsCard, SummaryCard,
} from '../components/ui'
import { BOOKING_FEE, HOST, clubs, courts, startTimes } from '../data'
import { dayAt, endTime, fmt, genderLabel, levelRange, useApp } from '../state'
import { track } from '../log'

/* ───────────── Find activities (search tab) ───────────── */
export function FindScreen() {
  const { push, back } = useApp()
  const [sheet, setSheet] = useState(true)
  const [choice, setChoice] = useState<'Matches' | 'Lessons' | 'Court' | 'Tournaments'>('Matches')
  return (
    <div className="screen">
      <TitleHeader title="Find activities" onBack={back} />
      <div className="screen__scroll" style={{ padding: '8px 20px 120px' }}>
        <div className="stack gap16">
          <div className="field-group">
            <TButton className="field-group__row" style={{ width: '100%' }} trackId="find:what" onClick={() => setSheet(true)}><Icon name="search" /> {choice === 'Court' ? 'Courts' : choice}</TButton>
            <TButton className="field-group__row" style={{ width: '100%' }} trackId="find:where"><Icon name="location-pin" /> Sant Martí • 5 km</TButton>
          </div>
          <div className="row gap8" style={{ overflow: 'hidden' }}>
            <Chip trackId="find:filters"><Icon name="filter" size={20} /></Chip>
            <Chip trackId="find:day"><Icon name="calendar" size={20} /> Any day &amp; time</Chip>
            <Chip trackId="find:type"><Icon name="racket" size={20} /> Any match type</Chip>
          </div>
          <EventCard
            trackId="find:result1"
            header={{ tone: 'lime', content: <span className="label14 row gap8"><Icon name="badge" size={16} /> Great fit based on your profile</span> }}
            tags={[{ icon: 'venus', label: 'Women' }, { icon: 'racket', label: 'Competitive' }, { icon: 'level', label: '3.0 – 3.4' }]}
            title="Monday, July 15 • 18:30"
            lineup={[{ name: 'Alice', photo: 'alice', level: '3.1' }, { name: 'Iris', photo: 'iris', level: '3.1' }, { name: 'Kate', level: '3.1' }, { available: true }]}
            location="Padel 7"
            action={<Button variant="secondary" icon="plus" trackId="find:result1:join">Join</Button>}
          />
        </div>
      </div>
      <NavBar active="find" />
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Find or start an activity" trackId="find-sheet">
        <div className="stack gap8" role="radiogroup">
          {([['Matches', 'ball'], ['Lessons', 'hat'], ['Court', 'field'], ['Tournaments', 'trophy']] as const).map(([label, icon]) => (
            <RadioCard key={label} title={label} icon={icon} selected={choice === label} onSelect={() => setChoice(label)} trackId={`find-sheet:${label}`} />
          ))}
        </div>
        <div style={{ paddingTop: 24 }}>
          <Button size="lg" trackId="find-sheet:see-results" onClick={() => { setSheet(false); if (choice === 'Court') setTimeout(() => push('bookCourt'), 200) }}>See results</Button>
        </div>
      </Sheet>
    </div>
  )
}

/* ───────────── Book a court ───────────── */
export function BookCourtScreen() {
  const { push, back, setConfig } = useApp()
  return (
    <div className="screen">
      <TitleHeader title="Book a court" onBack={back} />
      <div className="screen__scroll" style={{ padding: '8px 20px 120px' }}>
        <div className="stack gap16">
          <div className="field-group">
            <TButton className="field-group__row" style={{ width: '100%' }} trackId="book:what"><Icon name="field" /> Courts</TButton>
            <TButton className="field-group__row" style={{ width: '100%' }} trackId="book:where"><Icon name="location-pin" /> Sant Martí • 5 km</TButton>
          </div>
          <div className="row gap8" style={{ overflow: 'hidden' }}>
            <Chip trackId="book:filters"><Icon name="filter" size={20} /></Chip>
            <Chip trackId="book:day"><Icon name="calendar" size={20} /> Any day &amp; time</Chip>
            <Chip trackId="book:duration"><Icon name="clock" size={20} /> Any duration</Chip>
          </div>
          {clubs.map((c) => (
            <ClubCard key={c.id} name={c.name} address={c.address} photo={c.photo} trackId={`club-card:${c.id}`} onBook={() => { setConfig({ clubId: c.id, time: null }); push('club') }} />
          ))}
        </div>
      </div>
      <NavBar active="find" />
    </div>
  )
}

/* ───────────── Club page: day, duration, time, court ───────────── */
export function ClubScreen() {
  const { config, setConfig, push, back } = useApp()
  const club = clubs.find((c) => c.id === config.clubId)!
  const photo = asset('clubs', club.photo)
  const [tab, setTab] = useState('Courts')
  return (
    <div className="screen">
      <div className="screen__scroll">
        <div className="hero hero--photo" style={photo ? { backgroundImage: `url(${photo})` } : { backgroundImage: 'linear-gradient(160deg,#6d8fc4,#1d4a9a)' }}>
          <div className="hero__topbar">
            <IconButton icon="chevron-left" label="Back" onClick={back} trackId="back" />
            <div className="hdr__spacer" />
            <IconButton icon="heart" label="Save club" trackId="club:save" />
            <IconButton icon="share" label="Share" trackId="club:share" />
          </div>
        </div>
        <div className="sheet-body stack gap24" style={{ padding: 24, paddingLeft: 20, paddingRight: 20 }}>
          <div className="row gap12">
            <div className="grow stack gap4">
              <p className="h2">{club.name}</p>
              <InfoRow icon="location-pin">{club.area} • {club.distanceKm} km</InfoRow>
            </div>
            <IconButton icon="map" label="Open map" variant="secondary" trackId="club:map" />
          </div>
          <Segmented items={['About', 'Courts', 'Activities']} value={tab} onChange={setTab} trackPrefix="club:tab" />
          <div className="stack gap12">
            <SectionHeader title="Day" />
            <div className="row gap8" style={{ overflowX: 'auto', margin: '0 -20px', padding: '0 20px', scrollbarWidth: 'none' }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = dayAt(i)
                return (
                  <TButton key={i} className={`day-chip ${i === 0 ? 'today' : ''} ${config.dayIndex === i ? 'on' : ''}`} trackId={`club:day:${i}`} onClick={() => setConfig({ dayIndex: i })}>
                    <span style={{ textTransform: 'uppercase' }}>{fmt.weekdayShort(d)}</span>
                    <b>{d.getDate()}</b>
                    <span>{fmt.monthShort(d)}</span>
                  </TButton>
                )
              })}
            </div>
          </div>
          <div className="stack gap12">
            <SectionHeader title="Match duration" />
            <div className="row gap8">
              {([60, 90, 120] as const).map((m) => (
                <Chip key={m} selected={config.duration === m} trackId={`club:duration:${m}`} onClick={() => setConfig({ duration: m })} style={{ flex: 1 }}>{m} min</Chip>
              ))}
            </div>
          </div>
          <div className="stack gap12">
            <SectionHeader title="Start time" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {startTimes.map((t) => (
                <Chip key={t} selected={config.time === t} trackId={`club:time:${t}`} onClick={() => setConfig({ time: t })}>{t}</Chip>
              ))}
            </div>
          </div>
          {config.time && (
            <div className="stack gap12">
              <SectionHeader title={`Courts available at ${config.time}`} />
              <div className="stack gap8" role="radiogroup">
                {courts.map((c) => (
                  <RadioCard
                    key={c.id}
                    title={c.name}
                    desc={c.details}
                    selected={config.courtId === c.id}
                    onSelect={() => setConfig({ courtId: c.id })}
                    trackId={`club:court:${c.id}`}
                    trailing={
                      <span className="rcard__trailing">
                        <span className="h3">€{c.price}</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{config.duration} min</span>
                      </span>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomBar>
        <Button size="lg" disabled={!config.time} trackId="club:continue" onClick={() => push('visibility')}>Continue</Button>
      </BottomBar>
    </div>
  )
}

/* ───────────── Step 1: visibility ───────────── */
export function VisibilityScreen() {
  const { config, setConfig, push, back } = useApp()
  return (
    <div className="screen">
      <StepHeader step={1} onBack={back} />
      <div className="screen__scroll stack gap20" style={{ padding: '8px 20px 24px' }}>
        <p className="h3">Set up match visibility</p>
        <div className="stack gap8" role="radiogroup">
          <RadioCard icon="users" title="Open" desc="Visible to players on the activities search page." selected={config.visibility === 'open'} onSelect={() => setConfig({ visibility: 'open' })} trackId="visibility:open" />
          <RadioCard icon="person-shield" title="Private" desc="Only visible to the people you add. Private match results won’t affect your level." selected={false} disabled onSelect={() => {}} trackId="visibility:private" />
        </div>
      </div>
      <BottomBar><Button size="lg" trackId="visibility:continue" onClick={() => push('matchType')}>Continue</Button></BottomBar>
    </div>
  )
}

/* ───────────── Step 2: match type + level range ───────────── */
function RangeSlider({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = (v: number) => (v / 7) * 100
  const startDrag = (which: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault()
    const el = ref.current!
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect()
      let v = Math.round((((ev.clientX - r.left) / r.width) * 7) * 10) / 10
      v = Math.max(0, Math.min(7, v))
      const next: [number, number] = [...value] as [number, number]
      if (which === 0) next[0] = Math.min(v, value[1] - 0.2)
      else next[1] = Math.max(v, value[0] + 0.2)
      onChange(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      track('slider_change', 'matchType:range')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className="stack gap8">
      <div className="range" ref={ref}>
        <div className="range__dots" />
        <div className="range__sel" style={{ left: `${pct(value[0])}%`, width: `${pct(value[1] - value[0])}%` }} />
        <div className="range__ball" style={{ left: `${pct(HOST.level)}%` }}>{HOST.level.toFixed(2)}</div>
        <div className="range__handle" style={{ left: `${pct(value[0])}%` }} onPointerDown={startDrag(0)} role="slider" aria-label="Minimum level" aria-valuenow={value[0]} />
        <div className="range__handle" style={{ left: `${pct(value[1])}%` }} onPointerDown={startDrag(1)} role="slider" aria-label="Maximum level" aria-valuenow={value[1]} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="label16">0.00</span><span className="label16">7.00</span></div>
    </div>
  )
}

export function MatchTypeScreen() {
  const { config, setConfig, push, back } = useApp()
  const [lo, hi] = levelRange(config, HOST.level)
  const rangeBadge = <Badge icon="level" variant="accent">{lo.toFixed(2)} – {hi.toFixed(2)}</Badge>
  return (
    <div className="screen">
      <StepHeader step={2} onBack={back} />
      <div className="screen__scroll stack gap20" style={{ padding: '8px 20px 24px' }}>
        <p className="h3">Choose match type</p>
        <div className="stack gap8" role="radiogroup">
          <RadioCard
            icon="level" title="Competitive" desc="Results will affect players’ levels"
            selected={config.type === 'competitive'} onSelect={() => setConfig({ type: 'competitive' })} trackId="type:competitive"
            details={
              <div className="stack gap8">
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="h6">Match range level</span>{rangeBadge}</div>
                <p className="body14 muted">Based on your current level. Players outside this range can request to join.</p>
              </div>
            }
          />
          <RadioCard
            icon="handshake" title="Casual" desc="Results won’t affect players’ levels"
            selected={config.type === 'casual'} onSelect={() => setConfig({ type: 'casual' })} trackId="type:casual"
            details={
              <div className="stack gap12">
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="h6">Match range level</span>{rangeBadge}</div>
                <RangeSlider value={config.casualRange} onChange={(v) => setConfig({ casualRange: v })} />
              </div>
            }
          />
        </div>
        <TButton className="link" trackId="type:level-descriptions">See level descriptions <Icon name="level" size={20} /></TButton>
      </div>
      <BottomBar><Button size="lg" trackId="type:continue" onClick={() => push('gender')}>Continue</Button></BottomBar>
    </div>
  )
}

/* ───────────── Step 3: who would you like to play with ───────────── */
export function GenderScreen() {
  const { config, setConfig, push, back } = useApp()
  const [sheet, setSheet] = useState(false)
  const [hostGender, setHostGender] = useState(config.hostGender)
  const options = [['any', 'Any gender'], ['women', 'Women only'], ['men', 'Men only'], ['mixed', 'Mixed']] as const
  return (
    <div className="screen">
      <StepHeader step={3} onBack={back} />
      <div className="screen__scroll stack gap20" style={{ padding: '8px 20px 24px' }}>
        <p className="h3">Who would you like to play with?</p>
        <div className="stack gap8" role="radiogroup">
          {options.map(([k, label]) => (
            <RadioCard key={k} title={label} selected={config.gender === k} onSelect={() => {
              setConfig({ gender: k })
              if ((k === 'women' || k === 'men' || k === 'mixed') && !config.hostGender) setSheet(true)
            }} trackId={`gender:${k}`} />
          ))}
        </div>
      </div>
      <BottomBar><Button size="lg" disabled={!config.gender} trackId="gender:continue" onClick={() => push('approval')}>Continue</Button></BottomBar>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Before you continue" trackId="gender-sheet">
        <div className="stack gap4" style={{ marginBottom: 12 }}>
          <p className="h6">Add your gender</p>
          <p className="body14 muted">We need your gender to set up this match.</p>
        </div>
        <div className="stack gap8" role="radiogroup">
          {([['woman', 'Woman'], ['man', 'Man'], ['nonbinary', 'Non-binary'], ['unsaid', 'Prefer not to say']] as const).map(([k, label]) => (
            <RadioCard key={k} title={label} selected={hostGender === k} onSelect={() => setHostGender(k)} trackId={`gender-sheet:${k}`} />
          ))}
        </div>
        <div style={{ paddingTop: 24 }}>
          <Button size="lg" disabled={!hostGender} trackId="gender-sheet:continue" onClick={() => { setConfig({ hostGender }); setSheet(false) }}>Continue</Button>
        </div>
      </Sheet>
    </div>
  )
}

/* ───────────── Step 4: approval ───────────── */
export function ApprovalScreen() {
  const { config, setConfig, push, back } = useApp()
  return (
    <div className="screen">
      <StepHeader step={4} onBack={back} />
      <div className="screen__scroll stack gap20" style={{ padding: '8px 20px 24px' }}>
        <p className="h3">How should players join<br />the match?</p>
        <div className="stack gap8" role="radiogroup">
          <RadioCard title="Join instantly" desc="Players that meet the requirements are automatically accepted." selected={false} disabled onSelect={() => {}} trackId="approval:instant" />
          <RadioCard title="Require your approval" desc="You’ll review and approve each player before they join." selected={config.approval === 'approve'} onSelect={() => setConfig({ approval: 'approve' })} trackId="approval:approve" />
        </div>
      </div>
      <BottomBar><Button size="lg" trackId="approval:continue" onClick={() => push('review')}>Continue</Button></BottomBar>
    </div>
  )
}

/* ───────────── Step 5: review ───────────── */
export function ReviewScreen() {
  const { config, push, back } = useApp()
  const club = clubs.find((c) => c.id === config.clubId)!
  const court = courts.find((c) => c.id === config.courtId)!
  const d = dayAt(config.dayIndex)
  const [lo, hi] = levelRange(config, HOST.level)
  return (
    <div className="screen">
      <div className="screen__scroll">
        <BallHero onBack={back} />
        <div className="sheet-body stack gap20" style={{ padding: '24px 20px 24px' }}>
          <SummaryCard status="joined" statusLabel="Match review" title="Open match" subtitle="Visible on “Find”" />
          <div className="info-card">
            <InfoRow icon="calendar" trackId="review:edit-time" onClick={() => push('club')}>{fmt.long(d)} • {config.time}–{endTime(config.time ?? '18:30', config.duration)}</InfoRow>
            <InfoRow icon="location-pin" trackId="review:edit-court" onClick={() => push('club')}>{club.name} • {court.name.replace('Court ', 'Court ')} • {court.short}</InfoRow>
            <InfoRow icon="racket" trackId="review:edit-type" onClick={() => push('matchType')}>{config.type === 'competitive' ? 'Competitive • Results affect your level' : 'Casual • Results don’t affect your level'}</InfoRow>
            <InfoRow icon="person-shield" trackId="review:edit-approval" onClick={() => push('approval')}>Your approval is required • You review each player</InfoRow>
          </div>
          <StatsCard items={[['Gender', genderLabel[config.gender ?? 'any']], ['Level', `${lo.toFixed(1)} – ${hi.toFixed(1)}`], ['Court', `€${court.price}`]]} />
          <MoreInfo dayIndex={config.dayIndex} time={config.time ?? '18:30'} />
        </div>
      </div>
      <BottomBar><Button size="lg" trackId="review:continue" onClick={() => push('payment')}>Continue to pay</Button></BottomBar>
    </div>
  )
}

export function MoreInfo({ dayIndex, time }: { dayIndex: number; time: string }) {
  const d = dayAt(dayIndex)
  const prev = dayAt(dayIndex - 1)
  return (
    <div className="stack gap12">
      <SectionHeader title="More info" />
      <div className="info-card">
        <InfoRow icon="hour-glass">Cancels automatically if fewer than 4 players join by <b>{dayIndex === 0 ? 'today' : dayIndex === 1 ? 'tomorrow' : fmt.short(d)} at {endTime(time, -60)}</b></InfoRow>
        <InfoRow icon="calendar-x">Free cancellation by <b>{fmt.short(prev)}, {time}</b></InfoRow>
        <InfoRow icon="calendar-x">Full refund <b>if the club cancels the match</b></InfoRow>
      </div>
    </div>
  )
}

/* ───────────── Step 6: payment ───────────── */
export function PaymentScreen() {
  const { config, setConfig, push, back } = useApp()
  const club = clubs.find((c) => c.id === config.clubId)!
  const court = courts.find((c) => c.id === config.courtId)!
  const share = court.price / 4
  const youPay = config.payMode === 'share' ? share : court.price
  const total = youPay + BOOKING_FEE
  const d = dayAt(config.dayIndex)
  const eur = (n: number) => `€${n % 1 === 0 ? n : n.toFixed(2)}`
  return (
    <div className="screen">
      <TitleHeader title="Payment" onBack={back} />
      <div className="screen__scroll stack gap24" style={{ padding: '8px 20px 24px' }}>
        <div className="stack gap8">
          <InfoRow icon="calendar">{config.dayIndex === 0 ? 'Today' : fmt.short(d)} • {config.time} – {endTime(config.time ?? '18:30', config.duration)}</InfoRow>
          <InfoRow icon="location-pin">{club.name} • {club.address.split(', ')[1]}</InfoRow>
        </div>
        <div className="stack gap12">
          <SectionHeader title="How would you like to pay?" />
          <RadioCard icon="profile" title={`Pay my share • ${eur(share + BOOKING_FEE)}`} desc="Other players will pay their share when they join" selected={config.payMode === 'share'} onSelect={() => setConfig({ payMode: 'share' })} trackId="pay:share" />
          <RadioCard icon="users" title={`Pay the full court price • ${eur(court.price + BOOKING_FEE)}`} desc="Other players can reimburse you separately" selected={config.payMode === 'full'} onSelect={() => setConfig({ payMode: 'full' })} trackId="pay:full" />
        </div>
        <div className="stack gap8">
          <SectionHeader title="Payment method" />
          <TButton className="chip" style={{ justifyContent: 'flex-start', width: '100%', borderRadius: 16, padding: 16, height: 54 }} trackId="pay:method">
            <Icon name="wallet" size={20} /><span className="grow" style={{ fontWeight: 600 }}>Apple Pay</span><Icon name="chevron-down" size={20} />
          </TButton>
        </div>
        <PromoLink />
        <div className="stack gap12">
          <SectionHeader title="Summary" />
          <div className="card stack gap12" style={{ padding: 16, borderRadius: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="body16 muted">Court price</span><span className="label16">{eur(court.price)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="body16 muted">You pay • {config.payMode === 'share' ? 'Your share' : 'Full court'}</span><span className="label16">{eur(youPay)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="body16 muted">Booking fee</span><span className="label16">€{BOOKING_FEE.toFixed(2)}</span></div>
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="h6">Total</span><span className="h6">€{total.toFixed(2)}</span></div>
          </div>
          <p className="body14 muted">This is a prototype: no real payment is made.</p>
        </div>
      </div>
      <BottomBar>
        <Button size="lg" variant="black" trackId="pay:apple-pay" onClick={() => push('booked')}>Pay with Apple Pay</Button>
      </BottomBar>
    </div>
  )
}

/* ───────────── Court booked ───────────── */
export function BookedScreen() {
  const { config, reset, milestone } = useApp()
  const club = clubs.find((c) => c.id === config.clubId)!
  const d = dayAt(config.dayIndex)
  const heart = asset('illustrations', 'booked-heart')
  const bookedBg = asset('illustrations', 'booked-bg')
  const close = () => { milestone('task1_complete'); reset('homeMatch') }
  return (
    <div className="screen">
      <div className="screen__scroll">
        <div className="brand-bg" style={{ position: 'relative', color: '#fff', padding: 'calc(var(--safe-top) + 4px) 20px 72px', minHeight: 330, overflow: 'hidden', ...(bookedBg ? { backgroundImage: `url(${bookedBg})`, backgroundSize: '100% auto', backgroundPosition: 'top center' } : {}) }}>
          <IconButton icon="close" label="Close" onClick={close} trackId="booked:close" />
          <div className="stack" style={{ alignItems: 'center', gap: 8, marginTop: 24, textAlign: 'center' }}>
            {heart ? <img src={heart} width={76} height={66} alt="" /> : <span style={{ fontSize: 0, color: 'var(--lime)' }}><Icon name="heart-filled" size={72} style={{ color: 'var(--lime)' }} /></span>}
            <p className="h2" style={{ marginTop: 8 }}>Court booked</p>
            <p className="body16">Your match is now visible to other players.</p>
          </div>
          {!bookedBg && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, borderTop: '2px solid rgba(255,255,255,.9)' }}>
              <div style={{ position: 'absolute', left: 82, top: 0, bottom: 0, borderLeft: '2px solid rgba(255,255,255,.9)' }} />
            </div>
          )}
        </div>
        <div className="sheet-body stack gap12" style={{ padding: '24px 20px 24px', marginTop: -24 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="h5">Your match</p>
            <span className="status-text"><Icon name="calendar" size={14} /> {config.dayIndex <= 1 ? (config.dayIndex === 0 ? 'Today' : 'Tomorrow') : `In ${config.dayIndex} days`}</span>
          </div>
          <EventCard
            trackId="booked:card"
            tags={[{ icon: 'ball', label: 'Match' }, ...(config.gender && config.gender !== 'any' ? [{ icon: 'venus', label: genderLabel[config.gender] }] : []), { icon: 'racket', label: config.type === 'competitive' ? 'Competitive' : 'Casual' }]}
            title={`${fmt.long(d)} • ${config.time}`}
            lineup={[{ name: HOST.name, photo: HOST.photo, level: HOST.level.toFixed(1), you: true }, { available: true }, { available: true }, { available: true }]}
            location={club.name}
            action={<Button variant="secondary" icon="chat" trackId="booked:message">Message</Button>}
          />
        </div>
      </div>
      <BottomBar><Button size="lg" icon="person-plus" trackId="booked:invite">Invite players</Button></BottomBar>
    </div>
  )
}

