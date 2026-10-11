import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import VideoPlayer from '../components/VideoPlayer';
import MatchCard from '../components/MatchCard';
import { Crest, Empty, SectionHead, StatusPill } from '../components/common';
import { LiveScoreRow } from '../components/rows';
import { SPORT_BY_ID } from '../lib/catalog';
import { clock, dayLabel, isLiveNow, relTime } from '../lib/format';

export default function WatchMatch() {
  const { id } = useParams<{ id: string }>();
  const { catalog, isFavorite, toggleFavorite, notify, loading } = useApp();
  const [tab, setTab] = useState<'live' | 'stats' | 'lineups'>('live');
  const [reminded, setReminded] = useState(false);

  const highlight = catalog.highlights.find((h) => id === `hl-${h.id}`);
  const match = catalog.matches.find((m) => m.id === id);

  useEffect(() => { setReminded(false); }, [id]);

  const related = useMemo(() => {
    if (!match) return catalog.matches.filter((m) => m.sport === highlight?.sport).slice(0, 4);
    return catalog.matches.filter((m) => m.id !== match.id && (m.leagueId === match.leagueId || m.sport === match.sport)).slice(0, 8);
  }, [catalog.matches, match, highlight]);

  if (loading) return <div className="wrap sec"><div className="skel" style={{ aspectRatio: '16/9' }} /></div>;
  if (!match && !highlight) return <div className="wrap sec"><Empty title="Match not found" body="That fixture is not in the current catalogue. It may have been replaced when the feed refreshed." action={<Link className="btn btn-lime" to="/live">Back to live sports</Link>} /></div>;

  const title = match ? `${match.home.name} vs ${match.away.name}` : highlight!.title;
  const meta = SPORT_BY_ID[match?.sport ?? highlight!.sport];
  const playerMatch = match ?? {
    id: highlight!.id, sport: highlight!.sport, leagueId: '', leagueName: highlight!.league, region: 'World',
    home: { id: 'hl', name: highlight!.title, short: 'HL', color: '#c8ff2e' },
    away: { id: 'hl2', name: highlight!.league, short: 'TV', color: '#2d8cff' },
    status: 'finished' as const, kickoff: highlight!.published, durationMin: 12, minute: 0, period: 'Replay',
    homeScore: 0, awayScore: 0, subscores: '', venue: 'MagxTV Studio', channel: 'Highlights',
    premium: false, featured: false, streamPath: highlight!.streamPath, thumb: highlight!.thumb, viewers: highlight!.views
  };

  const live = match ? isLiveNow(match) : false;

  return (
    <div className="wrap wrap-wide sec">
      <nav className="small muted" aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
        <Link to="/">Home</Link> · <Link to={meta.id === 'motorsport' ? '/motorsports' : `/${meta.id}`}>{meta.label}</Link> · <span>{match?.leagueName ?? 'Highlights'}</span>
      </nav>

      <div className="side-layout">
        <div>
          <VideoPlayer match={playerMatch} titleLine={title} />

          <div className="panel pad" style={{ marginTop: 18 }}>
            <div className="row-between" style={{ alignItems: 'flex-start', gap: 18 }}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {match && <StatusPill match={match} />}
                  <span className="pill">{meta.icon} {meta.label}</span>
                  <span className="pill">{match?.leagueName ?? highlight!.league}</span>
                  {match?.premium && <span className="pill pill-lime">Premium</span>}
                  {live && <span className="pill pill-cyan">{match!.viewers} watching</span>}
                </div>
                <h1 style={{ fontSize: 'clamp(22px,2.8vw,34px)' }}>{title}</h1>
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  {dayLabel(playerMatch.kickoff)} {clock(playerMatch.kickoff)} · {playerMatch.venue} · {playerMatch.channel}
                </p>
              </div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button className={`btn ${isFavorite(playerMatch.id) ? 'btn-lime' : ''}`} onClick={() => toggleFavorite(playerMatch.id)}>
                  {isFavorite(playerMatch.id) ? '♥ In favourites' : '♡ Add to favourites'}
                </button>
                <button className="btn" disabled={reminded}
                  onClick={() => { notify({ kind: 'match', title: `Reminder set — ${title}`, body: `Kick-off ${dayLabel(playerMatch.kickoff)} ${clock(playerMatch.kickoff)} · ${playerMatch.leagueName}` }); setReminded(true); }}>
                  {reminded ? '✓ Reminder set' : '🔔 Remind me'}
                </button>
                <button className="btn" onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}>🔗 Copy link</button>
              </div>
            </div>
          </div>

          <div className="panel pad" style={{ marginTop: 18 }}>
            <div className="tabs" style={{ marginBottom: 16 }}>
              <button className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Match centre</button>
              <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Statistics</button>
              <button className={tab === 'lineups' ? 'on' : ''} onClick={() => setTab('lineups')}>{meta.id === 'football' ? 'Line-ups' : 'Entries'}</button>
            </div>

            {tab === 'live' && (
              <div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
                  <div className="kpi"><b className="mono">{match && match.status !== 'upcoming' ? `${match.homeScore}–${match.awayScore}` : clock(playerMatch.kickoff)}</b><small>{match ? (live ? `Live · ${match.minute}’` : match.status === 'finished' ? 'Full time' : 'Kick-off time') : 'Replay'}</small></div>
                  <div className="kpi"><b className="mono">{playerMatch.viewers}</b><small>Viewers on this stream</small></div>
                  <div className="kpi"><b className="mono">{match?.subscores || '—'}</b><small>{match?.period ?? 'Highlight package'}</small></div>
                  <div className="kpi"><b className="mono">{catalog.matches.filter((m) => m.leagueId === match?.leagueId).length}</b><small>Matches in this competition</small></div>
                </div>
                <div className="panel pad" style={{ marginTop: 16, background: 'rgba(255,255,255,.04)' }}>
                  <b>Commentary timeline</b>
                  <ul className="stack" style={{ marginTop: 10 }}>
                    {[
                      `${playerMatch.minute ? playerMatch.minute + '’' : 'Full time'} — ${match && match.status !== 'upcoming' ? `${match.home.short} ${match.homeScore}-${match.awayScore} ${match.away.short}` : 'Coverage build-up underway'}`,
                      `Highlights package available ${relTime(playerMatch.kickoff)}`,
                      'Multi-camera angles: main, tactical and behind the goal',
                      'Adaptive bitrate up to 1080p on this demo source'
                    ].map((line) => (
                      <li key={line} className="row small" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <span className="live-dot" style={{ marginTop: 7 }} />{line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <div className="stack" style={{ gap: 14 }}>
                {[['Possession / control', 54], ['Shots on target', 61], ['Chances created', 47], ['Discipline', 38]].map(([label, value]) => (
                  <div key={String(label)} className="bar-row">
                    <span className="muted">{label}</span>
                    <span className="bar"><i style={{ width: `${value}%` }} /></span>
                    <span className="mono">{value}%</span>
                  </div>
                ))}
                <p className="muted tiny" style={{ marginTop: 10 }}>Demonstration statistics generated by the provider adapter. Connect a live data API to populate these with real values.</p>
              </div>
            )}

            {tab === 'lineups' && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                {[playerMatch.home, playerMatch.away].map((t) => (
                  <div key={t.id} className="panel pad" style={{ background: 'rgba(255,255,255,.04)' }}>
                    <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                      <Crest name={t.name} color={t.color} short={t.short} />
                      <b>{t.name}</b>
                    </div>
                    <ul className="stack">
                      {Array.from({ length: 11 }, (_, i) => (
                        <li key={i} className="row small" style={{ gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                          <span className="mono muted" style={{ width: 20 }}>{i + 1}</span>
                          <span>{`${t.short} Player ${i + 1}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside>
          {match && (
            <div className="panel pad" style={{ marginBottom: 18 }}>
              <b>Head to head</b>
              <div className="score-row" style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <span className="row" style={{ gap: 10 }}><Crest name={match.home.name} color={match.home.color} short={match.home.short} /><span>{match.home.name}</span></span>
                <span className="row" style={{ gap: 10 }}><Crest name={match.away.name} color={match.away.color} short={match.away.short} /><span>{match.away.name}</span></span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12, textAlign: 'center' }}>
                <div><b className="mono">4</b><div className="muted tiny">Wins (H)</div></div>
                <div><b className="mono">2</b><div className="muted tiny">Draws</div></div>
                <div><b className="mono">3</b><div className="muted tiny">Wins (A)</div></div>
              </div>
            </div>
          )}

          <div className="panel pad" style={{ marginBottom: 18 }}>
            <b>Also live</b>
            <div style={{ marginTop: 10 }}>
              {catalog.matches.filter(isLiveNow).slice(0, 3).map((m) => <LiveScoreRow key={m.id} m={m} />)}
              {catalog.matches.filter(isLiveNow).length === 0 && <p className="muted tiny" style={{ margin: 0 }}>Nothing else in play — see upcoming fixtures.</p>}
            </div>
          </div>

          <div className="panel pad">
            <b>Stream licensing</b>
            <p className="muted tiny" style={{ marginTop: 6 }}>
              Playback is restricted to hosts on the stream allow-list. This demo build ships only openly licensed
              test streams (Mux public HLS and Blender Foundation CC-BY titles). Operators point the allow-list at
              their own licensed origin.
            </p>
            <Link className="btn btn-sm btn-ghost btn-block" to="/credits">See credits</Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="sec">
          <SectionHead eyebrow="Up next" title="You may also like" />
          <div className="grid-cards">{related.map((m) => <MatchCard key={m.id} m={m} />)}</div>
        </section>
      )}
    </div>
  );
}
