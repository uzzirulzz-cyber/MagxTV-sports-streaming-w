import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import MatchCard from '../components/MatchCard';
import { Crest, DemoBadge, Empty, SectionHead, Skeletons } from '../components/common';
import { FixtureRow, StandingsTable } from '../components/rows';
import { SPORT_BY_ID } from '../lib/catalog';
import { dayLabel, isLiveNow } from '../lib/format';
import type { SportId } from '../lib/types';

export default function SportPage({ sport }: { sport: SportId }) {
  const { catalog, loading, status } = useApp();
  const meta = SPORT_BY_ID[sport];
  const leagues = catalog.leagues.filter((l) => l.sport === sport);
  const [league, setLeague] = useState<string>('all');
  const [tab, setTab] = useState<'matches' | 'table' | 'fixtures'>('matches');

  const matches = useMemo(() => catalog.matches.filter((m) => m.sport === sport && (league === 'all' || m.leagueId === league)), [catalog.matches, sport, league]);
  const live = matches.filter(isLiveNow);
  const upcoming = matches.filter((m) => m.status === 'upcoming');
  const played = matches.filter((m) => m.status === 'finished');
  const tableLeague = league !== 'all' ? league : leagues[0]?.id;
  const standings = tableLeague ? catalog.standings[tableLeague] ?? [] : [];
  const days = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    upcoming.forEach((m) => {
      const k = dayLabel(m.kickoff);
      map.set(k, [...(map.get(k) ?? []), m]);
    });
    return [...map.entries()];
  }, [upcoming]);

  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="wrap wrap-wide">
          <div className="hero-grid">
            <div>
              {status.demo && <DemoBadge provider={status.provider} />}
              <h1 style={{ marginTop: 14 }}>{meta.icon} {meta.label}</h1>
              <p className="lead">{meta.tagline}</p>
              <ul className="tick-list">
                <li><i />{live.length} live now</li>
                <li><i />{upcoming.length} upcoming</li>
                <li><i />{leagues.length} competitions</li>
              </ul>
              <div className="hero-cta">
                <Link className="btn btn-lime" to="/live">All live sports</Link>
                <Link className="btn btn-ghost" to="/schedule">Schedule</Link>
              </div>
            </div>
            <div className="hero-art-main" style={{ aspectRatio: '16/10' }}>
              <img src={meta.hero} alt={`${meta.label} action`} />
            </div>
          </div>
        </div>
      </section>

      <div className="wrap wrap-wide sec">
        <div className="panel pad" style={{ marginBottom: 22 }}>
          <div className="row-between">
            <div className="chips-scroll" aria-label="Filter by competition">
              <button className={`chip${league === 'all' ? ' on' : ''}`} onClick={() => setLeague('all')}>All {meta.label}</button>
              {leagues.map((l) => (
                <button key={l.id} className={`chip${league === l.id ? ' on' : ''}`} onClick={() => setLeague(l.id)}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: l.accent, display: 'inline-block' }} />{l.name}
                </button>
              ))}
            </div>
            <div className="tabs">
              {(['matches', 'table', 'fixtures'] as const).map((t) => (
                <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                  {t === 'matches' ? 'Matches' : t === 'table' ? meta.tableTitle : 'Fixtures'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? <Skeletons n={6} /> : tab === 'matches' ? (
          matches.length ? <div className="grid-cards">{matches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            : <Empty title={`No ${meta.label} matches for that competition`} body="Pick another competition from the filter above." />
        ) : tab === 'table' ? (
          <div className="sec" style={{ padding: 0 }}>
            <SectionHead eyebrow="Standings" title={`${leagues.find((l) => l.id === tableLeague)?.name ?? meta.label} — ${meta.tableTitle}`}
              sub={league === 'all' ? 'Showing the first competition in this sport. Choose a competition above to switch tables.' : undefined} />
            {standings.length ? <StandingsTable rows={standings} kind={meta.tableKind} title={meta.tableTitle} /> : <Empty title="Table unavailable" body="This competition has no table in the current data set." />}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', marginTop: 22 }}>
              {played.slice(0, 4).map((m) => (
                <div key={m.id} className="panel pad">
                  <div className="row-between" style={{ marginBottom: 10 }}>
                    <span className="pill">Final</span><span className="muted tiny">{dayLabel(m.kickoff)}</span>
                  </div>
                  <div className="score-row" style={{ display: 'grid', gap: 8 }}>
                    <span className="row" style={{ gap: 10 }}><Crest name={m.home.name} color={m.home.color} short={m.home.short} size="sm" /><span>{m.home.name}</span><b className="mono" style={{ marginLeft: 'auto' }}>{m.homeScore}</b></span>
                    <span className="row" style={{ gap: 10 }}><Crest name={m.away.name} color={m.away.color} short={m.away.short} size="sm" /><span>{m.away.name}</span><b className="mono" style={{ marginLeft: 'auto' }}>{m.awayScore}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          upcoming.length ? days.map(([day, list]) => (
            <div key={day} className="panel pad" style={{ marginBottom: 16 }}>
              <SectionHead title={day} sub={`${list.length} fixture${list.length > 1 ? 's' : ''}`} />
              {list.map((m) => <FixtureRow key={m.id} m={m} />)}
            </div>
          )) : <Empty title="No fixtures scheduled" body="Nothing is lined up for this competition in the current data set." />
        )}
      </div>
    </>
  );
}
