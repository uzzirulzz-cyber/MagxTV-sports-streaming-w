import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { SPORTS, SPORT_BY_ID } from '../lib/catalog';
import { IMG } from '../lib/images';
import MatchCard from '../components/MatchCard';
import { DemoBadge, ErrorState, SectionHead, Skeletons } from '../components/common';
import { FixtureRow, HighlightCard, LiveScoreRow, NewsList, SportTile } from '../components/rows';
import { isLiveNow, countdown } from '../lib/format';

const FEATURES = [
  { icon: '📡', t: 'Live every night', s: 'Multi-camera match feeds' },
  { icon: '🏆', t: '18 competitions', s: 'Football to motorsport' },
  { icon: '⚡', t: 'Low-latency HLS', s: 'Adaptive up to 4K' },
  { icon: '📱', t: 'Any screen', s: 'TV, laptop, tablet, phone' }
];

export default function Home() {
  const { catalog, loading, error, refresh, status, favorites, isFavorite, toggleFavorite } = useApp();
  const live = catalog.matches.filter(isLiveNow);
  const upcoming = catalog.matches.filter((m) => m.status === 'upcoming').slice(0, 6);
  const featured = catalog.matches.filter((m) => m.featured).slice(0, 8);
  const hero = live[0] ?? upcoming[0];
  const heroSport = hero ? SPORT_BY_ID[hero.sport] : null;

  if (error && !catalog.matches.length) return <div className="wrap sec"><ErrorState message={error} onRetry={() => void refresh()} /></div>;

  return (
    <>
      <section className="hero">
        <div className="wrap wrap-wide">
          <div className="hero-grid">
            <div className="fade-up">
              {status.demo && <DemoBadge provider={status.provider} />}
              <h1>Live Sports Broadcast &amp; Match Coverage</h1>
              <p className="lead">
                Stream every match night with live scores, fixtures and highlights in one place — football, cricket,
                basketball, tennis and motorsport on any screen you own.
              </p>
              <ul className="tick-list">
                <li><i />{live.length} matches live right now</li>
                <li><i />{catalog.leagues.length} competitions tracked</li>
                <li><i />Up to 4K multi-camera</li>
              </ul>
              <div className="hero-cta">
                <Link className="btn btn-lg btn-lime" to={hero ? `/watch/${hero.id}` : '/live'}>
                  {hero ? <>▶ Watch now — {hero.home.short} vs {hero.away.short}</> : '▶ Go to live sports'}
                </Link>
                <Link className="btn btn-lg btn-ghost" to="/schedule">Browse full schedule</Link>
              </div>
              <div className="feat">
                {FEATURES.map((f) => (
                  <div key={f.t}>
                    <span className="fbox" aria-hidden="true">{f.icon}</span>
                    <b>{f.t}</b><small>{f.s}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-art">
              <div className="hero-art-main">
                <img src={hero?.thumb ?? IMG.footballHero} alt={hero ? `${hero.home.name} versus ${hero.away.name}` : 'Floodlit stadium at night'} />
              </div>
              <div className="float-card float-up">
                <div style={{ padding: 12 }}>
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <b className="small">Next up</b>
                    {heroSport && <span className="pill pill-cyan">{heroSport.icon} {heroSport.label}</span>}
                  </div>
                  {upcoming.slice(0, 2).map((m) => (
                    <div key={m.id} className="stack" style={{ gap: 6, marginBottom: 8 }}>
                      <span className="tiny" style={{ fontWeight: 600 }}>{m.home.short} vs {m.away.short}</span>
                      <span className="tiny muted">{countdown(m.kickoff) || 'Starting'} · {m.leagueName}</span>
                    </div>
                  ))}
                  <Link className="btn btn-sm btn-lime btn-block" to="/schedule">Full schedule</Link>
                </div>
              </div>
              <div className="float-card float-live">
                <div style={{ padding: 14 }}>
                  <div className="row-between" style={{ marginBottom: 10 }}>
                    <span className="row" style={{ gap: 7 }}><span className="live-dot" /><b className="small">Live now</b></span>
                    <Link className="tiny" to="/live" style={{ color: 'var(--lime)' }}>See all →</Link>
                  </div>
                  {loading && live.length === 0 ? <div className="skel" style={{ height: 92 }} /> : (
                    live.slice(0, 2).map((m) => <LiveScoreRow key={m.id} m={m} />)
                  )}
                  {live.length === 0 && !loading && <p className="muted tiny" style={{ margin: 0 }}>No live matches at this moment — the next kick-off is listed in the schedule.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap wrap-wide">
          <SectionHead eyebrow="Popular sports" title="Pick your sport"
            sub="Focused hubs with live matches, tables and fixtures for each discipline."
            action={<Link className="btn btn-ghost" to="/live">All live sports</Link>} />
          <div className="grid-6">
            {SPORTS.map((s) => (
              <SportTile key={s.id} id={s.id} label={s.label} icon={s.icon}
                href={s.id === 'motorsport' ? '/motorsports' : `/${s.id}`}
                count={catalog.matches.filter((m) => m.sport === s.id).length} />
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap wrap-wide">
          <SectionHead eyebrow="Broadcasting now" title="Live sports"
            sub="Scores update as the demo catalogue ticks over — every card opens the match page."
            action={<Link className="btn btn-ghost" to="/live">Open live hub</Link>} />
          {loading ? <Skeletons n={4} /> : live.length ? (
            <div className="grid-cards">{live.slice(0, 8).map((m) => <MatchCard key={m.id} m={m} />)}</div>
          ) : (
            <div className="panel pad"><p className="muted" style={{ margin: 0 }}>Nothing is live right now. The fixtures below start soon.</p></div>
          )}
        </div>
      </section>

      <section className="sec">
        <div className="wrap wrap-wide">
          <div className="side-layout">
            <div>
              <SectionHead eyebrow="Featured" title="Big matches this week"
                action={<Link className="btn btn-ghost" to="/football">Football hub</Link>} />
              {loading ? <Skeletons n={4} /> : (
                <div className="grid-cards">{featured.map((m) => <MatchCard key={m.id} m={m} />)}</div>
              )}

              <div className="sec" style={{ paddingBottom: 0 }}>
                <SectionHead eyebrow="Fixtures" title="Upcoming broadcasts"
                  action={<Link className="btn btn-ghost" to="/schedule">Full schedule</Link>} />
                <div className="panel pad">
                  {upcoming.map((m) => <FixtureRow key={m.id} m={m} />)}
                </div>
              </div>

              <div className="sec" style={{ paddingBottom: 0 }}>
                <SectionHead eyebrow="Watch again" title="Latest highlights"
                  action={<Link className="btn btn-ghost" to="/highlights">All highlights</Link>} />
                <div className="grid-cards">{catalog.highlights.slice(0, 4).map((h) => <HighlightCard key={h.id} h={h} />)}</div>
              </div>
            </div>

            <aside>
              <div className="panel pad" style={{ marginBottom: 20 }}>
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <b>Sports news</b><span className="pill pill-lime">Desk</span>
                </div>
                <NewsList items={catalog.news.slice(0, 6)} />
              </div>

              <div className="panel pad" style={{ marginBottom: 20 }}>
                <b>Your favourites</b>
                <p className="muted tiny" style={{ marginTop: 6 }}>
                  {favorites.length ? `${favorites.length} saved. Tap the heart on any match to manage the list.` : 'Nothing saved yet. Tap the heart on a match card or in the player.'}
                </p>
                <div className="stack" style={{ gap: 8 }}>
                  {catalog.matches.filter((m) => favorites.includes(m.id)).slice(0, 3).map((m) => (
                    <div key={m.id} className="row-between panel" style={{ padding: '10px 12px', background: 'rgba(255,255,255,.05)' }}>
                      <span className="small">{m.home.short} vs {m.away.short}</span>
                      <button className="btn btn-sm btn-ghost" onClick={() => toggleFavorite(m.id)}>
                        {isFavorite(m.id) ? '♥' : '♡'}
                      </button>
                    </div>
                  ))}
                  <Link className="btn btn-sm btn-lime btn-block" to="/favorites">Manage favourites</Link>
                </div>
              </div>

              <div className="panel pad">
                <b>Watch on every screen</b>
                <p className="muted tiny" style={{ marginTop: 6 }}>Smart TV · Android · iPhone &amp; iPad · Windows &amp; Mac · Fire TV · Web</p>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {['📺', '📱', '💻', '🔥'].map((i) => <span key={i} className="pill" style={{ height: 34, fontSize: 16 }}>{i}</span>)}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
