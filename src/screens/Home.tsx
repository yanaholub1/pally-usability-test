import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { EmptyState, EventCard, PromoBanner } from '../components/cards'
import { Button, IconButton, NavBar, SectionHeader, TButton } from '../components/ui'
import { dayAt, fmt, useApp } from '../state'

export function GreetingHeader({ summary, onSummary }: { summary: string; onSummary?: () => void }) {
  return (
    <div className="hdr-greeting brand-bg">
      <div className="hdr-greeting__row">
        {/* kit: court lines end 9 px above the title, wherever the title sits */}
        <div className="hdr-greeting__courtlines" aria-hidden />
        <p className="h3 hdr-greeting__title">Let’s play padel,<br />Katerine!</p>
        <div className="row gap8">
          <IconButton icon="bell" label="Notifications" trackId="home:notifications" />
          <IconButton icon="settings" label="Settings" trackId="home:settings" />
        </div>
      </div>
      <TButton className="activity-summary" trackId="home:activity-summary" onClick={onSummary}>
        <span className="grow stack">
          <span className="label14">Your activities</span>
          <span className="body14">{summary}</span>
        </span>
        <Icon name="chevron-right" />
      </TButton>
    </div>
  )
}

function FindTiles() {
  const { push } = useApp()
  const tile = (icon: string, label: string, go?: () => void) => (
    <TButton className="tile" trackId={`home:tile:${label}`} onClick={go}>
      <Icon name={icon} />
      <span className="ellipsis">{label}</span>
    </TButton>
  )
  return (
    <div className="stack gap12">
      {/* Figma 2195:38448: "Join a match" finds existing matches; "Create a match" starts by booking a court */}
      <SectionHeader title="Find your next game" />
      <div className="stack gap8">
        <div className="row gap8">{tile('ball', 'Join a match', () => push('find'))}{tile('field', 'Create a match', () => push('bookCourt'))}</div>
        <div className="row gap8">{tile('trophy', 'Tournaments')}{tile('hat', 'Lessons')}</div>
      </div>
    </div>
  )
}

export function LessonCard() {
  return (
    <div className="stack gap12">
      <SectionHeader title="Level up your game" link="See all" />
      <EventCard
        trackId="home:lesson"
        layout="lead"
        tags={[{ icon: 'hat', label: 'Lesson' }, { icon: 'bars', label: '3.0 – 3.5' }]}
        title="Group lesson to refine your technique"
        date={`${fmt.long(dayAt(2))} • 18:30`}
        lineup={[{ name: 'Coach Albert', photo: 'coach', badgeIcon: 'hat' }, { name: 'Iris', photo: 'iris', level: '3.1' }, { name: 'Nora', photo: 'nora', level: '3.4' }, { available: true }, { available: true }]}
        location="Padel 7"
        action={<Button icon="plus" trackId="home:lesson:join">Join</Button>}
      />
    </div>
  )
}

export function HomeScaffold({ summary, top }: { summary: string; top?: ReactNode }) {
  return (
    <div className="screen">
      <div className="screen__scroll">
        <GreetingHeader summary={summary} />
        <div className="sheet-body stack gap32" style={{ padding: '24px 20px 120px' }}>
          {top}
          <FindTiles />
          <PromoBanner />
          <LessonCard />
          <div className="stack gap12">
            <SectionHeader title="Your clubs" />
            <EmptyState illustration="empty-clubs" fallbackIcon="location-pin" title="No clubs saved yet" desc="Save your favorite clubs here for quick access when booking." action="Explore clubs" actionIcon="field" trackId="home:explore-clubs" />
          </div>
          <div className="stack gap12">
            <SectionHeader title="Play together" />
            <EmptyState illustration="empty-friends" fallbackIcon="handshake" title="Add friends" desc="Find people you know to play together." action="Find friends" actionIcon="users" trackId="home:find-friends" />
          </div>
        </div>
      </div>
      <NavBar active="home" />
    </div>
  )
}

export function HomeEmpty() {
  return <HomeScaffold summary="No activities yet" />
}

